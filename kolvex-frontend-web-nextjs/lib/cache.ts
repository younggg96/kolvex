/**
 * 简单的内存缓存工具
 * 用于缓存 API 响应，减少对后端的请求次数
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每 5 分钟清理一次过期缓存
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  /**
   * 获取缓存数据
   * @param key 缓存键
   * @returns 缓存的数据，如果不存在或已过期则返回 null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 设置缓存数据
   * @param key 缓存键
   * @param data 要缓存的数据
   * @param ttlSeconds 缓存时间（秒），默认 5 分钟
   */
  set<T>(key: string, data: T, ttlSeconds: number = 300): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttlSeconds * 1000,
    });
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 删除指定缓存
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清理所有过期的缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// 全局单例缓存实例
export const chartCache = new MemoryCache();
export const quoteCache = new MemoryCache();
export const overviewCache = new MemoryCache();

// 缓存 TTL 配置（秒）
export const CACHE_TTL = {
  CHART: 5 * 60, // 图表数据缓存 5 分钟
  QUOTE: 60, // 报价数据缓存 1 分钟（价格变化较快）
  OVERVIEW: 10 * 60, // 概览数据缓存 10 分钟
  MULTIPLE_QUOTES: 60, // 多个报价缓存 1 分钟
} as const;

/**
 * 生成缓存键
 */
export function getCacheKey(action: string, symbol: string, extra?: string): string {
  return `${action}:${symbol.toUpperCase()}${extra ? `:${extra}` : ""}`;
}

