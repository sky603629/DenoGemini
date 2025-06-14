import { OpenAIRequest, OpenAIMessage, OpenAITool } from "../types/openai.ts";
import { GeminiRequest, GeminiContent, GeminiPart, GeminiTool, GeminiFunctionDeclaration, GeminiToolConfig } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

// 智能检测是否为JSON请求
function isJsonContentRequest(messages: OpenAIMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || typeof lastMessage.content !== "string") {
    return false;
  }

  const content = lastMessage.content.toLowerCase();

  // 检测JSON相关关键词
  const jsonKeywords = [
    "json格式",
    "json对象",
    "返回json",
    "输出json",
    "以json",
    "用json",
    "json回答",
    "json响应",
    '"nickname"',
    '"reason"',
    '{"',
    '}',
    "请用json",
    "json格式回答",
    "json格式输出"
  ];

  return jsonKeywords.some(keyword => content.includes(keyword));
}

export function transformOpenAIRequestToGemini(
  openaiRequest: OpenAIRequest,
  _geminiModelId: string
): GeminiRequest {
  const contents: GeminiContent[] = [];
  let userSystemContent = "";

  // 处理消息
  for (const msg of openaiRequest.messages) {
    if (msg.role === "system") {
      // 收集系统消息内容
      if (typeof msg.content === "string") {
        userSystemContent += (userSystemContent ? "\n" : "") + msg.content;
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

  // 创建自然输出提示词（仅在非JSON格式时应用）
  let finalSystemContent = userSystemContent;

  // 智能检测JSON请求
  const isJsonRequest = openaiRequest.response_format?.type === "json_object" ||
                       isJsonContentRequest(openaiRequest.messages);

  if (!isJsonRequest) {
    const naturalOutputPrompt = `请用自然、连贯的语言回复，严格禁止使用以下格式：
- 禁止使用星号 * 和 ** 进行任何格式化
- 禁止使用项目符号（• * - 1. 2. 等）
- 禁止使用粗体、斜体等markdown格式
- 禁止使用过多的分段和换行
- 禁止使用列表和表格格式

请用完全自然的对话语言，就像面对面聊天一样，用连贯的句子表达，不要使用任何格式化符号。`;

    // 合并系统指令
    finalSystemContent = userSystemContent ?
      `${userSystemContent}\n\n${naturalOutputPrompt}` :
      naturalOutputPrompt;
  } else {
    // JSON请求时，添加JSON专用指令
    const jsonPrompt = `请返回严格符合JSON语法的有效JSON格式。确保：
- 所有字符串都用双引号包围
- 属性名用双引号包围
- 不要有多余的引号或转义字符
- 确保JSON语法完全正确
- 不要添加任何解释文字，只返回纯JSON`;

    finalSystemContent = userSystemContent ?
      `${userSystemContent}\n\n${jsonPrompt}` :
      jsonPrompt;

    logger.debug("检测到JSON格式请求，应用JSON专用提示词");
  }

  const geminiRequest: GeminiRequest = {
    contents: contents
  };

  // 只有在有系统指令内容时才添加
  if (finalSystemContent && finalSystemContent.trim()) {
    geminiRequest.systemInstruction = {
      role: "user",
      parts: [{ text: finalSystemContent }]
    };
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
    // 直接使用用户指定的值，不做任何调整
    geminiRequest.generationConfig.maxOutputTokens = openaiRequest.max_tokens;
    logger.debug(`使用用户指定的 maxOutputTokens: ${openaiRequest.max_tokens}`);
  } else {
    // 未指定时使用最大值，不做任何限制
    const isThinkingModel = openaiRequest.model.includes("2.5");

    if (isThinkingModel) {
      // 2.5 模型使用最大限制 (65536)
      geminiRequest.generationConfig.maxOutputTokens = 65536;
      logger.debug("2.5 模型设置最大 maxOutputTokens: 65536");
    } else {
      // 1.5 模型使用最大限制 (8192)
      geminiRequest.generationConfig.maxOutputTokens = 8192;
      logger.debug("1.5 模型设置最大 maxOutputTokens: 8192");
    }
  }

  if (openaiRequest.stop) {
    const stopSequences = Array.isArray(openaiRequest.stop) ? openaiRequest.stop : [openaiRequest.stop];
    geminiRequest.generationConfig.stopSequences = stopSequences;
  }

  // 处理响应格式
  if (openaiRequest.response_format?.type === "json_object" || isJsonRequest) {
    geminiRequest.generationConfig.responseMimeType = "application/json";
    if (isJsonRequest && !openaiRequest.response_format) {
      logger.debug("智能检测到JSON请求，自动设置JSON响应格式");
    }
  }

  // 处理 Gemini 2.5 思考模式配置
  const isThinkingModel = openaiRequest.model.includes("2.5");
  if (isThinkingModel) {
    const enableThinking = (openaiRequest as OpenAIRequest & { enable_thinking?: boolean }).enable_thinking;

    // 根据官方文档正确设置思考预算
    if (enableThinking === true) {
      // 明确启用思考模式
      geminiRequest.generationConfig.thinkingConfig = {
        includeThoughts: true
        // 不设置 thinkingBudget，让模型自动决定
      };
      logger.info(`🧠 思考模式: 启用 (includeThoughts=true, thinkingBudget=auto)`);
    } else {
      // 默认或明确禁用思考模式 - 设置预算为0
      geminiRequest.generationConfig.thinkingConfig = {
        includeThoughts: false,
        thinkingBudget: 0  // 0 = 完全禁用思考功能
      };
      logger.info(`🧠 思考模式: 禁用 (thinkingBudget=0)`);
    }
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
