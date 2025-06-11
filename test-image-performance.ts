#!/usr/bin/env -S deno run --allow-net

/**
 * 图片处理性能测试工具
 * 测试不同大小和格式的图片处理性能
 */

const DEFAULT_URL = "http://localhost:8000";

interface PerformanceResult {
  success: boolean;
  duration: number;
  error?: string;
  responseSize?: number;
}

async function testImagePerformance(baseUrl: string, apiKey: string) {
  console.log(`🖼️ 图片处理性能测试: ${baseUrl}\n`);

  const testImages = [
    {
      name: "小图片 (data URI)",
      description: "1x1像素PNG",
      content: [
        { type: "text", text: "这是什么图片？" },
        { 
          type: "image_url", 
          image_url: { 
            url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" 
          } 
        }
      ]
    },
    {
      name: "中等图片 (远程URL)",
      description: "Wikipedia示例图片",
      content: [
        { type: "text", text: "请描述这张图片" },
        { 
          type: "image_url", 
          image_url: { 
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" 
          } 
        }
      ]
    },
    {
      name: "重复图片测试 (缓存)",
      description: "重复使用相同图片测试缓存",
      content: [
        { type: "text", text: "再次描述这张图片" },
        { 
          type: "image_url", 
          image_url: { 
            url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/280px-PNG_transparency_demonstration_1.png" 
          } 
        }
      ]
    }
  ];

  const results: { name: string; result: PerformanceResult }[] = [];

  for (const testImage of testImages) {
    console.log(`测试: ${testImage.name} (${testImage.description})`);
    
    const startTime = Date.now();
    
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
              content: testImage.content
            }
          ],
          max_tokens: 100
        })
      });

      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const responseContent = data.choices?.[0]?.message?.content || '';
        
        console.log(`✅ 成功 - 耗时: ${duration}ms`);
        console.log(`   回复: ${responseContent.slice(0, 100)}${responseContent.length > 100 ? '...' : ''}`);
        console.log(`   Token使用: ${data.usage?.total_tokens || '未知'}`);
        
        results.push({
          name: testImage.name,
          result: {
            success: true,
            duration,
            responseSize: responseContent.length
          }
        });
      } else {
        const errorText = await response.text();
        console.log(`❌ 失败 - 耗时: ${duration}ms`);
        console.log(`   错误: ${errorText}`);
        
        results.push({
          name: testImage.name,
          result: {
            success: false,
            duration,
            error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`
          }
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ 异常 - 耗时: ${duration}ms`);
      console.log(`   错误: ${(error as Error).message}`);
      
      results.push({
        name: testImage.name,
        result: {
          success: false,
          duration,
          error: (error as Error).message
        }
      });
    }
    
    console.log(); // 空行分隔
    
    // 在测试之间稍作延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 性能统计
  console.log("📊 性能统计:");
  console.log("─".repeat(60));
  
  const successfulTests = results.filter(r => r.result.success);
  const failedTests = results.filter(r => !r.result.success);
  
  console.log(`成功测试: ${successfulTests.length}/${results.length}`);
  console.log(`失败测试: ${failedTests.length}/${results.length}`);
  
  if (successfulTests.length > 0) {
    const durations = successfulTests.map(r => r.result.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    console.log(`平均响应时间: ${Math.round(avgDuration)}ms`);
    console.log(`最快响应时间: ${minDuration}ms`);
    console.log(`最慢响应时间: ${maxDuration}ms`);
  }
  
  console.log("\n详细结果:");
  for (const { name, result } of results) {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${name}: ${result.duration}ms`);
    if (result.error) {
      console.log(`   错误: ${result.error}`);
    }
  }
}

async function testCacheStatus(baseUrl: string, apiKey: string) {
  console.log("\n🗄️ 测试缓存状态...");
  
  try {
    // 发送一个简单请求来触发缓存统计
    const response = await fetch(`${baseUrl}/`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });
    
    if (response.ok) {
      console.log("✅ 服务器响应正常");
      console.log("💡 提示: 缓存统计信息会在服务器日志中显示");
    }
  } catch (error) {
    console.log(`❌ 无法获取缓存状态: ${(error as Error).message}`);
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🚀 图片处理性能测试工具\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-image-performance.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-image-performance.ts http://localhost:8000 your_api_key");
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
  
  await testImagePerformance(url, apiKey);
  await testCacheStatus(url, apiKey);
  
  console.log("\n🎉 图片处理性能测试完成！");
  console.log("\n💡 优化建议:");
  console.log("- 使用data URI格式的图片响应最快");
  console.log("- 重复使用的图片会被缓存，第二次访问更快");
  console.log("- 如果远程图片下载失败，考虑先转换为data URI");
  console.log("- 监控服务器日志查看详细的性能信息");
}

if (import.meta.main) {
  main().catch(console.error);
}
