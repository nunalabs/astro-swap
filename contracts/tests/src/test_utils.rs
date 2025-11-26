//! Test Utility Functions
//!
//! Common setup and helper functions for integration tests.

use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env
};

/// Test context containing all deployed contracts
pub struct TestContext {
    pub env: Env,
    pub admin: Address,
    pub user1: Address,
    pub user2: Address,
    pub factory: astroswap_factory::AstroSwapFactoryClient<'static>,
    pub factory_address: Address,
    pub router: astroswap_router::AstroSwapRouterClient<'static>,
    pub router_address: Address,
    pub staking: astroswap_staking::AstroSwapStakingClient<'static>,
    pub staking_address: Address,
    pub aggregator: astroswap_aggregator::AstroSwapAggregatorClient<'static>,
    pub aggregator_address: Address,
    pub bridge: astroswap_bridge::AstroSwapBridgeClient<'static>,
    pub bridge_address: Address,
    pub token_a: TokenClient<'static>,
    pub token_a_address: Address,
    pub token_b: TokenClient<'static>,
    pub token_b_address: Address,
    pub token_c: TokenClient<'static>,
    pub token_c_address: Address,
    pub xlm: TokenClient<'static>,
    pub xlm_address: Address,
}

impl TestContext {
    /// Create a new test context with all contracts deployed
    pub fn new() -> Self {
        let env = Env::default();
        // Use mock_all_auths_allowing_non_root_auth for cross-contract calls
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        // Deploy mock tokens using the token SDK
        let token_a_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_a_stellar = StellarAssetClient::new(&env, &token_a_address);
        token_a_stellar.mint(&admin, &1_000_000_0000000);
        let token_a = TokenClient::new(&env, &token_a_address);

        let token_b_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_b_stellar = StellarAssetClient::new(&env, &token_b_address);
        token_b_stellar.mint(&admin, &1_000_000_0000000);
        let token_b = TokenClient::new(&env, &token_b_address);

        let token_c_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let token_c_stellar = StellarAssetClient::new(&env, &token_c_address);
        token_c_stellar.mint(&admin, &1_000_000_0000000);
        let token_c = TokenClient::new(&env, &token_c_address);

        let xlm_address = env.register_stellar_asset_contract_v2(admin.clone()).address();
        let xlm_stellar = StellarAssetClient::new(&env, &xlm_address);
        xlm_stellar.mint(&admin, &10_000_000_0000000);
        let xlm = TokenClient::new(&env, &xlm_address);

        // Distribute tokens to users
        token_a.transfer(&admin, &user1, &100_000_0000000);
        token_a.transfer(&admin, &user2, &100_000_0000000);
        token_b.transfer(&admin, &user1, &100_000_0000000);
        token_b.transfer(&admin, &user2, &100_000_0000000);
        token_c.transfer(&admin, &user1, &100_000_0000000);
        token_c.transfer(&admin, &user2, &100_000_0000000);
        xlm.transfer(&admin, &user1, &1_000_000_0000000);
        xlm.transfer(&admin, &user2, &1_000_000_0000000);

        // Deploy pair WASM and get hash
        let pair_wasm_hash = env.deployer().upload_contract_wasm(crate::pair_wasm::WASM);

        // Deploy factory
        let factory_address = env.register(astroswap_factory::AstroSwapFactory, ());
        let factory = astroswap_factory::AstroSwapFactoryClient::new(&env, &factory_address);
        factory.initialize(&admin, &pair_wasm_hash, &30); // 0.3% fee

        // Deploy router
        let router_address = env.register(astroswap_router::AstroSwapRouter, ());
        let router = astroswap_router::AstroSwapRouterClient::new(&env, &router_address);
        router.initialize(&factory_address, &admin);

        // Deploy staking
        let staking_address = env.register(astroswap_staking::AstroSwapStaking, ());
        let staking = astroswap_staking::AstroSwapStakingClient::new(&env, &staking_address);
        staking.initialize(&admin, &xlm_address); // Using XLM as reward token

        // Deploy aggregator
        let aggregator_address = env.register(astroswap_aggregator::AstroSwapAggregator, ());
        let aggregator = astroswap_aggregator::AstroSwapAggregatorClient::new(&env, &aggregator_address);
        aggregator.initialize(&admin, &factory_address);

        // Deploy bridge
        let bridge_address = env.register(astroswap_bridge::AstroSwapBridge, ());
        let bridge = astroswap_bridge::AstroSwapBridgeClient::new(&env, &bridge_address);
        let launchpad = Address::generate(&env); // Mock launchpad address
        bridge.initialize(
            &admin,
            &factory_address,
            &staking_address,
            &launchpad,
            &xlm_address,
        );

        Self {
            env,
            admin,
            user1,
            user2,
            factory,
            factory_address,
            router,
            router_address,
            staking,
            staking_address,
            aggregator,
            aggregator_address,
            bridge,
            bridge_address,
            token_a,
            token_a_address,
            token_b,
            token_b_address,
            token_c,
            token_c_address,
            xlm,
            xlm_address,
        }
    }

