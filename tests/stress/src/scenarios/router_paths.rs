//! Router Path Stress Testing Scenario
//!
//! Tests multi-hop swap routing under load with complex paths.

use super::StressScenario;
use crate::config::StressConfig;
use crate::metrics::{MetricsCollector, OperationType};
use crate::utils::{AccountPool, TokenManager};
use astroswap_factory::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_pair::AstroSwapPair;
use astroswap_router::{AstroSwapRouter, AstroSwapRouterClient};
use rand::Rng;
use soroban_sdk::{testutils::Address as _, vec as soroban_vec, Address, BytesN, Env, Vec as SorobanVec};
use std::collections::HashMap;
use std::time::Instant;

pub struct RouterPathsScenario;

impl RouterPathsScenario {
    pub fn new() -> Self {
        Self
    }

    /// Setup test environment with interconnected pairs
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
        Vec<Vec<Address>>,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);

        // Create tokens (need enough for multi-hop paths)
        let mut token_manager = TokenManager::new();
        let num_tokens = (config.router_paths.max_hops + 2).max(6);
        token_manager.create_tokens(&env, &admin, num_tokens, 100_000_000_0000000);

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

        // Create connected pairs for multi-hop routing
        // Build a path graph: Token0 <-> Token1 <-> Token2 <-> Token3 ...
        let mut paths: Vec<Vec<Address>> = Vec::new();

        // Create sequential pairs (for guaranteed paths)
        for i in 0..(num_tokens - 1) {
            let token_a = token_manager.get(i as usize).unwrap();
            let token_b = token_manager.get((i + 1) as usize).unwrap();

            factory
                .create_pair(&token_a.address, &token_b.address)
                .unwrap();

            // Add liquidity
            let _ = router.add_liquidity(
                &admin,
                &token_a.address,
                &token_b.address,
                10_000_000_0000000,
                10_000_000_0000000,
                0,
                0,
                &(env.ledger().timestamp() + 3600),
            );
        }

        // Generate various path configurations
        for hops in config.router_paths.min_hops..=config.router_paths.max_hops {
            if hops as u32 <= num_tokens - 1 {
                let mut path = Vec::new();
                for i in 0..=hops {
                    let token = token_manager.get(i as usize).unwrap();
                    path.push(token.address.clone());
                }
                paths.push(path);
            }
        }

        (env, admin, token_manager, account_pool, factory, router, paths)
    }

    /// Execute multi-hop swap
    fn execute_multi_hop_swap(
        &self,
        env: &Env,
        router: &AstroSwapRouterClient,
        user: &Address,
        path: &[Address],
        amount_in: i128,
        min_out: i128,
        collector: &MetricsCollector,
    ) {
        let timer = collector.start_operation();

        // Convert path to Soroban Vec
        let mut soroban_path: SorobanVec<Address> = soroban_vec![env];
        for addr in path {
            soroban_path.push_back(addr.clone());
        }

        let deadline = env.ledger().timestamp() + 3600;

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            router.swap_exact_tokens_for_tokens(user, amount_in, min_out, &soroban_path, &deadline)
        }));

        match result {
            Ok(Ok(amounts)) => {
                let mut metadata = HashMap::new();
                metadata.insert("hops".to_string(), (path.len() - 1).to_string());
                metadata.insert("amount_in".to_string(), amount_in.to_string());
                if let Some(amount_out) = amounts.last() {
                    metadata.insert("amount_out".to_string(), amount_out.to_string());
                    let price_impact = if amount_in > 0 {
                        ((amount_in - amount_out) * 10000) / amount_in
                    } else {
                        0
                    };
                    metadata.insert("price_impact_bps".to_string(), price_impact.to_string());
                }
                timer.success(OperationType::MultiHopSwap, metadata);
            }
            Ok(Err(e)) => {
                let mut metadata = HashMap::new();
                metadata.insert("hops".to_string(), (path.len() - 1).to_string());
                timer.error(
                    OperationType::MultiHopSwap,
                    format!("Multi-hop swap failed: {:?}", e),
                    metadata,
                );
            }
            Err(_) => {
                let mut metadata = HashMap::new();
                metadata.insert("hops".to_string(), (path.len() - 1).to_string());
                timer.error(
                    OperationType::MultiHopSwap,
                    "Multi-hop swap panicked".to_string(),
                    metadata,
                );
            }
        }
    }
}

impl Default for RouterPathsScenario {
    fn default() -> Self {
        Self::new()
    }
}

impl StressScenario for RouterPathsScenario {
    fn run(&self, config: &StressConfig, collector: &MetricsCollector) {
        let (env, _admin, _token_manager, mut account_pool, _factory, router, paths) =
            self.setup_environment(config);

        let test_start = Instant::now();
        let target_duration = std::time::Duration::from_secs(config.duration_seconds);
        let router_config = &config.router_paths;

        let mut rng = rand::thread_rng();
        let mut operation_count = 0u64;

        println!(
            "Starting router paths test: {} paths for {} seconds",
            paths.len(),
            config.duration_seconds
        );

        while test_start.elapsed() < target_duration {
            let iteration_start = Instant::now();

            // Execute paths per second
            for _ in 0..router_config.paths_per_second {
                // Select random path
                let path_idx = rng.gen_range(0..paths.len());
                let path = &paths[path_idx];

                // Select random user
                let user = account_pool.random();

                // Generate swap amount
                let amount_in = rng.gen_range(1_000_0000000..=100_000_0000000);

                // Calculate minimum output (with slippage tolerance)
                // Simplified: assume 0.3% fee per hop + price impact tolerance
                let hops = path.len() - 1;
                let fee_impact = 10000 - (30 * hops as i128); // 0.3% per hop
                let price_impact_tolerance = router_config.max_price_impact_bps as i128;
                let min_out = (amount_in * (fee_impact - price_impact_tolerance)) / 10000;

                self.execute_multi_hop_swap(
                    &env,
                    &router,
                    user,
                    path,
                    amount_in,
                    min_out.max(1),
                    collector,
                );

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
            if operation_count % 200 == 0 {
                println!(
                    "Progress: {} multi-hop swaps, {:.2} ops/s, {:.2}% success",
                    operation_count,
                    collector.operations_per_second(),
                    collector.success_rate() * 100.0
                );
            }
        }

        println!(
            "Router paths test completed: {} operations in {:.2}s",
            collector.total_operations(),
            test_start.elapsed().as_secs_f64()
        );
    }

    fn name(&self) -> &str {
        "Router Paths Test"
    }

    fn description(&self) -> &str {
        "Multi-hop swap routing stress with complex paths"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_router_paths_scenario() {
        let scenario = RouterPathsScenario::new();
        let mut config = StressConfig::default();
        config.duration_seconds = 5;
        config.router_paths.paths_per_second = 5;
        config.router_paths.min_hops = 2;
        config.router_paths.max_hops = 3;
        config.num_accounts = 5;

        let collector = MetricsCollector::new();
        scenario.run(&config, &collector);

        assert!(collector.total_operations() > 0);
        println!(
            "Executed {} multi-hop swaps with {:.2}% success rate",
            collector.total_operations(),
            collector.success_rate() * 100.0
        );
    }
}
