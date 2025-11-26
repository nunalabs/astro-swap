//! Pool Stress Testing Scenario
//!
//! Tests rapid add/remove liquidity operations on multiple pools.

use super::StressScenario;
use crate::config::StressConfig;
use crate::metrics::{MetricsCollector, OperationType};
use crate::utils::{AccountPool, TokenManager};
use astroswap_factory::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_pair::AstroSwapPair;
use astroswap_shared::interfaces::PairClient;
use rand::Rng;
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};
use std::collections::HashMap;
use std::time::Instant;

pub struct PoolStressScenario;

impl PoolStressScenario {
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
        Vec<Address>,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // Create tokens (need more for multiple pools)
        let mut token_manager = TokenManager::new();
        let num_tokens = (config.pool_stress.num_pools * 2).max(10);
        token_manager.create_tokens(&env, &admin, num_tokens, 100_000_000_0000000);

        // Create account pool
        let account_pool = AccountPool::new(&env, config.num_accounts);

        // Distribute tokens to all accounts
        token_manager.distribute(&admin, account_pool.all(), 10_000_000_0000000);

        // Deploy pair WASM
        let pair_wasm = env.deployer().upload_contract_wasm(AstroSwapPair);
        let pair_wasm_hash = BytesN::from_array(&env, &pair_wasm.into());

        // Deploy factory
        let factory_address = env.register(AstroSwapFactory, ());
        let factory = AstroSwapFactoryClient::new(&env, &factory_address);
        factory.initialize(&admin, &pair_wasm_hash, &30);

        // Create pools
        let mut pair_addresses = Vec::new();
        let all_pairs = token_manager.all_pairs();

        for i in 0..config.pool_stress.num_pools.min(all_pairs.len() as u32) {
            let (token_a_idx, token_b_idx) = all_pairs[i as usize];
            let (token_a_addr, token_b_addr) = token_manager
                .get_pair_addresses(token_a_idx, token_b_idx)
                .unwrap();

            let pair_addr = factory.create_pair(&token_a_addr, &token_b_addr).unwrap();
            pair_addresses.push(pair_addr);
        }

        (env, admin, token_manager, account_pool, factory, pair_addresses)
    }

    /// Execute add liquidity operation
    fn add_liquidity(
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
            Ok((actual_0, actual_1, shares)) => {
                let mut metadata = HashMap::new();
                metadata.insert("amount_0".to_string(), actual_0.to_string());
                metadata.insert("amount_1".to_string(), actual_1.to_string());
                metadata.insert("shares".to_string(), shares.to_string());
                timer.success(OperationType::AddLiquidity, metadata);
            }
            Err(_) => {
                timer.error(
                    OperationType::AddLiquidity,
                    "Add liquidity failed".to_string(),
                    HashMap::new(),
                );
            }
        }
    }

    /// Execute remove liquidity operation
    fn remove_liquidity(
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
                metadata.insert("shares".to_string(), shares.to_string());
                timer.success(OperationType::RemoveLiquidity, metadata);
            }
            Err(_) => {
                timer.error(
                    OperationType::RemoveLiquidity,
                    "Remove liquidity failed".to_string(),
                    HashMap::new(),
                );
            }
        }
    }
}

impl Default for PoolStressScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl StressScenario for PoolStressScenario {
    fn run(&self, config: &StressConfig, collector: &MetricsCollector) {
        let (env, _admin, _token_manager, mut account_pool, _factory, pair_addresses) =
            self.setup_environment(config);

        let test_start = Instant::now();
        let target_duration = std::time::Duration::from_secs(config.duration_seconds);
        let pool_config = &config.pool_stress;

        let mut rng = rand::thread_rng();
        let mut operation_count = 0u64;

        // Track LP positions per user per pool
        let mut lp_positions: HashMap<(Address, Address), i128> = HashMap::new();

        println!(
            "Starting pool stress test: {} pools for {} seconds",
            pair_addresses.len(),
            config.duration_seconds
        );

        while test_start.elapsed() < target_duration {
            let iteration_start = Instant::now();

            // Execute multiple operations per iteration
            let ops_per_iteration = config.target_tps as usize;

            for _ in 0..ops_per_iteration {
                // Select random pool
                let pool_idx = rng.gen_range(0..pair_addresses.len());
                let pair_address = &pair_addresses[pool_idx];

                // Select random user
                let user = account_pool.random().clone();

                // Decide: add or remove liquidity
                let should_add = rng.gen_bool(pool_config.add_ratio);

                if should_add || !lp_positions.contains_key(&(user.clone(), pair_address.clone())) {
                    // Add liquidity
                    let amount_0 = if pool_config.test_edge_cases && rng.gen_bool(0.1) {
                        // Test edge cases 10% of the time
                        if rng.gen_bool(0.5) {
                            pool_config.min_liquidity
                        } else {
                            pool_config.max_liquidity
                        }
                    } else {
                        rng.gen_range(pool_config.min_liquidity..=pool_config.max_liquidity)
                    };

                    let amount_1 = if pool_config.test_edge_cases && rng.gen_bool(0.1) {
                        if rng.gen_bool(0.5) {
                            pool_config.min_liquidity
                        } else {
                            pool_config.max_liquidity
                        }
                    } else {
                        rng.gen_range(pool_config.min_liquidity..=pool_config.max_liquidity)
                    };

                    self.add_liquidity(&env, pair_address, &user, amount_0, amount_1, collector);

                    // Track position (simplified - just track that they have shares)
                    let pair_client = PairClient::new(&env, pair_address);
                    let balance = pair_client.balance(&user);
                    if balance > 0 {
                        lp_positions.insert((user.clone(), pair_address.clone()), balance);
                    }
                } else {
                    // Remove liquidity
                    if let Some(&shares) = lp_positions.get(&(user.clone(), pair_address.clone())) {
                        if shares > 0 {
                            // Remove random portion (10% - 100%)
                            let remove_ratio = rng.gen_range(10..=100);
                            let shares_to_remove = (shares * remove_ratio) / 100;

                            self.remove_liquidity(
                                &env,
                                pair_address,
                                &user,
                                shares_to_remove,
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
                    "Progress: {} operations, {:.2} ops/s, {:.2}% success, {} active positions",
                    operation_count,
                    collector.operations_per_second(),
                    collector.success_rate() * 100.0,
                    lp_positions.len()
                );
            }
        }

        println!(
            "Pool stress test completed: {} operations in {:.2}s",
            collector.total_operations(),
            test_start.elapsed().as_secs_f64()
        );
    }

    fn name(&self) -> &str {
        "Pool Stress Test"
    }

    fn description(&self) -> &str {
        "Rapid add/remove liquidity operations on multiple pools"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_stress_scenario() {
        let scenario = PoolStressScenario::new();
        let mut config = StressConfig::default();
        config.duration_seconds = 5;
        config.target_tps = 10;
        config.pool_stress.num_pools = 3;
        config.num_accounts = 5;

        let collector = MetricsCollector::new();
        scenario.run(&config, &collector);

        assert!(collector.total_operations() > 0);
        println!(
            "Executed {} pool operations with {:.2}% success rate",
            collector.total_operations(),
            collector.success_rate() * 100.0
        );
    }
}
