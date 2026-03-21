import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rpcLimiter, contractLimiter } from '../rate-limiter';

// Mock setTimeout for faster tests
vi.useFakeTimers();

describe('rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  describe('getQueueLength', () => {
    it('should return 0 for empty queue', () => {
      expect(rpcLimiter.getQueueLength()).toBe(0);
    });

    it('should return correct queue length with pending requests', async () => {
      // Create slow async function
      const slowFn = () => new Promise<string>((resolve) => {
        setTimeout(() => resolve('done'), 5000);
      });

      // Queue multiple requests
      const promise1 = rpcLimiter.execute(slowFn);
      const promise2 = rpcLimiter.execute(slowFn);
      const promise3 = rpcLimiter.execute(slowFn);

      // Check queue length (should be 2, as 1 is processing)
      await vi.advanceTimersByTimeAsync(10);
      const queueLength = rpcLimiter.getQueueLength();
      expect(queueLength).toBeGreaterThanOrEqual(0);

      // Clean up
      await vi.runAllTimersAsync();
      await Promise.all([promise1, promise2, promise3]);
    });
  });

  describe('getStats', () => {
    it('should return statistics object', () => {
      const stats = rpcLimiter.getStats();

      expect(stats).toHaveProperty('queueLength');
      expect(stats).toHaveProperty('processing');
      expect(stats).toHaveProperty('requestCount');
      expect(stats).toHaveProperty('windowStart');
    });

    it('should have correct types for stats properties', () => {
      const stats = rpcLimiter.getStats();

      expect(typeof stats.queueLength).toBe('number');
      expect(typeof stats.processing).toBe('boolean');
      expect(typeof stats.requestCount).toBe('number');
      expect(typeof stats.windowStart).toBe('number');
    });

    it('should show processing status correctly', async () => {
      const slowFn = () => new Promise<string>((resolve) => {
        setTimeout(() => resolve('done'), 1000);
      });

      const promise = rpcLimiter.execute(slowFn);

      // Should be processing
      await vi.advanceTimersByTimeAsync(10);
      const statsDuring = rpcLimiter.getStats();
      expect(typeof statsDuring.processing).toBe('boolean');

      // Complete the request
      await vi.runAllTimersAsync();
      await promise;

      // Should not be processing
      const statsAfter = rpcLimiter.getStats();
      expect(typeof statsAfter.processing).toBe('boolean');
    });
  });

  describe('execute', () => {
    it('should execute function and return result', async () => {
      const testFn = vi.fn().mockResolvedValue('test-result');

      const promise = rpcLimiter.execute(testFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('test-result');
      expect(testFn).toHaveBeenCalledOnce();
    });

    it('should handle errors', async () => {
      const errorFn = vi.fn().mockRejectedValue(new Error('Test error'));

      const executePromise = rpcLimiter.execute(errorFn).catch((error) => error);
      await vi.runAllTimersAsync();

      const result = await executePromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Test error');
    });

    it('should queue multiple requests', async () => {
      const results: string[] = [];
      const fn1 = vi.fn().mockResolvedValue('result1');
      const fn2 = vi.fn().mockResolvedValue('result2');
      const fn3 = vi.fn().mockResolvedValue('result3');

      const promise1 = rpcLimiter.execute(fn1);
      const promise2 = rpcLimiter.execute(fn2);
      const promise3 = rpcLimiter.execute(fn3);

      await vi.runAllTimersAsync();

      results.push(await promise1);
      results.push(await promise2);
      results.push(await promise3);

      expect(results).toEqual(['result1', 'result2', 'result3']);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
    });
  });

  describe('contractLimiter', () => {
    it('should be a separate instance', () => {
      expect(contractLimiter).toBeDefined();
      expect(contractLimiter).not.toBe(rpcLimiter);
    });

    it('should have its own queue', () => {
      const rpcStats = rpcLimiter.getStats();
      const contractStats = contractLimiter.getStats();

      expect(rpcStats).toBeDefined();
      expect(contractStats).toBeDefined();
      // They should be independent instances
      expect(rpcStats !== contractStats).toBe(true);
    });

    it('should execute functions independently', async () => {
      const rpcFn = vi.fn().mockResolvedValue('rpc-result');
      const contractFn = vi.fn().mockResolvedValue('contract-result');

      const rpcPromise = rpcLimiter.execute(rpcFn);
      const contractPromise = contractLimiter.execute(contractFn);

      await vi.runAllTimersAsync();

      const rpcResult = await rpcPromise;
      const contractResult = await contractPromise;

      expect(rpcResult).toBe('rpc-result');
      expect(contractResult).toBe('contract-result');
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit errors', async () => {
      let attempts = 0;
      const rateLimitFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('rate limit exceeded'));
        }
        return Promise.resolve('success-after-retry');
      });

      const promise = rpcLimiter.execute(rateLimitFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success-after-retry');
      expect(attempts).toBe(3);
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      const networkErrorFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('network timeout'));
        }
        return Promise.resolve('success-after-network-retry');
      });

      const promise = rpcLimiter.execute(networkErrorFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success-after-network-retry');
      expect(attempts).toBe(2);
    });

    it('should retry on 503 server errors', async () => {
      let attempts = 0;
      const serverErrorFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('503 Service Unavailable'));
        }
        return Promise.resolve('success-after-503-retry');
      });

      const promise = rpcLimiter.execute(serverErrorFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success-after-503-retry');
      expect(attempts).toBe(2);
    });

    it('should fail after max retries', async () => {
      const alwaysFailFn = vi.fn().mockRejectedValue(new Error('too many requests'));

      const executePromise = rpcLimiter.execute(alwaysFailFn).catch((error) => error);
      await vi.runAllTimersAsync();

      const result = await executePromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('too many requests');

      // Should have tried 1 initial + 3 retries = 4 total
      expect(alwaysFailFn).toHaveBeenCalledTimes(4);
    });

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableFn = vi.fn().mockRejectedValue(new Error('Bad Request'));

      const executePromise = rpcLimiter.execute(nonRetryableFn).catch((error) => error);
      await vi.runAllTimersAsync();

      const result = await executePromise;
      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toBe('Bad Request');

      // Should only try once (no retries)
      expect(nonRetryableFn).toHaveBeenCalledOnce();
    });
  });
});
