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

// Re-exports for convenience
pub use config::{Network, Scenario, StressConfig};
pub use scenarios::StressScenario;
pub use metrics::{MetricsCollector, TestReport};
pub use utils::{AccountPool, TokenManager};
