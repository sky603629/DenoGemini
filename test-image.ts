#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * 图片处理测试工具
 */

async function testImageProcessing() {
  console.log("🖼️ 测试图片处理功能...\n");

  // 测试 1: 测试 data URI 处理
  console.log("1. 测试 data URI 处理...");
  const testDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  
  try {
    const response = await fetch("http://localhost:8000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "这是什么图片？请简单描述。" },
              { type: "image_url", image_url: { url: testDataUri } }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ data URI 图片处理成功");
      console.log(`   回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
    } else {
      console.log(`❌ data URI 图片处理失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ data URI 图片处理出错: ${(error as Error).message}`);
  }

  // 测试 2: 测试远程图片URL
  console.log("\n2. 测试远程图片URL处理...");
  const testImageUrl = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png";
  
  try {
    const response = await fetch("http://localhost:8000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "请描述这张图片的内容。" },
              { type: "image_url", image_url: { url: testImageUrl } }
            ]
          }
        ],
        max_tokens: 100
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ 远程图片URL处理成功");
      console.log(`   回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
    } else {
      console.log(`❌ 远程图片URL处理失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 远程图片URL处理出错: ${(error as Error).message}`);
  }

  // 测试 3: 测试无效图片URL
  console.log("\n3. 测试无效图片URL处理...");
  const invalidImageUrl = "https://invalid-url-that-does-not-exist.com/image.jpg";
  
  try {
    const response = await fetch("http://localhost:8000/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "请描述这张图片。" },
              { type: "image_url", image_url: { url: invalidImageUrl } }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ 无效图片URL处理成功（应该有错误提示）");
      console.log(`   回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
    } else {
      console.log(`❌ 无效图片URL处理失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 无效图片URL处理出错: ${(error as Error).message}`);
  }

  console.log("\n📋 图片处理测试完成！");
  console.log("\n💡 使用提示:");
  console.log("1. 支持的图片格式: JPEG, PNG, GIF, WebP");
  console.log("2. 图片大小限制: 建议小于 4MB");
  console.log("3. URL格式: data: URI 或 https:// URL");
  console.log("4. 如果使用远程URL，确保图片可以公开访问");
}

async function main() {
  console.log("🚀 图片处理功能测试\n");
  
  // 检查服务器是否运行
  try {
    const response = await fetch("http://localhost:8000");
    if (!response.ok) {
      console.log("❌ 服务器未运行，请先启动服务器:");
      console.log("   deno task dev");
      return;
    }
  } catch (error) {
    console.log("❌ 无法连接到服务器，请先启动服务器:");
    console.log("   deno task dev");
    return;
  }
  
  await testImageProcessing();
}

if (import.meta.main) {
  main().catch(console.error);
}
