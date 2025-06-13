import { logger } from "../config/env.ts";

/**
 * 并发管理器 - 处理高并发请求和API限制
 */
export class ConcurrencyManager {
  private requestQueue: Array<{
    id: string;
    execute: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    timestamp: number;
  }> = [];

  private activeRequests = new Set<string>();
  private maxConcurrentRequests: number;
  private maxQueueSize: number;
  private processing = false;
  private stats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    queuedRequests: 0,
    averageResponseTime: 0,
    responseTimes: [] as number[]
  };

  // API限制管理
  private apiLimits = new Map<string, {
    requests: number;
    resetTime: number;
    maxRequests: number;
  }>();

  constructor(maxConcurrentRequests = 50, maxQueueSize = 1000) {
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.maxQueueSize = maxQueueSize;
    
    // 定期清理统计数据
    setInterval(() => this.cleanupStats(), 60000); // 每分钟清理一次
    
    logger.info(`🚀 并发管理器初始化: 最大并发=${maxConcurrentRequests}, 最大队列=${maxQueueSize}`);
  }

  /**
   * 执行请求（带并发控制）
   */
  async executeRequest<T>(
    requestId: string,
    executor: () => Promise<T>,
    priority: number = 0,
    apiKey?: string
  ): Promise<T> {
    // 检查API限制
    if (apiKey && this.isApiLimited(apiKey)) {
      throw new Error(`API密钥 ${apiKey.slice(0, 8)}... 已达到速率限制`);
    }

    // 检查队列大小
    if (this.requestQueue.length >= this.maxQueueSize) {
      this.stats.failedRequests++;
      throw new Error(`请求队列已满 (${this.maxQueueSize})，请稍后重试`);
    }

    this.stats.totalRequests++;
    this.stats.queuedRequests++;

    return new Promise<T>((resolve, reject) => {
      const request = {
        id: requestId,
        execute: executor,
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      };

      // 按优先级插入队列
      this.insertByPriority(request);
      
      logger.debug(`📋 请求 ${requestId} 已加入队列 (优先级: ${priority}, 队列长度: ${this.requestQueue.length})`);

      // 开始处理队列
      this.processQueue();
    });
  }

  /**
   * 按优先级插入请求
   */
  private insertByPriority(request: any) {
    let inserted = false;
    for (let i = 0; i < this.requestQueue.length; i++) {
      if (request.priority > this.requestQueue[i].priority) {
        this.requestQueue.splice(i, 0, request);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.requestQueue.push(request);
    }
  }

  /**
   * 处理请求队列
   */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.requestQueue.length > 0 && this.activeRequests.size < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (!request) break;

      this.stats.queuedRequests--;
      this.activeRequests.add(request.id);

      // 异步执行请求
      this.executeRequestAsync(request);
    }

    this.processing = false;
  }

  /**
   * 异步执行单个请求
   */
  private async executeRequestAsync(request: any) {
    const startTime = Date.now();
    
    try {
      logger.debug(`🚀 开始执行请求 ${request.id} (活跃: ${this.activeRequests.size})`);
      
      const result = await request.execute();
      
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, true);
      
      logger.debug(`✅ 请求 ${request.id} 完成 (耗时: ${responseTime}ms)`);
      request.resolve(result);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, false);
      
      logger.warn(`❌ 请求 ${request.id} 失败 (耗时: ${responseTime}ms): ${(error as Error).message}`);
      request.reject(error);
      
    } finally {
      this.activeRequests.delete(request.id);
      
      // 继续处理队列
      if (this.requestQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(responseTime: number, success: boolean) {
    if (success) {
      this.stats.completedRequests++;
    } else {
      this.stats.failedRequests++;
    }

    this.stats.responseTimes.push(responseTime);
    
    // 保持最近1000个响应时间
    if (this.stats.responseTimes.length > 1000) {
      this.stats.responseTimes = this.stats.responseTimes.slice(-1000);
    }

    // 计算平均响应时间
    this.stats.averageResponseTime = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
  }

  /**
   * 检查API限制
   */
  private isApiLimited(apiKey: string): boolean {
    const limit = this.apiLimits.get(apiKey);
    if (!limit) return false;

    const now = Date.now();
    if (now > limit.resetTime) {
      // 重置计数器
      this.apiLimits.set(apiKey, {
        requests: 0,
        resetTime: now + 60000, // 1分钟后重置
        maxRequests: limit.maxRequests
      });
      return false;
    }

    return limit.requests >= limit.maxRequests;
  }

  /**
   * 记录API使用
   */
  recordApiUsage(apiKey: string, maxRequests = 60) {
    const limit = this.apiLimits.get(apiKey) || {
      requests: 0,
      resetTime: Date.now() + 60000,
      maxRequests
    };

    limit.requests++;
    this.apiLimits.set(apiKey, limit);
  }

  /**
   * 清理统计数据
   */
  private cleanupStats() {
    const now = Date.now();
    
    // 清理过期的API限制
    for (const [key, limit] of this.apiLimits.entries()) {
      if (now > limit.resetTime) {
        this.apiLimits.delete(key);
      }
    }

    // 重置部分统计
    if (this.stats.responseTimes.length > 500) {
      this.stats.responseTimes = this.stats.responseTimes.slice(-500);
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      activeRequests: this.activeRequests.size,
      queueLength: this.requestQueue.length,
      apiLimits: Array.from(this.apiLimits.entries()).map(([key, limit]) => ({
        key: `${key.slice(0, 8)}...`,
        requests: limit.requests,
        maxRequests: limit.maxRequests,
        resetIn: Math.max(0, limit.resetTime - Date.now())
      }))
    };
  }

  /**
   * 获取健康状态
   */
  getHealthStatus() {
    const stats = this.getStats();
    const queueUtilization = stats.queueLength / this.maxQueueSize;
    const concurrencyUtilization = stats.activeRequests / this.maxConcurrentRequests;
    
    let status = 'healthy';
    if (queueUtilization > 0.8 || concurrencyUtilization > 0.9) {
      status = 'degraded';
    }
    if (queueUtilization > 0.95 || concurrencyUtilization > 0.95) {
      status = 'overloaded';
    }

    return {
      status,
      queueUtilization: Math.round(queueUtilization * 100),
      concurrencyUtilization: Math.round(concurrencyUtilization * 100),
      averageResponseTime: Math.round(stats.averageResponseTime),
      successRate: stats.totalRequests > 0 ? 
        Math.round((stats.completedRequests / stats.totalRequests) * 100) : 100
    };
  }

  /**
   * 优雅关闭
   */
  async shutdown() {
    logger.info("🔄 并发管理器正在关闭...");
    
    // 等待所有活跃请求完成
    while (this.activeRequests.size > 0) {
      logger.info(`⏳ 等待 ${this.activeRequests.size} 个活跃请求完成...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 拒绝所有队列中的请求
    for (const request of this.requestQueue) {
      request.reject(new Error("服务器正在关闭"));
    }
    this.requestQueue.length = 0;

    logger.info("✅ 并发管理器已关闭");
  }
}

/**
 * 连接池管理器 - 复用HTTP连接
 */
export class ConnectionPool {
  private connections = new Map<string, {
    lastUsed: number;
    inUse: boolean;
  }>();

  private maxConnections = 20;
  private connectionTimeout = 30000; // 30秒

  constructor() {
    // 定期清理过期连接
    setInterval(() => this.cleanupConnections(), 10000);
  }

  /**
   * 获取或创建连接
   */
  getConnection(url: string): void {
    const connection = this.connections.get(url);

    if (connection && !connection.inUse) {
      connection.inUse = true;
      connection.lastUsed = Date.now();
      return;
    }

    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      // 清理最旧的连接
      this.cleanupOldestConnection();
    }

    // 创建新连接
    this.connections.set(url, {
      lastUsed: Date.now(),
      inUse: true
    });
  }

  /**
   * 释放连接
   */
  releaseConnection(url: string) {
    const connection = this.connections.get(url);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  /**
   * 清理过期连接
   */
  private cleanupConnections() {
    const now = Date.now();
    for (const [url, connection] of this.connections.entries()) {
      if (!connection.inUse && (now - connection.lastUsed) > this.connectionTimeout) {
        this.connections.delete(url);
      }
    }
  }

  /**
   * 清理最旧的连接
   */
  private cleanupOldestConnection() {
    let oldestUrl = '';
    let oldestTime = Date.now();

    for (const [url, connection] of this.connections.entries()) {
      if (!connection.inUse && connection.lastUsed < oldestTime) {
        oldestTime = connection.lastUsed;
        oldestUrl = url;
      }
    }

    if (oldestUrl) {
      this.connections.delete(oldestUrl);
    }
  }

  getStats() {
    const activeConnections = Array.from(this.connections.values()).filter(c => c.inUse).length;
    return {
      totalConnections: this.connections.size,
      activeConnections,
      maxConnections: this.maxConnections
    };
  }
}

// 全局实例
export const concurrencyManager = new ConcurrencyManager();
export const connectionPool = new ConnectionPool();
