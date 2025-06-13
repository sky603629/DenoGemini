#!/usr/bin/env -S deno run --allow-net

/**
 * 思考模型测试工具
 * 专门测试 Gemini 2.5 思考模型的响应格式
 */

const DEFAULT_URL = "http://localhost:8000";

interface ThinkingModelTest {
  name: string;
  model: string;
  prompt: string;
  description: string;
}

const thinkingTests: ThinkingModelTest[] = [
  {
    name: "基础思考测试",
    model: "gemini-2.0-flash-thinking-exp",
    prompt: "请思考一下：1+1等于多少？请展示你的思考过程。",
    description: "测试基本的思考过程展示"
  },
  {
    name: "JSON格式思考",
    model: "gemini-2.0-flash-thinking-exp", 
    prompt: "你是四水常在，请思考并用json格式回复：{\"nickname\": \"昵称\", \"reason\": \"理由\"}",
    description: "测试思考模型生成JSON格式的能力"
  },
  {
    name: "复杂推理思考",
    model: "gemini-2.0-flash-thinking-exp",
    prompt: "请思考：如果一个人说'我正在说谎'，这句话是真的还是假的？请详细展示你的思考过程。",
    description: "测试复杂逻辑推理的思考过程"
  }
];

async function testThinkingModel(test: ThinkingModelTest, baseUrl: string, apiKey: string) {
  console.log(`\n🧠 ${test.name}`);
  console.log(`📝 描述: ${test.description}`);
  console.log(`🤖 模型: ${test.model}`);
  console.log(`💭 提示: ${test.prompt.slice(0, 50)}...`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: test.model,
        messages: [
          { role: "user", content: test.prompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      })
    });

    const duration = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      console.log(`✅ 请求成功 - 耗时: ${duration}ms`);
      console.log(`📊 Token使用: ${data.usage?.total_tokens || '未知'}`);
      
      if (content) {
        console.log(`📄 内容类型: ${typeof content}`);
        console.log(`📏 内容长度: ${content.length} 字符`);
        
        // 分析思考内容
        const hasThinkTags = content.includes('<think>') && content.includes('</think>');
        console.log(`🧠 包含思考标签: ${hasThinkTags ? '是' : '否'}`);
        
        if (hasThinkTags) {
          // 提取思考部分
          const thinkMatch = content.match(/<think>(.*?)<\/think>/s);
          if (thinkMatch) {
            const thinkingContent = thinkMatch[1].trim();
            console.log(`💭 思考内容长度: ${thinkingContent.length} 字符`);
            console.log(`💭 思考内容预览: "${thinkingContent.slice(0, 100)}..."`);
          }
          
          // 提取最终回答
          const afterThink = content.split('</think>')[1];
          if (afterThink) {
            const finalAnswer = afterThink.trim();
            console.log(`💬 最终回答长度: ${finalAnswer.length} 字符`);
            console.log(`💬 最终回答预览: "${finalAnswer.slice(0, 100)}..."`);
          }
        } else {
          console.log(`💬 完整回复预览: "${content.slice(0, 200)}..."`);
        }
        
        // 检查是否为空或null
        if (content === null || content === undefined) {
          console.log(`❌ 内容为空值！这会导致应用端错误`);
        } else if (content.trim() === "") {
          console.log(`❌ 内容为空字符串！这可能导致应用端错误`);
        } else {
          console.log(`✅ 内容正常，应用端应该能正确处理`);
        }
        
      } else {
        console.log(`❌ 响应中没有内容字段`);
      }
      
    } else {
      console.log(`❌ 请求失败: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`错误详情: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`❌ 请求异常: ${(error as Error).message}`);
  }
}

async function compareWithRegularModel(baseUrl: string, apiKey: string) {
  console.log(`\n🔄 对比测试：普通模型 vs 思考模型\n`);
  
  const testPrompt = "请用json格式回复：{\"nickname\": \"测试\", \"reason\": \"对比测试\"}";
  
  const models = [
    { name: "普通模型", model: "gemini-2.0-flash" },
    { name: "思考模型", model: "gemini-2.0-flash-thinking-exp" }
  ];
  
  for (const { name, model } of models) {
    console.log(`📋 测试 ${name} (${model})`);
    
    try {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: "user", content: testPrompt }],
          max_tokens: 200
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        console.log(`   ✅ 成功`);
        console.log(`   📄 内容类型: ${typeof content}`);
        console.log(`   🧠 包含思考: ${content?.includes('<think>') ? '是' : '否'}`);
        console.log(`   💬 内容预览: "${content?.slice(0, 100) || '无内容'}..."`);
        
      } else {
        console.log(`   ❌ 失败: ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ 异常: ${(error as Error).message}`);
    }
  }
}

async function main() {
  const url = Deno.args[0] || DEFAULT_URL;
  const apiKey = Deno.args[1];
  
  console.log("🧠 思考模型测试工具");
  console.log("专门测试 Gemini 2.5 思考模型的响应格式和内容处理\n");
  
  if (!apiKey) {
    console.log("❌ 请提供API密钥");
    console.log("   使用方法: deno run --allow-net test-thinking-models.ts [URL] <API密钥>");
    console.log("   示例: deno run --allow-net test-thinking-models.ts http://localhost:8000 your_api_key");
    return;
  }
  
  // 检查服务器连接
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
  
  console.log(`🌐 连接到: ${url}\n`);
  
  // 运行思考模型测试
  for (const test of thinkingTests) {
    await testThinkingModel(test, url, apiKey);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 延迟1秒
  }
  
  // 对比测试
  await compareWithRegularModel(url, apiKey);
  
  console.log(`\n📋 测试总结:`);
  console.log(`✅ 思考模型测试完成`);
  console.log(`\n💡 关键发现:`);
  console.log(`1. 思考模型会在 <think> 标签中展示推理过程`);
  console.log(`2. 最终回答在 </think> 标签之后`);
  console.log(`3. 您的应用端需要正确解析这种格式`);
  console.log(`4. 确保正则表达式能处理完整的思考内容`);
  
  console.log(`\n🔧 应用端修复建议:`);
  console.log(`在您的 Python 代码中添加空值检查:`);
  console.log(`if content is not None:`);
  console.log(`    match = re.search(r"(?:<think>)?(.*?)</think>", content, re.DOTALL)`);
  console.log(`else:`);
  console.log(`    logger.warning("收到空响应")`);
  console.log(`    content = "默认回复"`);
}

if (import.meta.main) {
  main().catch(console.error);
}
