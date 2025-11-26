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
    /// TWAP observations for a token
    Observations(Address),
    /// Last observation index for a token
    LastObservationIndex(Address),
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
    pub fn get_admin(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap()
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
}
