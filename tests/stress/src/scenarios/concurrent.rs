//! Concurrent Operations Testing Scenario
//!
//! Tests mixed concurrent operations for race conditions and conflicts.

use super::StressScenario;
use crate::config::StressConfig;
use crate::metrics::{MetricsCollector, OperationType};
use crate::utils::{AccountPool, TokenManager};
use astroswap_factory::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_pair::AstroSwapPair;
use astroswap_router::{AstroSwapRouter, AstroSwapRouterClient};
use astroswap_shared::interfaces::PairClient;
use rand::Rng;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};
use std::collections::HashMap;
use std::time::Instant;

#[derive(Debug, Clone, Copy)]
enum Operation {
    Swap,
    AddLiquidity,
    RemoveLiquidity,
}

pub struct ConcurrentScenario;

impl ConcurrentScenario {
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
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // Create tokens
        let mut token_manager = TokenManager::new();
        token_manager.create_tokens(&env, &admin, config.num_pairs * 2, 100_000_000_0000000);

        // Create account pool
        let account_pool = AccountPool::new(&env, config.num_accounts);
        token_manager.distribute(&admin, account_pool.all(), 10_000_000_0000000);

        // Deploy contracts
        let pair_wasm = env.deployer().upload_contract_wasm(AstroSwapPair);
        let pair_wasm_hash = BytesN::from_array(&env, &pair_wasm.into());

        let factory_address = env.register(AstroSwapFactory, ());
        let factory = AstroSwapFactoryClient::new(&env, &factory_address);
        factory.initialize(&admin, &pair_wasm_hash, &30);

        let router_address = env.register(AstroSwapRouter, ());
        let router = AstroSwapRouterClient::new(&env, &router_address);
        router.initialize(&factory_address, &admin);

        // Create pairs with initial liquidity
        let mut pair_addresses = Vec::new();
        let pairs = token_manager.all_pairs();

        for i in 0..config.num_pairs.min(pairs.len() as u32) {
            let (token_a_idx, token_b_idx) = pairs[i as usize];
            let (token_a_addr, token_b_addr) = token_manager
                .get_pair_addresses(token_a_idx, token_b_idx)
                .unwrap();

            let pair_addr = factory.create_pair(&token_a_addr, &token_b_addr).unwrap();
            pair_addresses.push(pair_addr.clone());

            // Add substantial initial liquidity
            let _ = router.add_liquidity(
                &admin,
                &token_a_addr,
                &token_b_addr,
                10_000_000_0000000,
                10_000_000_0000000,
                0,
                0,
                &(env.ledger().timestamp() + 3600),
            );
        }

        (env, admin, token_manager, account_pool, factory, router, pair_addresses)
    }

    /// Select operation type based on weights
    fn select_operation(&self, config: &crate::config::ConcurrentConfig) -> Operation {
        let mut rng = rand::thread_rng();
        let total_weight = config.swap_weight + config.add_liquidity_weight + config.remove_liquidity_weight;
        let roll = rng.gen_range(0..total_weight);

        if roll < config.swap_weight {
            Operation::Swap
        } else if roll < config.swap_weight + config.add_liquidity_weight {
            Operation::AddLiquidity
        } else {
            Operation::RemoveLiquidity
        }
    }

    /// Execute swap operation
    fn execute_swap(
        &self,
        env: &Env,
        pair_address: &Address,
        user: &Address,
        token_in: &Address,
        amount_in: i128,
        collector: &MetricsCollector,
    ) {
        let timer = collector.start_operation();
        let pair_client = PairClient::new(env, pair_address);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pair_client.swap(user, token_in, amount_in, 1)
        }));

        match result {
            Ok(Ok(amount_out)) => {
                let mut metadata = HashMap::new();
                metadata.insert("amount_in".to_string(), amount_in.to_string());
                metadata.insert("amount_out".to_string(), amount_out.to_string());
                timer.success(OperationType::Swap, metadata);
            }
            _ => {
                timer.error(OperationType::Swap, "Swap failed".to_string(), HashMap::new());
            }
        }
    }

    /// Execute add liquidity operation
    fn execute_add_liquidity(
        &self,
        env: &Env,
        pair_address: &Address,
        user: &Address,
        amount_0: i128,
        amount_1: i128,
        collector: &MetricsCollector,
    ) {
        let timer = collector.start_operation();
        let pair_client = PairClient::new(env, pair_address);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pair_client.deposit(user, amount_0, amount_1, 0, 0)
        }));

        match result {
            Ok((_, _, shares)) => {
                let mut metadata = HashMap::new();
                metadata.insert("shares".to_string(), shares.to_string());
                timer.success(OperationType::AddLiquidity, metadata);
            }
            _ => {
                timer.error(
                    OperationType::AddLiquidity,
                    "Add liquidity failed".to_string(),
                    HashMap::new(),
                );
            }
        }
    }

    /// Execute remove liquidity operation
    fn execute_remove_liquidity(
        &self,
        env: &Env,
        pair_address: &Address,
        user: &Address,
        shares: i128,
        collector: &MetricsCollector,
    ) {
        let timer = collector.start_operation();
        let pair_client = PairClient::new(env, pair_address);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            pair_client.withdraw(user, shares, 0, 0)
        }));

        match result {
            Ok((amount_0, amount_1)) => {
                let mut metadata = HashMap::new();
                metadata.insert("amount_0".to_string(), amount_0.to_string());
                metadata.insert("amount_1".to_string(), amount_1.to_string());
                timer.success(OperationType::RemoveLiquidity, metadata);
            }
            _ => {
                timer.error(
                    OperationType::RemoveLiquidity,
                    "Remove liquidity failed".to_string(),
                    HashMap::new(),
                );
            }
        }
    }
}

