#!/usr/bin/env -S deno run --allow-net

/**
 * 流式响应测试工具
 * 专门测试流式聊天功能
 */

const DEFAULT_URL = "http://localhost:8000";

async function testStreamingChat(baseUrl: string, apiKey: string) {
  console.log(`🌊 测试流式聊天: ${baseUrl}\n`);

  const testCases = [
    {
      name: "简单文本流式响应",
      messages: [{ role: "user", content: "请简单回复'流式测试成功'" }],
      maxTokens: 50
    },
    {
      name: "较长文本流式响应", 
      messages: [{ role: "user", content: "请用50字左右介绍一下人工智能" }],
      maxTokens: 100
    },
    {
      name: "对话式流式响应",
      messages: [
        { role: "user", content: "你好" },
        { role: "assistant", content: "你好！我是AI助手。" },
        { role: "user", content: "请告诉我今天天气怎么样" }
      ],
      maxTokens: 80
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`${i + 1}. ${testCase.name}...`);
    
    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gemini-1.5-pro",
          messages: testCase.messages,
          stream: true,
          max_tokens: testCase.maxTokens
        })
      });

      if (!response.ok) {
        console.log(`❌ 请求失败: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   错误: ${errorText}`);
        continue;
      }

      if (!response.body) {
        console.log("❌ 没有响应体");
        continue;
      }

      console.log("✅ 开始接收流式数据...");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let chunks = 0;
      let content = "";
      let hasRole = false;
      let isComplete = false;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
            
            const data = trimmedLine.slice(6); // 移除 'data: '
            
            if (data === '[DONE]') {
              isComplete = true;
              break;
            }
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.choices && parsed.choices[0]) {
                const choice = parsed.choices[0];
                const delta = choice.delta;
                
                if (delta.role) {
                  hasRole = true;
                }
                
                if (delta.content) {
                  content += delta.content;
                  chunks++;
                }
                
                if (choice.finish_reason) {
                  console.log(`   完成原因: ${choice.finish_reason}`);
                }
              }
            } catch (_parseError) {
              // 忽略解析错误，继续处理
            }
          }
          
          if (isComplete) break;
        }
        
        console.log(`✅ 流式响应完成`);
        console.log(`   接收块数: ${chunks}`);
        console.log(`   包含角色: ${hasRole ? '是' : '否'}`);
        console.log(`   生成内容: "${content}"`);
        console.log(`   内容长度: ${content.length} 字符`);
        
      } catch (streamError) {
        console.log(`❌ 流读取错误: ${(streamError as Error).message}`);
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      console.log(`❌ 测试失败: ${(error as Error).message}`);
    }
    
    console.log(); // 空行分隔
  }
}

async function testNonStreamingComparison(baseUrl: string, apiKey: string) {
  console.log("🔄 对比非流式响应...\n");
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemini-1.5-pro",
        messages: [{ role: "user", content: "请简单回复'非流式测试成功'" }],
        stream: false,
        max_tokens: 50
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ 非流式响应成功");
      console.log(`   回复: "${data.choices?.[0]?.message?.content || '无内容'}"`);
      console.log(`   使用token: ${data.usage?.total_tokens || '未知'}`);
    } else {
      console.log(`❌ 非流式响应失败: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误: ${errorText}`);
    }
  } catch (error) {
    console.log(`❌ 非流式测试失败: ${(error as Error).message}`);
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🚀 流式响应测试工具\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-stream.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-stream.ts http://localhost:8000 your_api_key");
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
  
  await testStreamingChat(url, apiKey);
  await testNonStreamingComparison(url, apiKey);
  
  console.log("🎉 流式响应测试完成！");
  console.log("\n💡 提示:");
  console.log("- 如果看到JSON解析错误，这是正常的，已经被优化处理");
  console.log("- 流式响应应该逐步返回内容");
  console.log("- 检查生成的内容是否完整和合理");
}

if (import.meta.main) {
  main().catch(console.error);
}
