#!/usr/bin/env python3
"""
响应质量验证测试
验证并发请求返回的内容是否有效和合理
"""

import asyncio
import aiohttp
import time
import sys
import json
import re
from typing import List, Dict, Any

def validate_response_content(content: str, expected_topic: str) -> Dict[str, Any]:
    """验证响应内容的质量"""
    if not content:
        return {
            'valid': False,
            'reason': '内容为空',
            'score': 0
        }
    
    content_lower = content.lower()
    expected_lower = expected_topic.lower()
    
    # 检查内容长度
    if len(content) < 20:
        return {
            'valid': False,
            'reason': '内容过短',
            'score': 1,
            'length': len(content)
        }
    
    # 检查是否包含相关关键词
    topic_keywords = {
        '人工智能': ['人工智能', 'ai', '机器', '算法', '智能', '计算机', '学习'],
        '机器学习': ['机器学习', '算法', '数据', '模型', '训练', '预测', '学习'],
        '深度学习': ['深度学习', '神经网络', '网络', '层', '训练', '模型', '学习']
    }
    
    relevant_keywords = []
    for topic, keywords in topic_keywords.items():
        if topic in expected_topic:
            relevant_keywords = keywords
            break
    
    if not relevant_keywords:
        relevant_keywords = ['技术', '方法', '系统', '应用']
    
    keyword_matches = sum(1 for keyword in relevant_keywords if keyword in content_lower)
    keyword_score = min(keyword_matches / len(relevant_keywords), 1.0)
    
    # 检查是否是错误信息
    error_indicators = ['错误', 'error', '失败', '无法', '抱歉', '暂时无法', '请稍后']
    has_errors = any(indicator in content_lower for indicator in error_indicators)
    
    # 检查是否是重复内容
    sentences = content.split('。')
    unique_sentences = set(s.strip() for s in sentences if s.strip())
    repetition_score = len(unique_sentences) / max(len(sentences), 1)
    
    # 检查是否包含中文
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content))
    chinese_ratio = chinese_chars / len(content) if content else 0
    
    # 综合评分
    total_score = 0
    reasons = []
    
    if has_errors:
        total_score = 0
        reasons.append('包含错误信息')
    else:
        # 关键词相关性 (40%)
        total_score += keyword_score * 0.4
        if keyword_score < 0.3:
            reasons.append(f'关键词匹配度低 ({keyword_score:.1%})')
        
        # 内容长度 (20%)
        length_score = min(len(content) / 100, 1.0)
        total_score += length_score * 0.2
        
        # 内容重复度 (20%)
        total_score += repetition_score * 0.2
        if repetition_score < 0.8:
            reasons.append(f'内容重复度高 ({repetition_score:.1%})')
        
        # 中文比例 (20%)
        total_score += min(chinese_ratio * 2, 1.0) * 0.2
        if chinese_ratio < 0.3:
            reasons.append(f'中文比例低 ({chinese_ratio:.1%})')
    
    is_valid = total_score >= 0.6 and not has_errors
    
    return {
        'valid': is_valid,
        'score': round(total_score, 2),
        'reasons': reasons if not is_valid else [],
        'details': {
            'length': len(content),
            'keyword_matches': keyword_matches,
            'keyword_score': round(keyword_score, 2),
            'repetition_score': round(repetition_score, 2),
            'chinese_ratio': round(chinese_ratio, 2),
            'has_errors': has_errors
        }
    }

async def make_quality_request(session: aiohttp.ClientSession, url: str, headers: Dict[str, str], 
                              payload: Dict[str, Any], request_id: int, expected_topic: str) -> Dict[str, Any]:
    """发送请求并验证响应质量"""
    start_time = time.time()
    
    try:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as response:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000
            
            if response.status == 200:
                data = await response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                usage = data.get('usage', {})
                
                # 验证内容质量
                quality = validate_response_content(content, expected_topic)
                
                return {
                    'request_id': request_id,
                    'status': 'success',
                    'response_time': response_time,
                    'content': content,
                    'content_preview': content[:100] + '...' if len(content) > 100 else content,
                    'tokens': usage.get('total_tokens', 0),
                    'quality': quality,
                    'expected_topic': expected_topic
                }
            else:
                error_text = await response.text()
                return {
                    'request_id': request_id,
                    'status': 'http_error',
                    'status_code': response.status,
                    'response_time': response_time,
                    'error': error_text[:200],
                    'quality': {'valid': False, 'score': 0, 'reasons': ['HTTP错误']}
                }
                
    except Exception as e:
        end_time = time.time()
        response_time = (end_time - start_time) * 1000
        return {
            'request_id': request_id,
            'status': 'exception',
            'response_time': response_time,
            'error': str(e)[:200],
            'quality': {'valid': False, 'score': 0, 'reasons': ['请求异常']}
        }

