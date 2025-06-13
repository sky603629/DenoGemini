#!/usr/bin/env -S deno run --allow-net

/**
 * 调试模型问题工具
 * 帮助诊断应用端报错的原因
 */

const DEFAULT_URL = "http://localhost:8000";

async function checkAvailableModels(baseUrl: string, apiKey: string) {
  console.log("🔍 检查可用模型列表...\n");
  
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 成功获取 ${data.data?.length || 0} 个模型`);
      
      if (data.data && data.data.length > 0) {
        console.log("\n📋 可用模型列表:");
        for (const model of data.data) {
          console.log(`   - ${model.id}`);
        }
        
        // 检查问题模型
        const problemModel = "gemini-2.5-flash-preview-05-20";
        const hasModel = data.data.some((m: { id: string }) => m.id === problemModel);

        console.log(`\n🎯 检查问题模型: ${problemModel}`);
        if (hasModel) {
          console.log("✅ 模型存在");
        } else {
          console.log("❌ 模型不存在！");
          console.log("\n💡 建议使用以下模型:");
          const recommendedModels = data.data
            .filter((m: { id: string }) => m.id.includes('gemini'))
            .slice(0, 5);
          for (const model of recommendedModels) {
            console.log(`   - ${model.id}`);
          }
        }
      }
    } else {
      console.log(`❌ 获取模型列表失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function testProblemModel(baseUrl: string, apiKey: string) {
  console.log("\n🧪 测试问题模型的请求...\n");
  
  const problemModel = "gemini-2.5-flash-preview-05-20";
  const testRequest = {
    model: problemModel,
    messages: [
      {
        role: "user",
        content: "你是四水常在，你一个可爱的小男娘，情感丰富，心地善良。请用json给出你的想法，示例如下：{\"nickname\": \"昵称\", \"reason\": \"理由\"}"
      }
    ],
    max_tokens: 256
  };
  
  console.log(`📤 测试请求到模型: ${problemModel}`);
  console.log(`📋 请求内容: ${JSON.stringify(testRequest, null, 2)}`);
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(testRequest)
    });

    console.log(`\n📥 响应状态: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 原始响应长度: ${responseText.length} 字符`);
    
    if (responseText.length === 0) {
      console.log("❌ 响应为空！这可能是问题的根源");
      return;
    }
    
    try {
      const data = JSON.parse(responseText);
      console.log(`📊 解析后的响应:`);
      console.log(JSON.stringify(data, null, 2));
      
      // 检查关键字段
      if (data.choices && data.choices[0]) {
        const choice = data.choices[0];
        const content = choice.message?.content;
        
        console.log(`\n🔍 内容字段检查:`);
        console.log(`   - content 类型: ${typeof content}`);
        console.log(`   - content 值: ${content === null ? 'null' : content === undefined ? 'undefined' : `"${content}"`}`);
        
        if (content === null || content === undefined) {
          console.log("❌ 发现问题：content 字段为空！");
          console.log("这就是您应用端报错的原因");
        } else {
          console.log("✅ content 字段正常");
        }
      } else {
        console.log("❌ 响应格式异常：缺少 choices 字段");
      }
      
    } catch (parseError) {
      console.log("❌ JSON 解析失败:");
      console.log(`错误: ${(parseError as Error).message}`);
      console.log(`原始响应: ${responseText.slice(0, 500)}...`);
    }
    
  } catch (error) {
    console.log(`❌ 请求失败: ${(error as Error).message}`);
  }
}

async function testWorkingModel(baseUrl: string, apiKey: string) {
  console.log("\n✅ 测试已知可用模型...\n");
  
  const workingModels = [
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-2.0-flash"
  ];
  
  for (const model of workingModels) {
    console.log(`📤 测试模型: ${model}`);
    
    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "user", content: "请简单回复'测试成功'" }
          ],
          max_tokens: 50
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
          console.log(`✅ ${model}: "${content}"`);
        } else {
          console.log(`❌ ${model}: content 字段为空`);
        }
      } else {
        console.log(`❌ ${model}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${model}: ${(error as Error).message}`);
    }
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🔧 Gemini API 问题调试工具\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net debug-model-issue.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net debug-model-issue.ts http://localhost:8000 your_api_key");
    return;
  }
  
  // 检查服务器连接
  try {
    const response = await fetch(url);
    if (!response.ok && response.status !== 401) {
      console.log("❌ 服务器似乎未运行");
      return;
    }
  } catch (_error) {
    console.log("❌ 无法连接到服务器");
    return;
  }
  
  console.log(`🌐 连接到: ${url}\n`);
  
  // 运行诊断
  await checkAvailableModels(url, apiKey);
  await testProblemModel(url, apiKey);
  await testWorkingModel(url, apiKey);
  
  console.log("\n💡 解决建议:");
  console.log("1. 检查您的应用是否使用了正确的模型名称");
  console.log("2. 确保您的应用能正确处理 content 为 null 的情况");
  console.log("3. 建议使用 gemini-1.5-pro 或 gemini-2.0-flash 等稳定模型");
  console.log("4. 在您的应用中添加空值检查：");
  console.log("   if content is not None and content.strip():");
  console.log("       # 处理内容");
  console.log("   else:");
  console.log("       # 处理空内容的情况");
}

if (import.meta.main) {
  main().catch(console.error);
}
