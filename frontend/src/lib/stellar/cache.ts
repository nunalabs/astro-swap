/**
 * Contract Call Caching
 *
 * Reduces RPC load by caching read-only contract call results.
 * Uses TTL-based invalidation with LRU eviction.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheOptions {
  ttlMs: number;
  maxEntries: number;
}

export class ContractCallCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      ttlMs: options.ttlMs ?? 30000, // 30 seconds default
      maxEntries: options.maxEntries ?? 1000,
    };
  }

  /**
   * Generate cache key from contract call parameters
   */
  private generateKey(
    contractId: string,
    method: string,
    args: unknown[]
  ): string {
    // Serialize args to stable JSON
    const argsJson = JSON.stringify(args, (_, value) => {
      // Handle BigInt
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    });

    return `${contractId}:${method}:${argsJson}`;
  }

  /**
   * Get cached value if exists and not expired
   */
  get<T>(contractId: string, method: string, args: unknown[]): T | undefined {
    const key = this.generateKey(contractId, method, args);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Update access stats (for LRU)
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.value as T;
  }

  /**
   * Set cache value with TTL
   */
  set<T>(
    contractId: string,
    method: string,
    args: unknown[],
    value: T,
    customTtlMs?: number
  ): void {
    const key = this.generateKey(contractId, method, args);
    const ttl = customTtlMs ?? this.options.ttlMs;

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.options.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Invalidate specific contract cache
   */
  invalidate(contractId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${contractId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache stats
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; accessCount: number; age: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      accessCount: entry.accessCount,
      age: now - (entry.expiresAt - this.options.ttlMs),
    }));

    // Calculate hit rate (simplified)
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const hitRate = totalAccess > 0 ? entries.length / totalAccess : 0;

    return {
      size: this.cache.size,
      maxSize: this.options.maxEntries,
      hitRate,
      entries: entries.sort((a, b) => b.accessCount - a.accessCount).slice(0, 10),
    };
  }
}

// Global cache instance
export const contractCallCache = new ContractCallCache({
  ttlMs: 30000, // 30 seconds
  maxEntries: 1000,
});

// Clear expired entries every 60 seconds
if (typeof window !== 'undefined') {
  setInterval(() => {
    contractCallCache.clearExpired();
  }, 60000);
}