impl Default for ConcurrentScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl StressScenario for ConcurrentScenario {
    fn run(&self, config: &StressConfig, collector: &MetricsCollector) {
        let (env, _admin, _token_manager, mut account_pool, _factory, _router, pair_addresses) =
            self.setup_environment(config);

        let test_start = Instant::now();
        let target_duration = std::time::Duration::from_secs(config.duration_seconds);
        let concurrent_config = &config.concurrent;

        let mut rng = rand::thread_rng();
        let mut operation_count = 0u64;

        // Track LP positions for remove operations
        let mut lp_positions: HashMap<(Address, Address), i128> = HashMap::new();

        println!(
            "Starting concurrent operations test: {} workers for {} seconds",
            concurrent_config.num_workers, config.duration_seconds
        );

        while test_start.elapsed() < target_duration {
            let iteration_start = Instant::now();

            // Simulate concurrent workers
            for _ in 0..concurrent_config.num_workers {
                let operation = self.select_operation(concurrent_config);
                let pair_idx = rng.gen_range(0..pair_addresses.len());
                let pair_address = &pair_addresses[pair_idx];
                let user = account_pool.random().clone();

                match operation {
                    Operation::Swap => {
                        let pair_client = PairClient::new(&env, pair_address);
                        let token_0 = pair_client.token_0();
                        let token_1 = pair_client.token_1();
                        let token_in = if rng.gen_bool(0.5) { &token_0 } else { &token_1 };
                        let amount_in = rng.gen_range(100_0000000..=1_000_0000000);

                        self.execute_swap(&env, pair_address, &user, token_in, amount_in, collector);
                    }
                    Operation::AddLiquidity => {
                        let amount_0 = rng.gen_range(10_000_0000000..=100_000_0000000);
                        let amount_1 = rng.gen_range(10_000_0000000..=100_000_0000000);

                        self.execute_add_liquidity(
                            &env,
                            pair_address,
                            &user,
                            amount_0,
                            amount_1,
                            collector,
                        );

                        // Update position tracking
                        let pair_client = PairClient::new(&env, pair_address);
                        let balance = pair_client.balance(&user);
                        if balance > 0 {
                            lp_positions.insert((user.clone(), pair_address.clone()), balance);
                        }
                    }
                    Operation::RemoveLiquidity => {
                        // Only remove if user has a position
                        if let Some(&shares) = lp_positions.get(&(user.clone(), pair_address.clone())) {
                            if shares > 0 {
                                let remove_shares = rng.gen_range(1..=shares);
                                self.execute_remove_liquidity(
                                    &env,
                                    pair_address,
                                    &user,
                                    remove_shares,
                                    collector,
                                );

                                // Update position
                                let pair_client = PairClient::new(&env, pair_address);
                                let new_balance = pair_client.balance(&user);
                                if new_balance > 0 {
                                    lp_positions.insert((user.clone(), pair_address.clone()), new_balance);
                                } else {
                                    lp_positions.remove(&(user.clone(), pair_address.clone()));
                                }
                            }
                        }
                    }
                }

                operation_count += 1;

                if test_start.elapsed() >= target_duration {
                    break;
                }
            }

            // Rate limiting
            let iteration_duration = iteration_start.elapsed();
            let target_iteration_duration = std::time::Duration::from_secs(1);
            if iteration_duration < target_iteration_duration {
                std::thread::sleep(target_iteration_duration - iteration_duration);
            }

            // Progress reporting
            if operation_count % 500 == 0 {
                println!(
                    "Progress: {} operations, {:.2} ops/s, {:.2}% success",
                    operation_count,
                    collector.operations_per_second(),
                    collector.success_rate() * 100.0
                );
            }
        }

        println!(
            "Concurrent operations test completed: {} operations in {:.2}s",
            collector.total_operations(),
            test_start.elapsed().as_secs_f64()
        );
    }

    fn name(&self) -> &str {
        "Concurrent Operations Test"
    }

    fn description(&self) -> &str {
        "Mixed concurrent operations for race conditions and conflicts"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_concurrent_scenario() {
        let scenario = ConcurrentScenario::new();
        let mut config = StressConfig::default();
        config.duration_seconds = 5;
        config.concurrent.num_workers = 10;
        config.num_pairs = 2;
        config.num_accounts = 5;

        let collector = MetricsCollector::new();
        scenario.run(&config, &collector);

        assert!(collector.total_operations() > 0);
        println!(
            "Executed {} concurrent operations with {:.2}% success rate",
            collector.total_operations(),
            collector.success_rate() * 100.0
        );
    }
}
