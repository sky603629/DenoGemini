#!/usr/bin/env -S deno run --allow-net

/**
 * 验证部署的 API 服务器
 * 使用方法: deno run --allow-net verify.ts [服务器URL] [API密钥]
 * 示例: deno run --allow-net verify.ts https://your-project.deno.dev your_api_key
 */

const DEFAULT_URL = "http://localhost:8000";

async function verifyServer(baseUrl: string, apiKey?: string) {
  console.log(`🔍 验证服务器: ${baseUrl}\n`);

  if (!apiKey) {
    console.log("⚠️  未提供API密钥，某些测试可能会失败");
    console.log("   使用方法: deno run --allow-net verify.ts [URL] [API密钥]\n");
  }

  // 测试 1: 检查根端点
  console.log("1. 检查根端点...");
  try {
    const response = await fetch(baseUrl);
    if (response.ok) {
      const data = await response.json();
      console.log("✅ 根端点响应正常");
      console.log(`   消息: ${data.message}`);
    } else {
      console.log(`❌ 根端点响应错误: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 无法连接到服务器: ${(error as Error).message}`);
    return;
  }

  // 测试 2: 获取模型列表
  console.log("\n2. 获取模型列表...");
  try {
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/models`, { headers });
    if (response.ok) {
      const data = await response.json();
      console.log("✅ 模型列表获取成功");
      console.log(`   可用模型数量: ${data.data?.length || 0}`);
      if (data.data && data.data.length > 0) {
        console.log(`   示例模型: ${data.data[0].id}`);
      }
    } else {
      console.log(`❌ 获取模型列表失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
      if (response.status === 401) {
        console.log("   💡 提示: 请提供有效的API密钥");
      }
    }
  } catch (error) {
    console.log(`❌ 获取模型列表时出错: ${(error as Error).message}`);
  }

  // 测试 3: 测试聊天补全
  console.log("\n3. 测试聊天补全...");
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          { role: "user", content: "请简单回复'测试成功'" }
        ],
        max_tokens: 50
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ 聊天补全测试成功");
      console.log(`   模型: ${data.model}`);
      console.log(`   回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
      console.log(`   使用的token: ${data.usage?.total_tokens || '未知'}`);
    } else {
      console.log(`❌ 聊天补全测试失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
      if (response.status === 401) {
        console.log("   💡 提示: 请提供有效的API密钥");
      }
    }
  } catch (error) {
    console.log(`❌ 聊天补全测试时出错: ${(error as Error).message}`);
  }

  // 测试 4: 测试流式响应
  console.log("\n4. 测试流式响应...");
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          { role: "user", content: "请说'流式测试成功'" }
        ],
        stream: true,
        max_tokens: 50
      })
    });

    if (response.ok && response.body) {
      console.log("✅ 流式响应连接成功");
      
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
          
          if (chunks >= 3) { // 读取几个块后停止
            break;
          }
        }
        
        console.log(`   接收到 ${chunks} 个数据块`);
        reader.releaseLock();
      } catch (streamError) {
        console.log(`   流读取错误: ${(streamError as Error).message}`);
      }
    } else {
      console.log(`❌ 流式响应测试失败: ${response.status}`);
      if (response.status === 401) {
        console.log("   💡 提示: 请提供有效的API密钥");
      }
    }
  } catch (error) {
    console.log(`❌ 流式响应测试时出错: ${(error as Error).message}`);
  }

  console.log("\n🎉 验证完成！");
}

// 主函数
async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];

  console.log("🚀 Gemini 到 OpenAI API 服务器验证工具\n");

  if (url === DEFAULT_URL) {
    console.log("💡 提示: 您可以指定服务器URL和API密钥作为参数");
    console.log("   示例: deno run --allow-net verify.ts https://your-project.deno.dev your_api_key\n");
  }

  await verifyServer(url, apiKey);
}

if (import.meta.main) {
  main().catch(console.error);
}
