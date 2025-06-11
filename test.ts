#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// 简单的测试脚本来验证服务器功能
import { configManager } from "./config/env.ts";

async function testServer() {
  try {
    console.log("🧪 测试Gemini到OpenAI API服务器...\n");

    // 测试1：加载配置
    console.log("1. 测试配置加载...");
    try {
      await configManager.loadConfig();
      console.log("✅ 配置加载成功");
      console.log(`   - API密钥数量: ${configManager.getApiKeyCount()}`);
      console.log(`   - 端口: ${configManager.getConfig().port}`);
    } catch (error) {
      console.log("❌ 配置加载失败:", (error as Error).message);
      console.log("   请确保您已在.env文件中设置了GEMINI_API_KEYS");
      return;
    }

    // 测试2：测试模型服务
    console.log("\n2. 测试模型服务...");
    try {
      const { modelService } = await import("./services/modelService.ts");
      const models = await modelService.getAvailableModels();
      console.log(`✅ 已获取 ${models.length} 个可用模型`);
      if (models.length > 0) {
        console.log(`   - 示例模型: ${models[0].name}`);
      }
    } catch (error) {
      console.log("❌ 模型服务测试失败:", (error as Error).message);
    }

    // 测试3：测试基本转换
    console.log("\n3. 测试请求转换...");
    try {
      const { transformOpenAIRequestToGemini } = await import("./transformers/openaiToGemini.ts");
      const openaiRequest = {
        model: "gemini-1.5-pro",
        messages: [
          { role: "user" as const, content: "你好，世界！" }
        ]
      };

      const geminiRequest = await transformOpenAIRequestToGemini(openaiRequest, "gemini-1.5-pro");
      console.log("✅ 请求转换成功");
      console.log(`   - 内容项: ${geminiRequest.contents.length} 个`);
    } catch (error) {
      console.log("❌ 请求转换失败:", (error as Error).message);
    }

    // 测试4：测试响应转换
    console.log("\n4. 测试响应转换...");
    try {
      const { transformGeminiResponseToOpenAI } = await import("./transformers/geminiToOpenAI.ts");
      const geminiResponse = {
        candidates: [{
          content: {
            role: "model" as const,
            parts: [{ text: "你好！我今天能为您做些什么？" }]
          },
          finishReason: "STOP" as const
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 15,
          totalTokenCount: 25
        }
      };

      const openaiRequest = {
        model: "gemini-1.5-pro",
        messages: [{ role: "user" as const, content: "你好" }]
      };

      const openaiResponse = transformGeminiResponseToOpenAI(geminiResponse, openaiRequest, "test-123");
      console.log("✅ 响应转换成功");
      console.log(`   - 选择项: ${openaiResponse.choices.length}`);
      console.log(`   - 使用量: ${openaiResponse.usage?.total_tokens} 个token`);
    } catch (error) {
      console.log("❌ 响应转换失败:", (error as Error).message);
    }

    console.log("\n🎉 基本测试完成！");
    console.log("\n要启动服务器，请运行:");
    console.log("  deno task dev");
    console.log("\n然后测试:");
    console.log("  curl http://localhost:8000/v1/models");

  } catch (error) {
    console.error("❌ 测试失败:", error);
  }
}

if (import.meta.main) {
  testServer();
}
