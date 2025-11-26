/**
 * Pool Cache
 *
 * Efficient caching layer for pool data with TTL support
 */

import type { PoolData, PoolCacheEntry, TokenGraph } from './types';

/**
 * Pool cache manager with automatic expiration
 */
export class PoolCache {
  private cache: Map<string, PoolCacheEntry>;
  private tokenGraph: TokenGraph;
  private ttl: number;
  private hits: number;
  private misses: number;

  /**
   * Create a new pool cache
   * @param ttl - Time to live in milliseconds (default: 30000)
   */
  constructor(ttl: number = 30000) {
    this.cache = new Map();
    this.tokenGraph = {
      nodes: new Map(),
      pools: [],
    };
    this.ttl = ttl;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get pool data by address
   */
  get(address: string): PoolData | null {
    const entry = this.cache.get(address.toLowerCase());

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(address.toLowerCase());
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data;
  }

  /**
   * Set pool data
   */
  set(address: string, data: PoolData): void {
    const entry: PoolCacheEntry = {
      data: {
        ...data,
        address: address.toLowerCase(),
        cachedAt: Date.now(),
      },
      expiresAt: Date.now() + this.ttl,
    };

    this.cache.set(address.toLowerCase(), entry);
    this.updateGraph(entry.data);
  }

  /**
   * Set multiple pools at once
   */
  setMany(pools: PoolData[]): void {
    const now = Date.now();
    const expiresAt = now + this.ttl;

    for (const pool of pools) {
      const entry: PoolCacheEntry = {
        data: {
          ...pool,
          address: pool.address.toLowerCase(),
          cachedAt: now,
        },
        expiresAt,
      };

      this.cache.set(pool.address.toLowerCase(), entry);
      this.updateGraph(entry.data);
    }
  }

  /**
   * Check if pool exists in cache
   */
  has(address: string): boolean {
    const entry = this.cache.get(address.toLowerCase());
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(address.toLowerCase());
      return false;
    }
    return true;
  }

  /**
   * Delete pool from cache
   */
  delete(address: string): boolean {
    const deleted = this.cache.delete(address.toLowerCase());
    if (deleted) {
      this.rebuildGraph();
    }
    return deleted;
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.tokenGraph = {
      nodes: new Map(),
      pools: [],
    };
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get all cached pools (non-expired)
   */
  getAll(): PoolData[] {
    const now = Date.now();
    const pools: PoolData[] = [];

    for (const [address, entry] of this.cache.entries()) {
      if (now <= entry.expiresAt) {
        pools.push(entry.data);
      } else {
        // Remove expired entry
        this.cache.delete(address);
      }
    }

    return pools;
  }

  /**
   * Get pools for a specific token
   */
  getPoolsForToken(tokenAddress: string): PoolData[] {
    const node = this.tokenGraph.nodes.get(tokenAddress.toLowerCase());
    return node ? node.pools : [];
  }

  /**
   * Get the token graph
   */
  getGraph(): TokenGraph {
    return this.tokenGraph;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      totalTokens: this.tokenGraph.nodes.size,
    };
  }

  /**
   * Clean expired entries
   */
  cleanExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [address, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(address);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.rebuildGraph();
    }

    return cleaned;
  }

  /**
   * Update TTL for all entries
   */
  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  /**
   * Get cache hit rate
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  // ==================== Private Methods ====================

  /**
   * Update the token graph with new pool data
   */
  private updateGraph(pool: PoolData): void {
    const token0Lower = pool.token0.toLowerCase();
    const token1Lower = pool.token1.toLowerCase();

    // Get or create nodes
    let node0 = this.tokenGraph.nodes.get(token0Lower);
    if (!node0) {
      node0 = { address: token0Lower, pools: [] };
      this.tokenGraph.nodes.set(token0Lower, node0);
    }

    let node1 = this.tokenGraph.nodes.get(token1Lower);
    if (!node1) {
      node1 = { address: token1Lower, pools: [] };
      this.tokenGraph.nodes.set(token1Lower, node1);
    }

    // Add pool to nodes if not already present
    const poolLower = pool.address.toLowerCase();

    if (!node0.pools.some(p => p.address.toLowerCase() === poolLower)) {
      node0.pools.push(pool);
    } else {
      // Update existing pool data
      const idx = node0.pools.findIndex(p => p.address.toLowerCase() === poolLower);
      node0.pools[idx] = pool;
    }

    if (!node1.pools.some(p => p.address.toLowerCase() === poolLower)) {
      node1.pools.push(pool);
    } else {
      // Update existing pool data
      const idx = node1.pools.findIndex(p => p.address.toLowerCase() === poolLower);
      node1.pools[idx] = pool;
    }

    // Update pools array
    const existingIdx = this.tokenGraph.pools.findIndex(
      p => p.address.toLowerCase() === poolLower
    );
    if (existingIdx >= 0) {
      this.tokenGraph.pools[existingIdx] = pool;
    } else {
      this.tokenGraph.pools.push(pool);
    }
  }

  /**
   * Rebuild the entire graph from cache
   */
  private rebuildGraph(): void {
    this.tokenGraph = {
      nodes: new Map(),
      pools: [],
    };

    const pools = this.getAll();
    for (const pool of pools) {
      this.updateGraph(pool);
    }
  }
}
