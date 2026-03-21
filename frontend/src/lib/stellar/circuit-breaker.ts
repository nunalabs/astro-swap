/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by temporarily blocking requests to failing services.
 * Implements the Circuit Breaker pattern for RPC/Horizon endpoints.
 */

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN',     // Blocking requests (too many failures)
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before attempting recovery (half-open)
  windowSize: number; // Rolling window for failure tracking (ms)
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;
  private recentFailures: number[] = [];

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(
          `Circuit breaker [${this.name}] is OPEN. Service temporarily unavailable.`
        );
      }

      // Transition to half-open (test recovery)
      this.state = CircuitState.HALF_OPEN;
      console.log(`🟡 Circuit breaker [${this.name}] entering HALF_OPEN state`);
    }

    try {
      const result = await operation();

      // Success
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.options.successThreshold) {
        // Recovered - close circuit
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        this.recentFailures = [];
        console.log(`✅ Circuit breaker [${this.name}] closed (service recovered)`);
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    const now = Date.now();
    this.lastFailureTime = now;
    this.recentFailures.push(now);

    // Remove old failures outside window
    this.recentFailures = this.recentFailures.filter(
      time => now - time < this.options.windowSize
    );

    // Check if should open circuit
    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during recovery - reopen immediately
      this.openCircuit();
    } else if (this.recentFailures.length >= this.options.failureThreshold) {
      // Too many failures in window - open circuit
      this.openCircuit();
    }

    this.failureCount++;
  }

  /**
   * Open circuit (block requests)
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.options.timeout;
    this.successCount = 0;

    console.error(
      `❌ Circuit breaker [${this.name}] opened after ${this.recentFailures.length} failures. ` +
      `Will retry in ${(this.options.timeout / 1000).toFixed(0)}s`
    );
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get stats
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    recentFailures: number;
    nextAttemptIn?: number;
  } {
    const stats: {
      state: CircuitState;
      failureCount: number;
      successCount: number;
      recentFailures: number;
      nextAttemptIn?: number;
    } = {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      recentFailures: this.recentFailures.length,
    };

    if (this.state === CircuitState.OPEN) {
      stats.nextAttemptIn = Math.max(0, this.nextAttemptTime - Date.now());
    }

    return stats;
  }

  /**
   * Manually reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.recentFailures = [];
    console.log(`🔄 Circuit breaker [${this.name}] manually reset`);
  }
}

// Circuit breakers for different services
export const rpcCircuitBreaker = new CircuitBreaker('Soroban RPC', {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
  windowSize: 60000, // 1 minute
});

export const horizonCircuitBreaker = new CircuitBreaker('Horizon API', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  windowSize: 120000, // 2 minutes
});
