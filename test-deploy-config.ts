#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * 部署配置测试工具
 * 测试在不同配置状态下的服务行为
 */

const DEFAULT_URL = "http://localhost:8000";

interface ConfigTest {
  name: string;
  description: string;
  envVars: Record<string, string>;
  expectedStatus: "ready" | "needs_configuration";
  expectedMissingKeys: string[];
}

const configTests: ConfigTest[] = [
  {
    name: "完全未配置",
    description: "没有任何密钥",
    envVars: {},
    expectedStatus: "needs_configuration",
    expectedMissingKeys: ["GEMINI_API_KEYS", "ACCESS_KEYS"]
  },
  {
    name: "仅配置Gemini密钥",
    description: "只有Gemini API密钥，缺少准入密码",
    envVars: {
      GEMINI_API_KEYS: "test_gemini_key_1,test_gemini_key_2"
    },
    expectedStatus: "needs_configuration",
    expectedMissingKeys: ["ACCESS_KEYS"]
  },
  {
    name: "仅配置准入密码",
    description: "只有准入密码，缺少Gemini API密钥",
    envVars: {
      ACCESS_KEYS: "test_access_key_1,test_access_key_2"
    },
    expectedStatus: "needs_configuration",
    expectedMissingKeys: ["GEMINI_API_KEYS"]
  },
  {
    name: "完全配置",
    description: "所有必需密钥都已配置",
    envVars: {
      GEMINI_API_KEYS: "test_gemini_key_1,test_gemini_key_2",
      ACCESS_KEYS: "test_access_key_1,test_access_key_2"
    },
    expectedStatus: "ready",
    expectedMissingKeys: []
  }
];

