import { OpenAIResponse, OpenAIChoice, OpenAIMessage, ToolCall, OpenAIUsage, OpenAIRequest } from "../types/openai.ts";
import { GeminiResponse, GeminiCandidate } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

export function transformGeminiResponseToOpenAI(
  geminiResponse: GeminiResponse,
  openaiRequest: OpenAIRequest,
  requestId: string
): OpenAIResponse {
  // 检查思考模式设置
  const enableThinking = openaiRequest.enable_thinking !== false;
  const choices: OpenAIChoice[] = [];

  if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
    for (let i = 0; i < geminiResponse.candidates.length; i++) {
      const candidate = geminiResponse.candidates[i];
      const choice = transformCandidateToChoice(candidate, i, enableThinking);
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

function transformCandidateToChoice(candidate: GeminiCandidate, index: number, enableThinking = true): OpenAIChoice {
  let combinedContent = "";
  const toolCalls: ToolCall[] = [];

  if (candidate.content && candidate.content.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        combinedContent += part.text;
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

  // 检查是否包含思考内容
  const hasThinkingContent = finalContent.includes('<think>') && finalContent.includes('</think>');

  if (hasThinkingContent) {
    logger.debug("检测到思考模型响应，处理思考内容");

    if (!enableThinking) {
      // 如果禁用思考，只返回思考标签后的内容
      const thinkEndIndex = finalContent.lastIndexOf('</think>');
      if (thinkEndIndex !== -1) {
        const afterThink = finalContent.substring(thinkEndIndex + 8).trim();
        if (afterThink) {
          finalContent = afterThink;
          logger.debug("已移除思考内容，只保留最终回答");
        } else {
          // 如果思考标签后没有内容，提取思考内容作为回答
          const thinkMatch = finalContent.match(/<think>(.*?)<\/think>/s);
          if (thinkMatch) {
            finalContent = thinkMatch[1].trim();
            logger.debug("思考标签后无内容，使用思考内容作为回答");
          }
        }
      }
    } else {
      // 启用思考时，保持原始格式
      logger.debug("保持思考内容的完整格式");
    }
  }

  // 确保内容不为空，避免应用端处理 null 值时出错
  if (toolCalls.length === 0 && (!finalContent || finalContent.trim() === "")) {
    logger.warn("Gemini响应内容为空，提供默认内容");
    if (enableThinking && hasThinkingContent) {
      finalContent = "<think>\n用户的请求需要我思考，但我暂时无法生成完整的思考过程。\n</think>\n\n抱歉，我暂时无法生成回复。请稍后再试。";
    } else {
      finalContent = "抱歉，我暂时无法生成回复。请稍后再试。";
    }
  }

  const message: OpenAIMessage = {
    role: "assistant",
    content: toolCalls.length > 0 ? null : finalContent,
  };

  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    index: index,
    message: message,
    finish_reason: mapFinishReasonToOpenAI(candidate.finishReason),
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
