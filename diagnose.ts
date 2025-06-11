#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * 网络诊断工具
 * 用于诊断 Gemini API 连接问题
 */

import { configManager } from "./config/env.ts";

async function testDNS() {
  console.log("🔍 测试 DNS 解析...");
  try {
    const hostname = "generativelanguage.googleapis.com";
    // 简单的 DNS 测试
    const response = await fetch(`https://${hostname}`, { 
      method: "HEAD",
      signal: AbortSignal.timeout(5000)
    });
    console.log(`✅ DNS 解析成功: ${hostname}`);
    return true;
  } catch (error) {
    console.log(`❌ DNS 解析失败: ${(error as Error).message}`);
    return false;
  }
}

async function testGeminiAPI() {
  console.log("\n🔍 测试 Gemini API 连接...");
  
  try {
    await configManager.loadConfig();
    const apiKey = configManager.getNextApiKey();
    
    // 测试模型列表 API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Deno-Gemini-Proxy/1.0",
        },
        signal: AbortSignal.timeout(10000)
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Gemini API 连接成功`);
      console.log(`   状态码: ${response.status}`);
      console.log(`   模型数量: ${data.models?.length || 0}`);
      return true;
    } else {
      console.log(`❌ Gemini API 响应错误: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`   错误详情: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Gemini API 连接失败: ${(error as Error).message}`);
    return false;
  }
}

async function testSimpleGeneration() {
  console.log("\n🔍 测试简单文本生成...");
  
  try {
    await configManager.loadConfig();
    const apiKey = configManager.getNextApiKey();
    
    const requestBody = {
      contents: [{
        role: "user",
        parts: [{ text: "请简单回复'测试成功'" }]
      }],
      generationConfig: {
        maxOutputTokens: 10
      }
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Deno-Gemini-Proxy/1.0",
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15000)
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 文本生成测试成功`);
      console.log(`   状态码: ${response.status}`);
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "无内容";
      console.log(`   生成内容: ${content}`);
      return true;
    } else {
      console.log(`❌ 文本生成测试失败: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`   错误详情: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 文本生成测试失败: ${(error as Error).message}`);
    return false;
  }
}

async function testNetworkInfo() {
  console.log("\n🔍 网络环境信息...");
  
  // 检查是否在代理环境中
  const httpProxy = Deno.env.get("HTTP_PROXY") || Deno.env.get("http_proxy");
  const httpsProxy = Deno.env.get("HTTPS_PROXY") || Deno.env.get("https_proxy");
  
  if (httpProxy || httpsProxy) {
    console.log("⚠️  检测到代理设置:");
    if (httpProxy) console.log(`   HTTP_PROXY: ${httpProxy}`);
    if (httpsProxy) console.log(`   HTTPS_PROXY: ${httpsProxy}`);
  } else {
    console.log("ℹ️  未检测到代理设置");
  }
  
  // 显示操作系统信息
  console.log(`ℹ️  操作系统: ${Deno.build.os} ${Deno.build.arch}`);
  console.log(`ℹ️  Deno 版本: ${Deno.version.deno}`);
}

async function main() {
  console.log("🚀 Gemini API 网络诊断工具\n");
  
  // 显示网络环境信息
  await testNetworkInfo();
  
  // 测试 DNS
  const dnsOk = await testDNS();
  
  // 测试 API 连接
  const apiOk = await testGeminiAPI();
  
  // 测试文本生成
  const genOk = await testSimpleGeneration();
  
  console.log("\n📊 诊断结果:");
  console.log(`   DNS 解析: ${dnsOk ? "✅ 正常" : "❌ 失败"}`);
  console.log(`   API 连接: ${apiOk ? "✅ 正常" : "❌ 失败"}`);
  console.log(`   文本生成: ${genOk ? "✅ 正常" : "❌ 失败"}`);
  
  if (dnsOk && apiOk && genOk) {
    console.log("\n🎉 所有测试通过！网络连接正常。");
    console.log("如果服务器仍有问题，可能是并发请求或特定模型的问题。");
  } else {
    console.log("\n⚠️  发现网络问题，建议:");
    if (!dnsOk) {
      console.log("   - 检查 DNS 设置");
      console.log("   - 尝试使用不同的 DNS 服务器 (如 8.8.8.8)");
    }
    if (!apiOk) {
      console.log("   - 检查 API 密钥是否有效");
      console.log("   - 检查网络防火墙设置");
      console.log("   - 如果在公司网络，可能需要配置代理");
    }
    if (!genOk) {
      console.log("   - 检查 API 配额是否充足");
      console.log("   - 尝试使用不同的模型");
    }
  }
}

if (import.meta.main) {
  main().catch(console.error);
}
