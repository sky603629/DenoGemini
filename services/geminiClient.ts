import { GeminiRequest, GeminiResponse } from "../types/gemini.ts";
import { configManager, logger } from "../config/env.ts";
import { modelService } from "./modelService.ts";

export class GeminiClient {
  private async makeRequest(
    endpoint: string,
    request: GeminiRequest,
    stream: boolean = false,
    retryCount: number = 0
  ): Promise<Response> {
    const config = configManager.getConfig();
    const maxRetries = Math.min(config.maxRetries, configManager.getApiKeyCount());

    if (retryCount >= maxRetries) {
      throw new Error(`已超过最大重试次数 (${maxRetries})`);
    }

    const apiKey = configManager.getApiKey(retryCount);
    const keyPreview = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}?key=${apiKey}`;

    logger.info(`🌐 Gemini API请求: ${endpoint} (第 ${retryCount + 1} 次尝试, 密钥: ${keyPreview})`);

    // 记录请求详情
    const hasImages = JSON.stringify(request).includes('"inlineData"');
    const messageCount = request.contents?.length || 0;
    logger.info(`📋 请求内容: ${messageCount} 条消息${hasImages ? ', 包含图像' : ''}`);

    try {
      const controller = new AbortController();

      // 根据模型和 max_tokens 动态设置超时时间
      const isThinkingModel = endpoint.includes("2.5");
      const maxTokens = request.generationConfig?.maxOutputTokens || 1000;

      let timeoutMs = config.requestTimeout; // 默认值
      if (isThinkingModel && maxTokens > 10000) {
        timeoutMs = 120000; // 2 分钟，用于大型请求
      } else if (isThinkingModel) {
        timeoutMs = 60000;  // 1 分钟，用于思考模型
      }

      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      logger.debug(`设置请求超时时间: ${timeoutMs}ms (endpoint: ${endpoint}, maxTokens: ${maxTokens})`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Deno-Gemini-Proxy/1.0",
          "Connection": "close", // 避免连接复用问题
        },
        body: JSON.stringify(request),
        signal: controller.signal,
        // 网络配置优化
        keepalive: false,
      });

      clearTimeout(timeoutId);

      logger.info(`✅ Gemini API响应: ${response.status} ${response.statusText}`);

      // 如果遇到速率限制或服务器错误，尝试下一个密钥
      if (response.status === 429 || response.status >= 500) {
        if (retryCount < maxRetries - 1) {
          const delay = Math.min(Math.pow(2, retryCount) * 1000 + Math.random() * 1000, 10000);
          logger.warn(`⚠️ 请求失败，状态码 ${response.status}，${delay}ms后使用下一个密钥重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, request, stream, retryCount + 1);
        }
      }

      return response;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // 重新计算超时时间用于错误消息
        const isThinkingModel = endpoint.includes("2.5");
        const maxTokens = request.generationConfig?.maxOutputTokens || 1000;
        let timeoutMs = config.requestTimeout;
        if (isThinkingModel && maxTokens > 10000) {
          timeoutMs = 120000;
        } else if (isThinkingModel) {
          timeoutMs = 60000;
        }
        throw new Error(`请求超时，超过 ${timeoutMs}ms`);
      }

      // 如果是网络错误且还有更多密钥可尝试
      if (retryCount < maxRetries - 1) {
        const delay = Math.min(Math.pow(2, retryCount) * 1000 + Math.random() * 1000, 10000); // 指数退避 + 随机延迟，最大10秒
        logger.warn(`请求失败，错误: ${(error as Error).message}，${delay}ms后使用下一个密钥重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, request, stream, retryCount + 1);
      }

      throw error;
    }
  }

  async generateContent(
    modelName: string,
    request: GeminiRequest
  ): Promise<GeminiResponse> {
    const normalizedModelName = modelService.normalizeModelName(modelName);
    const endpoint = `${normalizedModelName}:generateContent`;
    
    const response = await this.makeRequest(endpoint, request);
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw {
        error: {
          code: response.status,
          message: errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.statusText,
          details: errorBody.error?.details || []
        }
      };
    }
    
    const responseData = await response.json();

    // 记录详细响应信息以便调试
    if (responseData.candidates && responseData.candidates.length > 0) {
      const candidate = responseData.candidates[0];
      const contentText = candidate.content?.parts?.[0]?.text || '';
      const contentLength = contentText.length;

      logger.info(`📥 Gemini响应详情:`);
      logger.info(`   - 完成原因: ${candidate.finishReason || 'UNKNOWN'}`);
      logger.info(`   - 内容长度: ${contentLength} 字符`);
      logger.info(`   - 完整内容: "${contentText}"`);

      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        logger.warn(`⚠️ Gemini非正常完成: ${candidate.finishReason}`);

        // 如果有安全过滤信息，记录详细信息
        if (candidate.finishReason === "SAFETY" && candidate.safetyRatings) {
          logger.warn(`🛡️ 安全过滤详情: ${JSON.stringify(candidate.safetyRatings)}`);
        }

        // 如果是MAX_TOKENS，记录token使用情况
        if (candidate.finishReason === "MAX_TOKENS") {
          logger.warn(`📊 Token限制详情: 输出被截断`);
        }
      }

      // 记录token使用情况
      if (responseData.usageMetadata) {
        logger.info(`📊 Token使用详情:`);
        logger.info(`   - 输入Token: ${responseData.usageMetadata.promptTokenCount || 0}`);
        logger.info(`   - 输出Token: ${responseData.usageMetadata.candidatesTokenCount || 0}`);
        logger.info(`   - 总Token: ${responseData.usageMetadata.totalTokenCount || 0}`);
      }
    } else {
      logger.warn("❌ Gemini响应中没有candidates");
      logger.warn(`🔍 完整响应: ${JSON.stringify(responseData)}`);
    }

    return responseData;
  }

  async streamGenerateContent(
    modelName: string,
    request: GeminiRequest
  ): Promise<ReadableStream<Uint8Array>> {
    const normalizedModelName = modelService.normalizeModelName(modelName);
    const endpoint = `${normalizedModelName}:streamGenerateContent`;
    
    const response = await this.makeRequest(endpoint, request, true);
    
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw {
        error: {
          code: response.status,
          message: errorBody.error?.message || `HTTP ${response.status}: ${response.statusText}`,
          status: response.statusText,
          details: errorBody.error?.details || []
        }
      };
    }
    
    if (!response.body) {
      throw new Error("未从Gemini API接收到响应体");
    }
    
    return response.body;
  }
}

export const geminiClient = new GeminiClient();
