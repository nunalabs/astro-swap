use soroban_sdk::{Address, Env, Vec};

use crate::error::OracleError;
use crate::storage::{DataKey, Observation, MAX_OBSERVATIONS};

/// Maximum TWAP window in seconds (24 hours)
pub const MAX_TWAP_WINDOW: u64 = 86400;

/// Minimum TWAP window in seconds (5 minutes)
pub const MIN_TWAP_WINDOW: u64 = 300;

/// Add a new price observation for TWAP calculation
pub fn add_observation(env: &Env, token: &Address, price: i128) -> Result<(), OracleError> {
    let current_time = env.ledger().timestamp();

    // Get existing observations or create new vector
    let mut observations: Vec<Observation> = env
        .storage()
        .persistent()
        .get(&DataKey::Observations(token.clone()))
        .unwrap_or(Vec::new(env));

    // Get last observation index
    let last_index: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::LastObservationIndex(token.clone()))
        .unwrap_or(0);

    // Calculate cumulative price
    let cumulative_price = if observations.is_empty() {
        price
    } else {
        let last_obs = observations.get(last_index).unwrap();
        let time_elapsed = current_time.saturating_sub(last_obs.timestamp);

        // Prevent overflow: cumulative_price + (price * time_elapsed)
        last_obs
            .cumulative_price
            .checked_add(
                price
                    .checked_mul(time_elapsed as i128)
                    .ok_or(OracleError::Overflow)?
            )
            .ok_or(OracleError::Overflow)?
    };

    let new_observation = Observation {
        timestamp: current_time,
        cumulative_price,
        price,
    };

    // Add observation (circular buffer)
    if observations.len() < MAX_OBSERVATIONS {
        observations.push_back(new_observation);
        let new_index = observations.len() - 1;
        env.storage()
            .persistent()
            .set(&DataKey::LastObservationIndex(token.clone()), &new_index);
    } else {
        // Overwrite oldest observation
        let next_index = (last_index + 1) % MAX_OBSERVATIONS;
        observations.set(next_index, new_observation);
        env.storage()
            .persistent()
            .set(&DataKey::LastObservationIndex(token.clone()), &next_index);
    }

    // Save observations
    env.storage()
        .persistent()
        .set(&DataKey::Observations(token.clone()), &observations);

    Ok(())
}

/// Calculate Time-Weighted Average Price (TWAP) for a given window
pub fn calculate_twap(env: &Env, token: &Address, window: u64) -> Result<i128, OracleError> {
    // Validate window
    if window < MIN_TWAP_WINDOW {
        return Err(OracleError::InvalidWindow);
    }
    if window > MAX_TWAP_WINDOW {
        return Err(OracleError::WindowTooLarge);
    }

    let observations: Vec<Observation> = env
        .storage()
        .persistent()
        .get(&DataKey::Observations(token.clone()))
        .ok_or(OracleError::InsufficientObservations)?;

    if observations.is_empty() {
        return Err(OracleError::InsufficientObservations);
    }

    let current_time = env.ledger().timestamp();
    let window_start = current_time.saturating_sub(window);

    // Find the two observations that bracket the window
    let (start_obs, end_obs) = find_bracketing_observations(&observations, window_start, current_time)?;

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
        .checked_div(time_elapsed as i128)
        .ok_or(OracleError::DivisionByZero)?;

    Ok(twap)
}

/// Find observations that bracket the given time window
fn find_bracketing_observations(
    observations: &Vec<Observation>,
    window_start: u64,
    window_end: u64,
) -> Result<(Observation, Observation), OracleError> {
    let len = observations.len();

    if len < 2 {
        return Err(OracleError::InsufficientObservations);
    }

    // Get the most recent observation
    let mut end_obs = observations.get(len - 1).unwrap();

    // If the most recent observation is before window_end, use it
    if end_obs.timestamp < window_end {
        // Find the observation closest to window_start
        let mut start_obs = observations.get(0).unwrap();

        for i in 0..len {
            let obs = observations.get(i).unwrap();
            if obs.timestamp >= window_start {
                if i > 0 {
                    start_obs = observations.get(i - 1).unwrap();
                } else {
                    start_obs = obs;
                }
                break;
            }
            start_obs = obs;
        }

        // Check if start observation is too old
        if start_obs.timestamp < window_start.saturating_sub(MAX_TWAP_WINDOW) {
            return Err(OracleError::ObservationTooOld);
        }

        return Ok((start_obs, end_obs));
    }

    // If we need to find an observation at window_end
    let mut found_end = false;
    for i in (0..len).rev() {
        let obs = observations.get(i).unwrap();
        if obs.timestamp <= window_end {
            end_obs = obs;
            found_end = true;
            break;
        }
    }

    if !found_end {
        return Err(OracleError::InsufficientObservations);
    }

    // Find start observation
    let mut start_obs = observations.get(0).unwrap();
    for i in 0..len {
        let obs = observations.get(i).unwrap();
        if obs.timestamp >= window_start {
            if i > 0 {
                start_obs = observations.get(i - 1).unwrap();
            } else {
                start_obs = obs;
            }
            break;
        }
        start_obs = obs;
    }

    Ok((start_obs, end_obs))
}

/// Get the latest price observation
#[allow(dead_code)]
pub fn get_latest_observation(env: &Env, token: &Address) -> Result<Observation, OracleError> {
    let observations: Vec<Observation> = env
        .storage()
        .persistent()
        .get(&DataKey::Observations(token.clone()))
        .ok_or(OracleError::InsufficientObservations)?;

    if observations.is_empty() {
        return Err(OracleError::InsufficientObservations);
    }

    let last_index: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::LastObservationIndex(token.clone()))
        .unwrap_or(observations.len() - 1);

    observations
        .get(last_index)
        .ok_or(OracleError::InsufficientObservations)
}

// TWAP tests are covered through contract integration tests
// Direct module tests would require contract context
