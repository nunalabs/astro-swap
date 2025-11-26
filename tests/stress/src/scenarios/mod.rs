//! Stress Test Scenarios
//!
//! Individual test scenarios for different aspects of the DEX.

pub mod swap_load;
pub mod pool_stress;
pub mod router_paths;
pub mod concurrent;

use crate::config::StressConfig;
use crate::metrics::MetricsCollector;

/// Trait for stress test scenarios
pub trait StressScenario {
    /// Run the scenario
    fn run(&self, config: &StressConfig, collector: &MetricsCollector);

    /// Get scenario name
    fn name(&self) -> &str;

    /// Get scenario description
    fn description(&self) -> &str;
}

pub use swap_load::SwapLoadScenario;
pub use pool_stress::PoolStressScenario;
pub use router_paths::RouterPathsScenario;
pub use concurrent::ConcurrentScenario;
