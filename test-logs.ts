#!/usr/bin/env -S deno run --allow-net

/**
 * 日志测试工具
 * 发送各种类型的请求来测试日志输出
 */

const DEFAULT_URL = "http://localhost:8000";

async function testTextRequest(baseUrl: string, apiKey: string) {
  console.log("📝 测试纯文本请求...");
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          { role: "user", content: "请简单回复'文本测试成功'" }
        ],
        max_tokens: 20,
        temperature: 0.7
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 文本请求成功: ${data.choices?.[0]?.message?.content}`);
    } else {
      console.log(`❌ 文本请求失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 文本请求异常: ${(error as Error).message}`);
  }
}

async function testImageRequest(baseUrl: string, apiKey: string) {
  console.log("\n🖼️ 测试图片请求...");
  
  const testDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "这是什么颜色的图片？" },
              { type: "image_url", image_url: { url: testDataUri } }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 图片请求成功: ${data.choices?.[0]?.message?.content}`);
    } else {
      console.log(`❌ 图片请求失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 图片请求异常: ${(error as Error).message}`);
  }
}

async function testStreamRequest(baseUrl: string, apiKey: string) {
  console.log("\n🌊 测试流式请求...");
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          { role: "user", content: "请说'流式测试成功'" }
        ],
        stream: true,
        max_tokens: 30
      })
    });

    if (response.ok && response.body) {
      console.log(`✅ 流式请求已建立`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          if (chunk.includes('data:') && !chunk.includes('[DONE]')) {
            chunks++;
          }
          
          if (chunks >= 3) break; // 读取几个块后停止
        }
        
        console.log(`✅ 流式请求完成，接收到 ${chunks} 个数据块`);
      } finally {
        reader.releaseLock();
      }
    } else {
      console.log(`❌ 流式请求失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 流式请求异常: ${(error as Error).message}`);
  }
}

async function testModelsRequest(baseUrl: string, apiKey: string) {
  console.log("\n📋 测试模型列表请求...");
  
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 模型列表请求成功: ${data.data?.length || 0} 个模型`);
    } else {
      console.log(`❌ 模型列表请求失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 模型列表请求异常: ${(error as Error).message}`);
  }
}

async function testErrorRequest(baseUrl: string, apiKey: string) {
  console.log("\n❌ 测试错误请求...");
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "invalid-model-name",
        messages: [
          { role: "user", content: "测试错误" }
        ]
      })
    });

    if (!response.ok) {
      console.log(`✅ 错误请求正确返回错误: ${response.status}`);
    } else {
      console.log(`⚠️ 错误请求意外成功`);
    }
  } catch (error) {
    console.log(`❌ 错误请求异常: ${(error as Error).message}`);
  }
}

async function testAuthFailure(baseUrl: string) {
  console.log("\n🔒 测试身份验证失败...");
  
  try {
    const response = await fetch(`${baseUrl}/v1/models`);

    if (response.status === 401) {
      console.log(`✅ 身份验证失败正确返回401`);
    } else {
      console.log(`⚠️ 身份验证失败返回了意外状态: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 身份验证测试异常: ${(error as Error).message}`);
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🚀 日志测试工具\n");
  console.log("此工具将发送各种请求来测试服务器的日志输出");
  console.log("请观察服务器终端的详细日志信息\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-logs.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-logs.ts http://localhost:8000 your_api_key");
    return;
  }
  
  // 检查服务器是否运行
  try {
    const response = await fetch(url);
    if (!response.ok && response.status !== 401) {
      console.log("❌ 服务器似乎未运行");
      console.log("   请确保服务器正在运行: deno task dev");
      return;
    }
  } catch (_error) {
    console.log("❌ 无法连接到服务器");
    console.log("   请确保服务器正在运行: deno task dev");
    return;
  }
  
  console.log("开始测试，请观察服务器日志...\n");
  
  // 运行各种测试
  await testAuthFailure(url);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testModelsRequest(url, apiKey);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testTextRequest(url, apiKey);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testImageRequest(url, apiKey);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testStreamRequest(url, apiKey);
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testErrorRequest(url, apiKey);
  
  console.log("\n🎉 日志测试完成！");
  console.log("\n💡 检查服务器终端，您应该看到:");
  console.log("- 每个请求的详细ID和类型");
  console.log("- 身份验证状态");
  console.log("- 请求参数和内容分析");
  console.log("- 图片处理详情");
  console.log("- Gemini API交互日志");
  console.log("- 响应统计信息");
  console.log("- 错误处理详情");
}

if (import.meta.main) {
  main().catch(console.error);
}
