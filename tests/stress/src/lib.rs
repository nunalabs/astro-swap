//! AstroSwap DEX Stress & Load Testing Suite
//!
//! This library provides comprehensive stress testing infrastructure for validating
//! AstroSwap DEX performance under extreme conditions.
//!
//! # Modules
//!
//! - `config`: Test configuration and parameters
//! - `scenarios`: Individual test scenarios (swaps, pools, routing, etc.)
//! - `metrics`: Metrics collection and analysis
//! - `utils`: Helper utilities for account and token management

pub mod config;
pub mod scenarios;
pub mod metrics;
pub mod utils;

// WASM bytes for pair contract deployment (SDK 23 requirement)
pub mod pair_wasm {
    pub const WASM: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/astroswap_pair.wasm");
}

// Re-exports for convenience
pub use config::{Network, Scenario, StressConfig};
pub use scenarios::StressScenario;
pub use metrics::{MetricsCollector, TestReport};
pub use utils::{AccountPool, TokenManager};
