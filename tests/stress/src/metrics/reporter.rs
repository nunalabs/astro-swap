//! Test Report Generation
//!
//! Generates comprehensive reports from collected metrics.

use super::collector::{MetricsCollector, OperationMetric, OperationType};
use crate::config::StressConfig;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

/// Complete test report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestReport {
    pub test_id: String,
    pub config: StressConfig,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_seconds: f64,
    pub scenarios: Vec<ScenarioReport>,
    pub summary: TestSummary,
}

/// Report for a single scenario
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioReport {
    pub name: String,
    pub performance: PerformanceMetrics,
    pub errors: ErrorStatistics,
    pub operation_breakdown: HashMap<String, OperationStats>,
}

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_operations: usize,
    pub successful_operations: usize,
    pub failed_operations: usize,
    pub success_rate: f64,
    pub operations_per_second: f64,
    pub latency_avg_ms: f64,
    pub latency_p50_ms: f64,
    pub latency_p95_ms: f64,
    pub latency_p99_ms: f64,
    pub latency_max_ms: f64,
}

/// Error statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorStatistics {
    pub total_errors: usize,
    pub error_rate: f64,
    pub error_breakdown: HashMap<String, u64>,
    pub top_errors: Vec<(String, u64)>,
}

/// Statistics for specific operation type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationStats {
    pub count: usize,
    pub success_count: usize,
    pub failure_count: usize,
    pub success_rate: f64,
    pub avg_latency_ms: f64,
    pub p95_latency_ms: f64,
}

/// Overall test summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSummary {
    pub total_scenarios: usize,
    pub total_operations: usize,
    pub overall_success_rate: f64,
    pub overall_tps: f64,
    pub overall_latency_ms: f64,
    pub test_passed: bool,
    pub issues: Vec<String>,
}

impl TestReport {
    /// Generate a report from metrics collector
    pub fn from_metrics(
        test_id: String,
        config: StressConfig,
        start_time: DateTime<Utc>,
        collector: &MetricsCollector,
    ) -> Self {
        let end_time = Utc::now();
        let duration_seconds = (end_time - start_time).num_milliseconds() as f64 / 1000.0;

        // For now, create a single scenario report from all metrics
        let scenario_name = if config.scenarios.len() == 1 {
            format!("{:?}", config.scenarios[0])
        } else {
            "Combined".to_string()
        };

        let scenario_report = ScenarioReport::from_metrics(&scenario_name, collector);

        let summary = TestSummary {
            total_scenarios: 1,
            total_operations: collector.total_operations(),
            overall_success_rate: collector.success_rate(),
            overall_tps: collector.operations_per_second(),
            overall_latency_ms: collector.average_latency_micros() as f64 / 1000.0,
            test_passed: collector.success_rate() > 0.95, // 95% success threshold
            issues: Self::identify_issues(collector, &config),
        };

        Self {
            test_id,
            config,
            start_time,
            end_time,
            duration_seconds,
            scenarios: vec![scenario_report],
            summary,
        }
    }

    /// Identify issues in the test results
    fn identify_issues(collector: &MetricsCollector, config: &StressConfig) -> Vec<String> {
        let mut issues = Vec::new();

        // Check success rate
        if collector.success_rate() < 0.95 {
            issues.push(format!(
                "Low success rate: {:.2}% (threshold: 95%)",
                collector.success_rate() * 100.0
            ));
        }

        // Check TPS
        let actual_tps = collector.operations_per_second();
        let target_tps = config.target_tps as f64;
        if actual_tps < target_tps * 0.8 {
            issues.push(format!(
                "Low TPS: {:.2} (target: {:.2})",
                actual_tps, target_tps
            ));
        }

        // Check latency
        let p95_latency_ms = collector.latency_percentile(0.95) as f64 / 1000.0;
        if p95_latency_ms > 1000.0 {
            issues.push(format!(
                "High p95 latency: {:.2}ms (threshold: 1000ms)",
                p95_latency_ms
            ));
        }

        // Check error diversity
        let error_counts = collector.error_counts();
        if error_counts.len() > 5 {
            issues.push(format!(
                "Many error types: {} distinct errors",
                error_counts.len()
            ));
        }

        issues
    }

