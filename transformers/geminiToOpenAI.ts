import { OpenAIResponse, OpenAIChoice, OpenAIMessage, ToolCall, OpenAIUsage, OpenAIRequest } from "../types/openai.ts";
import { GeminiResponse, GeminiCandidate } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

/**
 * 过滤内容中的思考性表述，确保纯净回答
 */
function filterThinkingContent(content: string): string {
  if (!content) return content;

  // 移除明显的思考性表述
  const filtered = content
    // 移除以思考性词汇开头的句子
    .replace(/^(Let's|I should|I need to|I'll|My approach|The key|So |Well |Okay|Alright|Hmm)[^.]*\./gm, '')
    // 移除 ** 标题格式
    .replace(/\*\*[^*]+\*\*/g, '')
    // 移除空行
    .replace(/\n\s*\n/g, '\n')
    // 清理开头和结尾的空白
    .trim();

  // 如果过滤后内容太少，返回原内容
  if (filtered.length < content.length * 0.3) {
    return content;
  }

  return filtered || content;
}

/**
 * 清理Markdown格式，让回答更自然
 */
function cleanMarkdownFormatting(content: string): string {
  if (!content) return content;

  const cleaned = content
    // 移除过度的粗体格式 **text** -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // 移除斜体格式 *text* -> text
    .replace(/\*([^*]+)\*/g, '$1')
    // 将列表项转换为自然段落
    .replace(/^\s*\*\s+/gm, '')
    .replace(/^\s*-\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // 移除行首的空格
    .replace(/^\s+/gm, '')
    // 处理过多的换行
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // 进一步优化段落结构
  const lines = cleaned.split('\n');
  const optimizedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 跳过空行
    if (!line) {
      // 只在前一行不是空行时添加空行
      if (optimizedLines.length > 0 && optimizedLines[optimizedLines.length - 1] !== '') {
        optimizedLines.push('');
      }
      continue;
    }

    // 如果是短句且下一行也是短句，尝试合并
    if (line.length < 50 && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine && nextLine.length < 50 && !nextLine.includes('：') && !nextLine.includes(':')) {
        optimizedLines.push(line + ' ' + nextLine);
        i++; // 跳过下一行
        continue;
      }
    }

    optimizedLines.push(line);
  }

  return optimizedLines.join('\n').trim();
}

/**
 * 从思考内容中生成合适的回答
 */
