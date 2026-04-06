/**
 * Rate Limiter for RPC calls with exponential backoff
 * Prevents exhausting RPC rate limits and provides retry logic
 */

interface RateLimiterConfig {
  maxRequestsPerSecond: number;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

interface QueuedRequest<T> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  retries: number;
}

class RateLimiter {
  private config: RateLimiterConfig;
  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private requestCount = 0;
  private windowStart = Date.now();

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      maxRequestsPerSecond: config.maxRequestsPerSecond || 10, // Conservative limit
      maxRetries: config.maxRetries || 3,
      baseDelay: config.baseDelay || 1000, // 1 second
      maxDelay: config.maxDelay || 10000, // 10 seconds
    };
  }

  /**
   * Execute a function with rate limiting and retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        retries: 0,
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      // Reset window if needed (sliding window)
      const now = Date.now();
      if (now - this.windowStart >= 1000) {
        this.windowStart = now;
        this.requestCount = 0;
      }

      // Check rate limit
      if (this.requestCount >= this.config.maxRequestsPerSecond) {
        // Wait until next window
        const waitTime = 1000 - (now - this.windowStart);
        await this.sleep(waitTime);
        this.windowStart = Date.now();
        this.requestCount = 0;
      }

      // Get next request
      const request = this.queue.shift();
      if (!request) break;

      try {
        // Execute request
        const result = await request.fn();
        request.resolve(result);
        this.requestCount++;

        // Small delay between requests to avoid bursts
        await this.sleep(100);
      } catch (error) {
        // Retry logic with exponential backoff
        if (this.shouldRetry(error) && request.retries < this.config.maxRetries) {
          const delay = this.calculateBackoff(request.retries);
          await this.sleep(delay);

          // Re-queue with incremented retry count
          request.retries++;
          this.queue.unshift(request);
        } else {
          // Max retries reached or non-retryable error
          request.reject(error);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Check if error is retryable
   */
  private shouldRetry(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Retry on rate limit errors
      if (message.includes('rate limit') || message.includes('too many requests')) {
        return true;
      }

      // Retry on network errors
      if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused') ||
        message.includes('econnreset')
      ) {
        return true;
      }

      // Retry on 5xx server errors
      if (message.includes('500') || message.includes('502') || message.includes('503')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(retryCount: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000; // Add jitter to avoid thundering herd
    return Math.min(exponentialDelay + jitter, this.config.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current queue length (for debugging)
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestCount: this.requestCount,
      windowStart: this.windowStart,
    };
  }
}

// Singleton instance for RPC calls
export const rpcLimiter = new RateLimiter({
  maxRequestsPerSecond: 10, // Conservative for public RPC
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
});

// Singleton for contract calls (may have different limits)
export const contractLimiter = new RateLimiter({
  maxRequestsPerSecond: 15,
  maxRetries: 2,
  baseDelay: 500,
  maxDelay: 5000,
});
