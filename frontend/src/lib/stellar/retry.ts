/**
 * Retry Logic with Exponential Backoff
 *
 * Enterprise-grade retry mechanism following Stellar best practices.
 * Implements exponential backoff with jitter to handle network congestion.
 *
 * Based on: https://stellar.org/blog/developers/transaction-submission-timeouts-and-dynamic-fees-faq
 */

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number; // 0-1, adds randomness to prevent thundering herd
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

export class RetryableError extends Error {
  constructor(
    message: string,
    public attempt: number,
    public maxAttempts: number
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class MaxRetriesExceededError extends Error {
  constructor(
    message: string,
    public attempts: number,
    public lastError: Error
  ) {
    super(message);
    this.name = 'MaxRetriesExceededError';
  }
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  options: RetryOptions
): number {
  const exponentialDelay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt),
    options.maxDelayMs
  );

  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * options.jitterFactor * (Math.random() - 0.5);
  return Math.max(0, exponentialDelay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Type guard for error-like objects
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const err = error as Record<string, unknown>;

  // Network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return true;
  }

  // HTTP errors (check for response object)
  const response = err.response as Record<string, unknown> | undefined;
  if (response && typeof response.status === 'number') {
    // HTTP 5xx errors (server side)
    if (response.status >= 500 && response.status < 600) {
      return true;
    }

    // HTTP 429 (rate limit)
    if (response.status === 429) {
      return true;
    }

    // Horizon specific errors - 504 Gateway timeout
    if (response.status === 504) {
      return true;
    }
  }

  // Check message property
  const message = error instanceof Error ? error.message : '';

  // Stellar transaction timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }

  // XDR parsing errors (RPC instability)
  if (message.includes('union switch') || message.includes('XDR')) {
    return true;
  }

  // NOT_FOUND during confirmation polling (still pending)
  if (err.code === 'NOT_FOUND' && message.includes('Transaction')) {
    return true;
  }

  return false;
}

/**
 * Execute operation with retry logic and exponential backoff
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => submitTransaction(tx),
 *   { maxAttempts: 5 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      // Log retry attempts (except first)
      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt + 1}/${opts.maxAttempts}`);
      }

      const result = await operation();

      // Success - log if it was a retry
      if (attempt > 0) {
        console.log(`✅ Operation succeeded after ${attempt + 1} attempts`);
      }

      return result;

    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Check if error is retryable
      if (!isRetryableError(error)) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Non-retryable error: ${errorMessage}`);
        throw error;
      }

      // Last attempt - don't wait, just throw
      if (attempt === opts.maxAttempts - 1) {
        console.error(`❌ Max retries (${opts.maxAttempts}) exceeded`);
        const errMsg = error instanceof Error ? error.message : String(error);
        const errObj = error instanceof Error ? error : new Error(errMsg);
        throw new MaxRetriesExceededError(
          `Operation failed after ${opts.maxAttempts} attempts: ${errMsg}`,
          opts.maxAttempts,
          errObj
        );
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, opts);
      const retryErrMsg = error instanceof Error ? error.message : String(error);
      console.warn(
        `⚠️ Retryable error (attempt ${attempt + 1}/${opts.maxAttempts}): ${retryErrMsg}`
      );
      console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before retry...`);

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new MaxRetriesExceededError(
    `Operation failed after ${opts.maxAttempts} attempts`,
    opts.maxAttempts,
    lastError!
  );
}

/**
 * Retry-specific operation (e.g., just confirmation polling)
 *
 * More aggressive retry for polling operations
 */
export async function withPollingRetry<T>(
  operation: () => Promise<T>,
  timeoutMs: number = 60000
): Promise<T> {
  return withRetry(operation, {
    maxAttempts: Math.floor(timeoutMs / 1000), // 1 attempt per second
    initialDelayMs: 1000,
    maxDelayMs: 2000,
    backoffMultiplier: 1.1, // Gentle backoff for polling
    jitterFactor: 0.05,
  });
}