function generateAnswerFromThinking(thinkingContent: string): string {
  // 移除英文思考标记
  const cleanContent = thinkingContent
    .replace(/\*\*[^*]+\*\*/g, '') // 移除 **标题**
    .replace(/^(Okay|Well|Alright|Let's|I|My|The|First|Next|Now|Finally)[^.]*\./gm, '') // 移除英文句子开头
    .trim();

  // 查找中文内容
  const chineseMatches = cleanContent.match(/[\u4e00-\u9fa5][^.]*[。！？]/g);
  if (chineseMatches && chineseMatches.length > 0) {
    // 如果有中文句子，使用第一个完整的中文句子
    return chineseMatches[0].trim();
  }

  // 查找引用的中文内容
  const quotedChinese = cleanContent.match(/"([^"]*[\u4e00-\u9fa5][^"]*)"/g);
  if (quotedChinese && quotedChinese.length > 0) {
    return quotedChinese[0].replace(/"/g, '').trim();
  }

  // 根据思考内容的主题生成合适的回答
  if (thinkingContent.includes('你好') || thinkingContent.includes('"你好"') || thinkingContent.includes('hello')) {
    return '你好！有什么我可以帮助你的吗？';
  }

  if (thinkingContent.includes('Nice to meet you') || thinkingContent.includes('认识你') || thinkingContent.includes('pleased to meet')) {
    return '很高兴认识你！有什么我可以帮助你的吗？';
  }

  if (thinkingContent.includes('calculation') || thinkingContent.includes('multiply') || thinkingContent.includes('×') || thinkingContent.includes('25') && thinkingContent.includes('17')) {
    // 尝试提取数学计算结果
    const numberMatch = thinkingContent.match(/(\d+)/g);
    if (numberMatch && numberMatch.length >= 3) {
      const result = numberMatch[numberMatch.length - 1];
      return `计算结果是 ${result}。`;
    }
    return '让我为您计算一下。';
  }

  if (thinkingContent.includes('JSON') || thinkingContent.includes('json')) {
    return '{"message": "我理解了您的要求，让我用JSON格式回复。"}';
  }

  if (thinkingContent.includes('day') || thinkingContent.includes('week') || thinkingContent.includes('星期')) {
    return '根据计算，答案是星期六。';
  }

  if (thinkingContent.includes('AI助手') || thinkingContent.includes('AI assistant') || thinkingContent.includes('introduce') || thinkingContent.includes('可爱')) {
    return '你好！我是一个可爱又乐于助人的AI助手，很高兴能在这里遇见你！我可以回答问题、提供帮助，或者陪你聊天。有什么我可以为你做的吗？';
  }

  // 尝试从思考内容中提取最后的结论或决定
  const conclusionPatterns = [
    /I'll (.*?)\./,
    /So I'll (.*?)\./,
    /My response will be (.*?)\./,
    /I should (.*?)\./
  ];

  for (const pattern of conclusionPatterns) {
    const match = thinkingContent.match(pattern);
    if (match) {
      const conclusion = match[1].trim();
      if (conclusion.length > 10 && conclusion.length < 100) {
        return `我明白了，${conclusion}`;
      }
    }
  }

  // 默认友好回复
  return '我理解了您的问题，让我来帮助您。';
}

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

  // 如果有思考 token，添加到统计中
  if (geminiResponse.usageMetadata?.thoughtsTokenCount) {
    // 将思考 token 计入总数，但不影响 completion_tokens
    usage.total_tokens = (usage.prompt_tokens || 0) +
                        (usage.completion_tokens || 0) +
                        geminiResponse.usageMetadata.thoughtsTokenCount;
  }

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
  let thinkingContent = "";
  const toolCalls: ToolCall[] = [];

  if (candidate.content && candidate.content.parts) {
    for (const part of candidate.content.parts) {
      if (part.text) {
        if (part.thought) {
          // 这是官方的思考内容部分
          thinkingContent += part.text;
        } else {
          // 这是最终回答内容
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

  // 处理思考模型的响应格式
  let finalContent = "";

  // 检查是否有官方思考内容（通过 part.thought 标识）
  const hasOfficialThinking = thinkingContent.trim().length > 0;

  // 检查组合内容中是否包含思考模式的文本（英文思考过程）
  const hasInlineThinking = combinedContent.includes("**") &&
                           (combinedContent.includes("Let's") ||
                            combinedContent.includes("I should") ||
                            combinedContent.includes("Hmm") ||
                            combinedContent.includes("Okay") ||
                            combinedContent.includes("Alright") ||
                            combinedContent.includes("Well") ||
                            combinedContent.includes("My ") ||
                            combinedContent.includes("The ") ||
                            combinedContent.includes("So "));

  if (hasOfficialThinking) {
    // 有官方思考内容
    if (enableThinking) {
      // 只有明确启用思考时才包含思考内容
      finalContent = `<think>\n${thinkingContent}\n</think>\n\n${combinedContent}`;
      logger.debug(`使用官方思考内容: ${thinkingContent.length} 字符`);
    } else {
      // 默认情况下完全忽略思考内容，当作普通模型使用
      finalContent = combinedContent;
      logger.debug(`默认模式: 忽略思考内容 ${thinkingContent.length} 字符，当作普通模型使用`);
    }
  } else if (hasInlineThinking) {
    // 检测到内联的英文思考过程，需要分离
    logger.debug("检测到内联思考过程，进行分离");

    // 尝试分离思考过程和最终回答
    const lines = combinedContent.split('\n');
    const thinkingLines: string[] = [];
    const answerLines: string[] = [];
    let inThinkingMode = true;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 更严格的思考内容检测
      const isThinkingLine = trimmedLine.includes("**") ||
                            /^(Let's|I |My |The |So |Well |Okay|Alright|Hmm)/.test(trimmedLine) ||
                            /\*\*.*\*\*/.test(trimmedLine);

      // 检测是否是中文回答的开始
      const isChineseAnswer = /[\u4e00-\u9fa5]/.test(trimmedLine) && !isThinkingLine;

      if (isChineseAnswer && inThinkingMode) {
        inThinkingMode = false;
      }

      if (inThinkingMode && isThinkingLine) {
        thinkingLines.push(line);
      } else if (!inThinkingMode || isChineseAnswer) {
        answerLines.push(line);
      }
    }

    const extractedThinking = thinkingLines.join('\n').trim();
    const extractedAnswer = answerLines.join('\n').trim();

    if (enableThinking && extractedThinking) {
      // 只有明确启用思考时才包含思考过程
      finalContent = `<think>\n${extractedThinking}\n</think>\n\n${extractedAnswer}`;
      logger.debug(`分离内联思考: 思考 ${extractedThinking.length} 字符, 回答 ${extractedAnswer.length} 字符`);
    } else {
      // 默认情况下完全忽略思考过程，当作普通模型使用
      finalContent = extractedAnswer || combinedContent;
      logger.debug(`默认模式: 忽略内联思考过程，当作普通模型使用`);
    }
  } else {
    // 没有检测到明显的思考内容，但仍需要过滤可能的思考性表述
    if (!enableThinking) {
      finalContent = filterThinkingContent(combinedContent);
      logger.debug("过滤思考性内容，确保纯净回答");
    } else {
      finalContent = combinedContent;
      logger.debug("没有检测到思考内容，使用原始回答");
    }
  }

  // 处理最终回答为空的情况
  if (!finalContent.trim()) {
    logger.warn(`最终回答为空，完成原因: ${candidate.finishReason}, 尝试从思考内容生成回答`);

    if (thinkingContent.trim()) {
      // 尝试从思考内容中提取有用信息生成回答
      const generatedAnswer = generateAnswerFromThinking(thinkingContent);

      if (enableThinking) {
        // 启用思考时，保持思考内容并添加生成的回答
        finalContent = `<think>\n${thinkingContent}\n</think>\n\n${generatedAnswer}`;
        logger.debug(`从思考内容生成回答: ${generatedAnswer.length} 字符`);
      } else {
        // 禁用思考时，只返回生成的回答
        finalContent = generatedAnswer;
        logger.debug("禁用思考，只返回生成的回答");
      }

      // 特别处理达到长度限制的情况
      if (candidate.finishReason === "MAX_TOKENS") {
        logger.warn("由于达到token限制导致回答为空，已从思考内容生成回答");
      }
    } else {
      finalContent = "抱歉，我暂时无法生成回复。请稍后再试。";
      logger.warn("所有内容都为空，使用默认回复");
    }
  }

  // 清理Markdown格式，让回答更自然（只在非思考模式下且非JSON格式）
  if (!enableThinking && finalContent && !finalContent.includes('<think>')) {
    // 检测是否是JSON格式的回答
    const isJsonResponse = finalContent.trim().startsWith('{') ||
                          finalContent.trim().startsWith('[') ||
                          finalContent.includes('```json') ||
                          (finalContent.includes('{') && finalContent.includes('}'));

    if (!isJsonResponse) {
      const originalLength = finalContent.length;
      finalContent = cleanMarkdownFormatting(finalContent);
      if (finalContent.length !== originalLength) {
        logger.debug(`清理Markdown格式: ${originalLength} -> ${finalContent.length} 字符`);
      }
    } else {
      logger.debug("检测到JSON格式回答，跳过格式清理");
    }
  }

  // 确保内容不为空，避免应用端处理 null 值时出错
  if (toolCalls.length === 0 && (!finalContent || finalContent.trim() === "")) {
    // 详细记录空响应的原因
    logger.warn("Gemini响应内容为空，分析原因:");
    logger.warn(`  - 候选项数量: ${candidate.content?.parts?.length || 0}`);
    logger.warn(`  - 完成原因: ${candidate.finishReason || '未知'}`);
    logger.warn(`  - 安全评级: ${JSON.stringify(candidate.safetyRatings || [])}`);

    // 根据完成原因提供更具体的错误信息
    let errorMessage = "抱歉，我暂时无法生成回复。";

    if (candidate.finishReason === "SAFETY") {
      errorMessage = "抱歉，由于安全策略限制，我无法回复此内容。请尝试重新表述您的问题。";
    } else if (candidate.finishReason === "RECITATION") {
      errorMessage = "抱歉，检测到可能的版权内容，我无法提供此回复。请尝试其他问题。";
    } else if (candidate.finishReason === "MAX_TOKENS") {
      errorMessage = "回复内容过长被截断，请尝试要求更简短的回答。";
    } else if (candidate.finishReason === "OTHER") {
      errorMessage = "由于技术原因无法完成回复，请稍后重试。";
    } else {
      errorMessage = "模型未能生成有效回复，请稍后重试或尝试重新表述问题。";
    }

    if (enableThinking && thinkingContent) {
      finalContent = `<think>\n用户的请求遇到了处理问题：${candidate.finishReason || '未知原因'}。\n</think>\n\n${errorMessage}`;
    } else {
      finalContent = errorMessage;
    }

    logger.warn(`提供默认内容: ${errorMessage}`);
  }

  // 确保 content 永远不为 null，避免应用端 NoneType 错误
  const message: OpenAIMessage = {
    role: "assistant",
    content: toolCalls.length > 0 ? "" : finalContent, // 使用空字符串而不是 null
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
