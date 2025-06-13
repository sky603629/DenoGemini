#!/usr/bin/env python3
"""
并发性能测试
测试服务器在高并发场景下的表现
"""

import asyncio
import aiohttp
import time
import sys
import json
from typing import List, Dict, Any

async def make_request(session: aiohttp.ClientSession, url: str, headers: Dict[str, str], payload: Dict[str, Any], request_id: int) -> Dict[str, Any]:
    """发送单个请求"""
    start_time = time.time()
    
    try:
        async with session.post(url, headers=headers, json=payload, timeout=aiohttp.ClientTimeout(total=30)) as response:
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # 转换为毫秒
            
            if response.status == 200:
                data = await response.json()
                content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
                return {
                    'request_id': request_id,
                    'status': 'success',
                    'status_code': response.status,
                    'response_time': response_time,
                    'content_length': len(content),
                    'tokens': data.get('usage', {}).get('total_tokens', 0)
                }
            else:
                error_text = await response.text()
                return {
                    'request_id': request_id,
                    'status': 'error',
                    'status_code': response.status,
                    'response_time': response_time,
                    'error': error_text[:200]
                }
                
    except asyncio.TimeoutError:
        end_time = time.time()
        response_time = (end_time - start_time) * 1000
        return {
            'request_id': request_id,
            'status': 'timeout',
            'status_code': 0,
            'response_time': response_time,
            'error': 'Request timeout'
        }
    except Exception as e:
        end_time = time.time()
        response_time = (end_time - start_time) * 1000
        return {
            'request_id': request_id,
            'status': 'exception',
            'status_code': 0,
            'response_time': response_time,
            'error': str(e)[:200]
        }