    /// Save report to JSON file
    pub fn save_json<P: AsRef<Path>>(&self, path: P) -> Result<(), std::io::Error> {
        let json = serde_json::to_string_pretty(&self)?;
        fs::write(path, json)?;
        Ok(())
    }

    /// Save report to markdown file
    pub fn save_markdown<P: AsRef<Path>>(&self, path: P) -> Result<(), std::io::Error> {
        let markdown = self.to_markdown();
        fs::write(path, markdown)?;
        Ok(())
    }

    /// Generate markdown representation
    pub fn to_markdown(&self) -> String {
        let mut md = String::new();

        md.push_str(&format!("# Stress Test Report: {}\n\n", self.test_id));
        md.push_str(&format!("**Duration**: {:.2}s\n", self.duration_seconds));
        md.push_str(&format!("**Start**: {}\n", self.start_time));
        md.push_str(&format!("**End**: {}\n\n", self.end_time));

        // Summary
        md.push_str("## Summary\n\n");
        md.push_str(&format!("- **Total Operations**: {}\n", self.summary.total_operations));
        md.push_str(&format!("- **Success Rate**: {:.2}%\n", self.summary.overall_success_rate * 100.0));
        md.push_str(&format!("- **TPS**: {:.2}\n", self.summary.overall_tps));
        md.push_str(&format!("- **Avg Latency**: {:.2}ms\n", self.summary.overall_latency_ms));
        md.push_str(&format!("- **Test Passed**: {}\n\n", if self.summary.test_passed { "✓" } else { "✗" }));

        if !self.summary.issues.is_empty() {
            md.push_str("### Issues\n\n");
            for issue in &self.summary.issues {
                md.push_str(&format!("- {}\n", issue));
            }
            md.push_str("\n");
        }

        // Scenarios
        for scenario in &self.scenarios {
            md.push_str(&format!("## Scenario: {}\n\n", scenario.name));

            md.push_str("### Performance\n\n");
            md.push_str(&format!("- Total Operations: {}\n", scenario.performance.total_operations));
            md.push_str(&format!("- Success Rate: {:.2}%\n", scenario.performance.success_rate * 100.0));
            md.push_str(&format!("- TPS: {:.2}\n", scenario.performance.operations_per_second));
            md.push_str(&format!("- Avg Latency: {:.2}ms\n", scenario.performance.latency_avg_ms));
            md.push_str(&format!("- P50 Latency: {:.2}ms\n", scenario.performance.latency_p50_ms));
            md.push_str(&format!("- P95 Latency: {:.2}ms\n", scenario.performance.latency_p95_ms));
            md.push_str(&format!("- P99 Latency: {:.2}ms\n", scenario.performance.latency_p99_ms));
            md.push_str(&format!("- Max Latency: {:.2}ms\n\n", scenario.performance.latency_max_ms));

            if scenario.errors.total_errors > 0 {
                md.push_str("### Errors\n\n");
                md.push_str(&format!("- Total Errors: {}\n", scenario.errors.total_errors));
                md.push_str(&format!("- Error Rate: {:.2}%\n\n", scenario.errors.error_rate * 100.0));

                if !scenario.errors.top_errors.is_empty() {
                    md.push_str("**Top Errors**:\n\n");
                    for (error, count) in &scenario.errors.top_errors {
                        md.push_str(&format!("- {} ({})\n", error, count));
                    }
                    md.push_str("\n");
                }
            }

            if !scenario.operation_breakdown.is_empty() {
                md.push_str("### Operation Breakdown\n\n");
                md.push_str("| Operation | Count | Success Rate | Avg Latency (ms) | P95 Latency (ms) |\n");
                md.push_str("|-----------|-------|--------------|------------------|------------------|\n");

                for (op_name, stats) in &scenario.operation_breakdown {
                    md.push_str(&format!(
                        "| {} | {} | {:.2}% | {:.2} | {:.2} |\n",
                        op_name,
                        stats.count,
                        stats.success_rate * 100.0,
                        stats.avg_latency_ms,
                        stats.p95_latency_ms
                    ));
                }
                md.push_str("\n");
            }
        }

        md
    }
}

