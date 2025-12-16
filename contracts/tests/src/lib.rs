#![cfg(test)]
#![allow(clippy::inconsistent_digit_grouping)]
#![allow(clippy::len_zero)]
#![allow(clippy::new_without_default)]
#![allow(unused_variables)]
#![allow(unused_imports)]

//! AstroSwap DEX Integration Tests
//!
//! Comprehensive integration tests covering all major contract interactions:
//! - Full swap flows with liquidity management
//! - Multi-hop swaps across multiple pairs
//! - Staking and reward distribution
//! - Aggregator with multiple protocols
//! - Bridge graduation from Astro-Shiba launchpad
//!
//! These tests ensure all contracts work together correctly and handle
//! edge cases, error conditions, and complex user flows.

// Import pair WASM for factory deployment
// Note: Only importing WASM bytes, not generating client types to avoid conflicts
pub mod pair_wasm {
    // Include the WASM bytes directly
    pub const WASM: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/astroswap_pair.wasm");
}

mod mock_token;
mod test_aggregator;
mod test_bridge;
mod test_full_swap;
mod test_multi_hop;
mod test_staking;
mod test_utils;

pub use test_utils::*;
