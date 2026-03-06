use crate::error::OracleError;
use soroban_sdk::{contracttype, Address, Env, String};

/// Storage keys for the Oracle contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Contract initialization flag
    Initialized,
    /// Admin address
    Admin,
    /// Staleness threshold in seconds (e.g., 3600 for 1 hour)
    StalenessThreshold,
    /// Price data for a token
    PriceData(Address),
    /// Feed ID mapping for a token (for DIA integration)
    FeedId(Address),
    /// TWAP observations for a token (legacy - being phased out)
    Observations(Address),
    /// Last observation index for a token
    LastObservationIndex(Address),
    /// Individual observation at index (efficient circular buffer)
    /// Key: (token, index) -> Observation
    ObservationAt(Address, u32),
    /// Circular buffer metadata for a token
    CircularBufferMeta(Address),
}

/// Price data structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceData {
    /// Price value (scaled by decimals)
    pub price: i128,
    /// Timestamp when price was last updated
    pub timestamp: u64,
    /// Number of decimals for the price (e.g., 8 for USD prices)
    pub decimals: u32,
    /// Price source/feed identifier
    pub source: String,
}

/// TWAP observation structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Observation {
    /// Timestamp of the observation
    pub timestamp: u64,
    /// Cumulative price at this timestamp (for TWAP calculation)
    pub cumulative_price: i128,
    /// Actual price at this observation
    pub price: i128,
}

/// Maximum number of observations to store per token
pub const MAX_OBSERVATIONS: u32 = 100;

/// Circular buffer metadata for efficient TWAP calculation
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CircularBufferMeta {
    /// Current write index (next position to write to)
    pub write_index: u32,
    /// Number of observations stored (0 to MAX_OBSERVATIONS)
    pub count: u32,
    /// Oldest timestamp in buffer (for quick range checks)
    pub oldest_timestamp: u64,
    /// Newest timestamp in buffer
    pub newest_timestamp: u64,
}

/// Default staleness threshold (1 hour)
pub const DEFAULT_STALENESS_THRESHOLD: u64 = 3600;

/// Maximum staleness threshold (24 hours)
pub const MAX_STALENESS_THRESHOLD: u64 = 86400;