async def run_concurrent_test(api_key: str, base_url: str, concurrent_requests: int, total_requests: int):
    """运行并发测试"""
    
    print(f"🚀 并发性能测试")
    print(f"服务器: {base_url}")
    print(f"并发数: {concurrent_requests}")
    print(f"总请求数: {total_requests}")
    print("=" * 60)
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    # 测试用的请求负载
    test_payloads = [
        {
            "model": "gemini-2.5-flash-preview-05-20",
            "messages": [{"role": "user", "content": "请简单介绍一下人工智能"}],
            "max_tokens": 200,
            "temperature": 0.7
        },
        {
            "model": "gemini-2.5-flash-preview-05-20", 
            "messages": [{"role": "user", "content": "解释一下机器学习的基本概念"}],
            "max_tokens": 200,
            "temperature": 0.7
        },
        {
            "model": "gemini-2.5-flash-preview-05-20",
            "messages": [{"role": "user", "content": "什么是深度学习？"}],
            "max_tokens": 200,
            "temperature": 0.7
        }
    ]
    
    url = f"{base_url}/v1/chat/completions"
    results = []
    
    # 创建连接器，限制连接数
    connector = aiohttp.TCPConnector(
        limit=concurrent_requests * 2,  # 总连接数限制
        limit_per_host=concurrent_requests,  # 每个主机的连接数限制
        ttl_dns_cache=300,  # DNS缓存时间
        use_dns_cache=True,
    )
    
    async with aiohttp.ClientSession(connector=connector) as session:
        start_time = time.time()
        
        # 创建信号量来控制并发数
        semaphore = asyncio.Semaphore(concurrent_requests)
        
        async def bounded_request(request_id: int):
            async with semaphore:
                payload = test_payloads[request_id % len(test_payloads)]
                return await make_request(session, url, headers, payload, request_id)
        
        # 创建所有任务
        tasks = [bounded_request(i) for i in range(total_requests)]
        
        # 执行所有任务并收集结果
        print(f"⏳ 开始执行 {total_requests} 个请求...")
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        end_time = time.time()
        total_time = end_time - start_time
    
    # 分析结果
    successful_requests = [r for r in results if isinstance(r, dict) and r.get('status') == 'success']
    failed_requests = [r for r in results if isinstance(r, dict) and r.get('status') != 'success']
    exceptions = [r for r in results if not isinstance(r, dict)]
    
    print(f"\n📊 测试结果分析:")
    print(f"总耗时: {total_time:.2f} 秒")
    print(f"总请求数: {total_requests}")
    print(f"成功请求: {len(successful_requests)}")
    print(f"失败请求: {len(failed_requests)}")
    print(f"异常请求: {len(exceptions)}")
    print(f"成功率: {len(successful_requests)/total_requests*100:.1f}%")
    print(f"平均QPS: {total_requests/total_time:.1f} 请求/秒")
    
    if successful_requests:
        response_times = [r['response_time'] for r in successful_requests]
        avg_response_time = sum(response_times) / len(response_times)
        min_response_time = min(response_times)
        max_response_time = max(response_times)
        
        # 计算百分位数
        sorted_times = sorted(response_times)
        p50 = sorted_times[len(sorted_times) // 2]
        p95 = sorted_times[int(len(sorted_times) * 0.95)]
        p99 = sorted_times[int(len(sorted_times) * 0.99)]
        
        print(f"\n⏱️  响应时间统计:")
        print(f"平均响应时间: {avg_response_time:.0f}ms")
        print(f"最小响应时间: {min_response_time:.0f}ms")
        print(f"最大响应时间: {max_response_time:.0f}ms")
        print(f"P50: {p50:.0f}ms")
        print(f"P95: {p95:.0f}ms")
        print(f"P99: {p99:.0f}ms")
        
        # Token统计
        total_tokens = sum(r.get('tokens', 0) for r in successful_requests)
        avg_tokens = total_tokens / len(successful_requests) if successful_requests else 0
        print(f"\n🎯 Token统计:")
        print(f"总Token数: {total_tokens}")
        print(f"平均Token/请求: {avg_tokens:.1f}")
        print(f"Token/秒: {total_tokens/total_time:.1f}")
    
    # 错误分析
    if failed_requests:
        print(f"\n❌ 错误分析:")
        error_types = {}
        for req in failed_requests:
            error_type = f"{req.get('status', 'unknown')} ({req.get('status_code', 0)})"
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        for error_type, count in error_types.items():
            print(f"  {error_type}: {count} 次")
    
    if exceptions:
        print(f"\n⚠️  异常情况: {len(exceptions)} 个")
        for i, exc in enumerate(exceptions[:3]):  # 只显示前3个异常
            print(f"  {i+1}. {type(exc).__name__}: {str(exc)[:100]}")

async def check_server_health(base_url: str):
    """检查服务器健康状态"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{base_url}/health", timeout=aiohttp.ClientTimeout(total=5)) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"🏥 服务器健康状态:")
                    print(f"  状态: {data.get('status', 'unknown')}")
                    print(f"  队列利用率: {data.get('performance', {}).get('queueUtilization', 'N/A')}")
                    print(f"  并发利用率: {data.get('performance', {}).get('concurrencyUtilization', 'N/A')}")
                    print(f"  平均响应时间: {data.get('performance', {}).get('averageResponseTime', 'N/A')}")
                    print(f"  成功率: {data.get('performance', {}).get('successRate', 'N/A')}")
                    return True
                else:
                    print(f"❌ 健康检查失败: HTTP {response.status}")
                    return False
    except Exception as e:
        print(f"❌ 无法连接到服务器: {e}")
        return False

async def main():
    if len(sys.argv) < 2:
        print("❌ 请提供API密钥")
        print("   使用方法: python test_concurrency.py <API密钥> [服务器URL] [并发数] [总请求数]")
        return
    
    api_key = sys.argv[1]
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    concurrent_requests = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    total_requests = int(sys.argv[4]) if len(sys.argv) > 4 else 50
    
    print(f"🌐 测试目标: {base_url}")
    
    # 检查服务器健康状态
    if not await check_server_health(base_url):
        return
    
    print()
    
    # 运行并发测试
    await run_concurrent_test(api_key, base_url, concurrent_requests, total_requests)
    
    print(f"\n🎯 测试建议:")
    print(f"✅ 如果成功率 > 95%，服务器并发处理良好")
    print(f"✅ 如果平均响应时间 < 3000ms，性能表现优秀")
    print(f"✅ 如果QPS > 5，吞吐量满足一般需求")
    print(f"⚠️  如果出现大量超时，可能需要调整并发限制")

if __name__ == "__main__":
    asyncio.run(main())
