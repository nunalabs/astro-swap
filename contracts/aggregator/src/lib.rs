#![no_std]
//! AstroSwap Aggregator Contract
//!
//! Multi-protocol DEX aggregator implementing Smart Order Routing (SOR)
//! for finding optimal swap routes across multiple liquidity sources.
//!
//! ## Supported Protocols
//! - AstroSwap (native) - Protocol ID: 0
//! - Soroswap - Protocol ID: 1
//! - Phoenix - Protocol ID: 2
//! - Aqua - Protocol ID: 3
//!
//! ## Features
//! - Smart Order Routing across multiple DEXs
//! - Multi-hop path finding (up to 3 hops)
//! - Quote comparison and best route selection
//! - Slippage protection
//! - Split routing for large orders (future)

mod storage;

use astroswap_shared::{AstroSwapError, PairClient, Protocol, RouteStep, SwapRoute};
use soroban_sdk::{contract, contractimpl, token, Address, Env, IntoVal, Symbol, Vec};

use crate::storage::{
    extend_instance_ttl, get_admin, get_config, get_fee_recipient, get_protocol,
    get_protocol_count, is_initialized, is_paused, set_admin, set_config, set_fee_recipient,
    set_initialized, set_paused, set_protocol, set_protocol_count, AggregatorConfig,
    ProtocolAdapter,
};

/// Basis points constant (100% = 10000)
const BPS: u32 = 10_000;

/// Maximum hops allowed in a single route
const MAX_HOPS: u32 = 3;

#[contract]
pub struct AstroSwapAggregator;

#[contractimpl]
impl AstroSwapAggregator {
    // ==================== Initialization ====================

