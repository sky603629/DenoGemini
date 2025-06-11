#!/usr/bin/env -S deno run --allow-net --allow-read

/**
 * 图像转换工具
 * 将图像文件或URL转换为data URI格式，以便在API中使用
 */

async function convertFileToDataUri(filePath: string): Promise<string | null> {
  try {
    console.log(`📁 读取本地文件: ${filePath}`);
    
    const fileData = await Deno.readFile(filePath);
    const base64Data = btoa(String.fromCharCode(...fileData));
    
    // 根据文件扩展名确定MIME类型
    const ext = filePath.toLowerCase().split('.').pop();
    let mimeType = "application/octet-stream";
    
    switch (ext) {
      case "jpg":
      case "jpeg":
        mimeType = "image/jpeg";
        break;
      case "png":
        mimeType = "image/png";
        break;
      case "gif":
        mimeType = "image/gif";
        break;
      case "webp":
        mimeType = "image/webp";
        break;
      case "bmp":
        mimeType = "image/bmp";
        break;
      default:
        console.log(`⚠️  未知的图像格式: ${ext}`);
    }
    
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    
    console.log(`✅ 转换成功`);
    console.log(`   文件大小: ${Math.round(fileData.length / 1024)}KB`);
    console.log(`   MIME类型: ${mimeType}`);
    console.log(`   Data URI长度: ${dataUri.length} 字符`);
    
    return dataUri;
    
  } catch (error) {
    console.log(`❌ 文件读取失败: ${(error as Error).message}`);
    return null;
  }
}

async function convertUrlToDataUri(imageUrl: string): Promise<string | null> {
  try {
    console.log(`🌐 下载远程图像: ${imageUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Image-Converter/1.0)",
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      throw new Error(`不是有效的图像类型: ${contentType}`);
    }
    
    const imageBuffer = await response.arrayBuffer();
    
    if (imageBuffer.byteLength > 4 * 1024 * 1024) {
      throw new Error(`图像太大: ${Math.round(imageBuffer.byteLength / 1024 / 1024)}MB，建议小于4MB`);
    }
    
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
    const dataUri = `data:${contentType};base64,${base64Data}`;
    
    console.log(`✅ 下载转换成功`);
    console.log(`   文件大小: ${Math.round(imageBuffer.byteLength / 1024)}KB`);
    console.log(`   MIME类型: ${contentType}`);
    console.log(`   Data URI长度: ${dataUri.length} 字符`);
    
    return dataUri;
    
  } catch (error) {
    console.log(`❌ 图像下载失败: ${(error as Error).message}`);
    return null;
  }
}

async function testWithApi(dataUri: string) {
  console.log("\n🧪 测试转换后的图像...");
  
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
              { type: "image_url", image_url: { url: dataUri } }
            ]
          }
        ],
        max_tokens: 200
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ API测试成功");
      console.log(`   AI回复: ${data.choices?.[0]?.message?.content || '无内容'}`);
    } else {
      console.log(`❌ API测试失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ API测试出错: ${(error as Error).message}`);
    console.log("   请确保服务器正在运行: deno task dev");
  }
}

async function main() {
  const args = Deno.args;
  
  if (args.length === 0) {
    console.log("🖼️ 图像转换工具");
    console.log("\n使用方法:");
    console.log("  deno run --allow-net --allow-read image-converter.ts <文件路径或URL>");
    console.log("\n示例:");
    console.log("  deno run --allow-net --allow-read image-converter.ts ./image.jpg");
    console.log("  deno run --allow-net --allow-read image-converter.ts https://example.com/image.png");
    console.log("\n支持的格式: JPEG, PNG, GIF, WebP, BMP");
    return;
  }
  
  const input = args[0];
  let dataUri: string | null = null;
  
  console.log("🚀 图像转换工具\n");
  
  if (input.startsWith("http://") || input.startsWith("https://")) {
    // 处理URL
    dataUri = await convertUrlToDataUri(input);
  } else {
    // 处理本地文件
    dataUri = await convertFileToDataUri(input);
  }
  
  if (dataUri) {
    console.log("\n📋 Data URI (复制以下内容用于API调用):");
    console.log("─".repeat(50));
    console.log(dataUri);
    console.log("─".repeat(50));
    
    // 如果服务器在运行，测试API
    try {
      const serverResponse = await fetch("http://localhost:8000");
      if (serverResponse.ok) {
        await testWithApi(dataUri);
      }
    } catch {
      console.log("\n💡 提示: 启动服务器后可以测试图像识别:");
      console.log("   deno task dev");
    }
    
    console.log("\n💡 使用提示:");
    console.log("1. 复制上面的Data URI");
    console.log("2. 在API请求中使用:");
    console.log('   {"type": "image_url", "image_url": {"url": "data:..."}}');
  } else {
    console.log("\n❌ 图像转换失败");
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
