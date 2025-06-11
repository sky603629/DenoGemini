import { OpenAIResponse, OpenAIChoice, OpenAIMessage, ToolCall, OpenAIUsage, OpenAIRequest } from "../types/openai.ts";
import { GeminiResponse, GeminiCandidate } from "../types/gemini.ts";

export function transformGeminiResponseToOpenAI(
  geminiResponse: GeminiResponse,
  openaiRequest: OpenAIRequest,
  requestId: string
): OpenAIResponse {
  const choices: OpenAIChoice[] = [];

  if (geminiResponse.candidates && geminiResponse.candidates.length > 0) {
    for (let i = 0; i < geminiResponse.candidates.length; i++) {
      const candidate = geminiResponse.candidates[i];
      const choice = transformCandidateToChoice(candidate, i);
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

function transformCandidateToChoice(candidate: GeminiCandidate, index: number): OpenAIChoice {
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

  const message: OpenAIMessage = {
    role: "assistant",
    content: toolCalls.length > 0 ? null : combinedContent || null,
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
