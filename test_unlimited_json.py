#!/usr/bin/env python3
"""
无限制 JSON 测试
验证 JSON 请求完全忽略 token 限制
"""

import requests
import json
import sys

def test_unlimited_json(api_key: str, base_url: str):
    """测试无限制 JSON"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🚀 无限制 JSON 测试")
    print("验证 JSON 请求完全忽略用户 token 限制")
    print("=" * 60)
    
    # 极端小 token 设置测试
    test_cases = [
        {
            "name": "极小 token (10) - 应该忽略",
            "max_tokens": 10
        },
        {
            "name": "很小 token (50) - 应该忽略", 
            "max_tokens": 50
        },
        {
            "name": "小 token (100) - 应该忽略",
            "max_tokens": 100
        },
        {
            "name": "中等 token (256) - 应该忽略",
            "max_tokens": 256
        },
        {
            "name": "较大 token (1000) - 应该忽略",
            "max_tokens": 1000
        }
    ]
    
    success_count = 0
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}: {test_case['name']}")
        print("-" * 40)
        
        payload = {
            "model": "gemini-2.5-flash-preview-05-20",
            "messages": [
                {
                    "role": "user",
                    "content": f'你是四水常在，请给用户取昵称，用户QQ昵称是测试用户{i}。请用json给出你的想法，并详细说明理由，示例：{{"nickname": "昵称", "reason": "详细的理由说明"}}'
                }
            ],
            "max_tokens": test_case["max_tokens"]
        }
        
        try:
            response = requests.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = data.get('usage', {})
                
                completion_tokens = usage.get('completion_tokens', 0)
                user_setting = test_case["max_tokens"]
                
                print(f"✅ 请求成功")
                print(f"📊 用户设置: {user_setting} tokens")
                print(f"📊 实际输出: {completion_tokens} tokens")
                
                if completion_tokens > user_setting:
                    print(f"🎉 成功忽略用户限制！(输出 {completion_tokens} > 设置 {user_setting})")
                    
                    # 验证 JSON 格式
                    try:
                        parsed = json.loads(content)
                        if "nickname" in parsed and "reason" in parsed:
                            print(f"✅ JSON 格式完整")
                            print(f"🎯 昵称: {parsed['nickname']}")
                            print(f"💭 理由长度: {len(parsed['reason'])} 字符")
                            success_count += 1
                        else:
                            print(f"❌ JSON 字段不完整")
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON 解析失败: {e}")
                else:
                    print(f"❌ 未能忽略用户限制 (输出 {completion_tokens} <= 设置 {user_setting})")
                    
            else:
                print(f"❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    print(f"\n🎯 无限制测试结果:")
    print(f"✅ 成功忽略限制: {success_count}/{len(test_cases)} ({success_count/len(test_cases)*100:.1f}%)")
    
    if success_count == len(test_cases):
        print(f"🎉 完美！JSON 请求完全无限制！")
    elif success_count >= len(test_cases) * 0.8:
        print(f"👍 很好！大部分请求成功忽略限制")
    else:
        print(f"⚠️ 仍需进一步优化")

def test_model_comparison(api_key: str, base_url: str):
    """测试不同模型的无限制效果"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n🤖 不同模型无限制测试")
    print("=" * 40)
    
    models = [
        {"name": "gemini-2.5-flash-preview-05-20", "expected_max": 65536},
        {"name": "gemini-1.5-flash", "expected_max": 8192}
    ]
    
    for model in models:
        print(f"\n📋 测试模型: {model['name']}")
        print(f"   预期最大 tokens: {model['expected_max']}")
        
        payload = {
            "model": model["name"],
            "messages": [
                {
                    "role": "user",
                    "content": '请用json格式返回详细的用户信息，包含多个字段和详细描述，示例：{"name": "姓名", "description": "详细描述"}'
                }
            ],
            "max_tokens": 50  # 极小设置
        }
        
        try:
            response = requests.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                completion_tokens = data.get('usage', {}).get('completion_tokens', 0)
                
                print(f"   ✅ 实际输出: {completion_tokens} tokens")
                
                if completion_tokens > 50:
                    print(f"   🎉 成功使用最大值 (忽略用户设置 50)")
                else:
                    print(f"   ❌ 未能忽略用户限制")
            else:
                print(f"   ❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 异常: {e}")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_unlimited_json.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: 验证 JSON 请求完全无限制")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行无限制测试
    test_unlimited_json(api_key, base_url)
    
    # 运行模型对比测试
    test_model_comparison(api_key, base_url)
    
    print(f"\n📋 无限制策略:")
    print(f"🚀 JSON 请求完全忽略用户 max_tokens 设置")
    print(f"🧠 2.5 模型: 使用最大值 65,536 tokens")
    print(f"⚡ 1.5 模型: 使用最大值 8,192 tokens")
    print(f"💬 普通对话: 仍然尊重用户设置")
    print(f"📊 保证服务稳定性和响应完整性")

if __name__ == "__main__":
    main()