/// Storage helper functions
impl DataKey {
    /// Check if contract is initialized
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Initialized)
    }

    /// Set initialized flag
    pub fn set_initialized(env: &Env) {
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
    }

    /// Get admin address
    pub fn get_admin(env: &Env) -> Result<Address, OracleError> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(OracleError::NotInitialized)
    }

    /// Set admin address
    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage()
            .instance()
            .set(&DataKey::Admin, admin);
    }

    /// Get staleness threshold
    pub fn get_staleness_threshold(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::StalenessThreshold)
            .unwrap_or(DEFAULT_STALENESS_THRESHOLD)
    }

    /// Set staleness threshold
    pub fn set_staleness_threshold(env: &Env, threshold: u64) {
        env.storage()
            .instance()
            .set(&DataKey::StalenessThreshold, &threshold);
    }

    /// Get price data for a token
    pub fn get_price_data(env: &Env, token: &Address) -> Option<PriceData> {
        env.storage()
            .persistent()
            .get(&DataKey::PriceData(token.clone()))
    }

    /// Set price data for a token
    pub fn set_price_data(env: &Env, token: &Address, data: &PriceData) {
        env.storage()
            .persistent()
            .set(&DataKey::PriceData(token.clone()), data);
    }

    /// Get feed ID for a token
    pub fn get_feed_id(env: &Env, token: &Address) -> Option<String> {
        env.storage()
            .persistent()
            .get(&DataKey::FeedId(token.clone()))
    }

    /// Set feed ID for a token
    pub fn set_feed_id(env: &Env, token: &Address, feed_id: &String) {
        env.storage()
            .persistent()
            .set(&DataKey::FeedId(token.clone()), feed_id);
    }

    // ==================== Efficient Circular Buffer Functions ====================

    /// Get circular buffer metadata for a token
    pub fn get_buffer_meta(env: &Env, token: &Address) -> Option<CircularBufferMeta> {
        env.storage()
            .persistent()
            .get(&DataKey::CircularBufferMeta(token.clone()))
    }

    /// Set circular buffer metadata for a token
    pub fn set_buffer_meta(env: &Env, token: &Address, meta: &CircularBufferMeta) {
        env.storage()
            .persistent()
            .set(&DataKey::CircularBufferMeta(token.clone()), meta);
    }

    /// Get observation at specific index (efficient - single storage read)
    pub fn get_observation_at(env: &Env, token: &Address, index: u32) -> Option<Observation> {
        env.storage()
            .persistent()
            .get(&DataKey::ObservationAt(token.clone(), index))
    }

    /// Set observation at specific index (efficient - single storage write)
    pub fn set_observation_at(env: &Env, token: &Address, index: u32, obs: &Observation) {
        env.storage()
            .persistent()
            .set(&DataKey::ObservationAt(token.clone(), index), obs);
    }

    /// Add observation to circular buffer (efficient version)
    ///
    /// This is O(1) instead of O(n) because we only write to a single index
    pub fn add_observation_efficient(
        env: &Env,
        token: &Address,
        obs: &Observation,
    ) -> Result<(), OracleError> {
        let mut meta = Self::get_buffer_meta(env, token).unwrap_or(CircularBufferMeta {
            write_index: 0,
            count: 0,
            oldest_timestamp: obs.timestamp,
            newest_timestamp: obs.timestamp,
        });

        // Write observation at current index
        Self::set_observation_at(env, token, meta.write_index, obs);

        // Update metadata
        if meta.count < MAX_OBSERVATIONS {
            meta.count += 1;
        } else {
            // Buffer is full - we're overwriting the oldest
            // Find the new oldest timestamp
            let oldest_index = (meta.write_index + 1) % MAX_OBSERVATIONS;
            if let Some(oldest_obs) = Self::get_observation_at(env, token, oldest_index) {
                meta.oldest_timestamp = oldest_obs.timestamp;
            }
        }

        meta.newest_timestamp = obs.timestamp;
        meta.write_index = (meta.write_index + 1) % MAX_OBSERVATIONS;

        Self::set_buffer_meta(env, token, &meta);

        Ok(())
    }

    /// Binary search for observation at or before timestamp
    ///
    /// Returns the index of the observation at or just before the given timestamp.
    /// Uses binary search for O(log n) performance instead of O(n) linear scan.
    pub fn find_observation_at_or_before(
        env: &Env,
        token: &Address,
        target_timestamp: u64,
    ) -> Option<(u32, Observation)> {
        let meta = Self::get_buffer_meta(env, token)?;

        if meta.count == 0 {
            return None;
        }

        // Quick bounds check
        if target_timestamp < meta.oldest_timestamp {
            return None;
        }

        if target_timestamp >= meta.newest_timestamp {
            // Return the newest observation
            let newest_index = if meta.write_index == 0 {
                meta.count - 1
            } else {
                meta.write_index - 1
            };
            let obs = Self::get_observation_at(env, token, newest_index)?;
            return Some((newest_index, obs));
        }

        // Binary search within the circular buffer
        let start_index = if meta.count < MAX_OBSERVATIONS {
            0
        } else {
            meta.write_index
        };

        let mut left = 0u32;
        let mut right = meta.count;
        let mut result: Option<(u32, Observation)> = None;

        while left < right {
            let mid = left + (right - left) / 2;
            let actual_index = (start_index + mid) % MAX_OBSERVATIONS;

            if let Some(obs) = Self::get_observation_at(env, token, actual_index) {
                if obs.timestamp <= target_timestamp {
                    result = Some((actual_index, obs.clone()));
                    left = mid + 1;
                } else {
                    right = mid;
                }
            } else {
                break;
            }
        }

        result
    }

    /// Find observation at or after timestamp
    pub fn find_observation_at_or_after(
        env: &Env,
        token: &Address,
        target_timestamp: u64,
    ) -> Option<(u32, Observation)> {
        let meta = Self::get_buffer_meta(env, token)?;

        if meta.count == 0 {
            return None;
        }

        // Quick bounds check
        if target_timestamp > meta.newest_timestamp {
            return None;
        }

        if target_timestamp <= meta.oldest_timestamp {
            // Return the oldest observation
            let oldest_index = if meta.count < MAX_OBSERVATIONS {
                0
            } else {
                meta.write_index
            };
            let obs = Self::get_observation_at(env, token, oldest_index)?;
            return Some((oldest_index, obs));
        }

        // Binary search
        let start_index = if meta.count < MAX_OBSERVATIONS {
            0
        } else {
            meta.write_index
        };

        let mut left = 0u32;
        let mut right = meta.count;
        let mut result: Option<(u32, Observation)> = None;

        while left < right {
            let mid = left + (right - left) / 2;
            let actual_index = (start_index + mid) % MAX_OBSERVATIONS;

            if let Some(obs) = Self::get_observation_at(env, token, actual_index) {
                if obs.timestamp >= target_timestamp {
                    result = Some((actual_index, obs.clone()));
                    right = mid;
                } else {
                    left = mid + 1;
                }
            } else {
                break;
            }
        }

        result
    }
}
