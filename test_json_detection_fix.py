#!/usr/bin/env python3
"""
精确 JSON 检测测试
验证修复后的 JSON 检测不会误判普通对话
"""

import requests
import json
import sys

def test_json_detection_accuracy(api_key: str, base_url: str):
    """测试 JSON 检测准确性"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🎯 精确 JSON 检测测试")
    print("验证 JSON 检测不会误判普通对话")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "普通对话 - 不应该被检测为 JSON",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": "你现在正在做的事情是：阿明在自己的房间里，听到四水常在房间里传来的键盘敲击声。请继续这个故事。"
                    }
                ],
                "max_tokens": 256,
                "temperature": 0.2
            },
            "expect_json": False,
            "expect_unlimited_tokens": False
        },
        {
            "name": "包含大括号的普通对话 - 不应该被检测为 JSON",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": """
请分析以下对话：
被回复：「戳了戳四水常在」
回复：「{,"response":,"@铃鹿酱;又戳！"}」

请分析回复者的情感。
                        """
                    }
                ],
                "max_tokens": 300
            },
            "expect_json": False,
            "expect_unlimited_tokens": False
        },
        {
            "name": "明确的 JSON 请求 - 应该被检测为 JSON",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": "请用JSON格式返回用户信息，包含姓名和年龄"
                    }
                ],
                "max_tokens": 100
            },
            "expect_json": True,
            "expect_unlimited_tokens": True
        },
        {
            "name": "JSON 示例请求 - 应该被检测为 JSON",
            "payload": {
                "model": "gemini-1.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": "请返回JSON格式的结果，示例：{\"name\": \"张三\", \"age\": 25}"
                    }
                ],
                "max_tokens": 150
            },
            "expect_json": True,
            "expect_unlimited_tokens": True
        },
        {
            "name": "普通编程讨论 - 不应该被检测为 JSON",
            "payload": {
                "model": "gemini-1.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": "在JavaScript中，如何创建一个对象？比如 {name: 'test'} 这样的语法对吗？"
                    }
                ],
                "max_tokens": 200
            },
            "expect_json": False,
            "expect_unlimited_tokens": False
        }
    ]
    
    success_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}: {test_case['name']}")
        print("-" * 50)
        
        try:
            response = requests.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=test_case["payload"],
                timeout=30
            )
            
            print(f"📡 响应状态: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = data.get('usage', {})
                
                completion_tokens = usage.get('completion_tokens', 0)
                user_max_tokens = test_case["payload"].get("max_tokens")
                expect_json = test_case.get("expect_json", False)
                expect_unlimited = test_case.get("expect_unlimited_tokens", False)
                
                print(f"✅ 请求成功")
                print(f"📊 用户设置: {user_max_tokens} tokens")
                print(f"📊 实际输出: {completion_tokens} tokens")
                
                # 检查是否被误判为 JSON 请求
                was_treated_as_json = completion_tokens > user_max_tokens * 2  # 如果输出远超用户设置，说明被当作 JSON 处理
                
                if expect_json:
                    if was_treated_as_json:
                        print(f"✅ 正确识别为 JSON 请求")
                        success_count += 1
                    else:
                        print(f"❌ 应该识别为 JSON 但没有")
                else:
                    if not was_treated_as_json:
                        print(f"✅ 正确识别为普通对话")
                        success_count += 1
                    else:
                        print(f"❌ 被误判为 JSON 请求")
                
                # 检查内容是否被截断
                if "再费脑子也要注意" in content and not content.strip().endswith("。"):
                    print(f"⚠️ 检测到内容被截断")
                elif completion_tokens > 0:
                    print(f"✅ 内容完整")
                
                # 显示内容预览
                preview = content[:100] + "..." if len(content) > 100 else content
                print(f"📝 内容预览: \"{preview}\"")
                
                # 如果期望是 JSON，验证格式
                if expect_json:
                    try:
                        json.loads(content)
                        print(f"✅ JSON 格式正确")
                    except json.JSONDecodeError:
                        print(f"⚠️ JSON 格式有问题")
                
            else:
                print(f"❌ 请求失败: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   错误信息: {error_data}")
                except:
                    print(f"   错误文本: {response.text[:200]}")
                    
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    print(f"\n🎯 JSON 检测准确性测试结果:")
    print(f"✅ 准确识别: {success_count}/{len(test_cases)} ({success_count/len(test_cases)*100:.1f}%)")
    
    if success_count == len(test_cases):
        print(f"🎉 完美！JSON 检测完全准确")
    elif success_count >= len(test_cases) * 0.8:
        print(f"👍 很好！JSON 检测基本准确")
    else:
        print(f"⚠️ JSON 检测需要进一步优化")

def test_story_continuation(api_key: str, base_url: str):
    """专门测试故事续写场景"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n📖 故事续写专项测试")
    print("=" * 40)
    
    story_payload = {
        "model": "gemini-2.5-flash-preview-05-20",
        "messages": [
            {
                "role": "user",
                "content": """
你现在正在做的事情是：阿明在自己的房间里，听到四水常在房间里传来的键盘敲击声和各种奇怪的哼唱声，忍不住笑了笑。他知道四水常在又进入了他的"代码狂魔"模式，这种时候，除了吃饭睡觉，其他任何事情都无法打扰他。

请继续这个故事，描述四水常在在房间里编程的情景。
                """
            }
        ],
        "max_tokens": 256,
        "temperature": 0.2
    }
    
    print(f"📤 发送故事续写请求...")
    
    try:
        response = requests.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json=story_payload,
            timeout=30
        )
        
        print(f"📡 响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            usage = data.get('usage', {})
            
            completion_tokens = usage.get('completion_tokens', 0)
            user_max_tokens = 256
            
            print(f"📊 用户设置: {user_max_tokens} tokens")
            print(f"📊 实际输出: {completion_tokens} tokens")
            
            # 检查是否尊重用户的 token 限制
            if completion_tokens <= user_max_tokens * 1.2:  # 允许小幅超出
                print(f"✅ 正确尊重用户 token 限制")
            else:
                print(f"❌ 超出用户 token 限制过多，可能被误判为 JSON")
            
            # 检查内容完整性
            if content.strip() and not content.endswith("...") and len(content) > 50:
                print(f"✅ 故事内容完整")
            else:
                print(f"⚠️ 故事内容可能被截断")
            
            print(f"📝 故事内容:")
            print(f"   {content}")
            
        else:
            print(f"❌ 请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_json_detection_fix.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: 验证精确 JSON 检测")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行 JSON 检测准确性测试
    test_json_detection_accuracy(api_key, base_url)
    
    # 运行故事续写专项测试
    test_story_continuation(api_key, base_url)
    
    print(f"\n📋 修复说明:")
    print(f"🎯 移除过于宽泛的关键词 (如 '{{' 和 '}}')")
    print(f"🔍 添加精确的 JSON 模式匹配")
    print(f"📝 区分 JSON 请求和包含 JSON 的普通对话")
    print(f"⚡ 普通对话完全尊重用户 token 设置")
    print(f"🧹 JSON 请求仍然使用无限制策略")

if __name__ == "__main__":
    main()
