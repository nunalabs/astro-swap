//! Metrics Collector
//!
//! Real-time collection of stress test metrics including latency, throughput, and errors.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Type of operation being measured
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum OperationType {
    Swap,
    AddLiquidity,
    RemoveLiquidity,
    CreatePair,
    MultiHopSwap,
    Stake,
    Unstake,
    ClaimRewards,
}

impl OperationType {
    pub fn as_str(&self) -> &str {
        match self {
            OperationType::Swap => "swap",
            OperationType::AddLiquidity => "add_liquidity",
            OperationType::RemoveLiquidity => "remove_liquidity",
            OperationType::CreatePair => "create_pair",
            OperationType::MultiHopSwap => "multi_hop_swap",
            OperationType::Stake => "stake",
            OperationType::Unstake => "unstake",
            OperationType::ClaimRewards => "claim_rewards",
        }
    }
}

/// Individual operation metric
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationMetric {
    pub operation: OperationType,
    pub timestamp: DateTime<Utc>,
    pub duration_micros: u64,
    pub success: bool,
    pub error: Option<String>,
    pub metadata: HashMap<String, String>,
}

/// Thread-safe metrics collector
#[derive(Clone)]
pub struct MetricsCollector {
    inner: Arc<Mutex<MetricsCollectorInner>>,
}

struct MetricsCollectorInner {
    start_time: Instant,
    metrics: Vec<OperationMetric>,
    operation_counts: HashMap<OperationType, u64>,
    error_counts: HashMap<String, u64>,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(MetricsCollectorInner {
                start_time: Instant::now(),
                metrics: Vec::new(),
                operation_counts: HashMap::new(),
                error_counts: HashMap::new(),
            })),
        }
    }

    /// Start timing an operation
    pub fn start_operation(&self) -> OperationTimer {
        OperationTimer::new(self.clone())
    }

    /// Record a completed operation
    pub fn record(
        &self,
        operation: OperationType,
        duration: Duration,
        success: bool,
        error: Option<String>,
        metadata: HashMap<String, String>,
    ) {
        let mut inner = self.inner.lock().unwrap();

        let metric = OperationMetric {
            operation,
            timestamp: Utc::now(),
            duration_micros: duration.as_micros() as u64,
            success,
            error: error.clone(),
            metadata,
        };

        inner.metrics.push(metric);

        // Update counts
        *inner.operation_counts.entry(operation).or_insert(0) += 1;

        if let Some(err) = error {
            *inner.error_counts.entry(err).or_insert(0) += 1;
        }
    }

    /// Record a successful operation
    pub fn record_success(
        &self,
        operation: OperationType,
        duration: Duration,
        metadata: HashMap<String, String>,
    ) {
        self.record(operation, duration, true, None, metadata);
    }

    /// Record a failed operation
    pub fn record_error(
        &self,
        operation: OperationType,
        duration: Duration,
        error: String,
        metadata: HashMap<String, String>,
    ) {
        self.record(operation, duration, false, Some(error), metadata);
    }

    /// Get total number of operations
    pub fn total_operations(&self) -> usize {
        self.inner.lock().unwrap().metrics.len()
    }

    /// Get successful operations count
    pub fn successful_operations(&self) -> usize {
        self.inner
            .lock()
            .unwrap()
            .metrics
            .iter()
            .filter(|m| m.success)
            .count()
    }

    /// Get failed operations count
    pub fn failed_operations(&self) -> usize {
        self.inner
            .lock()
            .unwrap()
            .metrics
            .iter()
            .filter(|m| !m.success)
            .count()
    }

    /// Get operations per second
    pub fn operations_per_second(&self) -> f64 {
        let inner = self.inner.lock().unwrap();
        let elapsed = inner.start_time.elapsed().as_secs_f64();
        if elapsed > 0.0 {
            inner.metrics.len() as f64 / elapsed
        } else {
            0.0
        }
    }

    /// Get average latency in microseconds
    pub fn average_latency_micros(&self) -> u64 {
        let inner = self.inner.lock().unwrap();
        if inner.metrics.is_empty() {
            return 0;
        }

        let total: u64 = inner.metrics.iter().map(|m| m.duration_micros).sum();
        total / inner.metrics.len() as u64
    }

    /// Get latency percentile (0.0 - 1.0)
    pub fn latency_percentile(&self, percentile: f64) -> u64 {
        let inner = self.inner.lock().unwrap();
        if inner.metrics.is_empty() {
            return 0;
        }

        let mut durations: Vec<u64> = inner.metrics.iter().map(|m| m.duration_micros).collect();
        durations.sort_unstable();

        let index = ((durations.len() as f64) * percentile) as usize;
        durations[index.min(durations.len() - 1)]
    }

    /// Get error counts
    pub fn error_counts(&self) -> HashMap<String, u64> {
        self.inner.lock().unwrap().error_counts.clone()
    }

    /// Get operation counts
    pub fn operation_counts(&self) -> HashMap<OperationType, u64> {
        self.inner.lock().unwrap().operation_counts.clone()
    }

    /// Get all metrics (for detailed analysis)
    pub fn get_metrics(&self) -> Vec<OperationMetric> {
        self.inner.lock().unwrap().metrics.clone()
    }

    /// Get metrics for specific operation type
    pub fn get_metrics_for_operation(&self, operation: OperationType) -> Vec<OperationMetric> {
        self.inner
            .lock()
            .unwrap()
            .metrics
            .iter()
            .filter(|m| m.operation == operation)
            .cloned()
            .collect()
    }

    /// Calculate success rate
    pub fn success_rate(&self) -> f64 {
        let total = self.total_operations();
        if total == 0 {
            return 0.0;
        }
        self.successful_operations() as f64 / total as f64
    }

    /// Get elapsed time since start
    pub fn elapsed(&self) -> Duration {
        self.inner.lock().unwrap().start_time.elapsed()
    }

    /// Clear all metrics
    pub fn clear(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.metrics.clear();
        inner.operation_counts.clear();
        inner.error_counts.clear();
        inner.start_time = Instant::now();
    }
}

