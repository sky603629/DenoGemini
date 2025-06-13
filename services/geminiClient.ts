import { GeminiRequest, GeminiResponse } from "../types/gemini.ts";
import { configManager, logger } from "../config/env.ts";
import { modelService } from "./modelService.ts";
import { concurrencyManager, connectionPool } from "./concurrencyManager.ts";

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
      const timeoutId = setTimeout(() => controller.abort(), config.requestTimeout);

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

      // 对于成功的响应，检查内容质量
      if (response.status === 200 && !stream) {
        try {
          const responseText = await response.text();
          const responseData = JSON.parse(responseText);

          // 检查响应质量
          if (responseData.candidates && responseData.candidates.length > 0) {
            const candidate = responseData.candidates[0];
            const hasContent = candidate.content?.parts?.some((part: { text?: string }) => part.text?.trim());

            if (!hasContent) {
              logger.warn(`⚠️ Gemini返回空内容响应:`);
              logger.warn(`  - 完成原因: ${candidate.finishReason || '未知'}`);
              logger.warn(`  - 安全评级: ${JSON.stringify(candidate.safetyRatings || [])}`);
            } else {
              const contentLength = candidate.content.parts
                .filter((part: { text?: string }) => part.text)
                .reduce((total: number, part: { text: string }) => total + part.text.length, 0);
              logger.debug(`📄 响应内容长度: ${contentLength} 字符`);
            }
          } else {
            logger.warn(`⚠️ Gemini响应中没有候选项`);
          }

          // 重新创建响应对象
          return new Response(responseText, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        } catch (error) {
          logger.warn(`无法解析Gemini响应进行质量检查: ${(error as Error).message}`);
        }
      }

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
        throw new Error(`请求超时，超过 ${config.requestTimeout}ms`);
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

    // 生成请求ID用于并发管理
    const requestId = `${endpoint}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 使用并发管理器执行请求
    return await concurrencyManager.executeRequest(
      requestId,
      async () => {
        const apiKey = configManager.getApiKey(0);

        // 记录API使用情况
        concurrencyManager.recordApiUsage(apiKey);

        // 获取连接
        const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}`;
        connectionPool.getConnection(url);

        try {
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

          return await response.json();
        } finally {
          // 释放连接
          connectionPool.releaseConnection(url);
        }
      },
      0, // 普通优先级
      configManager.getApiKey(0)
    );
  }

  async streamGenerateContent(
    modelName: string,
    request: GeminiRequest
  ): Promise<ReadableStream<Uint8Array>> {
    const normalizedModelName = modelService.normalizeModelName(modelName);
    const endpoint = `${normalizedModelName}:streamGenerateContent`;

    // 生成请求ID用于并发管理
    const requestId = `${endpoint}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 流式请求使用高优先级
    return await concurrencyManager.executeRequest(
      requestId,
      async () => {
        const apiKey = configManager.getApiKey(0);

        // 记录API使用情况
        concurrencyManager.recordApiUsage(apiKey);

        // 获取连接
        const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}`;
        connectionPool.getConnection(url);

        try {
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
        } finally {
          // 释放连接
          connectionPool.releaseConnection(url);
        }
      },
      1, // 流式请求使用高优先级
      configManager.getApiKey(0)
    );
  }
}

export const geminiClient = new GeminiClient();
