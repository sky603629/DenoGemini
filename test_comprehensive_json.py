#!/usr/bin/env python3
"""
全面 JSON 检测测试
验证增强后的 JSON 检测覆盖率
"""

import requests
import json
import sys

def test_comprehensive_json_detection(api_key: str, base_url: str):
    """测试全面的 JSON 检测"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print("🔍 全面 JSON 检测测试")
    print("验证增强后的 JSON 检测覆盖率")
    print("=" * 60)
    
    test_cases = [
        # 应该被检测为 JSON 的情况
        {
            "name": "明确要求 JSON 格式",
            "content": "请用JSON格式返回用户信息",
            "expect_json": True
        },
        {
            "name": "要求返回 JSON",
            "content": "返回JSON数据，包含姓名和年龄",
            "expect_json": True
        },
        {
            "name": "JSON 形式回复",
            "content": "请以JSON形式给出结果",
            "expect_json": True
        },
        {
            "name": "生成 JSON 对象",
            "content": "生成一个JSON对象，包含用户信息",
            "expect_json": True
        },
        {
            "name": "提供 JSON 示例",
            "content": "提供JSON示例，格式如下：{\"name\": \"张三\", \"age\": 25}",
            "expect_json": True
        },
        {
            "name": "转换为 JSON",
            "content": "将以下信息转换为JSON格式：姓名张三，年龄25",
            "expect_json": True
        },
        {
            "name": "创建 JSON 结构",
            "content": "创建JSON结构来表示这个数据",
            "expect_json": True
        },
        {
            "name": "JSON 模板请求",
            "content": "给我一个JSON模板，包含基本字段",
            "expect_json": True
        },
        {
            "name": "昵称生成 JSON",
            "content": "给用户取昵称，用json给出想法，示例：{\"nickname\": \"昵称\", \"reason\": \"理由\"}",
            "expect_json": True
        },
        
        # 不应该被检测为 JSON 的情况
        {
            "name": "立场情绪分析",
            "content": "分析立场和情绪，按照\"立场-情绪\"格式输出，例如：\"反对-愤怒\"",
            "expect_json": False
        },
        {
            "name": "分析 JSON 内容",
            "content": "请分析这个JSON：{\"name\": \"test\"} 的结构是否正确",
            "expect_json": False
        },
        {
            "name": "解释 JSON 语法",
            "content": "解释JSON语法，{\"key\": \"value\"} 这种格式的含义",
            "expect_json": False
        },
        {
            "name": "包含 JSON 的对话分析",
            "content": "分析对话：回复「{,\"response\":,\"@用户;消息\"}」的情感",
            "expect_json": False
        },
        {
            "name": "普通编程讨论",
            "content": "JavaScript中如何创建对象？{name: 'test'} 这样对吗？",
            "expect_json": False
        },
        {
            "name": "故事续写",
            "content": "继续这个故事：小明在房间里听到键盘声...",
            "expect_json": False
        }
    ]
    
    success_count = 0
    json_detected_count = 0
    json_expected_count = sum(1 for case in test_cases if case["expect_json"])
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📋 测试 {i}: {test_case['name']}")
        print("-" * 50)
        
        payload = {
            "model": "gemini-1.5-flash",
            "messages": [
                {
                    "role": "user",
                    "content": test_case["content"]
                }
            ],
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
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = data.get('usage', {})
                
                completion_tokens = usage.get('completion_tokens', 0)
                user_max_tokens = 100
                expect_json = test_case["expect_json"]
                
                # 判断是否被当作 JSON 处理（简单启发式）
                was_treated_as_json = completion_tokens > user_max_tokens * 3  # 如果超出很多，可能是 JSON
                
                print(f"📊 输出 tokens: {completion_tokens} (设置: {user_max_tokens})")
                print(f"🎯 期望 JSON: {expect_json}")
                print(f"🔍 检测为 JSON: {was_treated_as_json}")
                
                if expect_json == was_treated_as_json:
                    print(f"✅ 检测正确")
                    success_count += 1
                else:
                    print(f"❌ 检测错误")
                
                if was_treated_as_json:
                    json_detected_count += 1
                
                # 显示内容预览
                preview = content[:80] + "..." if len(content) > 80 else content
                print(f"📝 回复: \"{preview}\"")
                
                # 如果期望是 JSON，验证格式
                if expect_json and was_treated_as_json:
                    try:
                        json.loads(content)
                        print(f"✅ JSON 格式正确")
                    except json.JSONDecodeError:
                        print(f"⚠️ JSON 格式有问题")
                
            else:
                print(f"❌ 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")
    
    print(f"\n🎯 全面 JSON 检测测试结果:")
    print("=" * 40)
    print(f"✅ 检测准确率: {success_count}/{len(test_cases)} ({success_count/len(test_cases)*100:.1f}%)")
    print(f"🔍 JSON 检测数量: {json_detected_count} (期望: {json_expected_count})")
    print(f"📊 JSON 召回率: {min(json_detected_count, json_expected_count)}/{json_expected_count} ({min(json_detected_count, json_expected_count)/json_expected_count*100:.1f}%)")
    
    if success_count >= len(test_cases) * 0.9:
        print(f"🎉 优秀！JSON 检测准确率很高")
    elif success_count >= len(test_cases) * 0.8:
        print(f"👍 良好！JSON 检测基本准确")
    else:
        print(f"⚠️ 需要进一步优化 JSON 检测")

def test_edge_cases(api_key: str, base_url: str):
    """测试边缘情况"""
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    print(f"\n🔬 边缘情况测试")
    print("=" * 40)
    
    edge_cases = [
        {
            "name": "混合请求 - JSON + 分析",
            "content": "请分析这个数据，然后用JSON格式返回结果",
            "expect_json": True
        },
        {
            "name": "条件 JSON 请求",
            "content": "如果可能的话，请用JSON格式回复",
            "expect_json": True
        },
        {
            "name": "隐含 JSON 请求",
            "content": "返回结构化数据，包含name和age字段",
            "expect_json": False  # 没有明确说 JSON
        },
        {
            "name": "JSON 相关但非请求",
            "content": "JSON是什么？它的语法规则是怎样的？",
            "expect_json": False
        }
    ]
    
    for i, test_case in enumerate(edge_cases, 1):
        print(f"\n📋 边缘测试 {i}: {test_case['name']}")
        
        payload = {
            "model": "gemini-1.5-flash",
            "messages": [{"role": "user", "content": test_case["content"]}],
            "max_tokens": 150
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
                expect_json = test_case["expect_json"]
                
                was_treated_as_json = completion_tokens > 300
                
                print(f"   📊 tokens: {completion_tokens}")
                print(f"   🎯 期望: {expect_json}, 检测: {was_treated_as_json}")
                
                if expect_json == was_treated_as_json:
                    print(f"   ✅ 正确")
                else:
                    print(f"   ❌ 错误")
                    
            else:
                print(f"   ❌ 失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 异常: {e}")

def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_comprehensive_json.py <API密钥> [服务器URL]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"🌐 测试服务器: {base_url}")
    print(f"🎯 测试目标: 验证全面的 JSON 检测覆盖率")
    
    # 检查连接
    try:
        requests.get(base_url, timeout=5)
        print(f"✅ 服务器连接正常")
    except:
        print(f"❌ 无法连接到服务器")
        return
    
    # 运行全面 JSON 检测测试
    test_comprehensive_json_detection(api_key, base_url)
    
    # 运行边缘情况测试
    test_edge_cases(api_key, base_url)
    
    print(f"\n📋 增强的 JSON 检测特性:")
    print(f"🎯 明确关键词: json格式、返回json、用json等")
    print(f"🔍 请求模式: 请用json格式、生成json、转换json等")
    print(f"📝 示例模式: 示例：{\"key\": \"value\"} 等")
    print(f"🏷️ 字段模式: \"name\":\"value\" 等（排除分析场景）")
    print(f"🛡️ 分析排除: 自动排除分析、解释类请求")

if __name__ == "__main__":
    main()