impl Default for MetricsCollector {
    fn default() -> Self {
        Self::new()
    }
}

/// RAII timer for operations
pub struct OperationTimer {
    start: Instant,
    collector: MetricsCollector,
}

impl OperationTimer {
    fn new(collector: MetricsCollector) -> Self {
        Self {
            start: Instant::now(),
            collector,
        }
    }

    /// Complete the operation successfully
    pub fn success(self, operation: OperationType, metadata: HashMap<String, String>) {
        let duration = self.start.elapsed();
        self.collector.record_success(operation, duration, metadata);
    }

    /// Complete the operation with error
    pub fn error(self, operation: OperationType, error: String, metadata: HashMap<String, String>) {
        let duration = self.start.elapsed();
        self.collector.record_error(operation, duration, error, metadata);
    }

    /// Get elapsed time without completing
    pub fn elapsed(&self) -> Duration {
        self.start.elapsed()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_metrics_collector() {
        let collector = MetricsCollector::new();

        // Record some operations
        collector.record_success(
            OperationType::Swap,
            Duration::from_millis(10),
            HashMap::new(),
        );
        collector.record_success(
            OperationType::Swap,
            Duration::from_millis(20),
            HashMap::new(),
        );
        collector.record_error(
            OperationType::AddLiquidity,
            Duration::from_millis(5),
            "Insufficient balance".to_string(),
            HashMap::new(),
        );

        assert_eq!(collector.total_operations(), 3);
        assert_eq!(collector.successful_operations(), 2);
        assert_eq!(collector.failed_operations(), 1);
        assert_eq!(collector.success_rate(), 2.0 / 3.0);
    }

    #[test]
    fn test_operation_timer() {
        let collector = MetricsCollector::new();

        let timer = collector.start_operation();
        thread::sleep(Duration::from_millis(10));
        timer.success(OperationType::Swap, HashMap::new());

        assert_eq!(collector.total_operations(), 1);
        assert!(collector.average_latency_micros() >= 10_000);
    }

    #[test]
    fn test_latency_percentiles() {
        let collector = MetricsCollector::new();

        for i in 0..100 {
            collector.record_success(
                OperationType::Swap,
                Duration::from_micros(i * 1000),
                HashMap::new(),
            );
        }

        let p50 = collector.latency_percentile(0.5);
        let p95 = collector.latency_percentile(0.95);
        let p99 = collector.latency_percentile(0.99);

        assert!(p50 < p95);
        assert!(p95 < p99);
    }

    #[test]
    fn test_operation_counts() {
        let collector = MetricsCollector::new();

        collector.record_success(OperationType::Swap, Duration::from_millis(1), HashMap::new());
        collector.record_success(OperationType::Swap, Duration::from_millis(1), HashMap::new());
        collector.record_success(
            OperationType::AddLiquidity,
            Duration::from_millis(1),
            HashMap::new(),
        );

        let counts = collector.operation_counts();
        assert_eq!(counts.get(&OperationType::Swap), Some(&2));
        assert_eq!(counts.get(&OperationType::AddLiquidity), Some(&1));
    }
}
