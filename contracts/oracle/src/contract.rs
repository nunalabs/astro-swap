use soroban_sdk::{contract, contractimpl, Address, Env, String};

use crate::error::OracleError;
use crate::storage::{DataKey, PriceData, MAX_STALENESS_THRESHOLD};
use crate::twap;

/// AstroSwap Oracle Contract
///
/// Provides price feeds for tokens with TWAP support
/// Integrates with DIA oracle for external price data
#[contract]
pub struct AstroSwapOracle;

#[contractimpl]
impl AstroSwapOracle {
    /// Initialize the oracle contract
    ///
    /// # Arguments
    /// * `admin` - Admin address that can update prices and settings
    /// * `staleness_threshold` - Time in seconds after which a price is considered stale
    pub fn initialize(
        env: Env,
        admin: Address,
        staleness_threshold: u64,
    ) -> Result<(), OracleError> {
        // Check if already initialized
        if DataKey::is_initialized(&env) {
            return Err(OracleError::AlreadyInitialized);
        }

        // Validate staleness threshold
        if staleness_threshold == 0 || staleness_threshold > MAX_STALENESS_THRESHOLD {
            return Err(OracleError::InvalidStalenessThreshold);
        }

        // Store admin
        admin.require_auth();
        DataKey::set_admin(&env, &admin);

        // Store staleness threshold
        DataKey::set_staleness_threshold(&env, staleness_threshold);

        // Mark as initialized
        DataKey::set_initialized(&env);

        Ok(())
    }

    /// Update price for a token
    ///
    /// # Arguments
    /// * `token` - Token address
    /// * `price` - Price value (scaled by decimals)
    /// * `decimals` - Number of decimals for the price
    /// * `source` - Price source identifier (e.g., "DIA", "Manual")
    pub fn update_price(
        env: Env,
        token: Address,
        price: i128,
        decimals: u32,
        source: String,
    ) -> Result<(), OracleError> {
        // Only admin can update prices
        let admin = DataKey::get_admin(&env);
        admin.require_auth();

        // Validate price
        if price <= 0 {
            return Err(OracleError::InvalidPrice);
        }

        // Validate decimals (typically 8 for USD prices)
        if decimals > 18 {
            return Err(OracleError::InvalidDecimals);
        }

        let timestamp = env.ledger().timestamp();

        // Create price data
        let price_data = PriceData {
            price,
            timestamp,
            decimals,
            source,
        };

        // Store price data
        DataKey::set_price_data(&env, &token, &price_data);

        // Add observation for TWAP
        twap::add_observation(&env, &token, price)?;

        Ok(())
    }

    /// Get current price for a token
    ///
    /// # Arguments
    /// * `token` - Token address
    ///
    /// # Returns
    /// Price data if available and fresh
    pub fn get_price(env: Env, token: Address) -> Result<PriceData, OracleError> {
        let price_data = DataKey::get_price_data(&env, &token)
            .ok_or(OracleError::PriceFeedNotFound)?;

        // Check if price is fresh
        let current_time = env.ledger().timestamp();
        let staleness_threshold = DataKey::get_staleness_threshold(&env);

        if current_time.saturating_sub(price_data.timestamp) > staleness_threshold {
            return Err(OracleError::StalePrice);
        }

        Ok(price_data)
    }

    /// Get Time-Weighted Average Price (TWAP) for a token
    ///
    /// # Arguments
    /// * `token` - Token address
    /// * `window` - Time window in seconds (e.g., 3600 for 1 hour)
    ///
    /// # Returns
    /// TWAP price value
    pub fn get_twap(env: Env, token: Address, window: u64) -> Result<i128, OracleError> {
        twap::calculate_twap(&env, &token, window)
    }

    /// Check if price is fresh (not stale)
    ///
    /// # Arguments
    /// * `token` - Token address
    ///
    /// # Returns
    /// true if price is fresh, false otherwise
    pub fn is_price_fresh(env: Env, token: Address) -> bool {
        let price_data = match DataKey::get_price_data(&env, &token) {
            Some(data) => data,
            None => return false,
        };

        let current_time = env.ledger().timestamp();
        let staleness_threshold = DataKey::get_staleness_threshold(&env);

        current_time.saturating_sub(price_data.timestamp) <= staleness_threshold
    }

    /// Set staleness threshold
    ///
    /// # Arguments
    /// * `threshold` - New staleness threshold in seconds
    pub fn set_staleness_threshold(env: Env, threshold: u64) -> Result<(), OracleError> {
        // Only admin can update settings
        let admin = DataKey::get_admin(&env);
        admin.require_auth();

        // Validate threshold
        if threshold == 0 || threshold > MAX_STALENESS_THRESHOLD {
            return Err(OracleError::InvalidStalenessThreshold);
        }

        DataKey::set_staleness_threshold(&env, threshold);

        Ok(())
    }

