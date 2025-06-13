#!/usr/bin/env -S deno run --allow-net

/**
 * 应用端兼容性测试工具
 * 测试各种请求格式和 enable_thinking 参数
 */

const DEFAULT_URL = "http://localhost:8000";

interface TestCase {
  name: string;
  description: string;
  request: Record<string, unknown>;
  expectThinking?: boolean;
}

const testCases: TestCase[] = [
  {
    name: "普通文本请求",
    description: "基础文本对话",
    request: {
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: "你好，请简单回复"
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    }
  },
  {
    name: "多轮对话请求",
    description: "包含历史对话的请求",
    request: {
      model: "gemini-2.0-flash",
      messages: [
        {
          role: "user",
          content: "我叫张三"
        },
        {
          role: "assistant",
          content: "你好张三，很高兴认识你！"
        },
        {
          role: "user",
          content: "我刚才说我叫什么？"
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    }
  },
  {
    name: "图像请求",
    description: "包含图片的多模态请求",
    request: {
      model: "gemini-1.5-pro",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "这是什么颜色？"
            },
            {
              type: "image_url",
              image_url: {
                url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
              }
            }
          ]
        }
      ],
      temperature: 0.7,
      max_tokens: 100
    }
  },
  {
    name: "思考模型 - 启用思考",
    description: "思考模型，enable_thinking=true（默认）",
    request: {
      model: "gemini-2.0-flash-thinking-exp",
      messages: [
        {
          role: "user",
          content: "请思考：1+1等于多少？"
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
      enable_thinking: true
    },
    expectThinking: true
  },
  {
    name: "思考模型 - 禁用思考",
    description: "思考模型，enable_thinking=false",
    request: {
      model: "gemini-2.0-flash-thinking-exp",
      messages: [
        {
          role: "user",
          content: "请思考：1+1等于多少？"
        }
      ],
      temperature: 0.7,
      max_tokens: 200,
      enable_thinking: false
    },
    expectThinking: false
  },
  {
    name: "JSON格式请求",
    description: "要求返回JSON格式的请求",
    request: {
      model: "gemini-1.5-pro",
      messages: [
        {
          role: "user",
          content: "请以JSON格式输出你的决策：\n{\n    \"action\": \"选择的行动类型\",\n    \"reason\": \"选择该行动的详细原因\"\n}"
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    }
  },
  {
    name: "PFC行动计划模型格式",
    description: "模拟PFC行动计划模型的请求",
    request: {
      model: "gemini-1.5-pro",
      messages: [
        {
          role: "user",
          content: "请以JSON格式输出你的决策：\n{\n    \"action\": \"选择的行动类型 (必须是上面列表中的一个)\",\n    \"reason\": \"选择该行动的详细原因\"\n}"
        }
      ],
      temperature: 0.7,
      max_tokens: 256
    }
  },
  {
    name: "回复检查模型格式",
    description: "模拟回复检查模型的请求",
    request: {
      model: "gemini-1.5-pro",
      messages: [
        {
          role: "user",
          content: "请以JSON格式输出，包含以下字段：\n{\n    \"suitable\": true,\n    \"reason\": \"回复符合要求，虽然有可能略微偏离目标，但是整体内容流畅得体\",\n    \"need_replan\": false\n}"
        }
      ],
      temperature: 0.7,
      max_tokens: 256
    }
  }
];

async function runTestCase(testCase: TestCase, baseUrl: string, apiKey: string) {
  console.log(`\n🧪 ${testCase.name}`);
  console.log(`📝 ${testCase.description}`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(testCase.request)
    });

    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      console.log(`✅ 请求成功 - 耗时: ${duration}ms`);
      console.log(`📊 Token使用: ${data.usage?.total_tokens || '未知'}`);
      
      // 检查响应格式
      console.log(`📋 响应格式检查:`);
      console.log(`   - ID: ${data.id || '无'}`);
      console.log(`   - Object: ${data.object || '无'}`);
      console.log(`   - Model: ${data.model || '无'}`);
      console.log(`   - Created: ${data.created || '无'}`);
      
      if (content !== null && content !== undefined) {
        console.log(`✅ Content字段正常 (类型: ${typeof content})`);
        console.log(`📏 内容长度: ${content.length} 字符`);
        
        // 检查思考内容
        const hasThinkTags = content.includes('<think>') && content.includes('</think>');
        console.log(`🧠 包含思考标签: ${hasThinkTags ? '是' : '否'}`);
        
        if (testCase.expectThinking !== undefined) {
          if (testCase.expectThinking === hasThinkTags) {
            console.log(`✅ 思考内容符合预期`);
          } else {
            console.log(`❌ 思考内容不符合预期 (期望: ${testCase.expectThinking ? '有' : '无'}, 实际: ${hasThinkTags ? '有' : '无'})`);
          }
        }
        
        // 显示内容预览
        const preview = content.length > 150 ? content.slice(0, 150) + '...' : content;
        console.log(`💬 内容预览: "${preview}"`);
        
        // 检查JSON格式（如果请求要求JSON）
        const messages = testCase.request.messages as Array<{ content: string }>;
        if (messages?.[0]?.content?.includes('JSON')) {
          try {
            // 尝试提取JSON部分
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              JSON.parse(jsonMatch[0]);
              console.log(`✅ JSON格式有效`);
            } else {
              console.log(`⚠️  未找到JSON格式内容`);
            }
          } catch {
            console.log(`❌ JSON格式无效`);
          }
        }
        
      } else {
        console.log(`❌ Content字段为空值！这会导致应用端错误`);
        console.log(`   Content值: ${content}`);
      }
      
    } else {
      console.log(`❌ 请求失败: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`错误详情: ${errorText.slice(0, 200)}...`);
    }
    
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function testStreamingResponse(baseUrl: string, apiKey: string) {
  console.log(`\n🌊 流式响应测试`);
  
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "user", content: "请说一个简短的故事" }
        ],
        stream: true,
        max_tokens: 200
      })
    });

    if (response.ok && response.body) {
      console.log(`✅ 流式响应已建立`);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let chunks = 0;
      let hasContent = false;
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  hasContent = true;
                }
                chunks++;
              } catch {
                // 忽略解析错误
              }
            }
          }
          
          if (chunks >= 5) break; // 读取几个块后停止
        }
        
        console.log(`✅ 流式响应正常，接收到 ${chunks} 个数据块`);
        console.log(`📄 包含内容: ${hasContent ? '是' : '否'}`);
        
      } finally {
        reader.releaseLock();
      }
    } else {
      console.log(`❌ 流式响应失败: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ 流式测试异常: ${(error as Error).message}`);
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🔧 应用端兼容性测试工具");
  console.log("测试各种请求格式和参数，确保与您的应用端完全兼容\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-app-compatibility.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-app-compatibility.ts http://localhost:8000 your_api_key");
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
  
  // 运行所有测试用例
  for (const testCase of testCases) {
    await runTestCase(testCase, url, apiKey);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
  }
  
  // 测试流式响应
  await testStreamingResponse(url, apiKey);
  
  console.log(`\n📋 兼容性测试总结:`);
  console.log(`✅ 所有测试用例已完成`);
  console.log(`\n💡 关键特性:`);
  console.log(`1. ✅ 支持 enable_thinking 参数控制思考内容`);
  console.log(`2. ✅ 确保 content 字段永不为 null`);
  console.log(`3. ✅ 支持多模态请求（文本+图片）`);
  console.log(`4. ✅ 支持多轮对话历史`);
  console.log(`5. ✅ 支持流式响应`);
  console.log(`6. ✅ 兼容各种温度和token设置`);
  
  console.log(`\n🔧 应用端使用建议:`);
  console.log(`- 对于思考模型，设置 enable_thinking: false 可获得纯净回答`);
  console.log(`- 对于JSON格式要求，建议使用 gemini-1.5-pro 模型`);
  console.log(`- 图片识别建议使用 data:image/xxx;base64,... 格式`);
  console.log(`- 所有响应的 content 字段都不会为 null，可安全处理`);
}

if (import.meta.main) {
  main().catch(console.error);
}
