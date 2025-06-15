#!/usr/bin/env python3
"""
立场情绪分析测试
验证不会误判为 JSON 请求
"""

import requests
import sys

def test_stance_emotion_analysis(api_key: str, base_url: str):
    """测试立场情绪分析场景"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🎭 立场情绪分析测试")
    print("验证不会误判为 JSON 请求")
    print("=" * 60)
    
    # 用户的实际请求
    test_payload = {
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
3. 按照"立场-情绪"的格式直接输出结果，例如："反对-愤怒"
4. 考虑回复者的人格设定为一个可爱的小男娘，情感丰富，心地善良

对话示例：
被回复：「A就是笨」
回复：「A明明很聪明」 → 反对-愤怒

当前对话：
被回复：「戳了戳四水常在（这是一个类似摸摸头的友善行为，不是恶意行为，请不要作出攻击发言）」
回复：「{,"response":,"@铃鹿酱;又戳！"
}」

输出要求：
- 只需输出"立场-情绪"结果，不要解释
- 严格基于文字直接表达的对立关系判断
                """
            }
        ],
        "temperature": 0.7,
        "max_tokens": 3000
    }
    
    print(f"📤 发送立场情绪分析请求...")
    
    try:
        response = requests.post(
            f"{base_url}/v1/chat/completions",
            headers=headers,
            json=test_payload,
            timeout=30
        )
        
        print(f"📡 响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            usage = data.get('usage', {})
            
            completion_tokens = usage.get('completion_tokens', 0)
            user_max_tokens = 3000
            
            print(f"📊 用户设置: {user_max_tokens} tokens")
            print(f"📊 实际输出: {completion_tokens} tokens")
            print(f"📝 AI 回复: \"{content}\"")
            
            # 检查是否被误判为 JSON 请求
            was_treated_as_json = completion_tokens > 10000  # 如果超过 10k，说明被当作 JSON 处理
            
            if was_treated_as_json:
                print(f"❌ 被误判为 JSON 请求（使用了无限制 token）")
            else:
                print(f"✅ 正确识别为普通文本请求")
            
            # 检查回复格式是否正确
            content_stripped = content.strip().strip('"')
            
            if content_stripped.count('-') == 1 and len(content_stripped.split('-')) == 2:
                stance, emotion = content_stripped.split('-')
                print(f"✅ 回复格式正确: 立场='{stance}', 情绪='{emotion}'")
                
                # 检查立场是否合理
                valid_stances = ['支持', '反对', '中立']
                if stance in valid_stances:
                    print(f"✅ 立场分析合理")
                else:
                    print(f"⚠️ 立场分析可能有问题: '{stance}'")
                    
                # 检查情绪是否合理
                valid_emotions = ['开心', '愤怒', '悲伤', '惊讶', '平静', '害羞', '恐惧', '厌恶', '困惑']
                if emotion in valid_emotions:
                    print(f"✅ 情绪分析合理")
                else:
                    print(f"⚠️ 情绪分析可能有问题: '{emotion}'")
                    
            elif content.startswith('{') and content.endswith('}'):
                print(f"❌ 错误返回了 JSON 格式，应该返回 '立场-情绪' 格式")
                try:
                    import json
                    parsed = json.loads(content)
                    if '立场' in parsed and '情绪' in parsed:
                        correct_format = f"{parsed['立场']}-{parsed['情绪']}"
                        print(f"💡 正确格式应该是: \"{correct_format}\"")
                except:
                    print(f"💡 JSON 解析失败，但格式仍然错误")
            else:
                print(f"⚠️ 回复格式不符合要求，应该是 '立场-情绪' 格式")
            
        else:
            print(f"❌ 请求失败: {response.status_code}")
            try:
                error_data = response.json()
                print(f"   错误信息: {error_data}")
            except:
                print(f"   错误文本: {response.text[:200]}")
                
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_simple_cases(api_key: str, base_url: str):
    """测试简单的对比案例"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n🔄 对比测试")
    print("=" * 40)
    
    test_cases = [
        {
            "name": "明确的 JSON 请求",
            "content": "请用JSON格式返回用户信息，包含姓名和年龄",
            "expect_json": True
        },
        {
            "name": "立场情绪分析（不是 JSON）",
            "content": "请分析立场和情绪，按照 '立场-情绪' 格式输出",
            "expect_json": False
        },
        {
            "name": "包含 JSON 字符的普通请求",
            "content": "请分析这段代码：{name: 'test'} 是否正确",
            "expect_json": False
        }
    ]
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}: {test_case['name']}")
        
        payload = {
            "model": "gemini-1.5-flash",
            "messages": [{"role": "user", "content": test_case["content"]}],
            "max_tokens": 100
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
                
                # 简单判断是否被当作 JSON 处理
                was_treated_as_json = completion_tokens > 500  # 如果超过 500，可能被当作 JSON
                expect_json = test_case["expect_json"]
                
                if expect_json == was_treated_as_json:
                    print(f"   ✅ 检测正确")
                else:
                    print(f"   ❌ 检测错误 (期望: {expect_json}, 实际: {was_treated_as_json})")
                    
                print(f"   📊 输出 tokens: {completion_tokens}")
                
            else:
                print(f"   ❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 异常: {e}")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_stance_emotion.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: 验证立场情绪分析不被误判为 JSON")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行立场情绪分析测试
    test_stance_emotion_analysis(api_key, base_url)
    
    # 运行对比测试
    test_simple_cases(api_key, base_url)
    
    print(f"\n📋 修复说明:")
    print(f"🎯 只检测明确要求 JSON 格式的请求")
    print(f"📝 移除了容易误判的 JSON 字符检测")
    print(f"🔍 立场情绪分析应该返回 '立场-情绪' 格式")
    print(f"⚡ 不应该被当作 JSON 请求处理")

if __name__ == "__main__":
    main()