async def run_quality_test(api_key: str, base_url: str, concurrent_requests: int, total_requests: int):
    """运行响应质量测试"""
    
    print(f"🔍 响应质量验证测试")
    print(f"服务器: {base_url}")
    print(f"并发数: {concurrent_requests}")
    print(f"总请求数: {total_requests}")
    print("=" * 60)
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # 多样化的测试问题
    test_cases = [
        {
            "prompt": "请详细解释什么是人工智能，包括其定义、发展历史和主要应用领域",
            "topic": "人工智能",
            "expected_length": 200
        },
        {
            "prompt": "机器学习的基本原理是什么？请说明监督学习和无监督学习的区别",
            "topic": "机器学习", 
            "expected_length": 150
        },
        {
            "prompt": "深度学习中的神经网络是如何工作的？请解释反向传播算法",
            "topic": "深度学习",
            "expected_length": 180
        },
        {
            "prompt": "请比较传统编程和机器学习方法的优缺点",
            "topic": "机器学习",
            "expected_length": 160
        },
        {
            "prompt": "自然语言处理技术在现实生活中有哪些应用？",
            "topic": "人工智能",
            "expected_length": 140
        }
    ]
    
    url = f"{base_url}/v1/chat/completions"
    
    connector = aiohttp.TCPConnector(
        limit=concurrent_requests * 2,
        limit_per_host=concurrent_requests,
        ttl_dns_cache=300,
        use_dns_cache=True,
    )
    
    async with aiohttp.ClientSession(connector=connector) as session:
        start_time = time.time()
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def bounded_request(request_id: int):
            async with semaphore:
                test_case = test_cases[request_id % len(test_cases)]
                payload = {
                    "model": "gemini-2.5-flash-preview-05-20",
                    "messages": [{"role": "user", "content": test_case["prompt"]}],
                    "max_tokens": 300,
                    "temperature": 0.7
                }
                return await make_quality_request(session, url, headers, payload, request_id, test_case["topic"])
        
        print(f"⏳ 开始执行 {total_requests} 个质量验证请求...")
        results = await asyncio.gather(*[bounded_request(i) for i in range(total_requests)], return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
    
    # 分析结果
    valid_results = [r for r in results if isinstance(r, dict)]
    successful_requests = [r for r in valid_results if r.get('status') == 'success']
    
    print(f"\n📊 响应质量分析:")
    print(f"总请求数: {total_requests}")
    print(f"成功响应: {len(successful_requests)}")
    print(f"总耗时: {total_time:.2f} 秒")
    
    if successful_requests:
        # 质量统计
        quality_scores = [r['quality']['score'] for r in successful_requests]
        valid_responses = [r for r in successful_requests if r['quality']['valid']]
        
        avg_quality = sum(quality_scores) / len(quality_scores)
        quality_rate = len(valid_responses) / len(successful_requests) * 100
        
        print(f"\n🎯 内容质量统计:")
        print(f"平均质量分数: {avg_quality:.2f}/1.0")
        print(f"有效响应率: {quality_rate:.1f}%")
        print(f"有效响应数: {len(valid_responses)}/{len(successful_requests)}")
        
        # 响应时间统计
        response_times = [r['response_time'] for r in successful_requests]
        avg_response_time = sum(response_times) / len(response_times)
        print(f"平均响应时间: {avg_response_time:.0f}ms")
        
        # 显示一些示例响应
        print(f"\n📝 响应内容示例:")
        for i, result in enumerate(successful_requests[:3]):
            quality = result['quality']
            print(f"\n示例 {i+1} (质量分数: {quality['score']}):")
            print(f"  问题: {result.get('expected_topic', '未知')}")
            print(f"  有效: {'✅' if quality['valid'] else '❌'}")
            print(f"  内容: \"{result['content_preview']}\"")
            if not quality['valid'] and quality.get('reasons'):
                print(f"  问题: {', '.join(quality['reasons'])}")
        
        # 质量问题分析
        invalid_responses = [r for r in successful_requests if not r['quality']['valid']]
        if invalid_responses:
            print(f"\n⚠️  质量问题分析:")
            problem_counts = {}
            for r in invalid_responses:
                for reason in r['quality'].get('reasons', []):
                    problem_counts[reason] = problem_counts.get(reason, 0) + 1
            
            for problem, count in problem_counts.items():
                print(f"  {problem}: {count} 次")
    
    # 错误分析
    failed_requests = [r for r in valid_results if r.get('status') != 'success']
    if failed_requests:
        print(f"\n❌ 请求失败分析:")
        for r in failed_requests[:3]:
            print(f"  请求 {r['request_id']}: {r.get('error', '未知错误')[:100]}")

async def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_response_quality.py <API密钥> [服务器URL] [并发数] [总请求数]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    concurrent_requests = int(sys.argv[3]) if len(sys.argv) > 3 else 5
    total_requests = int(sys.argv[4]) if len(sys.argv) > 4 else 15
    
    await run_quality_test(api_key, base_url, concurrent_requests, total_requests)
    
    print(f"\n🎯 质量评估标准:")
    print(f"✅ 质量分数 ≥ 0.6: 内容有效")
    print(f"✅ 有效响应率 ≥ 90%: 系统稳定")
    print(f"✅ 平均响应时间 < 3000ms: 性能良好")
    print(f"⚠️  如果质量分数低，可能需要调整提示词或模型参数")

if __name__ == "__main__":
    asyncio.run(main())