impl ScenarioReport {
    /// Create scenario report from metrics collector
    pub fn from_metrics(name: &str, collector: &MetricsCollector) -> Self {
        let performance = PerformanceMetrics::from_collector(collector);
        let errors = ErrorStatistics::from_collector(collector);
        let operation_breakdown = Self::calculate_operation_breakdown(collector);

        Self {
            name: name.to_string(),
            performance,
            errors,
            operation_breakdown,
        }
    }

    fn calculate_operation_breakdown(collector: &MetricsCollector) -> HashMap<String, OperationStats> {
        let mut breakdown = HashMap::new();
        let operation_types = [
            OperationType::Swap,
            OperationType::AddLiquidity,
            OperationType::RemoveLiquidity,
            OperationType::MultiHopSwap,
        ];

        for op_type in operation_types {
            let metrics = collector.get_metrics_for_operation(op_type);
            if !metrics.is_empty() {
                let stats = OperationStats::from_metrics(&metrics);
                breakdown.insert(op_type.as_str().to_string(), stats);
            }
        }

        breakdown
    }
}

impl PerformanceMetrics {
    fn from_collector(collector: &MetricsCollector) -> Self {
        Self {
            total_operations: collector.total_operations(),
            successful_operations: collector.successful_operations(),
            failed_operations: collector.failed_operations(),
            success_rate: collector.success_rate(),
            operations_per_second: collector.operations_per_second(),
            latency_avg_ms: collector.average_latency_micros() as f64 / 1000.0,
            latency_p50_ms: collector.latency_percentile(0.50) as f64 / 1000.0,
            latency_p95_ms: collector.latency_percentile(0.95) as f64 / 1000.0,
            latency_p99_ms: collector.latency_percentile(0.99) as f64 / 1000.0,
            latency_max_ms: collector.latency_percentile(1.0) as f64 / 1000.0,
        }
    }
}

impl ErrorStatistics {
    fn from_collector(collector: &MetricsCollector) -> Self {
        let error_breakdown = collector.error_counts();
        let total_errors = collector.failed_operations();
        let total_ops = collector.total_operations();

        let error_rate = if total_ops > 0 {
            total_errors as f64 / total_ops as f64
        } else {
            0.0
        };

        let mut top_errors: Vec<(String, u64)> = error_breakdown
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect();
        top_errors.sort_by(|a, b| b.1.cmp(&a.1));
        top_errors.truncate(10); // Top 10 errors

        Self {
            total_errors,
            error_rate,
            error_breakdown,
            top_errors,
        }
    }
}

impl OperationStats {
    fn from_metrics(metrics: &[OperationMetric]) -> Self {
        let count = metrics.len();
        let success_count = metrics.iter().filter(|m| m.success).count();
        let failure_count = count - success_count;
        let success_rate = success_count as f64 / count as f64;

        let avg_latency_ms = if !metrics.is_empty() {
            let total: u64 = metrics.iter().map(|m| m.duration_micros).sum();
            (total as f64 / count as f64) / 1000.0
        } else {
            0.0
        };

        let mut durations: Vec<u64> = metrics.iter().map(|m| m.duration_micros).collect();
        durations.sort_unstable();
        let p95_index = ((durations.len() as f64) * 0.95) as usize;
        let p95_latency_ms = if !durations.is_empty() {
            durations[p95_index.min(durations.len() - 1)] as f64 / 1000.0
        } else {
            0.0
        };

        Self {
            count,
            success_count,
            failure_count,
            success_rate,
            avg_latency_ms,
            p95_latency_ms,
        }
    }
}
