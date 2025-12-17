//! Swap Load Testing Scenario
//!
//! Tests high-frequency swap operations across multiple token pairs.

use super::StressScenario;
use crate::config::StressConfig;
use crate::metrics::{MetricsCollector, OperationType};
use crate::utils::{AccountPool, TokenManager};
use crate::pair_wasm;
use astroswap_factory::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_router::{AstroSwapRouter, AstroSwapRouterClient};
use astroswap_shared::interfaces::PairClient;
use rand::Rng;
use soroban_sdk::{testutils::Address as _, Address, Env};
use std::collections::HashMap;
use std::time::Instant;

pub struct SwapLoadScenario;

impl SwapLoadScenario {
    pub fn new() -> Self {
        Self
    }

    /// Setup test environment
    fn setup_environment(
        &self,
        config: &StressConfig,
    ) -> (
        Env,
        Address,
        TokenManager,
        AccountPool,
        AstroSwapFactoryClient<'static>,
        AstroSwapRouterClient<'static>,
        Vec<Address>,
    ) {
        let env = Env::default();
        // Use mock_all_auths_allowing_non_root_auth for contract-to-contract calls (SDK 23)
        env.mock_all_auths_allowing_non_root_auth();

        let admin = Address::generate(&env);

        // Create tokens
        let mut token_manager = TokenManager::new();
        token_manager.create_tokens(&env, &admin, config.num_pairs * 2, 10_000_000_0000000);

        // Create account pool
        let account_pool = AccountPool::new(&env, config.num_accounts);

        // Distribute tokens to all accounts
        token_manager.distribute(&admin, account_pool.all(), 100_000_0000000);

        // Deploy pair WASM (SDK 23: use WASM bytes directly)
        let pair_wasm_hash = env.deployer().upload_contract_wasm(pair_wasm::WASM);

        // Deploy factory
        let factory_address = env.register(AstroSwapFactory, ());
        let factory = AstroSwapFactoryClient::new(&env, &factory_address);
        factory.initialize(&admin, &pair_wasm_hash, &30); // 0.3% fee

        // Deploy router
        let router_address = env.register(AstroSwapRouter, ());
        let router = AstroSwapRouterClient::new(&env, &router_address);
        router.initialize(&factory_address, &admin);

        // Create pairs and add liquidity
        let mut pair_addresses = Vec::new();
        let pairs = token_manager.all_pairs();

        for i in 0..config.num_pairs.min(pairs.len() as u32) {
            let (token_a_idx, token_b_idx) = pairs[i as usize];
            let (token_a_addr, token_b_addr) = token_manager
                .get_pair_addresses(token_a_idx, token_b_idx)
                .unwrap();

            // Create pair (SDK 23: client method returns Address directly, use try_create_pair for Result)
            let pair_addr = factory.create_pair(&token_a_addr, &token_b_addr);
            pair_addresses.push(pair_addr.clone());

            // Add initial liquidity (SDK 23: i128 params need references)
            let _ = router.add_liquidity(
                &admin,
                &token_a_addr,
                &token_b_addr,
                &1_000_000_0000000,
                &1_000_000_0000000,
                &0,
                &0,
                &(env.ledger().timestamp() + 3600),
            );
        }

        (
            env,
            admin,
            token_manager,
            account_pool,
            factory,
            router,
            pair_addresses,
        )
    }

    /// Execute a single swap operation
    fn execute_swap(
        &self,
        env: &Env,
        pair_address: &Address,
        user: &Address,
        token_in: &Address,
        amount_in: i128,
        min_out: i128,
        collector: &MetricsCollector,
    ) {
        let timer = collector.start_operation();
        let pair_client = PairClient::new(env, pair_address);

        match pair_client.swap(user, token_in, amount_in, min_out) {
            Ok(amount_out) => {
                let mut metadata = HashMap::new();
                metadata.insert("amount_in".to_string(), amount_in.to_string());
                metadata.insert("amount_out".to_string(), amount_out.to_string());
                metadata.insert(
                    "slippage_bps".to_string(),
                    (((amount_in - amount_out) * 10000) / amount_in).to_string(),
                );
                timer.success(OperationType::Swap, metadata);
            }
            Err(e) => {
                timer.error(
                    OperationType::Swap,
                    format!("Swap failed: {:?}", e),
                    HashMap::new(),
                );
            }
        }
    }
}

