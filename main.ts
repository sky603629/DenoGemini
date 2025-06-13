import { OpenAIRequest } from "./types/openai.ts";
import { configManager, logger } from "./config/env.ts";
import { modelService } from "./services/modelService.ts";
import { geminiClient } from "./services/geminiClient.ts";
import { transformOpenAIRequestToGemini } from "./transformers/openaiToGemini.ts";
import { transformGeminiResponseToOpenAI, transformGeminiErrorToOpenAI } from "./transformers/geminiToOpenAI.ts";
import { createGeminiToOpenAISSEStream } from "./transformers/streamTransformer.ts";
import { authenticateRequest, createAuthErrorResponse } from "./middleware/auth.ts";
import { imageCache } from "./services/imageCache.ts";
import { concurrencyManager, connectionPool } from "./services/concurrencyManager.ts";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  // 处理CORS预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(),
    });
  }

  try {
    // 路由处理
    if (url.pathname === "/") {
      const cacheStats = imageCache.getStats();
      const configStatus = configManager.getConfigStatus();
      const health = concurrencyManager.getHealthStatus();
      const connectionStats = connectionPool.getStats();

      return new Response(
        JSON.stringify({
          message: "Gemini到OpenAI兼容API服务器 (高并发优化版)",
          version: "2.0.0",
          status: configStatus.configured ? health.status : "needs_configuration",
          configuration: {
            configured: configStatus.configured,
            missingKeys: configStatus.missingKeys,
            instructions: configStatus.configured ? null : "请在Deno Deploy环境变量中设置缺失的密钥"
          },
          endpoints: [
            "GET /v1/models - 列出可用模型",
            "POST /v1/chat/completions - 聊天补全（兼容OpenAI）",
            "GET /health - 健康检查和性能状态",
            "GET /stats - 详细统计信息"
          ],
          performance: {
            status: health.status,
            queueUtilization: `${health.queueUtilization}%`,
            concurrencyUtilization: `${health.concurrencyUtilization}%`,
            averageResponseTime: `${health.averageResponseTime}ms`,
            successRate: `${health.successRate}%`,
            connections: {
              active: connectionStats.activeConnections,
              total: connectionStats.totalConnections,
              max: connectionStats.maxConnections
            }
          },
          cache: {
            images: cacheStats.size,
            totalSize: `${cacheStats.totalSize}KB`
          }
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders()
          },
        }
      );
    }

    if (req.method === "GET" && url.pathname === "/v1/models") {
      return await handleModelsRequest(req);
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      return await handleChatCompletions(req);
    }

    // 性能监控端点
    if (req.method === "GET" && url.pathname === "/health") {
      return handleHealthCheck(req);
    }

    if (req.method === "GET" && url.pathname === "/stats") {
      return handleStatsRequest(req);
    }

    // 未知端点返回404
    return new Response(
      JSON.stringify({ error: { message: "未找到", type: "invalid_request_error" } }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      }
    );

  } catch (error) {
    logger.error("请求处理器中的未处理错误:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: "内部服务器错误",
          type: "api_error",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      }
    );
  }
}

function handleHealthCheck(_req: Request): Response {
  const health = concurrencyManager.getHealthStatus();
  const connectionStats = connectionPool.getStats();

  return new Response(
    JSON.stringify({
      status: health.status,
      timestamp: new Date().toISOString(),
      performance: {
        queueUtilization: `${health.queueUtilization}%`,
        concurrencyUtilization: `${health.concurrencyUtilization}%`,
        averageResponseTime: `${health.averageResponseTime}ms`,
        successRate: `${health.successRate}%`
      },
      connections: {
        total: connectionStats.totalConnections,
        active: connectionStats.activeConnections,
        max: connectionStats.maxConnections
      }
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    }
  );
}

function handleStatsRequest(_req: Request): Response {
  const stats = concurrencyManager.getStats();
  const connectionStats = connectionPool.getStats();
  const cacheStats = imageCache.getStats();

  return new Response(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      concurrency: {
        totalRequests: stats.totalRequests,
        completedRequests: stats.completedRequests,
        failedRequests: stats.failedRequests,
        activeRequests: stats.activeRequests,
        queueLength: stats.queueLength,
        queuedRequests: stats.queuedRequests,
        averageResponseTime: Math.round(stats.averageResponseTime),
        apiLimits: stats.apiLimits
      },
      connections: connectionStats,
      cache: {
        images: cacheStats.size,
        totalSize: `${cacheStats.totalSize}KB`
      }
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      }
    }
  );
}

