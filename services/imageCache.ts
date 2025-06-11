/**
 * 图片缓存服务
 * 缓存已下载的图片，避免重复下载
 */

interface CacheEntry {
  data: string; // base64 data
  mimeType: string;
  timestamp: number;
  size: number;
}

class ImageCache {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_CACHE_SIZE = 50; // 最大缓存50张图片
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30分钟过期

  // 生成缓存键
  private getCacheKey(url: string): string {
    // 使用URL的hash作为缓存键，避免过长的键名
    return btoa(url).slice(0, 32);
  }

  // 获取缓存的图片
  get(url: string): { data: string; mimeType: string } | null {
    const key = this.getCacheKey(url);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return {
      data: entry.data,
      mimeType: entry.mimeType
    };
  }

  // 设置缓存
  set(url: string, data: string, mimeType: string, size: number): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }
    
    const key = this.getCacheKey(url);
    this.cache.set(key, {
      data,
      mimeType,
      timestamp: Date.now(),
      size
    });
  }

  // 删除最旧的缓存条目
  private evictOldest(): void {
    let oldestKey = "";
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  // 获取缓存统计信息
  getStats(): { size: number; totalSize: number } {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    
    return {
      size: this.cache.size,
      totalSize: Math.round(totalSize / 1024) // KB
    };
  }

  // 清空缓存
  clear(): void {
    this.cache.clear();
  }
}

export const imageCache = new ImageCache();

// 定期清理过期缓存
setInterval(() => {
  imageCache.cleanup();
}, 5 * 60 * 1000); // 每5分钟清理一次
