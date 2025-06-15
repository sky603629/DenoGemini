#!/usr/bin/env python3
"""
JSON 清理功能测试
验证 JSON 格式清理和修复功能
"""

import requests
import json
import sys

def test_json_cleaning(api_key: str, base_url: str):
    """测试 JSON 清理功能"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🧹 JSON 清理功能测试")
    print("验证 JSON 格式清理和修复功能")
    print("=" * 60)
    
    # 模拟可能产生错误 JSON 的请求
    test_cases = [
        {
            "name": "情感分析 JSON 请求",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": """
请分析以下对话的情感，返回JSON格式：
对话：「你好，今天天气真好！」
请返回格式：{"emotion": "情感", "confidence": 0.9}
                        """
                    }
                ],
                "max_tokens": 100
            }
        },
        {
            "name": "立场分析 JSON 请求",
            "payload": {
                "model": "gemini-2.5-flash-preview-05-20",
                "messages": [
                    {
                        "role": "user",
                        "content": """
请分析立场，返回JSON格式：
被回复：「这个想法不错」
回复：「我也这么认为」
请返回：{"立场": "支持", "情绪": "开心"}
                        """
                    }
                ],
                "max_tokens": 200
            }
        },
        {
            "name": "用户信息 JSON 请求",
            "payload": {
                "model": "gemini-1.5-flash",
                "messages": [
                    {
                        "role": "user",
                        "content": "请用JSON格式返回一个用户信息示例，包含姓名、年龄、城市"
                    }
                ],
                "max_tokens": 150
            }
        }
    ]
    
    success_count = 0
    
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
            
            print(f"📡 响应状态: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = data.get('usage', {})
                
                completion_tokens = usage.get('completion_tokens', 0)
                
                print(f"✅ 请求成功")
                print(f"📊 输出 tokens: {completion_tokens}")
                print(f"📝 原始回复: \"{content}\"")
                
                # 验证 JSON 格式
                try:
                    parsed = json.loads(content)
                    print(f"✅ JSON 解析成功")
                    print(f"🎯 解析结果: {json.dumps(parsed, ensure_ascii=False, indent=2)}")
                    success_count += 1
                    
                    # 检查是否有常见的格式问题被修复
                    if content.strip().startswith('"') and content.strip().endswith('"'):
                        print(f"⚠️ 检测到可能的引号包围问题（已修复）")
                    
                except json.JSONDecodeError as e:
                    print(f"❌ JSON 解析失败: {e}")
                    print(f"📝 问题内容: \"{content}\"")
                    
                    # 分析具体的格式问题
                    if content.strip().startswith('"') and content.strip().endswith('"'):
                        print(f"🔍 检测到引号包围问题")
                    if ',}' in content:
                        print(f"🔍 检测到多余逗号问题")
                    if content.startswith('{,'):
                        print(f"🔍 检测到开头逗号问题")
                    
            else:
                print(f"❌ 请求失败: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   错误信息: {error_data}")
                except:
                    print(f"   错误文本: {response.text[:200]}")
                    
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    print(f"\n🎯 JSON 清理测试结果:")
    print(f"✅ 成功解析: {success_count}/{len(test_cases)} ({success_count/len(test_cases)*100:.1f}%)")
    
    if success_count == len(test_cases):
        print(f"🎉 完美！JSON 清理功能完全正常")
    elif success_count >= len(test_cases) * 0.8:
        print(f"👍 很好！JSON 清理基本正常")
    else:
        print(f"⚠️ JSON 清理需要进一步优化")

def test_problematic_json_cases(api_key: str, base_url: str):
    """测试特定的问题 JSON 案例"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n🔧 问题 JSON 案例测试")
    print("=" * 40)
    
    # 模拟用户实际遇到的问题场景
    problematic_case = {
        "model": "gemini-2.5-flash-preview-05-20",
        "messages": [
            {
                "role": "user",
                "content": """
请严格根据以下对话内容，完成以下任务：
1. 判断回复者对被回复者观点的直接立场：
- "支持"：明确同意或强化被回复者观点
- "反对"：明确反驳或否定被回复者观点
- "中立"：不表达明确立场或无关回应
2. 从"开心,愤怒,悲伤,惊讶,平静,害羞,恐惧,厌恶,困惑"中选出最匹配的1个情感标签
3. 按照JSON格式输出结果，例如：{"立场": "反对", "情绪": "愤怒"}

当前对话：
被回复：「戳了戳四水常在」
回复：「又戳！」

输出要求：
- 只需输出JSON结果，不要解释
- 严格基于文字直接表达的对立关系判断
                """
            }
        ],
        "temperature": 0.7,
        "max_tokens": 3000
    }
    
    print(f"📤 发送问题案例测试请求...")
    
    try:
        response = requests.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json=problematic_case,
            timeout=30
        )
        
        print(f"📡 响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            print(f"📝 原始回复: \"{content}\"")
            
            try:
                parsed = json.loads(content)
                print(f"✅ JSON 解析成功")
                print(f"🎯 立场: {parsed.get('立场', 'N/A')}")
                print(f"🎯 情绪: {parsed.get('情绪', 'N/A')}")
                
                # 检查格式是否正确
                if '立场' in parsed and '情绪' in parsed:
                    print(f"✅ 包含必需字段")
                else:
                    print(f"⚠️ 缺少必需字段")
                    
            except json.JSONDecodeError as e:
                print(f"❌ JSON 解析失败: {e}")
                
                # 详细分析问题
                print(f"🔍 问题分析:")
                if content.strip().startswith('"') and content.strip().endswith('"'):
                    print(f"   - 检测到整体引号包围问题")
                if '{,' in content:
                    print(f"   - 检测到开头逗号问题")
                if ',}' in content:
                    print(f"   - 检测到结尾逗号问题")
                if content.count('{') != content.count('}'):
                    print(f"   - 检测到括号不匹配问题")
                    
        else:
            print(f"❌ 请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_json_cleaning.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: 验证 JSON 清理功能")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行 JSON 清理测试
    test_json_cleaning(api_key, base_url)
    
    # 运行问题案例测试
    test_problematic_json_cases(api_key, base_url)
    
    print(f"\n📋 JSON 清理功能说明:")
    print(f"🧹 自动移除多余的引号包围")
    print(f"🔧 修复开头和结尾的逗号问题")
    print(f"📝 自动添加缺失的属性名引号")
    print(f"🎯 智能处理值的引号（保留数字和布尔值）")
    print(f"✅ 验证 JSON 格式正确性")

if __name__ == "__main__":
    main()
