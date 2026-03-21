/**
 * Metrics and Observability
 *
 * Collects metrics for monitoring system health and performance.
 * Enables data-driven optimization and proactive issue detection.
 */

interface MetricEntry {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

class MetricsCollector {
  private metrics = new Map<string, MetricEntry[]>();
  private readonly maxEntriesPerMetric = 1000;

  /**
   * Record a metric value
   */
  record(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const entries = this.metrics.get(name)!;
    entries.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only recent entries (LRU)
    if (entries.length > this.maxEntriesPerMetric) {
      entries.shift();
    }
  }

  /**
   * Record timing (duration in ms)
   */
  recordTiming(
    name: string,
    durationMs: number,
    tags?: Record<string, string>
  ): void {
    this.record(`${name}.duration`, durationMs, tags);
  }

  /**
   * Increment counter
   */
  increment(name: string, tags?: Record<string, string>): void {
    this.record(name, 1, tags);
  }

  /**
   * Get metric statistics
   */
  getStats(name: string, windowMs: number = 60000): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } | null {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    // Filter to window
    const now = Date.now();
    const recent = entries.filter(e => now - e.timestamp < windowMs);

    if (recent.length === 0) {
      return null;
    }

    // Calculate statistics
    const values = recent.map(e => e.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0],
      max: values[values.length - 1],
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get all metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Clear metrics older than windowMs
   */
  clearOld(windowMs: number = 300000): void {
    const cutoff = Date.now() - windowMs;

    for (const [name, entries] of this.metrics.entries()) {
      const filtered = entries.filter(e => e.timestamp > cutoff);

      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }
  }

  /**
   * Get dashboard summary
   */
  getDashboard(): Record<string, any> {
    const dashboard: Record<string, any> = {};

    // Transaction metrics
    const txSubmitted = this.getStats('transaction.submitted', 300000);
    const txConfirmed = this.getStats('transaction.confirmed.duration', 300000);
    const txFailed = this.getStats('transaction.failed', 300000);

    dashboard.transactions = {
      submitted: txSubmitted?.count ?? 0,
      confirmed: txConfirmed?.count ?? 0,
      failed: txFailed?.count ?? 0,
      successRate: txSubmitted && txConfirmed
        ? (txConfirmed.count / txSubmitted.count * 100).toFixed(1) + '%'
        : 'N/A',
      avgConfirmTime: txConfirmed ? `${(txConfirmed.avg / 1000).toFixed(1)}s` : 'N/A',
      p95ConfirmTime: txConfirmed ? `${(txConfirmed.p95 / 1000).toFixed(1)}s` : 'N/A',
    };

    // RPC metrics
    const rpcCalls = this.getStats('rpc.call.duration', 60000);
    const rpcErrors = this.getStats('rpc.error', 60000);

    dashboard.rpc = {
      calls: rpcCalls?.count ?? 0,
      errors: rpcErrors?.count ?? 0,
      errorRate: rpcCalls && rpcErrors
        ? (rpcErrors.count / rpcCalls.count * 100).toFixed(1) + '%'
        : 'N/A',
      avgLatency: rpcCalls ? `${rpcCalls.avg.toFixed(0)}ms` : 'N/A',
      p95Latency: rpcCalls ? `${rpcCalls.p95.toFixed(0)}ms` : 'N/A',
    };

    // Horizon metrics
    const horizonCalls = this.getStats('horizon.call.duration', 60000);
    const horizonErrors = this.getStats('horizon.error', 60000);

    dashboard.horizon = {
      calls: horizonCalls?.count ?? 0,
      errors: horizonErrors?.count ?? 0,
      errorRate: horizonCalls && horizonErrors
        ? (horizonErrors.count / horizonCalls.count * 100).toFixed(1) + '%'
        : 'N/A',
      avgLatency: horizonCalls ? `${horizonCalls.avg.toFixed(0)}ms` : 'N/A',
      p95Latency: horizonCalls ? `${horizonCalls.p95.toFixed(0)}ms` : 'N/A',
    };

    // Cache metrics
    const cacheHits = this.getStats('cache.hit', 60000);
    const cacheMisses = this.getStats('cache.miss', 60000);

    dashboard.cache = {
      hits: cacheHits?.count ?? 0,
      misses: cacheMisses?.count ?? 0,
      hitRate: cacheHits && cacheMisses
        ? ((cacheHits.count / (cacheHits.count + cacheMisses.count)) * 100).toFixed(1) + '%'
        : 'N/A',
    };

    return dashboard;
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Clear old metrics every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    metrics.clearOld(300000); // Keep last 5 minutes
  }, 300000);
}

/**
 * Utility to measure function execution time
 */
export async function measureTiming<T>(
  name: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await operation();
    metrics.recordTiming(name, Date.now() - start, tags);
    return result;
  } catch (error) {
    metrics.recordTiming(name, Date.now() - start, { ...tags, error: 'true' });
    throw error;
  }
}