async function handleModelsRequest(req: Request): Promise<Response> {
  const requestId = `models_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  logger.info(`[${requestId}] 📋 收到模型列表请求`);

  // 验证身份
  const authResult = authenticateRequest(req);
  if (!authResult.success) {
    logger.warn(`[${requestId}] 🔒 身份验证失败`);
    return createAuthErrorResponse(authResult);
  }

  logger.info(`[${requestId}] ✅ 身份验证成功`);

  // 检查Gemini API密钥配置
  if (!configManager.hasGeminiKeys()) {
    logger.warn(`[${requestId}] ❌ 未配置Gemini API密钥`);
    return new Response(
      JSON.stringify({
        error: {
          message: "服务器未配置Gemini API密钥。请在Deno Deploy环境变量中设置GEMINI_API_KEYS。",
          type: "configuration_error",
          code: "missing_gemini_keys"
        },
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      }
    );
  }

  try {
    logger.info(`[${requestId}] 📤 获取模型列表`);
    const models = await modelService.getOpenAICompatibleModels();
    logger.info(`[${requestId}] ✅ 成功获取 ${models.data?.length || 0} 个模型`);

    return new Response(JSON.stringify(models), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      },
    });
  } catch (error) {
    logger.error(`[${requestId}] ❌ 获取模型列表失败:`, error);
    return new Response(
      JSON.stringify({
        error: {
          message: "获取模型列表失败",
          type: "api_error",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      }
    );
  }
}

async function handleChatCompletions(req: Request): Promise<Response> {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  logger.info(`[${requestId}] 📥 收到聊天补全请求`);

  // 验证身份
  const authResult = authenticateRequest(req);
  if (!authResult.success) {
    logger.warn(`[${requestId}] 🔒 身份验证失败`);
    return createAuthErrorResponse(authResult);
  }

  logger.info(`[${requestId}] ✅ 身份验证成功`);

  // 检查配置状态
  const configStatus = configManager.getConfigStatus();
  if (!configStatus.configured) {
    logger.warn(`[${requestId}] ❌ 服务器配置不完整: ${configStatus.missingKeys.join(', ')}`);
    return new Response(
      JSON.stringify({
        error: {
          message: `服务器配置不完整。请在Deno Deploy环境变量中设置: ${configStatus.missingKeys.join(', ')}`,
          type: "configuration_error",
          code: "incomplete_configuration",
          missing_keys: configStatus.missingKeys
        },
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      }
    );
  }

  try {
    const openaiRequest: OpenAIRequest = await req.json();

    // 详细记录请求信息
    logger.info(`[${requestId}] 📋 请求详情:`);
    logger.info(`[${requestId}]   - 模型: ${openaiRequest.model}`);
    logger.info(`[${requestId}]   - 消息数量: ${openaiRequest.messages?.length || 0}`);
    logger.info(`[${requestId}]   - 流式模式: ${openaiRequest.stream ? '是' : '否'}`);
    logger.info(`[${requestId}]   - 最大Token: ${openaiRequest.max_tokens || '未设置'}`);
    logger.info(`[${requestId}]   - 温度: ${openaiRequest.temperature || '未设置'}`);

    // 分析消息内容
    if (openaiRequest.messages) {
      for (let i = 0; i < openaiRequest.messages.length; i++) {
        const msg = openaiRequest.messages[i];
        logger.info(`[${requestId}]   - 消息${i + 1}: ${msg.role}`);

        if (typeof msg.content === 'string') {
          const preview = msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content;
          logger.info(`[${requestId}]     内容: "${preview}"`);
        } else if (Array.isArray(msg.content)) {
          logger.info(`[${requestId}]     多模态内容: ${msg.content.length} 个部分`);
          for (let j = 0; j < msg.content.length; j++) {
            const part = msg.content[j];
            if (part.type === 'text') {
              const preview = part.text && part.text.length > 50 ? part.text.slice(0, 50) + '...' : part.text;
              logger.info(`[${requestId}]       ${j + 1}. 文本: "${preview}"`);
            } else if (part.type === 'image_url') {
              const url = part.image_url?.url || '';
              if (url.startsWith('data:')) {
                const mimeMatch = url.match(/^data:([^;]+)/);
                const mimeType = mimeMatch ? mimeMatch[1] : '未知';
                const sizeKB = Math.round(url.length * 0.75 / 1024); // 估算大小
                logger.info(`[${requestId}]       ${j + 1}. 图片: data URI (${mimeType}, ~${sizeKB}KB)`);
              } else {
                logger.info(`[${requestId}]       ${j + 1}. 图片: 远程URL (${url.slice(0, 50)}...)`);
              }
            }
          }
        }

        // 记录工具调用
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          logger.info(`[${requestId}]     工具调用: ${msg.tool_calls.length} 个`);
          for (const toolCall of msg.tool_calls) {
            logger.info(`[${requestId}]       - ${toolCall.function?.name || '未知函数'}`);
          }
        }
      }
    }

    // 验证必需字段
    logger.info(`[${requestId}] 🔍 开始验证请求字段`);

    if (!openaiRequest.model) {
      logger.warn(`[${requestId}] ❌ 验证失败: 缺少model字段`);
      return new Response(
        JSON.stringify({
          error: {
            message: "缺少必需字段: model",
            type: "invalid_request_error",
            param: "model",
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders()
          },
        }
      );
    }

    if (!openaiRequest.messages || !Array.isArray(openaiRequest.messages)) {
      logger.warn(`[${requestId}] ❌ 验证失败: messages字段无效`);
      return new Response(
        JSON.stringify({
          error: {
            message: "缺少或无效的必需字段: messages",
            type: "invalid_request_error",
            param: "messages",
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders()
          },
        }
      );
    }

    // 验证模型是否存在
    logger.info(`[${requestId}] 🔍 验证模型: ${openaiRequest.model}`);
    const isValidModel = await modelService.isValidModel(openaiRequest.model);
    if (!isValidModel) {
      logger.warn(`[${requestId}] ❌ 模型验证失败: ${openaiRequest.model} 不存在`);
      return new Response(
        JSON.stringify({
          error: {
            message: `模型 '${openaiRequest.model}' 未找到`,
            type: "invalid_request_error",
            param: "model",
          },
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders()
          },
        }
      );
    }

    logger.info(`[${requestId}] ✅ 所有验证通过`);

    const chatRequestId = `chatcmpl-${crypto.randomUUID()}`;
    logger.info(`[${requestId}] 🆔 生成聊天ID: ${chatRequestId}`);

    // 将OpenAI请求转换为Gemini格式
    logger.info(`[${requestId}] 🔄 开始转换请求格式 (OpenAI -> Gemini)`);
    const geminiRequest = transformOpenAIRequestToGemini(openaiRequest, openaiRequest.model);
    logger.info(`[${requestId}] ✅ 请求格式转换完成`);

    if (openaiRequest.stream) {
      // 处理流式响应
      logger.info(`[${requestId}] 🌊 开始流式请求到Gemini API`);
      const geminiStream = await geminiClient.streamGenerateContent(openaiRequest.model, geminiRequest);
      const openaiStream = createGeminiToOpenAISSEStream(geminiStream, chatRequestId, openaiRequest.model);
      logger.info(`[${requestId}] ✅ 流式响应已建立`);

      return new Response(openaiStream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          ...getCorsHeaders(),
        },
      });
    } else {
      // 处理非流式响应
      logger.info(`[${requestId}] 📤 发送请求到Gemini API`);
      const geminiResponse = await geminiClient.generateContent(openaiRequest.model, geminiRequest);
      logger.info(`[${requestId}] 📥 收到Gemini API响应`);

      logger.info(`[${requestId}] 🔄 开始转换响应格式 (Gemini -> OpenAI)`);
      const openaiResponse = transformGeminiResponseToOpenAI(geminiResponse, openaiRequest, chatRequestId);
      logger.info(`[${requestId}] ✅ 响应格式转换完成`);

      // 记录响应统计
      if (openaiResponse.usage) {
        logger.info(`[${requestId}] 📊 Token使用统计:`);
        logger.info(`[${requestId}]   - 提示Token: ${openaiResponse.usage.prompt_tokens}`);
        logger.info(`[${requestId}]   - 完成Token: ${openaiResponse.usage.completion_tokens}`);
        logger.info(`[${requestId}]   - 总Token: ${openaiResponse.usage.total_tokens}`);
      }

      const responseContent = openaiResponse.choices?.[0]?.message?.content || '';
      const preview = responseContent.length > 100 ? responseContent.slice(0, 100) + '...' : responseContent;
      logger.info(`[${requestId}] 💬 AI回复预览: "${preview}"`);

      return new Response(JSON.stringify(openaiResponse), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders()
        },
      });
    }

  } catch (error) {
    logger.error(`[${requestId}] ❌ 聊天补全处理错误:`, error);

    // 记录错误详情
    const errorObj = error as { error?: { code?: number; message?: string }; message?: string };
    if (errorObj.error) {
      logger.error(`[${requestId}]   - 错误代码: ${errorObj.error.code || '未知'}`);
      logger.error(`[${requestId}]   - 错误信息: ${errorObj.error.message || '未知'}`);
    } else if (errorObj.message) {
      logger.error(`[${requestId}]   - 错误信息: ${errorObj.message}`);
    }

    // 将Gemini错误转换为OpenAI格式
    logger.info(`[${requestId}] 🔄 转换错误格式 (Gemini -> OpenAI)`);
    const openaiError = transformGeminiErrorToOpenAI(error, "");
    const statusCode = errorObj?.error?.code || 500;

    logger.warn(`[${requestId}] 📤 返回错误响应 (状态码: ${statusCode})`);

    return new Response(JSON.stringify(openaiError), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders()
      },
    });
  }
}

function getCorsHeaders(): Record<string, string> {
  const config = configManager.getConfig();
  return {
    "Access-Control-Allow-Origin": config.corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Max-Age": "86400",
  };
}

// 主服务器启动
async function main() {
  try {
    // 加载配置
    const config = await configManager.loadConfig();
    const configStatus = configManager.getConfigStatus();

    // 尝试获取可用模型（如果配置了API密钥）
    if (configManager.hasGeminiKeys()) {
      logger.info("正在获取可用的Gemini模型...");
      const models = await modelService.getAvailableModels();
      logger.info(`已获取 ${models.length} 个可用的Gemini模型`);
    } else {
      logger.warn("跳过模型获取 - 未配置Gemini API密钥");
    }

    logger.info(`正在启动Gemini到OpenAI兼容API服务器...`);
    logger.info(`服务器将在端口 ${config.port} 上运行`);
    logger.info(`CORS源: ${config.corsOrigin}`);

    if (configStatus.configured) {
      logger.info("✅ 服务器配置完整，可以正常使用");
    } else {
      logger.warn("⚠️  服务器配置不完整，需要设置以下环境变量:");
      for (const key of configStatus.missingKeys) {
        logger.warn(`   - ${key}`);
      }
      logger.info("💡 请在Deno Deploy控制台中添加缺失的环境变量");
    }

    // 使用Deno.serve启动服务器
    Deno.serve({ port: config.port }, handler);

  } catch (error) {
    console.error("启动服务器失败:", error);
    Deno.exit(1);
  }
}

// 处理优雅关闭
Deno.addSignalListener("SIGINT", async () => {
  logger.info("收到SIGINT信号，正在优雅关闭...");
  await concurrencyManager.shutdown();
  Deno.exit(0);
});

// 只在非Windows系统上监听SIGTERM
if (Deno.build.os !== "windows") {
  Deno.addSignalListener("SIGTERM", async () => {
    logger.info("收到SIGTERM信号，正在优雅关闭...");
    await concurrencyManager.shutdown();
    Deno.exit(0);
  });
}

if (import.meta.main) {
  main();
}