    /// Get current timestamp
    pub fn timestamp(&self) -> u64 {
        self.env.ledger().timestamp()
    }

    /// Advance time by seconds
    pub fn advance_time(&self, seconds: u64) {
        self.env.ledger().with_mut(|li| {
            li.timestamp += seconds;
        });
    }

    /// Get deadline (current time + 1 hour)
    pub fn deadline(&self) -> u64 {
        self.timestamp() + 3600
    }

    /// Create a pair and add initial liquidity
    pub fn setup_pair(
        &self,
        token_a: &Address,
        token_b: &Address,
        amount_a: i128,
        amount_b: i128,
    ) -> Address {
        // Create pair (returns Address directly)
        let pair_address = self
            .factory
            .create_pair(token_a, token_b);

        // Add liquidity via router (returns tuple directly)
        let (_amount_a, _amount_b, _liquidity) = self
            .router
            .add_liquidity(
                &self.admin,
                token_a,
                token_b,
                &amount_a,
                &amount_b,
                &0,
                &0,
                &self.deadline(),
            );

        pair_address
    }

    /// Print balances for debugging
    #[allow(dead_code)]
    pub fn print_balances(&self, address: &Address, label: &str) {
        println!(
            "{} - Token A: {}, Token B: {}, Token C: {}, XLM: {}",
            label,
            self.token_a.balance(address),
            self.token_b.balance(address),
            self.token_c.balance(address),
            self.xlm.balance(address)
        );
    }
}

/// Assert that a value is within a tolerance range
#[allow(dead_code)]
pub fn assert_approx_eq(actual: i128, expected: i128, tolerance_bps: i128) {
    let diff = if actual > expected {
        actual - expected
    } else {
        expected - actual
    };
    let max_diff = (expected * tolerance_bps) / 10_000;
    assert!(
        diff <= max_diff,
        "Value {} not within {}% of {}, diff: {}",
        actual,
        tolerance_bps as f64 / 100.0,
        expected,
        diff
    );
}

/// Calculate expected output using constant product formula
/// output = (input * 9970 * reserve_out) / (reserve_in * 10000 + input * 9970)
/// Fee is 0.3% (30 bps), so we multiply by 9970/10000
#[allow(dead_code)]
pub fn calculate_output_amount(amount_in: i128, reserve_in: i128, reserve_out: i128) -> i128 {
    let amount_in_with_fee = amount_in * 9970;
    let numerator = amount_in_with_fee * reserve_out;
    let denominator = (reserve_in * 10000) + amount_in_with_fee;
    numerator / denominator
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let ctx = TestContext::new();

        // Verify admin has remaining tokens
        assert!(ctx.token_a.balance(&ctx.admin) > 0);
        assert!(ctx.token_b.balance(&ctx.admin) > 0);

        // Verify users received tokens
        assert_eq!(ctx.token_a.balance(&ctx.user1), 100_000_0000000);
        assert_eq!(ctx.token_b.balance(&ctx.user1), 100_000_0000000);

        // Verify contracts are initialized
        assert_eq!(ctx.factory.admin(), ctx.admin);
        assert_eq!(ctx.router.admin(), ctx.admin);
        assert_eq!(ctx.staking.admin(), ctx.admin);
    }

    #[test]
    fn test_calculate_output_amount() {
        // Example: swap 1000 tokens in pool with 10000/20000 reserves
        let output = calculate_output_amount(1000_0000000, 10000_0000000, 20000_0000000);

        // Expected: (1000 * 0.997 * 20000) / (10000 + 1000 * 0.997)
        // = (997 * 20000) / (10000 + 997)
        // = 19940000 / 10997 = 1813.5...
        // With 7 decimals: 1813.5 tokens = 18135000000 stroops
        assert!(output > 1810_0000000 && output < 1815_0000000);
    }
}
