import { OpenAIStreamChunk, OpenAIStreamChoice, Delta, ToolCallDelta } from "../types/openai.ts";
import { GeminiResponse, GeminiCandidate } from "../types/gemini.ts";
import { logger } from "../config/env.ts";

export function createGeminiToOpenAISSEStream(
  geminiStream: ReadableStream<Uint8Array>,
  requestId: string,
  modelName: string
): ReadableStream<Uint8Array> {
  const textDecoder = new TextDecoder();
  const textEncoder = new TextEncoder();
  
  let buffer = "";
  let roleSent = false;
  const currentToolCalls: Map<number, ToolCallDelta> = new Map();

  const transformStream = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      try {
        buffer += textDecoder.decode(chunk, { stream: true });

        // 处理完整的行
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // 保留最后一个不完整的行

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          // 处理服务器发送事件格式
          if (trimmedLine.startsWith('data: ')) {
            const jsonStr = trimmedLine.slice(6); // 移除'data: '前缀

            if (jsonStr === '[DONE]') {
              // 流结束
              controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
              continue;
            }
            
            try {
              const geminiChunk: GeminiResponse = JSON.parse(jsonStr);
              const openaiChunks = transformGeminiChunkToOpenAI(
                geminiChunk,
                requestId,
                modelName,
                roleSent,
                currentToolCalls
              );

              if (!roleSent && openaiChunks.length > 0) {
                roleSent = true;
              }

              for (const openaiChunk of openaiChunks) {
                const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                controller.enqueue(textEncoder.encode(sseData));
              }
            } catch (parseError) {
              logger.debug(`跳过无效的JSON数据: "${jsonStr.slice(0, 100)}..." - ${(parseError as Error).message}`);
            }
          } else {
            // 尝试解析为直接JSON（以防不是SSE格式）
            // 跳过明显不是JSON的行
            if (trimmedLine.startsWith('{') && trimmedLine.endsWith('}')) {
              try {
                const geminiChunk: GeminiResponse = JSON.parse(trimmedLine);
                const openaiChunks = transformGeminiChunkToOpenAI(
                  geminiChunk,
                  requestId,
                  modelName,
                  roleSent,
                  currentToolCalls
                );

                if (!roleSent && openaiChunks.length > 0) {
                  roleSent = true;
                }

                for (const openaiChunk of openaiChunks) {
                  const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                  controller.enqueue(textEncoder.encode(sseData));
                }
              } catch (_parseError) {
                logger.debug(`跳过无效的JSON行: "${trimmedLine.slice(0, 50)}..."`);
              }
            }
          }
        }
      } catch (error) {
        logger.error("流转换错误:", error);
      }
    },

    flush(controller) {
      // 处理任何剩余的缓冲区内容
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer && trimmedBuffer !== ']' && trimmedBuffer !== '[' && trimmedBuffer.length > 2) {
        try {
          // 尝试解析为完整的JSON对象
          const geminiChunk: GeminiResponse = JSON.parse(trimmedBuffer);
          const openaiChunks = transformGeminiChunkToOpenAI(
            geminiChunk,
            requestId,
            modelName,
            roleSent,
            currentToolCalls
          );

          for (const openaiChunk of openaiChunks) {
            const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
            controller.enqueue(textEncoder.encode(sseData));
          }
        } catch (error) {
          logger.debug(`跳过无效的缓冲区内容: "${trimmedBuffer}" - ${(error as Error).message}`);
        }
      }

      // 发送最终完成标记
      controller.enqueue(textEncoder.encode("data: [DONE]\n\n"));
    }
  });

  return geminiStream.pipeThrough(transformStream);
}

function transformGeminiChunkToOpenAI(
  geminiChunk: GeminiResponse,
  requestId: string,
  modelName: string,
  roleSent: boolean,
  currentToolCalls: Map<number, ToolCallDelta>
): OpenAIStreamChunk[] {
  const chunks: OpenAIStreamChunk[] = [];
  
  if (!geminiChunk.candidates || geminiChunk.candidates.length === 0) {
    return chunks;
  }

  for (let candidateIndex = 0; candidateIndex < geminiChunk.candidates.length; candidateIndex++) {
    const candidate = geminiChunk.candidates[candidateIndex];
    const delta: Delta = {};
    
    // 在第一个块中发送角色
    if (!roleSent && candidate.content?.parts?.some(p => p.text || p.functionCall)) {
      delta.role = "assistant";
    }

    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          delta.content = part.text;
        }

        if (part.functionCall) {
          const toolCallIndex = currentToolCalls.size;
          const toolCallId = `call_${crypto.randomUUID()}`;

          const toolCallDelta: ToolCallDelta = {
            index: toolCallIndex,
            id: toolCallId,
            type: "function",
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {})
            }
          };

          currentToolCalls.set(toolCallIndex, toolCallDelta);

          if (!delta.tool_calls) {
            delta.tool_calls = [];
          }
          delta.tool_calls.push(toolCallDelta);
        }
      }
    }
    
    const choice: OpenAIStreamChoice = {
      index: candidateIndex,
      delta: delta,
      finish_reason: mapFinishReasonToOpenAI(candidate.finishReason)
    };
    
    const chunk: OpenAIStreamChunk = {
      id: requestId,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      choices: [choice]
    };
    
    chunks.push(chunk);
  }
  
  return chunks;
}

function mapFinishReasonToOpenAI(
  geminiReason?: GeminiCandidate["finishReason"]
): OpenAIStreamChoice["finish_reason"] {
  if (!geminiReason) return null;

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