async function testConfigurationScenario(test: ConfigTest, baseUrl: string) {
  console.log(`\n🧪 测试场景: ${test.name}`);
  console.log(`📝 描述: ${test.description}`);
  
  // 设置环境变量
  for (const [key, value] of Object.entries(test.envVars)) {
    Deno.env.set(key, value);
  }
  
  // 清除未设置的环境变量
  const allPossibleKeys = ["GEMINI_API_KEYS", "ACCESS_KEYS"];
  for (const key of allPossibleKeys) {
    if (!(key in test.envVars)) {
      Deno.env.delete(key);
    }
  }
  
  console.log(`🔧 环境变量设置:`);
  for (const key of allPossibleKeys) {
    const value = Deno.env.get(key);
    if (value) {
      console.log(`   ${key}: ${value.split(',').length} 个密钥`);
    } else {
      console.log(`   ${key}: 未设置`);
    }
  }
  
  try {
    // 重新启动服务器进程来测试配置
    console.log(`📡 测试服务器响应...`);
    
    // 注意：这里我们只能测试当前运行的服务器
    // 在实际部署测试中，需要重新启动服务器
    const response = await fetch(`${baseUrl}/`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log(`✅ 服务器响应成功`);
      console.log(`📊 状态: ${data.status}`);
      console.log(`🔧 配置状态: ${data.configuration?.configured ? '完整' : '不完整'}`);
      
      if (data.configuration?.missingKeys?.length > 0) {
        console.log(`❌ 缺失密钥: ${data.configuration.missingKeys.join(', ')}`);
      }
      
      // 验证期望结果
      let testPassed = true;
      
      if (data.status !== test.expectedStatus) {
        console.log(`❌ 状态不匹配: 期望 ${test.expectedStatus}, 实际 ${data.status}`);
        testPassed = false;
      }
      
      const actualMissingKeys = data.configuration?.missingKeys || [];
      const expectedMissingKeys = test.expectedMissingKeys;
      
      if (JSON.stringify(actualMissingKeys.sort()) !== JSON.stringify(expectedMissingKeys.sort())) {
        console.log(`❌ 缺失密钥不匹配:`);
        console.log(`   期望: [${expectedMissingKeys.join(', ')}]`);
        console.log(`   实际: [${actualMissingKeys.join(', ')}]`);
        testPassed = false;
      }
      
      if (testPassed) {
        console.log(`🎉 测试通过！`);
      } else {
        console.log(`❌ 测试失败！`);
      }
      
      return testPassed;
      
    } else {
      console.log(`❌ 服务器响应失败: ${response.status}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 测试异常: ${(error as Error).message}`);
    return false;
  }
}

async function testApiEndpoints(baseUrl: string) {
  console.log(`\n🔌 测试API端点行为...`);
  
  const testCases = [
    {
      name: "模型列表（无认证）",
      url: `${baseUrl}/v1/models`,
      method: "GET",
      headers: {},
      expectedStatus: 401
    },
    {
      name: "模型列表（有认证但无密钥）",
      url: `${baseUrl}/v1/models`,
      method: "GET",
      headers: { "Authorization": "Bearer test_key" },
      expectedStatus: 503
    },
    {
      name: "聊天补全（无认证）",
      url: `${baseUrl}/v1/chat/completions`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [{ role: "user", content: "test" }]
      }),
      expectedStatus: 401
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n  📋 ${testCase.name}`);
    
    try {
      const response = await fetch(testCase.url, {
        method: testCase.method,
        headers: testCase.headers,
        body: testCase.body
      });
      
      if (response.status === testCase.expectedStatus) {
        console.log(`  ✅ 状态码正确: ${response.status}`);
        
        if (response.status >= 400) {
          const errorData = await response.json();
          console.log(`  📝 错误类型: ${errorData.error?.type || '未知'}`);
          console.log(`  💬 错误信息: ${errorData.error?.message?.slice(0, 80) || '无'}...`);
        }
      } else {
        console.log(`  ❌ 状态码不匹配: 期望 ${testCase.expectedStatus}, 实际 ${response.status}`);
      }
      
    } catch (error) {
      console.log(`  ❌ 请求失败: ${(error as Error).message}`);
    }
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  
  console.log("🚀 部署配置测试工具");
  console.log("此工具测试服务器在不同配置状态下的行为\n");
  
  console.log("⚠️  注意: 此测试会修改环境变量");
  console.log("建议在测试环境中运行，不要在生产环境使用\n");
  
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
  
  console.log("📡 服务器连接正常，开始测试...\n");
  
  // 保存原始环境变量
  const originalGeminiKeys = Deno.env.get("GEMINI_API_KEYS");
  const originalAccessKeys = Deno.env.get("ACCESS_KEYS");
  
  let allTestsPassed = true;
  
  try {
    // 运行配置测试
    for (const test of configTests) {
      const passed = await testConfigurationScenario(test, url);
      if (!passed) {
        allTestsPassed = false;
      }
    }
    
    // 测试API端点行为
    await testApiEndpoints(url);
    
  } finally {
    // 恢复原始环境变量
    console.log(`\n🔄 恢复原始环境变量...`);
    
    if (originalGeminiKeys) {
      Deno.env.set("GEMINI_API_KEYS", originalGeminiKeys);
    } else {
      Deno.env.delete("GEMINI_API_KEYS");
    }
    
    if (originalAccessKeys) {
      Deno.env.set("ACCESS_KEYS", originalAccessKeys);
    } else {
      Deno.env.delete("ACCESS_KEYS");
    }
  }
  
  console.log(`\n🎯 测试总结:`);
  if (allTestsPassed) {
    console.log("✅ 所有配置测试通过！");
    console.log("🚀 服务器可以正确处理各种配置状态");
  } else {
    console.log("❌ 部分测试失败");
    console.log("🔧 请检查配置逻辑");
  }
  
  console.log("\n💡 部署建议:");
  console.log("1. 先部署代码到 Deno Deploy（无需环境变量）");
  console.log("2. 检查根路径确认服务启动");
  console.log("3. 在控制台添加 GEMINI_API_KEYS 和 ACCESS_KEYS");
  console.log("4. 验证配置状态变为 'ready'");
}

if (import.meta.main) {
  main().catch(console.error);
}
