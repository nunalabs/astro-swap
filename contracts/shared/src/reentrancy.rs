//! Reentrancy Guard Module
//!
//! Re-exports from astro-core-shared with AstroSwapError conversion.
//!
//! Provides RAII-style reentrancy protection for Soroban contracts.
//! The guard automatically releases the lock when it goes out of scope,
//! ensuring proper cleanup even in error paths.

use soroban_sdk::Env;

use crate::error::AstroSwapError;

// Re-export the core guard for direct use when SharedError is acceptable
pub use astro_core_shared::reentrancy::SimpleReentrancyGuard;

/// RAII-style reentrancy guard that automatically releases the lock on drop.
///
/// This is a wrapper around astro-core's ReentrancyGuard that converts
/// SharedError to AstroSwapError for use in DEX contracts.
///
/// # Usage
///
/// ```ignore
/// use astroswap_shared::reentrancy::ReentrancyGuard;
///
/// fn guarded_function(env: Env) -> Result<(), AstroSwapError> {
///     // Lock is acquired here, returns Err if already locked
///     let _guard = ReentrancyGuard::acquire(&env, is_locked, set_locked)?;
///
///     // All operations protected by the lock
///     do_something()?;
///     do_something_else()?;
///
///     // Lock is automatically released when _guard goes out of scope
///     // This happens even if we return early with ? or return Err
///     Ok(())
/// }
/// ```
///
/// # Benefits over manual lock/unlock
///
/// 1. **Automatic cleanup**: Lock is always released, no matter how the function exits
/// 2. **Exception safety**: Early returns via `?` or `return` are handled correctly
/// 3. **Less error-prone**: No need to remember to call `release_lock` at every exit point
/// 4. **Code clarity**: Intent is clear - the scope of protection is visible
pub struct ReentrancyGuard<'a, F>
where
    F: Fn(&Env, bool),
{
    inner: astro_core_shared::reentrancy::ReentrancyGuard<'a, F>,
}

impl<'a, F> ReentrancyGuard<'a, F>
where
    F: Fn(&Env, bool),
{
    /// Acquire the reentrancy lock.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `is_locked_fn` - Function to check if lock is held (e.g., `storage::is_locked`)
    /// * `set_locked_fn` - Function to set lock state (e.g., `storage::set_locked`)
    ///
    /// # Returns
    /// * `Ok(ReentrancyGuard)` - Lock acquired successfully
    /// * `Err(AstroSwapError::Reentrancy)` - Lock is already held
    ///
    /// # Example
    /// ```ignore
    /// let _guard = ReentrancyGuard::acquire(&env, is_locked, set_locked)?;
    /// // protected operations here
    /// // lock released automatically on scope exit
    /// ```
    pub fn acquire<G>(
        env: &'a Env,
        is_locked_fn: G,
        set_locked_fn: F,
    ) -> Result<Self, AstroSwapError>
    where
        G: Fn(&Env) -> bool,
    {
        let inner =
            astro_core_shared::reentrancy::ReentrancyGuard::acquire(env, is_locked_fn, set_locked_fn)
                .map_err(|_| AstroSwapError::Reentrancy)?;
        Ok(Self { inner })
    }
}

// Note: Drop is handled by the inner guard

/// Convenience macro for acquiring reentrancy guard with standard storage functions.
///
/// # Usage
/// ```ignore
/// use astroswap_shared::with_reentrancy_guard;
/// use crate::storage::{is_locked, set_locked};
///
/// fn my_function(env: Env) -> Result<i128, AstroSwapError> {
///     let _guard = with_reentrancy_guard!(&env, is_locked, set_locked)?;
///     // protected code here
///     Ok(42)
/// }
/// ```
#[macro_export]
macro_rules! with_reentrancy_guard {
    ($env:expr, $is_locked:path, $set_locked:path) => {
        $crate::reentrancy::ReentrancyGuard::acquire($env, $is_locked, $set_locked)
    };
}

// Unit tests are covered through contract integration tests
