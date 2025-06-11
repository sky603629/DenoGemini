#!/usr/bin/env -S deno run --allow-net

/**
 * 身份验证测试工具
 * 测试不同的API密钥格式和身份验证场景
 */

const DEFAULT_URL = "http://localhost:8000";

async function testAuth(baseUrl: string, testKey?: string) {
  console.log(`🔐 测试身份验证: ${baseUrl}\n`);

  // 测试 1: 无API密钥
  console.log("1. 测试无API密钥的请求...");
  try {
    const response = await fetch(`${baseUrl}/v1/models`);
    if (response.status === 401) {
      console.log("✅ 正确拒绝了无密钥请求");
      const error = await response.json();
      console.log(`   错误信息: ${error.error?.message}`);
    } else {
      console.log(`❌ 应该返回401，但返回了: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${(error as Error).message}`);
  }

  // 测试 2: 无效API密钥
  console.log("\n2. 测试无效API密钥...");
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        "Authorization": "Bearer invalid_key_12345"
      }
    });
    if (response.status === 401) {
      console.log("✅ 正确拒绝了无效密钥");
      const error = await response.json();
      console.log(`   错误信息: ${error.error?.message}`);
    } else {
      console.log(`❌ 应该返回401，但返回了: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 请求失败: ${(error as Error).message}`);
  }

  // 测试 3: 有效API密钥（如果提供）
  if (testKey) {
    console.log("\n3. 测试有效API密钥...");
    
    // 测试 Bearer token 格式
    console.log("   3.1 测试 Bearer token 格式...");
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          "Authorization": `Bearer ${testKey}`
        }
      });
      if (response.ok) {
        console.log("✅ Bearer token 格式验证成功");
        const data = await response.json();
        console.log(`   获取到 ${data.data?.length || 0} 个模型`);
      } else {
        console.log(`❌ Bearer token 验证失败: ${response.status}`);
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`❌ Bearer token 请求失败: ${(error as Error).message}`);
    }

    // 测试 x-api-key header 格式
    console.log("   3.2 测试 x-api-key header 格式...");
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          "x-api-key": testKey
        }
      });
      if (response.ok) {
        console.log("✅ x-api-key header 格式验证成功");
        const data = await response.json();
        console.log(`   获取到 ${data.data?.length || 0} 个模型`);
      } else {
        console.log(`❌ x-api-key header 验证失败: ${response.status}`);
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`❌ x-api-key header 请求失败: ${(error as Error).message}`);
    }

    // 测试 Authorization header 不带 Bearer
    console.log("   3.3 测试 Authorization header (不带Bearer)...");
    try {
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: {
          "Authorization": testKey
        }
      });
      if (response.ok) {
        console.log("✅ Authorization header (不带Bearer) 验证成功");
        const data = await response.json();
        console.log(`   获取到 ${data.data?.length || 0} 个模型`);
      } else {
        console.log(`❌ Authorization header (不带Bearer) 验证失败: ${response.status}`);
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`❌ Authorization header (不带Bearer) 请求失败: ${(error as Error).message}`);
    }

    // 测试聊天补全
    console.log("   3.4 测试聊天补全API...");
    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${testKey}`
        },
        body: JSON.stringify({
          model: "gemini-1.5-pro",
          messages: [
            { role: "user", content: "请简单回复'身份验证测试成功'" }
          ],
          max_tokens: 50
        })
      });

      if (response.ok) {
        console.log("✅ 聊天补全API验证成功");
        const data = await response.json();
        console.log(`   AI回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
      } else {
        console.log(`❌ 聊天补全API验证失败: ${response.status}`);
        const error = await response.text();
        console.log(`   错误: ${error}`);
      }
    } catch (error) {
      console.log(`❌ 聊天补全API请求失败: ${(error as Error).message}`);
    }
  } else {
    console.log("\n💡 提示: 提供测试密钥以测试有效身份验证");
    console.log("   使用方法: deno run --allow-net test-auth.ts [URL] [测试密钥]");
  }

  console.log("\n📋 身份验证测试完成！");
  console.log("\n💡 支持的身份验证方式:");
  console.log("1. Authorization: Bearer <your_key>");
  console.log("2. Authorization: <your_key>");
  console.log("3. x-api-key: <your_key>");
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const testKey = Deno.args[1];
  
  console.log("🚀 身份验证测试工具\n");
  
  if (url === DEFAULT_URL) {
    console.log("💡 提示: 您可以指定服务器URL和测试密钥作为参数");
    console.log("   示例: deno run --allow-net test-auth.ts https://your-project.deno.dev your_test_key\n");
  }
  
  // 检查服务器是否运行
  try {
    const response = await fetch(url);
    if (!response.ok && response.status !== 401) {
      console.log("❌ 服务器似乎未运行或有问题");
      console.log("   请确保服务器正在运行: deno task dev");
      return;
    }
  } catch (error) {
    console.log("❌ 无法连接到服务器");
    console.log("   请确保服务器正在运行: deno task dev");
    return;
  }
  
  await testAuth(url, testKey);
}

if (import.meta.main) {
  main().catch(console.error);
}
