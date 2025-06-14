import { OpenAIResponse, OpenAIChoice, OpenAIMessage, ToolCall, OpenAIUsage, OpenAIRequest } from "../types/openai.ts";
import { GeminiResponse, GeminiCandidate, GeminiPart } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

export function transformGeminiResponseToOpenAI(
  geminiResponse: GeminiResponse,
  openaiRequest: OpenAIRequest,
  requestId: string
): OpenAIResponse {
  const choices: OpenAIChoice[] = [];

  if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
    for (let i = 0; i < geminiResponse.candidates.length; i++) {
      const candidate = geminiResponse.candidates[i];
      const choice = transformCandidateToChoice(candidate, i, geminiResponse);
      choices.push(choice);
    }
  } else {
    // 如果没有候选项，创建一个空选择
    choices.push({
      index: 0,
      message: {
        role: "assistant",
        content: "",
      },
      finish_reason: "stop",
    });
  }

  const usage: OpenAIUsage = {
    prompt_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
    completion_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
    total_tokens: geminiResponse.usageMetadata?.totalTokenCount || 0,
  };

  return {
    id: requestId,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: openaiRequest.model,
    choices: choices,
    usage: usage,
  };
}

function transformCandidateToChoice(candidate: GeminiCandidate, index: number, geminiResponse?: GeminiResponse): OpenAIChoice {
  let combinedContent = "";
  let thinkingContent = "";
  const toolCalls: ToolCall[] = [];

  if (candidate.content && candidate.content.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        // 检查是否是思考内容（根据官方文档）
        if ((part as GeminiPart & { thought?: boolean }).thought === true) {
          thinkingContent += part.text;
        } else {
          combinedContent += part.text;
        }
      } else if (part.functionCall) {
        toolCalls.push({
          id: `call_${crypto.randomUUID()}`,
          type: "function",
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }
  }

  // 处理思考模型的特殊响应格式
  let finalContent = combinedContent;

  // 如果有思考内容，按照标准格式组合
  if (thinkingContent.trim()) {
    logger.debug(`检测到思考内容: ${thinkingContent.length} 字符`);
    finalContent = `<think>\n${thinkingContent}\n</think>\n\n${combinedContent}`;
  }

  // 检查是否为思考模型（包含思考内容或 <think> 标签）
  const isThinkingModel = thinkingContent.trim() || finalContent.includes('<think>') || finalContent.includes('</think>');

  if (isThinkingModel) {
    logger.debug("检测到思考模型响应");
  }

  // 确保内容不为空，避免应用端处理 null 值时出错
  if (toolCalls.length === 0 && (!finalContent || finalContent.trim() === "")) {
    // 获取完成原因以提供更具体的错误信息
    const finishReason = geminiResponse?.candidates?.[0]?.finishReason || candidate.finishReason || "UNKNOWN";
    logger.warn(`Gemini响应内容为空，完成原因: ${finishReason}`);

    // 详细记录候选者信息用于调试
    logger.debug(`候选者详情: ${JSON.stringify({
      finishReason: candidate.finishReason,
      safetyRatings: candidate.safetyRatings,
      contentLength: candidate.content?.parts?.[0]?.text?.length || 0
    })}`);

    // 根据完成原因提供不同的错误信息
    let errorMessage = "";
    switch (finishReason) {
      case "SAFETY":
        errorMessage = "抱歉，您的请求可能包含不当内容，无法生成回复。请尝试修改您的问题。";
        logger.warn("内容被安全过滤器拦截");
        break;
      case "RECITATION":
        errorMessage = "抱歉，无法生成可能涉及版权的内容。请尝试其他问题。";
        logger.warn("内容涉及版权问题");
        break;
      case "MAX_TOKENS":
        errorMessage = "抱歉，回答内容过长被截断。请尝试简化您的问题。";
        logger.warn("达到最大token限制");
        break;
      case "OTHER":
        errorMessage = "抱歉，由于技术原因暂时无法生成回复。请稍后再试。";
        logger.warn("其他原因导致无法生成内容");
        break;
      default:
        errorMessage = "抱歉，我暂时无法生成回复。请稍后再试。";
        logger.warn(`未知完成原因: ${finishReason}`);
    }

    if (isThinkingModel) {
      finalContent = `<think>\n用户的请求需要我思考，但由于${finishReason}原因无法生成完整回复。\n</think>\n\n${errorMessage}`;
    } else {
      finalContent = errorMessage;
    }
  }

  const message: OpenAIMessage = {
    role: "assistant",
    content: toolCalls.length > 0 ? null : finalContent,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  // 如果有工具调用，finish_reason应该是tool_calls
  let finishReason = mapFinishReasonToOpenAI(candidate.finishReason);
  if (toolCalls.length > 0) {
    finishReason = "tool_calls";
    logger.debug(`检测到工具调用，设置finish_reason为tool_calls`);
  }

  return {
    index: index,
    message: message,
    finish_reason: finishReason,
  };
}

function mapFinishReasonToOpenAI(
  geminiReason?: GeminiCandidate["finishReason"]
): OpenAIChoice["finish_reason"] {
  if (!geminiReason) return "stop";

  switch (geminiReason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "content_filter";
    case "MALFORMED_FUNCTION_CALL":
      return "tool_calls";
    case "OTHER":
    default:
      return "stop";
  }
}

// 处理来自Gemini API的错误
export function transformGeminiErrorToOpenAI(error: unknown, _requestId: string) {
  let message = "发生了错误";
  let type = "api_error";
  let code = "unknown_error";

  const errorObj = error as { error?: { message?: string; status?: string; code?: number }; message?: string };

  if (errorObj.error) {
    message = errorObj.error.message || message;
    code = errorObj.error.status || code;

    // 将常见的Gemini错误代码映射到类似OpenAI的类型
    switch (errorObj.error.code) {
      case 400:
        type = "invalid_request_error";
        break;
      case 401:
        type = "authentication_error";
        break;
      case 403:
        type = "permission_error";
        break;
      case 429:
        type = "rate_limit_error";
        break;
      case 500:
      case 502:
      case 503:
        type = "api_error";
        break;
      default:
        type = "api_error";
    }
  } else if (typeof error === "string") {
    message = error;
  } else if (errorObj.message) {
    message = errorObj.message;
  }

  return {
    error: {
      message: message,
      type: type,
      code: code,
    },
  };
}
