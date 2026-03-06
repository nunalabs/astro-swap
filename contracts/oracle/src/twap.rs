use soroban_sdk::{Address, Env};

use crate::error::OracleError;
use crate::storage::{DataKey, Observation};

/// Maximum TWAP window in seconds (24 hours)
pub const MAX_TWAP_WINDOW: u64 = 86400;

/// Minimum TWAP window in seconds (5 minutes)
pub const MIN_TWAP_WINDOW: u64 = 300;

/// Add a new price observation for TWAP calculation
///
/// Uses the efficient circular buffer pattern that:
/// - Writes only to a single storage slot (O(1) instead of O(n))
/// - Uses binary search for finding observations (O(log n))
/// - Stores metadata separately for quick bounds checking
pub fn add_observation(env: &Env, token: &Address, price: i128) -> Result<(), OracleError> {
    let current_time = env.ledger().timestamp();

    // Get the last observation to calculate cumulative price
    let cumulative_price = if let Some(meta) = DataKey::get_buffer_meta(env, token) {
        if meta.count > 0 {
            // Find the most recent observation
            let last_index = if meta.write_index == 0 {
                meta.count - 1
            } else {
                meta.write_index - 1
            };

            if let Some(last_obs) = DataKey::get_observation_at(env, token, last_index) {
                let time_elapsed = current_time.saturating_sub(last_obs.timestamp);

                // Prevent overflow: cumulative_price + (price * time_elapsed)
                last_obs
                    .cumulative_price
                    .checked_add(
                        price
                            .checked_mul(i128::from(time_elapsed))
                            .ok_or(OracleError::Overflow)?,
                    )
                    .ok_or(OracleError::Overflow)?
            } else {
                price
            }
        } else {
            price
        }
    } else {
        price
    };

    let new_observation = Observation {
        timestamp: current_time,
        cumulative_price,
        price,
    };

    // Use efficient circular buffer (O(1) single storage write)
    DataKey::add_observation_efficient(env, token, &new_observation)?;

    Ok(())
}

/// Calculate Time-Weighted Average Price (TWAP) for a given window
///
/// Uses efficient binary search O(log n) instead of linear scan O(n)
pub fn calculate_twap(env: &Env, token: &Address, window: u64) -> Result<i128, OracleError> {
    // Validate window
    if window < MIN_TWAP_WINDOW {
        return Err(OracleError::InvalidWindow);
    }
    if window > MAX_TWAP_WINDOW {
        return Err(OracleError::WindowTooLarge);
    }

    let current_time = env.ledger().timestamp();
    let window_start = current_time.saturating_sub(window);

    // Use efficient binary search to find bracketing observations
    let (start_obs, end_obs) = find_bracketing_observations_efficient(env, token, window_start)?;

    // Calculate TWAP: (cumulative_price_end - cumulative_price_start) / time_elapsed
    let cumulative_diff = end_obs
        .cumulative_price
        .checked_sub(start_obs.cumulative_price)
        .ok_or(OracleError::Overflow)?;

    let time_elapsed = end_obs.timestamp.saturating_sub(start_obs.timestamp);

    if time_elapsed == 0 {
        return Err(OracleError::DivisionByZero);
    }

    let twap = cumulative_diff
        .checked_div(i128::from(time_elapsed))
        .ok_or(OracleError::DivisionByZero)?;

    Ok(twap)
}

/// Find bracketing observations using efficient binary search
///
/// Returns (start_obs, end_obs) where:
/// - start_obs is at or before window_start
/// - end_obs is the most recent observation
fn find_bracketing_observations_efficient(
    env: &Env,
    token: &Address,
    window_start: u64,
) -> Result<(Observation, Observation), OracleError> {
    // Get buffer metadata for quick validation
    let meta = DataKey::get_buffer_meta(env, token)
        .ok_or(OracleError::InsufficientObservations)?;

    if meta.count < 2 {
        return Err(OracleError::InsufficientObservations);
    }

    // Check if oldest observation is recent enough
    if meta.oldest_timestamp > window_start {
        return Err(OracleError::ObservationTooOld);
    }

    // Get the most recent observation (end_obs)
    let newest_index = if meta.write_index == 0 {
        meta.count - 1
    } else {
        meta.write_index - 1
    };

    let end_obs = DataKey::get_observation_at(env, token, newest_index)
        .ok_or(OracleError::InvalidObservationIndex)?;

    // Binary search for observation at or before window_start
    let (_, start_obs) = DataKey::find_observation_at_or_before(env, token, window_start)
        .ok_or(OracleError::InsufficientObservations)?;

    Ok((start_obs, end_obs))
}

/// Get the latest price observation using efficient circular buffer
#[allow(dead_code)]
pub fn get_latest_observation(env: &Env, token: &Address) -> Result<Observation, OracleError> {
    let meta = DataKey::get_buffer_meta(env, token)
        .ok_or(OracleError::InsufficientObservations)?;

    if meta.count == 0 {
        return Err(OracleError::InsufficientObservations);
    }

    // Get the most recent observation
    let newest_index = if meta.write_index == 0 {
        meta.count - 1
    } else {
        meta.write_index - 1
    };

    DataKey::get_observation_at(env, token, newest_index)
        .ok_or(OracleError::InvalidObservationIndex)
}

// TWAP tests are covered through contract integration tests
// Direct module tests would require contract context
