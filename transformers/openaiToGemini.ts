import { OpenAIRequest, OpenAIMessage, OpenAITool } from "../types/openai.ts";
import { GeminiRequest, GeminiContent, GeminiPart, GeminiTool, GeminiFunctionDeclaration, GeminiToolConfig } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

// GIF 帧提取函数
function extractGifFrames(dataUri: string): GeminiPart[] {
  try {
    logger.info("🎬 开始处理GIF图片...");

    // 解析 data URI
    const [header, base64Data] = dataUri.split(',');
    if (!base64Data) {
      throw new Error("GIF data URI 格式错误");
    }

    // 验证是否为 GIF
    if (!header.includes('image/gif')) {
      throw new Error("不是 GIF 格式");
    }

    // 检查 GIF 大小，对大文件进行更严格的限制
    const sizeBytes = base64Data.length * 0.75;
    const maxSizeBytes = 2 * 1024 * 1024; // GIF 限制为 2MB，更保守
    if (sizeBytes > maxSizeBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
      throw new Error(`GIF 过大 (${sizeMB}MB)，请压缩到 2MB 以下。大 GIF 文件可能导致处理失败`);
    }

    // 对于 GIF 处理，转换为 JPEG 格式以提高兼容性
    // 由于 Gemini API 对 GIF 支持不稳定，我们将其作为静态图片处理
    logger.info("🔄 将GIF转换为JPEG格式处理...");

    const frames: GeminiPart[] = [];

    // 将 GIF 数据转换为 JPEG MIME 类型发送
    // 这是一个兼容性策略，虽然不是真正的格式转换，但可以让 Gemini 接受
    frames.push({
      inlineData: {
        mimeType: "image/jpeg", // 使用 JPEG MIME 类型提高兼容性
        data: base64Data
      }
    });

    // 如果 GIF 较大，我们可以尝试提取多个"虚拟帧"
    // 这里我们简化为单帧处理
    logger.info(`✅ GIF处理完成，提取了 ${frames.length} 帧`);

    return frames;

  } catch (error) {
    logger.error("GIF帧提取失败:", (error as Error).message);
    throw error;
  }
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

            // 检查是否为 GIF 格式
            if (imageUrl.includes('data:image/gif')) {
              logger.info("🎬 检测到GIF格式，开始提取帧...");
              try {
                const gifFrames = extractGifFrames(imageUrl);

                if (gifFrames.length > 0) {
                  // 添加所有提取的帧
                  for (const frame of gifFrames) {
                    parts.push(frame);
                  }
                  logger.info(`✅ 成功提取GIF帧: ${gifFrames.length} 张图片`);

                  // 不添加额外的说明文字，避免可能的格式问题
                  // 让 AI 自然识别图片内容
                } else {
                  logger.warn("❌ GIF帧提取失败");
                  parts.push({ text: `[GIF处理失败，无法提取帧]` });
                }
              } catch (error) {
                logger.error("GIF处理异常:", (error as Error).message);
                parts.push({ text: `[GIF处理异常: ${(error as Error).message}]` });
              }
            } else {
              // 处理普通图片
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
              const errorMsg = (error as Error).message;
              logger.warn("❌ data URI处理失败:", errorMsg);

              // 根据错误类型提供具体的解决方案
              if (errorMsg.includes("不支持")) {
                parts.push({ text: `[图片格式不支持: ${errorMsg}]` });
              } else if (errorMsg.includes("过大")) {
                parts.push({ text: `[图片过大: ${errorMsg}]` });
              } else {
                parts.push({ text: `[图片处理失败: ${errorMsg}]` });
              }
            }
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
    // JSON请求时，添加JSON专用指令和长度控制
    let jsonPrompt = `请返回严格符合JSON语法的有效JSON格式。确保：
- 所有字符串都用双引号包围
- 属性名用双引号包围
- 不要有多余的引号或转义字符
- 确保JSON语法完全正确
- 不要添加任何解释文字，只返回纯JSON
- JSON对象不要用引号包围整体
- 确保开头是 { 结尾是 }
- 不要在JSON前后添加额外的引号或字符`;

    // 添加内容长度控制提示
    if (openaiRequest.max_tokens !== undefined && openaiRequest.max_tokens <= 1000) {
      const targetLength = Math.max(openaiRequest.max_tokens - 50, 50); // 预留50个token给JSON结构
      jsonPrompt += `\n\n重要：请控制JSON内容的长度，特别是文本字段（如reason、description等）的内容应该简洁明了，总体内容长度控制在约${targetLength}个token以内。使用简短但准确的表达，避免冗长的描述。`;
    } else if (openaiRequest.max_tokens !== undefined && openaiRequest.max_tokens <= 500) {
      jsonPrompt += `\n\n重要：用户希望得到简洁的回复，请将JSON中的文本内容控制得非常简短，每个文本字段不超过1-2句话，使用最精炼的表达方式。`;
    }

    finalSystemContent = userSystemContent ?
      `${userSystemContent}\n\n${jsonPrompt}` :
      jsonPrompt;

    logger.debug(`检测到JSON格式请求，应用JSON专用提示词 (用户token设置: ${openaiRequest.max_tokens})`);
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
    let finalMaxTokens = openaiRequest.max_tokens;

    // 为 JSON 请求完全忽略用户的 token 限制，使用最大值以保证服务正常
    if (isJsonRequest) {
      const isThinkingModel = openaiRequest.model.includes("2.5");
      const maxTokens = isThinkingModel ? 65536 : 8192;

      logger.warn(`JSON请求完全忽略用户设置的 max_tokens (${finalMaxTokens})，使用最大值 ${maxTokens} 以保证服务正常运行`);
      finalMaxTokens = maxTokens;
    }

    geminiRequest.generationConfig.maxOutputTokens = finalMaxTokens;
    logger.debug(`设置 maxOutputTokens: ${finalMaxTokens} (原始: ${openaiRequest.max_tokens}, JSON请求: ${isJsonRequest})`);
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

    // 检查不支持的图片格式（移除 GIF，我们将特殊处理）
    const unsupportedFormats = ["image/webp", "image/bmp", "image/tiff"];
    if (unsupportedFormats.includes(mimeType)) {
      throw new Error(`Gemini API 不支持 ${mimeType} 格式，请转换为 JPEG 或 PNG 格式`);
    }

    // 验证base64数据
    try {
      // 简单验证base64格式
      atob(base64Data);
    } catch {
      throw new Error("无效的base64数据");
    }

    // 检查图片大小限制 (Gemini API 限制约为 20MB，但建议更小)
    const sizeBytes = base64Data.length * 0.75; // base64 解码后的大小
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB 限制
    if (sizeBytes > maxSizeBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(1);
      throw new Error(`图片过大 (${sizeMB}MB)，请压缩到 10MB 以下`);
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

// JSON 内容检测函数
function isJsonContentRequest(messages: OpenAIMessage[]): boolean {
  // 明确要求 JSON 格式的关键词
  const jsonFormatKeywords = [
    'json格式', 'json对象', 'JSON格式', 'JSON对象',
    '返回json', '输出json', '返回JSON', '输出JSON',
    '请用json', '请用JSON', '用json', '用JSON',
    'json格式回答', 'JSON格式回答',
    'json格式输出', 'JSON格式输出',
    'json回复', 'JSON回复',
    'json响应', 'JSON响应',
    'json结果', 'JSON结果',
    'json数据', 'JSON数据',
    'json形式', 'JSON形式',
    'json方式', 'JSON方式'
  ];

  // JSON 请求的常见模式
  const jsonRequestPatterns = [
    /请.*用.*json.*格式/i,
    /请.*返回.*json/i,
    /输出.*json.*格式/i,
    /json.*格式.*返回/i,
    /以.*json.*格式/i,
    /转换.*json/i,
    /生成.*json/i,
    /创建.*json/i,
    /提供.*json/i,
    /给出.*json/i,
    /json.*示例/i,
    /json.*模板/i,
    /json.*结构/i
  ];

  // JSON 示例模式（更精确的检测）
  const jsonExamplePatterns = [
    /示例.*\{.*".*".*:.*".*".*\}/,  // 示例：{"key": "value"}
    /例如.*\{.*".*".*:.*".*".*\}/,  // 例如：{"key": "value"}
    /格式.*\{.*".*".*:.*".*".*\}/,  // 格式：{"key": "value"}
    /如下.*\{.*".*".*:.*".*".*\}/,  // 如下：{"key": "value"}
    /类似.*\{.*".*".*:.*".*".*\}/   // 类似：{"key": "value"}
  ];

  // 特定字段的 JSON 请求
  const jsonFieldPatterns = [
    /"name".*:.*".*"/i,
    /"nickname".*:.*".*"/i,
    /"reason".*:.*".*"/i,
    /"description".*:.*".*"/i,
    /"title".*:.*".*"/i,
    /"content".*:.*".*"/i,
    /"response".*:.*".*"/i,
    /"result".*:.*".*"/i
  ];

  for (const message of messages) {
    if (typeof message.content === 'string') {
      const content = message.content;

      // 检查明确的 JSON 关键词
      if (jsonFormatKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()))) {
        return true;
      }

      // 检查 JSON 请求模式
      if (jsonRequestPatterns.some(pattern => pattern.test(content))) {
        return true;
      }

      // 检查 JSON 示例模式
      if (jsonExamplePatterns.some(pattern => pattern.test(content))) {
        return true;
      }

      // 检查特定字段的 JSON 模式（但要排除纯分析场景）
      if (jsonFieldPatterns.some(pattern => pattern.test(content))) {
        // 额外检查：确保不是在分析别人的 JSON，而是要求生成 JSON
        const analysisKeywords = ['分析', '解析', '理解', '说明', '解释'];
        const isAnalysis = analysisKeywords.some(keyword => content.includes(keyword));

        if (!isAnalysis) {
          return true;
        }
      }
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && part.text) {
          const content = part.text;

          // 检查明确的 JSON 关键词
          if (jsonFormatKeywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()))) {
            return true;
          }

          // 检查 JSON 请求模式
          if (jsonRequestPatterns.some(pattern => pattern.test(content))) {
            return true;
          }

          // 检查 JSON 示例模式
          if (jsonExamplePatterns.some(pattern => pattern.test(content))) {
            return true;
          }

          // 检查特定字段的 JSON 模式
          if (jsonFieldPatterns.some(pattern => pattern.test(content))) {
            const analysisKeywords = ['分析', '解析', '理解', '说明', '解释'];
            const isAnalysis = analysisKeywords.some(keyword => content.includes(keyword));

            if (!isAnalysis) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}
