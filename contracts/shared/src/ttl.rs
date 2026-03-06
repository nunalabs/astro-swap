//! Lazy TTL Refresh Pattern
//!
//! Re-exports from astro-core-shared for consistent TTL management.
//!
//! Provides efficient TTL management by only refreshing when necessary.
//!
//! ## Problem
//! Calling `extend_ttl` on every storage access is expensive because:
//! 1. TTL extension is a storage write operation
//! 2. If TTL is still far from expiration, the extension is wasteful
//!
//! ## Solution
//! Only extend TTL when it's within a threshold of expiration.
//! This reduces unnecessary writes while ensuring data doesn't expire.
//!
//! ## Usage
//! ```ignore
//! use astroswap_shared::ttl;
//!
//! pub fn some_operation(env: Env) {
//!     ttl::maybe_extend_instance_ttl(&env);
//!     // ... rest of function
//! }
//! ```

// Re-export everything from astro-core-shared ttl module
pub use astro_core_shared::ttl::{
    force_extend_instance_ttl, maybe_extend_instance_ttl, maybe_extend_persistent_ttl,
    should_refresh_instance_ttl, LazyTtlKey, MIN_REFRESH_INTERVAL, REFRESH_THRESHOLD_PERCENT,
    TTL_BUFFER,
};