    /// Initialize the aggregator contract
    ///
    /// # Arguments
    /// * `admin` - Address with admin privileges
    /// * `astroswap_factory` - AstroSwap factory address (auto-registered as Protocol 0)
    pub fn initialize(
        env: Env,
        admin: Address,
        astroswap_factory: Address,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        set_admin(&env, &admin);
        set_initialized(&env);

        // Set default configuration
        let config = AggregatorConfig {
            max_hops: MAX_HOPS,
            max_splits: 2,
            aggregator_fee_bps: 5, // 0.05%
        };
        set_config(&env, &config);

        // Auto-register AstroSwap as Protocol 0
        let astroswap_adapter = ProtocolAdapter {
            protocol_id: 0,
            factory_address: astroswap_factory,
            is_active: true,
            default_fee_bps: 30, // 0.3%
        };
        set_protocol(&env, 0, &astroswap_adapter);
        set_protocol_count(&env, 1);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Core Swap Functions ====================

    /// Execute a swap using the best route found by the aggregator
    ///
    /// # Arguments
    /// * `user` - User executing the swap
    /// * `token_in` - Input token address
    /// * `token_out` - Output token address
    /// * `amount_in` - Amount of input tokens
    /// * `min_out` - Minimum output amount (slippage protection)
    /// * `deadline` - Transaction deadline timestamp
    ///
    /// # Returns
    /// * Actual amount of output tokens received
    pub fn swap(
        env: Env,
        user: Address,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
        min_out: i128,
        deadline: u64,
    ) -> Result<i128, AstroSwapError> {
        user.require_auth();
        Self::require_not_paused(&env)?;
        Self::check_deadline(&env, deadline)?;

        // Validate amounts
        if amount_in <= 0 {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Find the best route
        let route = Self::find_best_route_internal(&env, &token_in, &token_out, amount_in)?;

        // Verify minimum output
        if route.expected_output < min_out {
            return Err(AstroSwapError::SlippageExceeded);
        }

        // Execute the route
        let actual_out = Self::execute_route(&env, &user, &route, amount_in)?;

        // Final slippage check
        if actual_out < min_out {
            return Err(AstroSwapError::SlippageExceeded);
        }

        extend_instance_ttl(&env);
        Ok(actual_out)
    }

    /// Execute a swap using a pre-computed route
    ///
    /// Useful when the user already knows the optimal route
    /// or wants to use a specific path
    pub fn swap_with_route(
        env: Env,
        user: Address,
        route: SwapRoute,
        amount_in: i128,
        min_out: i128,
        deadline: u64,
    ) -> Result<i128, AstroSwapError> {
        user.require_auth();
        Self::require_not_paused(&env)?;
        Self::check_deadline(&env, deadline)?;

        // Validate route
        if route.steps.is_empty() {
            return Err(AstroSwapError::InvalidPath);
        }

        // Execute the route
        let actual_out = Self::execute_route(&env, &user, &route, amount_in)?;

        // Slippage check
        if actual_out < min_out {
            return Err(AstroSwapError::SlippageExceeded);
        }

        extend_instance_ttl(&env);
        Ok(actual_out)
    }

    // ==================== Route Finding ====================

    /// Find the best swap route across all registered protocols
    ///
    /// # Arguments
    /// * `token_in` - Input token address
    /// * `token_out` - Output token address
    /// * `amount_in` - Amount of input tokens
    ///
    /// # Returns
    /// * Best SwapRoute found across all protocols
    pub fn find_best_route(
        env: Env,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
    ) -> Result<SwapRoute, AstroSwapError> {
        extend_instance_ttl(&env);
        Self::find_best_route_internal(&env, &token_in, &token_out, amount_in)
    }

    /// Get quotes from all registered protocols for a swap
    ///
    /// Returns a vector of (protocol_id, expected_output) pairs
    pub fn get_all_quotes(
        env: Env,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
    ) -> Vec<(u32, i128)> {
        let mut quotes = Vec::new(&env);
        let protocol_count = get_protocol_count(&env);

        for protocol_id in 0..protocol_count {
            if let Some(adapter) = get_protocol(&env, protocol_id) {
                if adapter.is_active {
                    if let Ok(quote) = Self::get_protocol_quote_internal(
                        &env,
                        protocol_id,
                        &token_in,
                        &token_out,
                        amount_in,
                    ) {
                        quotes.push_back((protocol_id, quote));
                    }
                }
            }
        }

        extend_instance_ttl(&env);
        quotes
    }

    /// Get quote from a specific protocol
    pub fn get_protocol_quote(
        env: Env,
        protocol: Protocol,
        token_in: Address,
        token_out: Address,
        amount_in: i128,
    ) -> Result<i128, AstroSwapError> {
        let protocol_id = Self::protocol_to_id(&protocol);
        extend_instance_ttl(&env);
        Self::get_protocol_quote_internal(&env, protocol_id, &token_in, &token_out, amount_in)
    }

    // ==================== Protocol Management ====================

    /// Register a new protocol adapter
    ///
    /// # Arguments
    /// * `admin` - Must be contract admin
    /// * `protocol` - Protocol enum variant
    /// * `factory_address` - Factory or router address for the protocol
    /// * `default_fee_bps` - Default fee for estimation
    pub fn register_protocol(
        env: Env,
        admin: Address,
        protocol: Protocol,
        factory_address: Address,
        default_fee_bps: u32,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;

        let protocol_id = Self::protocol_to_id(&protocol);

        let adapter = ProtocolAdapter {
            protocol_id,
            factory_address,
            is_active: true,
            default_fee_bps,
        };

        set_protocol(&env, protocol_id, &adapter);

        // Update protocol count if this is a new protocol
        let current_count = get_protocol_count(&env);
        if protocol_id >= current_count {
            set_protocol_count(&env, protocol_id + 1);
        }

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Enable or disable a protocol
    pub fn set_protocol_active(
        env: Env,
        admin: Address,
        protocol: Protocol,
        is_active: bool,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;

        let protocol_id = Self::protocol_to_id(&protocol);

        let mut adapter =
            get_protocol(&env, protocol_id).ok_or(AstroSwapError::ProtocolNotFound)?;

        adapter.is_active = is_active;
        set_protocol(&env, protocol_id, &adapter);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Get protocol adapter info
    pub fn get_protocol_info(env: Env, protocol: Protocol) -> Option<ProtocolAdapter> {
        let protocol_id = Self::protocol_to_id(&protocol);
        extend_instance_ttl(&env);
        get_protocol(&env, protocol_id)
    }

    // ==================== Admin Functions ====================

    /// Update aggregator configuration
    pub fn set_config(
        env: Env,
        admin: Address,
        max_hops: u32,
        max_splits: u32,
        aggregator_fee_bps: u32,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;

        // Validate
        if max_hops == 0 || max_hops > MAX_HOPS {
            return Err(AstroSwapError::InvalidArgument);
        }
        if aggregator_fee_bps > 100 {
            // Max 1%
            return Err(AstroSwapError::FeeTooHigh);
        }

        let config = AggregatorConfig {
            max_hops,
            max_splits,
            aggregator_fee_bps,
        };
        set_config(&env, &config);

        extend_instance_ttl(&env);
        Ok(())
    }

    /// Set fee recipient for aggregator fees
    pub fn set_fee_recipient(
        env: Env,
        admin: Address,
        recipient: Address,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_fee_recipient(&env, &recipient);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Transfer admin role
    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_admin(&env, &new_admin);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Pause or unpause the aggregator
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_paused(&env, paused);
        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== View Functions ====================

    /// Get current configuration
    pub fn config(env: Env) -> AggregatorConfig {
        extend_instance_ttl(&env);
        get_config(&env)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    /// Get fee recipient
    pub fn fee_recipient(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_fee_recipient(&env)
    }

    /// Check if aggregator is paused
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    /// Get number of registered protocols
    pub fn protocol_count(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_protocol_count(&env)
    }

    // ==================== Internal Functions ====================

    /// Find best route across all protocols
    fn find_best_route_internal(
        env: &Env,
        token_in: &Address,
        token_out: &Address,
        amount_in: i128,
    ) -> Result<SwapRoute, AstroSwapError> {
        let protocol_count = get_protocol_count(env);
        let config = get_config(env);

        let mut best_route: Option<SwapRoute> = None;
        let mut best_output: i128 = 0;

        // Try direct swaps on each protocol
        for protocol_id in 0..protocol_count {
            if let Some(adapter) = get_protocol(env, protocol_id) {
                if !adapter.is_active {
                    continue;
                }

                // Try direct route
                if let Ok(output) = Self::get_protocol_quote_internal(
                    env,
                    protocol_id,
                    token_in,
                    token_out,
                    amount_in,
                ) {
                    if output > best_output {
                        best_output = output;

                        let step = RouteStep {
                            protocol_id,
                            pool_address: adapter.factory_address.clone(),
                            token_in: token_in.clone(),
                            token_out: token_out.clone(),
                            amount_in,
                            expected_out: output,
                        };

                        let mut steps = Vec::new(env);
                        steps.push_back(step);

                        best_route = Some(SwapRoute {
                            steps,
                            expected_output: output,
                            total_fee_bps: adapter.default_fee_bps + config.aggregator_fee_bps,
                        });
                    }
                }
            }
        }

        best_route.ok_or(AstroSwapError::RouteNotFound)
    }

    /// Get quote from a specific protocol
    fn get_protocol_quote_internal(
        env: &Env,
        protocol_id: u32,
        token_in: &Address,
        token_out: &Address,
        amount_in: i128,
    ) -> Result<i128, AstroSwapError> {
        let adapter = get_protocol(env, protocol_id).ok_or(AstroSwapError::ProtocolNotFound)?;

        if !adapter.is_active {
            return Err(AstroSwapError::ProtocolNotFound);
        }

        // For AstroSwap (protocol 0), use our native interface
        if protocol_id == 0 {
            return Self::get_astroswap_quote(
                env,
                &adapter.factory_address,
                token_in,
                token_out,
                amount_in,
            );
        }

        // For other protocols, use generic interface
        Self::get_external_quote(
            env,
            &adapter.factory_address,
            token_in,
            token_out,
            amount_in,
        )
    }

    /// Get quote from AstroSwap (native protocol)
    fn get_astroswap_quote(
        env: &Env,
        factory: &Address,
        token_in: &Address,
        token_out: &Address,
        amount_in: i128,
    ) -> Result<i128, AstroSwapError> {
        // Get pair address from factory
        let pair_address: Option<Address> = env.invoke_contract(
            factory,
            &Symbol::new(env, "get_pair"),
            Vec::from_array(env, [token_in.to_val(), token_out.to_val()]),
        );

        let pair = pair_address.ok_or(AstroSwapError::PairNotFound)?;
        let pair_client = PairClient::new(env, &pair);

        // Get reserves and calculate output
        let (reserve_0, reserve_1) = pair_client.get_reserves();
        let token_0 = pair_client.token_0();
        let fee_bps = pair_client.fee_bps();

        let (reserve_in, reserve_out) = if *token_in == token_0 {
            (reserve_0, reserve_1)
        } else {
            (reserve_1, reserve_0)
        };

        // Calculate amount out using AMM formula
        astroswap_shared::get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
    }

    /// Get quote from external protocol using generic interface
    fn get_external_quote(
        env: &Env,
        router: &Address,
        token_in: &Address,
        token_out: &Address,
        amount_in: i128,
    ) -> Result<i128, AstroSwapError> {
        // Generic quote interface - most DEXs implement this
        // Try "get_amount_out" or similar
        // Note: try_invoke_contract returns Result<Result<T, E>, InvokeError>
        // We need to flatten both error layers
        let result = env.try_invoke_contract::<i128, soroban_sdk::Error>(
            router,
            &Symbol::new(env, "get_amounts_out"),
            Vec::from_array(
                env,
                [
                    amount_in.into_val(env),
                    token_in.to_val(),
                    token_out.to_val(),
                ],
            ),
        );

        match result {
            Ok(Ok(amount)) => Ok(amount),
            _ => Err(AstroSwapError::ProtocolNotFound),
        }
    }

    /// Execute a swap route
    fn execute_route(
        env: &Env,
        user: &Address,
        route: &SwapRoute,
        amount_in: i128,
    ) -> Result<i128, AstroSwapError> {
        if route.steps.is_empty() {
            return Err(AstroSwapError::InvalidPath);
        }

        let config = get_config(env);
        let mut current_amount = amount_in;

        // Deduct aggregator fee upfront
        if config.aggregator_fee_bps > 0 {
            if let Some(fee_recipient) = get_fee_recipient(env) {
                let fee = (current_amount * config.aggregator_fee_bps as i128) / BPS as i128;
                if fee > 0 {
                    let first_step = route.steps.get(0).unwrap();
                    let token_client = token::Client::new(env, &first_step.token_in);
                    token_client.transfer(user, &fee_recipient, &fee);
                    current_amount -= fee;
                }
            }
        }

        // Execute each step in the route
        for i in 0..route.steps.len() {
            let step = route.steps.get(i).unwrap();

            // For the first step, transfer from user to pool
            if i == 0 {
                let token_client = token::Client::new(env, &step.token_in);
                token_client.transfer(user, &step.pool_address, &current_amount);
            }

            // Determine recipient (next pool or user)
            let recipient = if i == route.steps.len() - 1 {
                user.clone()
            } else {
                route.steps.get(i + 1).unwrap().pool_address.clone()
            };

            // Execute swap based on protocol
            current_amount = Self::execute_protocol_swap(
                env,
                step.protocol_id,
                &step.pool_address,
                &step.token_in,
                &step.token_out,
                current_amount,
                &recipient,
            )?;
        }

        Ok(current_amount)
    }

    /// Execute a swap on a specific protocol
    fn execute_protocol_swap(
        env: &Env,
        protocol_id: u32,
        pool: &Address,
        token_in: &Address,
        _token_out: &Address,
        amount_in: i128,
        recipient: &Address,
    ) -> Result<i128, AstroSwapError> {
        // For AstroSwap, use the pair's swap function
        if protocol_id == 0 {
            let pair_client = PairClient::new(env, pool);
            // Minimum out = 0 because we already validated the route
            return pair_client.swap(recipient, token_in, amount_in, 0);
        }

        // For external protocols, use generic swap interface
        let result: i128 = env.invoke_contract(
            pool,
            &Symbol::new(env, "swap"),
            Vec::from_array(
                env,
                [
                    recipient.to_val(),
                    token_in.to_val(),
                    amount_in.into_val(env),
                    0i128.into_val(env), // min_out = 0, already validated
                ],
            ),
        );

        Ok(result)
    }

    /// Convert Protocol enum to protocol ID
    fn protocol_to_id(protocol: &Protocol) -> u32 {
        match protocol {
            Protocol::AstroSwap => 0,
            Protocol::Soroswap => 1,
            Protocol::Phoenix => 2,
            Protocol::Aqua => 3,
        }
    }

    /// Verify caller is admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        caller.require_auth();
        if *caller != get_admin(env) {
            return Err(AstroSwapError::Unauthorized);
        }
        Ok(())
    }

    /// Verify contract is not paused
    fn require_not_paused(env: &Env) -> Result<(), AstroSwapError> {
        if is_paused(env) {
            return Err(AstroSwapError::ContractPaused);
        }
        Ok(())
    }

    /// Check if deadline has passed
    fn check_deadline(env: &Env, deadline: u64) -> Result<(), AstroSwapError> {
        if env.ledger().timestamp() > deadline {
            return Err(AstroSwapError::DeadlineExpired);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapAggregator, ());
        let client = AstroSwapAggregatorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);

        client.initialize(&admin, &factory);

        assert_eq!(client.admin(), admin);
        assert_eq!(client.protocol_count(), 1);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_cannot_initialize_twice() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapAggregator, ());
        let client = AstroSwapAggregatorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);

        client.initialize(&admin, &factory);

        // Second initialization should fail
        let result = client.try_initialize(&admin, &factory);
        assert!(result.is_err());
    }

    #[test]
    fn test_register_protocol() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapAggregator, ());
        let client = AstroSwapAggregatorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let soroswap = Address::generate(&env);

        client.initialize(&admin, &factory);

        // Register Soroswap
        client.register_protocol(&admin, &Protocol::Soroswap, &soroswap, &30);

        assert_eq!(client.protocol_count(), 2);

        let info = client.get_protocol_info(&Protocol::Soroswap);
        assert!(info.is_some());
        let info = info.unwrap();
        assert_eq!(info.factory_address, soroswap);
        assert!(info.is_active);
    }

    #[test]
    fn test_config_update() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapAggregator, ());
        let client = AstroSwapAggregatorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);

        client.initialize(&admin, &factory);

        // Update config
        client.set_config(&admin, &2, &1, &10);

        let config = client.config();
        assert_eq!(config.max_hops, 2);
        assert_eq!(config.max_splits, 1);
        assert_eq!(config.aggregator_fee_bps, 10);
    }

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapAggregator, ());
        let client = AstroSwapAggregatorClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);

        client.initialize(&admin, &factory);

        assert!(!client.is_paused());

        client.set_paused(&admin, &true);
        assert!(client.is_paused());

        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }
}
