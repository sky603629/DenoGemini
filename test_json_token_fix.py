#!/usr/bin/env python3
"""
JSON Token 修复测试
测试 JSON 请求的最小 token 保证是否生效
"""

import requests
import json
import sys

def test_json_token_fix(api_key: str, base_url: str):
    """测试 JSON token 修复"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🔧 JSON Token 修复测试")
    print("验证小 token 设置的 JSON 请求是否能正常工作")
    print("=" * 60)
    
    # 模拟应用端的实际请求场景
    test_cases = [
        {
            "name": "极小 token (50) - JSON 昵称生成",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": '你是四水常在，请给用户取昵称，用户QQ昵称是小语。请用json给出你的想法，示例：{"nickname": "昵称", "reason": "理由"}'
                    }
                ],
                "max_tokens": 50  # 极小设置
            },
            "expect_success": True
        },
        {
            "name": "小 token (100) - JSON 昵称生成",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": '你是四水常在，请给用户取昵称，用户QQ昵称是爱意随风起。请用json给出你的想法，示例：{"nickname": "昵称", "reason": "理由"}'
                    }
                ],
                "max_tokens": 100  # 小设置
            },
            "expect_success": True
        },
        {
            "name": "中等 token (256) - JSON 昵称生成",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": '你是四水常在，请给用户取昵称，用户QQ昵称是星陨阁风闲。请用json给出你的想法，示例：{"nickname": "昵称", "reason": "理由"}'
                    }
                ],
                "max_tokens": 256  # 应用端常用设置
            },
            "expect_success": True
        },
        {
            "name": "普通对话 - 小 token (100)",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": "你好，请简单介绍一下你自己"
                    }
                ],
                "max_tokens": 100  # 普通对话应该尊重用户设置
            },
            "expect_success": True,
            "is_json": False
        }
    ]
    
    success_count = 0
    total_count = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}: {test_case['name']}")
        print("-" * 40)
        
        try:
            response = requests.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=test_case["payload"],
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                choice = data.get('choices', [{}])[0]
                message = choice.get('message', {})
                content = message.get('content', '')
                usage = data.get('usage', {})
                
                completion_tokens = usage.get('completion_tokens', 0)
                user_max_tokens = test_case["payload"].get("max_tokens")
                is_json_test = test_case.get("is_json", True)
                
                print(f"✅ 请求成功")
                print(f"📊 Token 统计: 输出={completion_tokens}, 用户设置={user_max_tokens}")
                
                if completion_tokens > 0:
                    print(f"✅ 成功生成内容")
                    
                    # 检查是否超出用户设置（JSON 请求应该会自动调整）
                    if is_json_test and user_max_tokens < 512:
                        if completion_tokens >= 512:
                            print(f"✅ JSON 请求自动调整生效 (用户设置: {user_max_tokens}, 实际输出: {completion_tokens})")
                        else:
                            print(f"⚠️ JSON 请求可能未充分调整")
                    elif not is_json_test:
                        if completion_tokens <= user_max_tokens:
                            print(f"✅ 普通对话尊重用户设置 (设置: {user_max_tokens}, 实际: {completion_tokens})")
                        else:
                            print(f"⚠️ 普通对话超出用户设置")
                    
                    # 验证 JSON 格式
                    if is_json_test:
                        try:
                            parsed = json.loads(content)
                            print(f"✅ JSON 格式验证通过")
                            
                            if "nickname" in parsed and "reason" in parsed:
                                print(f"✅ 包含必需字段")
                                print(f"🎯 昵称: {parsed['nickname']}")
                                print(f"💭 理由: {parsed['reason'][:50]}...")
                                success_count += 1
                            else:
                                print(f"❌ 缺少必需字段")
                                
                        except json.JSONDecodeError as e:
                            print(f"❌ JSON 解析失败: {e}")
                            print(f"📝 内容: \"{content[:100]}...\"")
                    else:
                        # 普通对话
                        if "抱歉" not in content and "截断" not in content:
                            print(f"✅ 普通对话内容正常")
                            success_count += 1
                        else:
                            print(f"❌ 普通对话出现截断错误")
                        
                        preview = content[:100] + "..." if len(content) > 100 else content
                        print(f"📝 内容: \"{preview}\"")
                else:
                    print(f"❌ 输出 Token 为 0")
                    print(f"📝 内容: \"{content}\"")
                    
            else:
                print(f"❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    # 总结
    print(f"\n🎯 JSON Token 修复测试总结:")
    print("=" * 40)
    
    success_rate = (success_count / total_count) * 100
    print(f"✅ 成功率: {success_count}/{total_count} ({success_rate:.1f}%)")
    
    if success_rate >= 90:
        print(f"🎉 优秀！JSON Token 修复完全生效")
    elif success_rate >= 70:
        print(f"👍 良好！JSON Token 修复基本生效")
    else:
        print(f"⚠️ 需要进一步优化")

def test_repeated_requests(api_key: str, base_url: str):
    """重复测试相同请求，验证稳定性"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n🔄 重复请求稳定性测试")
    print("=" * 40)
    
    # 模拟应用端的实际请求
    test_payload = {
        "model": "gemini-2.5-flash-preview-05-20",
        "messages": [
            {
                "role": "user",
                "content": '你是四水常在，请给用户取昵称，用户QQ昵称是测试用户。请用json给出你的想法，示例：{"nickname": "昵称", "reason": "理由"}'
            }
        ],
        "max_tokens": 256
    }
    
    success_count = 0
    total_requests = 5
    
    for i in range(total_requests):
        print(f"\n📋 第 {i+1} 次请求:")
        
        try:
            response = requests.post(
                f"{base_url}/v1/chat/completions",
                headers=headers,
                json=test_payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                completion_tokens = data.get('usage', {}).get('completion_tokens', 0)
                
                if completion_tokens > 0:
                    try:
                        parsed = json.loads(content)
                        if "nickname" in parsed and "reason" in parsed:
                            print(f"✅ 成功 (tokens: {completion_tokens})")
                            success_count += 1
                        else:
                            print(f"❌ JSON 字段不完整")
                    except:
                        print(f"❌ JSON 解析失败")
                else:
                    print(f"❌ Token 为 0")
            else:
                print(f"❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 异常: {e}")
    
    print(f"\n📊 稳定性测试结果: {success_count}/{total_requests} ({success_count/total_requests*100:.1f}%)")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_json_token_fix.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: JSON Token 修复验证")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行 JSON Token 修复测试
    test_json_token_fix(api_key, base_url)
    
    # 运行重复请求稳定性测试
    test_repeated_requests(api_key, base_url)
    
    print(f"\n📋 修复说明:")
    print(f"✅ JSON 请求最小 token 保证: 512")
    print(f"✅ 普通对话完全尊重用户设置")
    print(f"✅ 自动检测并调整 JSON 请求")
    print(f"✅ 记录调整日志便于调试")

if __name__ == "__main__":
    main()
