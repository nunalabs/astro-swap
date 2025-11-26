//! Stress Test Configuration
//!
//! Defines configuration structures for stress and load testing scenarios.

use serde::{Deserialize, Serialize};

/// Network environment for testing
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Network {
    /// Local test environment (Soroban SDK testutils)
    Local,
    /// Testnet deployment
    Testnet,
    /// Futurenet deployment
    Futurenet,
}

impl Default for Network {
    fn default() -> Self {
        Network::Local
    }
}

/// Test scenario type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Scenario {
    /// High-frequency swap operations
    SwapLoad,
    /// Pool liquidity stress testing
    PoolStress,
    /// Multi-hop routing stress
    RouterPaths,
    /// Concurrent mixed operations
    Concurrent,
    /// All scenarios combined
    All,
}

impl Scenario {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "swap-load" | "swap_load" => Some(Scenario::SwapLoad),
            "pool-stress" | "pool_stress" => Some(Scenario::PoolStress),
            "router-paths" | "router_paths" => Some(Scenario::RouterPaths),
            "concurrent" => Some(Scenario::Concurrent),
            "all" => Some(Scenario::All),
            _ => None,
        }
    }

    pub fn all() -> Vec<Self> {
        vec![
            Scenario::SwapLoad,
            Scenario::PoolStress,
            Scenario::RouterPaths,
            Scenario::Concurrent,
        ]
    }
}

/// Main stress test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StressConfig {
    /// Network to run tests on
    pub network: Network,

    /// Test duration in seconds
    pub duration_seconds: u64,

    /// Target transactions per second
    pub target_tps: u32,

    /// Number of test accounts to generate
    pub num_accounts: u32,

    /// Number of trading pairs to create
    pub num_pairs: u32,

    /// Scenarios to run
    pub scenarios: Vec<Scenario>,

    /// Output directory for results
    pub output_dir: String,

    /// Scenario-specific configurations
    pub swap_load: SwapLoadConfig,
    pub pool_stress: PoolStressConfig,
    pub router_paths: RouterPathsConfig,
    pub concurrent: ConcurrentConfig,
}

impl Default for StressConfig {
    fn default() -> Self {
        Self {
            network: Network::Local,
            duration_seconds: 60,
            target_tps: 50,
            num_accounts: 30,
            num_pairs: 5,
            scenarios: vec![Scenario::All],
            output_dir: "results".to_string(),
            swap_load: SwapLoadConfig::default(),
            pool_stress: PoolStressConfig::default(),
            router_paths: RouterPathsConfig::default(),
            concurrent: ConcurrentConfig::default(),
        }
    }
}

/// Swap load test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapLoadConfig {
    /// Minimum swap amount (in base units)
    pub min_swap_amount: i128,

    /// Maximum swap amount (in base units)
    pub max_swap_amount: i128,

    /// Minimum slippage tolerance in basis points
    pub min_slippage_bps: u32,

    /// Maximum slippage tolerance in basis points
    pub max_slippage_bps: u32,

    /// Whether to test both directions (A->B and B->A)
    pub bidirectional: bool,
}

impl Default for SwapLoadConfig {
    fn default() -> Self {
        Self {
            min_swap_amount: 1_000_0000000,      // 1,000 tokens
            max_swap_amount: 100_000_0000000,    // 100,000 tokens
            min_slippage_bps: 10,                // 0.1%
            max_slippage_bps: 500,               // 5%
            bidirectional: true,
        }
    }
}

/// Pool stress test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolStressConfig {
    /// Minimum liquidity amount per token
    pub min_liquidity: i128,

    /// Maximum liquidity amount per token
    pub max_liquidity: i128,

    /// Number of pools to test simultaneously
    pub num_pools: u32,

    /// Ratio of add vs remove operations (0.0 - 1.0)
    pub add_ratio: f64,

    /// Test edge cases (min/max amounts)
    pub test_edge_cases: bool,
}

impl Default for PoolStressConfig {
    fn default() -> Self {
        Self {
            min_liquidity: 10_000_0000000,       // 10,000 tokens
            max_liquidity: 1_000_000_0000000,    // 1,000,000 tokens
            num_pools: 10,
            add_ratio: 0.6,                      // 60% adds, 40% removes
            test_edge_cases: true,
        }
    }
}

/// Router paths test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterPathsConfig {
    /// Minimum number of hops in a path
    pub min_hops: u32,

    /// Maximum number of hops in a path
    pub max_hops: u32,

    /// Number of different paths to test per second
    pub paths_per_second: u32,

    /// Test optimal path finding
    pub test_path_optimization: bool,

    /// Maximum price impact tolerance in basis points
    pub max_price_impact_bps: u32,
}

impl Default for RouterPathsConfig {
    fn default() -> Self {
        Self {
            min_hops: 2,
            max_hops: 4,
            paths_per_second: 20,
            test_path_optimization: true,
            max_price_impact_bps: 1000,          // 10%
        }
    }
}

/// Concurrent operations test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConcurrentConfig {
    /// Number of concurrent workers
    pub num_workers: u32,

    /// Weight for swap operations (relative to other ops)
    pub swap_weight: u32,

    /// Weight for add liquidity operations
    pub add_liquidity_weight: u32,

    /// Weight for remove liquidity operations
    pub remove_liquidity_weight: u32,

    /// Test for race conditions
    pub test_race_conditions: bool,

    /// Maximum acceptable retry rate (0.0 - 1.0)
    pub max_retry_rate: f64,
}

impl Default for ConcurrentConfig {
    fn default() -> Self {
        Self {
            num_workers: 20,
            swap_weight: 50,
            add_liquidity_weight: 25,
            remove_liquidity_weight: 25,
            test_race_conditions: true,
            max_retry_rate: 0.05,                // 5% retry rate acceptable
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scenario_from_str() {
        assert_eq!(Scenario::from_str("swap-load"), Some(Scenario::SwapLoad));
        assert_eq!(Scenario::from_str("pool_stress"), Some(Scenario::PoolStress));
        assert_eq!(Scenario::from_str("router-paths"), Some(Scenario::RouterPaths));
        assert_eq!(Scenario::from_str("concurrent"), Some(Scenario::Concurrent));
        assert_eq!(Scenario::from_str("all"), Some(Scenario::All));
        assert_eq!(Scenario::from_str("invalid"), None);
    }

    #[test]
    fn test_default_config() {
        let config = StressConfig::default();
        assert_eq!(config.network, Network::Local);
        assert_eq!(config.duration_seconds, 60);
        assert_eq!(config.target_tps, 50);
        assert_eq!(config.num_accounts, 30);
    }

    #[test]
    fn test_scenario_all() {
        let scenarios = Scenario::all();
        assert_eq!(scenarios.len(), 4);
        assert!(scenarios.contains(&Scenario::SwapLoad));
        assert!(scenarios.contains(&Scenario::PoolStress));
        assert!(scenarios.contains(&Scenario::RouterPaths));
        assert!(scenarios.contains(&Scenario::Concurrent));
    }
}
