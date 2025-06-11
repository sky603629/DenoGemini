#!/usr/bin/env -S deno run --allow-net

/**
 * 简单图片测试工具
 * 专门测试data URI格式的图片处理
 */

const DEFAULT_URL = "http://localhost:8000";

async function testDataUriImage(baseUrl: string, apiKey: string) {
  console.log(`🖼️ 测试data URI图片处理: ${baseUrl}\n`);

  // 测试用的小图片 (1x1像素红色PNG)
  const testDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  console.log("1. 测试data URI图片识别...");
  
  try {
    const startTime = Date.now();
    
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
              { type: "text", text: "请简单描述这张图片，只需要一句话。" },
              { type: "image_url", image_url: { url: testDataUri } }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ 成功 - 耗时: ${duration}ms`);
      console.log(`   AI回复: ${content}`);
      console.log(`   Token使用: ${data.usage?.total_tokens || '未知'}`);
      
      if (content.includes('[') && content.includes(']')) {
        console.log("⚠️  回复中包含错误标记，可能图片处理失败");
      } else {
        console.log("🎉 图片处理成功！");
      }
    } else {
      console.log(`❌ 请求失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function testTextOnly(baseUrl: string, apiKey: string) {
  console.log("\n📝 对比测试：纯文本请求...");
  
  try {
    const startTime = Date.now();
    
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
        max_tokens: 20
      })
    });

    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ 成功 - 耗时: ${duration}ms`);
      console.log(`   AI回复: ${content}`);
    } else {
      console.log(`❌ 请求失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function testRemoteImageUrl(baseUrl: string, apiKey: string) {
  console.log("\n🌐 测试远程图片URL（应该被跳过）...");
  
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
              { type: "text", text: "请描述这张图片" },
              { 
                type: "image_url", 
                image_url: { 
                  url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" 
                } 
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      console.log(`✅ 请求成功`);
      console.log(`   AI回复: ${content}`);
      
      if (content.includes('data:URI格式') || content.includes('convert:image')) {
        console.log("✅ 正确跳过了远程图片URL并提供了转换建议");
      } else {
        console.log("⚠️  可能没有正确处理远程图片URL");
      }
    } else {
      console.log(`❌ 请求失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🚀 简单图片测试工具\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-image-simple.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-image-simple.ts http://localhost:8000 your_api_key");
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
  
  // 运行测试
  await testTextOnly(url, apiKey);
  await testDataUriImage(url, apiKey);
  await testRemoteImageUrl(url, apiKey);
  
  console.log("\n🎉 测试完成！");
  console.log("\n💡 总结:");
  console.log("- 纯文本请求应该正常工作");
  console.log("- data URI格式的图片应该能正常识别");
  console.log("- 远程图片URL会被跳过并提供转换建议");
  console.log("- 如果图片处理仍有问题，请检查服务器日志");
}

if (import.meta.main) {
  main().catch(console.error);
}