impl Default for SwapLoadScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl StressScenario for SwapLoadScenario {
    fn run(&self, config: &StressConfig, collector: &MetricsCollector) {
        let (env, _admin, _token_manager, account_pool, _factory, _router, pair_addresses) =
            self.setup_environment(config);

        let test_start = Instant::now();
        let target_duration = std::time::Duration::from_secs(config.duration_seconds);
        let swap_config = &config.swap_load;

        let mut rng = rand::thread_rng();
        let mut operation_count = 0u64;

        println!(
            "Starting swap load test: target {} TPS for {} seconds",
            config.target_tps, config.duration_seconds
        );

        while test_start.elapsed() < target_duration {
            let iteration_start = Instant::now();

            // Calculate how many swaps to do in this iteration
            let swaps_per_iteration = config.target_tps as usize;

            for _ in 0..swaps_per_iteration {
                // Select random pair
                let pair_idx = rng.gen_range(0..pair_addresses.len());
                let pair_address = &pair_addresses[pair_idx];

                // Get pair tokens
                let pair_client = PairClient::new(&env, pair_address);
                let token_0 = pair_client.token_0();
                let token_1 = pair_client.token_1();

                // Select random direction
                let token_in = if swap_config.bidirectional && rng.gen_bool(0.5) {
                    &token_1
                } else {
                    &token_0
                };

                // Generate random amount
                let amount_in = rng.gen_range(
                    swap_config.min_swap_amount..=swap_config.max_swap_amount,
                );

                // Calculate minimum output with slippage
                let slippage_bps = rng.gen_range(
                    swap_config.min_slippage_bps..=swap_config.max_slippage_bps,
                );

                // Estimate output (simplified)
                let (reserve_in, reserve_out) = pair_client.get_reserves();
                let expected_out = if token_in == &token_0 {
                    (amount_in * 9970 * reserve_out) / (reserve_in * 10000 + amount_in * 9970)
                } else {
                    (amount_in * 9970 * reserve_in) / (reserve_out * 10000 + amount_in * 9970)
                };

                let min_out = (expected_out * (10000 - slippage_bps as i128)) / 10000;

                // Select random user
                let user = account_pool.random();

                // Execute swap
                self.execute_swap(
                    &env,
                    pair_address,
                    user,
                    token_in,
                    amount_in,
                    min_out,
                    collector,
                );

                operation_count += 1;

                // Check if we should stop
                if test_start.elapsed() >= target_duration {
                    break;
                }
            }

            // Rate limiting: wait to achieve target TPS
            let iteration_duration = iteration_start.elapsed();
            let target_iteration_duration = std::time::Duration::from_secs(1);
            if iteration_duration < target_iteration_duration {
                std::thread::sleep(target_iteration_duration - iteration_duration);
            }

            // Progress reporting
            if operation_count % 1000 == 0 {
                println!(
                    "Progress: {} swaps, {:.2} TPS, {:.2}% success",
                    operation_count,
                    collector.operations_per_second(),
                    collector.success_rate() * 100.0
                );
            }
        }

        println!(
            "Swap load test completed: {} operations in {:.2}s",
            collector.total_operations(),
            test_start.elapsed().as_secs_f64()
        );
    }

    fn name(&self) -> &str {
        "Swap Load Test"
    }

    fn description(&self) -> &str {
        "High-frequency swap operations across multiple token pairs"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_swap_load_scenario() {
        let scenario = SwapLoadScenario::new();
        let mut config = StressConfig::default();
        config.duration_seconds = 5; // Short test
        config.target_tps = 10;
        config.num_pairs = 2;
        config.num_accounts = 5;

        let collector = MetricsCollector::new();
        scenario.run(&config, &collector);

        // Verify some swaps were executed
        assert!(collector.total_operations() > 0);
        println!(
            "Executed {} swaps with {:.2}% success rate",
            collector.total_operations(),
            collector.success_rate() * 100.0
        );
    }
}
