import { OpenAIRequest, OpenAIMessage, OpenAITool } from "../types/openai.ts";
import { GeminiRequest, GeminiContent, GeminiPart, GeminiTool, GeminiFunctionDeclaration, GeminiToolConfig } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

export function transformOpenAIRequestToGemini(
  openaiRequest: OpenAIRequest,
  _geminiModelId: string
): GeminiRequest {
  const contents: GeminiContent[] = [];
  let systemInstruction: GeminiContent | undefined = undefined;

  // 处理消息
  for (const msg of openaiRequest.messages) {
    if (msg.role === "system") {
      // 将系统消息作为系统指令处理
      if (typeof msg.content === "string") {
        systemInstruction = {
          role: "user", // 系统指令在Gemini中使用user角色
          parts: [{ text: msg.content }]
        };
      }
      continue;
    }

    const parts: GeminiPart[] = [];

    if (typeof msg.content === "string") {
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
    } else if (Array.isArray(msg.content)) {
      // 处理多模态内容
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === "image_url" && part.image_url?.url) {
          const imageUrl = part.image_url.url;

          // 优先处理 data URI 格式（最稳定）
          if (imageUrl.startsWith("data:")) {
            logger.info("🖼️ 检测到data URI格式图像");
            try {
              const inlineDataPart = convertDataUriToInlineData(imageUrl);
              if (inlineDataPart) {
                parts.push(inlineDataPart);
                const mimeType = inlineDataPart.inlineData?.mimeType || '未知';
                const sizeKB = Math.round(imageUrl.length * 0.75 / 1024);
                logger.info(`✅ 成功处理data URI图像 (${mimeType}, ~${sizeKB}KB)`);
              } else {
                logger.warn("❌ data URI格式错误");
                parts.push({ text: `[data URI格式错误]` });
              }
            } catch (error) {
              logger.warn("❌ data URI处理失败:", (error as Error).message);
              parts.push({ text: `[data URI处理失败]` });
            }
          } else {
            // 对于远程URL，直接跳过并提示用户
            const urlPreview = imageUrl.length > 50 ? imageUrl.slice(0, 50) + '...' : imageUrl;
            logger.warn(`⏭️ 跳过远程图像URL: ${urlPreview}`);
            parts.push({ text: `[请将图像转换为data:URI格式。远程图像URL在当前网络环境下不稳定，建议使用: deno task convert:image ${imageUrl}]` });
          }
        }
      }
    }

    // 处理助手消息中的工具调用
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const toolCall of msg.tool_calls) {
        if (toolCall.type === "function") {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            parts.push({
              functionCall: {
                name: toolCall.function.name,
                args: args
              }
            });
          } catch (error) {
            logger.error("解析工具调用参数失败:", error);
          }
        }
      }
    }

    // 处理工具响应
    if (msg.role === "tool" && msg.tool_call_id && msg.content) {
      // 对于工具响应，我们需要找到对应的函数名称
      // 这是一个简化的方法 - 在实际实现中，您可能需要跟踪这个
      parts.push({
        functionResponse: {
          name: "unknown_function", // 这应该从之前的工具调用中跟踪
          response: { content: msg.content }
        }
      });
    }

    if (parts.length > 0) {
      contents.push({
        role: mapRoleToGemini(msg.role),
        parts: parts
      });
    }
  }

  const geminiRequest: GeminiRequest = {
    contents: contents
  };

  // 如果存在系统指令则添加
  if (systemInstruction) {
    geminiRequest.systemInstruction = systemInstruction;
  }

  // 转换工具
  if (openaiRequest.tools && openaiRequest.tools.length > 0) {
    geminiRequest.tools = transformTools(openaiRequest.tools);

    // 将tool_choice转换为toolConfig
    if (openaiRequest.tool_choice) {
      geminiRequest.toolConfig = transformToolChoice(openaiRequest.tool_choice, openaiRequest.tools);
    }
  }

  // 转换生成配置
  geminiRequest.generationConfig = {};

  if (openaiRequest.temperature !== undefined) {
    geminiRequest.generationConfig.temperature = openaiRequest.temperature;
  }

  if (openaiRequest.top_p !== undefined) {
    geminiRequest.generationConfig.topP = openaiRequest.top_p;
  }

  if (openaiRequest.max_tokens !== undefined) {
    geminiRequest.generationConfig.maxOutputTokens = openaiRequest.max_tokens;
  }

  if (openaiRequest.stop) {
    const stopSequences = Array.isArray(openaiRequest.stop) ? openaiRequest.stop : [openaiRequest.stop];
    geminiRequest.generationConfig.stopSequences = stopSequences;
  }

  // 处理响应格式
  if (openaiRequest.response_format?.type === "json_object") {
    geminiRequest.generationConfig.responseMimeType = "application/json";
  }

  return geminiRequest;
}

function mapRoleToGemini(role: OpenAIMessage["role"]): GeminiContent["role"] {
  switch (role) {
    case "assistant":
      return "model";
    case "user":
    case "tool":
      return "user";
    default:
      return "user";
  }
}

function transformTools(openaiTools: OpenAITool[]): GeminiTool[] {
  const functionDeclarations: GeminiFunctionDeclaration[] = openaiTools
    .filter(tool => tool.type === "function")
    .map(tool => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters as GeminiFunctionDeclaration["parameters"]
    }));

  return [{
    functionDeclarations: functionDeclarations
  }];
}

function transformToolChoice(
  toolChoice: OpenAIRequest["tool_choice"],
  _tools: OpenAITool[]
): GeminiToolConfig {
  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "none":
        return {
          functionCallingConfig: {
            mode: "NONE"
          }
        };
      case "auto":
        return {
          functionCallingConfig: {
            mode: "AUTO"
          }
        };
      case "required":
        return {
          functionCallingConfig: {
            mode: "ANY"
          }
        };
      default:
        return {
          functionCallingConfig: {
            mode: "AUTO"
          }
        };
    }
  } else if (toolChoice && typeof toolChoice === "object" && toolChoice.type === "function") {
    // Specific function requested
    return {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [toolChoice.function.name]
      }
    };
  }

  return {
    functionCallingConfig: {
      mode: "AUTO"
    }
  };
}

// 简化的data URI处理函数
function convertDataUriToInlineData(dataUri: string): GeminiPart | null {
  try {
    // 验证data URI格式
    if (!dataUri.startsWith("data:")) {
      throw new Error("不是有效的data URI");
    }

    const [header, base64Data] = dataUri.split(',');
    if (!base64Data) {
      throw new Error("data URI缺少base64数据");
    }

    // 解析MIME类型
    const mimeTypeMatch = header.match(/^data:([^;]+)/);
    if (!mimeTypeMatch || !mimeTypeMatch[1]) {
      throw new Error("无法解析MIME类型");
    }

    const mimeType = mimeTypeMatch[1];

    // 验证是否为图像类型
    if (!mimeType.startsWith("image/")) {
      throw new Error(`不是图像类型: ${mimeType}`);
    }

    // 验证base64数据
    try {
      // 简单验证base64格式
      atob(base64Data);
    } catch {
      throw new Error("无效的base64数据");
    }

    return {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    };
  } catch (error) {
    logger.error("data URI处理失败:", (error as Error).message);
    return null;
  }
}
