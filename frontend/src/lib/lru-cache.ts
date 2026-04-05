/**
 * Lightweight LRU (Least Recently Used) Cache
 *
 * Prevents unbounded memory growth by evicting least recently used entries
 * when the cache reaches its maximum size.
 *
 * Uses Map's insertion order guarantee (ES2015+) for efficient LRU tracking.
 */
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  /**
   * Create an LRU cache with maximum size
   * @param maxSize Maximum number of entries before eviction starts
   */
  constructor(maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('LRU cache maxSize must be positive');
    }
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get a value from the cache
   * Marks the entry as recently used by moving it to the end
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Set a value in the cache
   * If cache is at capacity, evicts the least recently used entry
   */
  set(key: K, value: V): void {
    // Delete if exists (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Add to end (most recently used)
    this.cache.set(key, value);

    // Evict oldest if over capacity
    if (this.cache.size > this.maxSize) {
      // First key is the oldest (least recently used)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Check if key exists in cache
   * Does NOT mark as recently used (use get() for that)
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get maximum cache size
   */
  get capacity(): number {
    return this.maxSize;
  }
}