    /// Add or update price feed mapping for a token
    ///
    /// # Arguments
    /// * `token` - Token address
    /// * `feed_id` - DIA feed identifier (e.g., "BTC/USD")
    pub fn add_price_feed(env: Env, token: Address, feed_id: String) -> Result<(), OracleError> {
        // Only admin can add price feeds
        let admin = DataKey::get_admin(&env);
        admin.require_auth();

        // Validate feed ID
        if feed_id.is_empty() {
            return Err(OracleError::InvalidFeedId);
        }

        DataKey::set_feed_id(&env, &token, &feed_id);

        Ok(())
    }

    /// Get feed ID for a token
    ///
    /// # Arguments
    /// * `token` - Token address
    ///
    /// # Returns
    /// Feed ID if configured
    pub fn get_feed_id(env: Env, token: Address) -> Result<String, OracleError> {
        DataKey::get_feed_id(&env, &token).ok_or(OracleError::PriceFeedNotFound)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Address {
        DataKey::get_admin(&env)
    }

    /// Get staleness threshold
    pub fn get_staleness_threshold(env: Env) -> u64 {
        DataKey::get_staleness_threshold(&env)
    }

    /// Update admin address
    ///
    /// # Arguments
    /// * `new_admin` - New admin address
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), OracleError> {
        // Only current admin can change admin
        let admin = DataKey::get_admin(&env);
        admin.require_auth();

        new_admin.require_auth();
        DataKey::set_admin(&env, &new_admin);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        let result = client.try_initialize(&admin, &3600);
        assert!(result.is_ok());

        // Should not be able to initialize twice
        let result = client.try_initialize(&admin, &3600);
        assert_eq!(result, Err(Ok(OracleError::AlreadyInitialized)));
    }

    #[test]
    fn test_update_and_get_price() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Update price
        client.update_price(
            &token,
            &100_000_000, // $100 with 6 decimals
            &6,
            &String::from_str(&env, "DIA"),
        );

        // Get price
        let price_data = client.get_price(&token);
        assert_eq!(price_data.price, 100_000_000);
        assert_eq!(price_data.decimals, 6);
    }

    #[test]
    fn test_stale_price() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Update price
        client.update_price(&token, &100_000_000, &6, &String::from_str(&env, "DIA"));

        // Advance time beyond staleness threshold
        env.ledger().set_timestamp(7200); // 2 hours

        // Should return stale price error
        let result = client.try_get_price(&token);
        assert_eq!(result, Err(Ok(OracleError::StalePrice)));

        // is_price_fresh should return false
        assert!(!client.is_price_fresh(&token));
    }

    #[test]
    fn test_price_feed_mapping() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Add price feed
        client.add_price_feed(&token, &String::from_str(&env, "BTC/USD"));

        // Get feed ID
        let feed_id = client.get_feed_id(&token);
        assert_eq!(feed_id, String::from_str(&env, "BTC/USD"));
    }

    #[test]
    fn test_invalid_price() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Try to update with zero price
        let result = client.try_update_price(&token, &0, &6, &String::from_str(&env, "DIA"));
        assert_eq!(result, Err(Ok(OracleError::InvalidPrice)));
    }

    #[test]
    fn test_invalid_staleness_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        // Zero threshold should fail
        let result = client.try_initialize(&admin, &0);
        assert_eq!(result, Err(Ok(OracleError::InvalidStalenessThreshold)));

        // Too large threshold should fail (create new contract)
        let contract_id2 = env.register(AstroSwapOracle, ());
        let client2 = AstroSwapOracleClient::new(&env, &contract_id2);
        let result = client2.try_initialize(&admin, &100000);
        assert_eq!(result, Err(Ok(OracleError::InvalidStalenessThreshold)));
    }

    #[test]
    fn test_update_staleness_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Update threshold
        client.set_staleness_threshold(&7200);

        let threshold = client.get_staleness_threshold();
        assert_eq!(threshold, 7200);
    }

    #[test]
    fn test_twap() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Add multiple price updates
        client.update_price(&token, &100_000_000, &6, &String::from_str(&env, "DIA"));

        env.ledger().set_timestamp(600);
        client.update_price(&token, &110_000_000, &6, &String::from_str(&env, "DIA"));

        env.ledger().set_timestamp(1200);
        client.update_price(&token, &105_000_000, &6, &String::from_str(&env, "DIA"));

        // Calculate TWAP
        let twap = client.get_twap(&token, &1200);

        // TWAP should be within the price range
        assert!((100_000_000..=110_000_000).contains(&twap));
    }

    #[test]
    fn test_admin_change() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapOracle, ());
        let client = AstroSwapOracleClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let new_admin = Address::generate(&env);

        client.initialize(&admin, &3600);

        // Change admin
        client.set_admin(&new_admin);

        let current_admin = client.get_admin();
        assert_eq!(current_admin, new_admin);
    }
}
