/// Fuzzing tests for AstroSwap Pair Contract
///
/// Tests extreme values and edge cases to ensure contract robustness
/// against unusual inputs, potential attacks, and boundary conditions.

#[cfg(test)]
mod fuzzing {
    use crate::contract::{AstroSwapPair, AstroSwapPairClient};
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, Env,
    };

    const FAR_FUTURE_DEADLINE: u64 = 9_999_999_999;

    // ==================== Helpers ====================

    fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, Address) {
        let addr = env.register_stellar_asset_contract_v2(admin.clone());
        let client = TokenClient::new(env, &addr.address());
        (client, addr.address())
    }

    fn mint_token(env: &Env, token_addr: &Address, _admin: &Address, to: &Address, amount: i128) {
        let sac = StellarAssetClient::new(env, token_addr);
        sac.mint(to, &amount);
    }

    fn register_pair<'a>(
        env: &'a Env,
        factory: &Address,
        token_0: &Address,
        token_1: &Address,
    ) -> AstroSwapPairClient<'a> {
        let pair_addr = env.register(
            AstroSwapPair,
            (factory.clone(), token_0.clone(), token_1.clone()),
        );
        AstroSwapPairClient::new(env, &pair_addr)
    }

    fn setup_pair_with_liquidity(
        env: &Env,
    ) -> (
        AstroSwapPairClient<'_>,
        TokenClient<'_>,
        TokenClient<'_>,
        Address,
        Address,
        Address,
    ) {
        let admin = Address::generate(env);
        let factory = Address::generate(env);
        let user = Address::generate(env);

        let (token_0_client, token_0) = create_token(env, &admin);
        let (token_1_client, token_1) = create_token(env, &admin);

        let pair_client = register_pair(env, &factory, &token_0, &token_1);

        // Mint tokens to user
        mint_token(env, &token_0, &admin, &user, 1_000_000_0000000);
        mint_token(env, &token_1, &admin, &user, 1_000_000_0000000);

        // Add initial liquidity
        pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0, &FAR_FUTURE_DEADLINE);

        (pair_client, token_0_client, token_1_client, admin, factory, user)
    }

    // ==================== Deadline Fuzzing ====================

    // Note: Deadline tests require setting ledger timestamp which has changed in SDK 25.x
    // These tests are better suited for integration tests with full environment control

    #[test]
    #[ignore] // Requires ledger timestamp manipulation - SDK 25.x API change
    fn fuzz_deadline_expired() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // TODO: Update for SDK 25.x ledger API
        // Set ledger timestamp to far future

        // Try deposit with expired deadline (year 2000)
        let expired_deadline = 946_684_800u64; // Jan 1, 2000
        let result = pair_client.try_deposit(
            &user,
            &10_0000000,
            &10_0000000,
            &0,
            &0,
            &expired_deadline,
        );

        assert!(result.is_err(), "Should fail with expired deadline");
    }

    #[test]
    #[ignore] // Requires ledger timestamp manipulation - SDK 25.x API change
    fn fuzz_deadline_exact_match() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // TODO: Update for SDK 25.x ledger API
        // Set ledger timestamp
        let current_time = 1_000_000_000u64;

        // Try deposit with deadline = current time (should fail, needs to be >)
        let result = pair_client.try_deposit(
            &user,
            &10_0000000,
            &10_0000000,
            &0,
            &0,
            &current_time,
        );

        assert!(result.is_err(), "Should fail when deadline equals current time");
    }

    #[test]
    fn fuzz_deadline_max_u64() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Use maximum u64 deadline
        let max_deadline = u64::MAX;

        let result = pair_client.deposit(
            &user,
            &10_0000000,
            &10_0000000,
            &0,
            &0,
            &max_deadline,
        );

        // Should succeed - far future deadline
        assert!(result.0 > 0 && result.1 > 0 && result.2 > 0);
    }

    // ==================== Amount Fuzzing ====================

    #[test]
    fn fuzz_amount_minimum_deposit() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_0_client, token_0) = create_token(&env, &admin);
        let (token_1_client, token_1) = create_token(&env, &admin);

        let pair_client = register_pair(&env, &factory, &token_0, &token_1);

        // Mint minimal amounts
        mint_token(&env, &token_0, &admin, &user, 10_000);
        mint_token(&env, &token_1, &admin, &user, 10_000);

        // Try first deposit with minimal amounts (1 stroop each)
        // Note: Will fail due to MINIMUM_LIQUIDITY requirement (1000)
        let result = pair_client.try_deposit(&user, &1, &1, &0, &0, &FAR_FUTURE_DEADLINE);

        assert!(result.is_err(), "Should fail - below minimum liquidity");
    }

    #[test]
    fn fuzz_amount_just_above_minimum() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_0_client, token_0) = create_token(&env, &admin);
        let (token_1_client, token_1) = create_token(&env, &admin);

        let pair_client = register_pair(&env, &factory, &token_0, &token_1);

        // Mint amounts just above minimum liquidity (MINIMUM_LIQUIDITY = 1000)
        mint_token(&env, &token_0, &admin, &user, 2000);
        mint_token(&env, &token_1, &admin, &user, 2000);

        // First deposit: sqrt(1001 * 1001) = 1001, minus 1000 locked = 1 LP token
        let result = pair_client.deposit(&user, &1001, &1001, &0, &0, &FAR_FUTURE_DEADLINE);

        // Should succeed and mint exactly 1 LP token to user (1000 locked forever)
        assert_eq!(result.2, 1, "Should mint exactly 1 LP token");
    }

    #[test]
    fn fuzz_amount_very_large_deposit() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_0_client, token_0) = create_token(&env, &admin);
        let (token_1_client, token_1) = create_token(&env, &admin);

        let pair_client = register_pair(&env, &factory, &token_0, &token_1);

        // Mint very large amounts (100 billion tokens with 7 decimals)
        let huge_amount = 100_000_000_000_0000000i128;
        mint_token(&env, &token_0, &admin, &user, huge_amount);
        mint_token(&env, &token_1, &admin, &user, huge_amount);

        // Deposit should succeed without overflow
        let result = pair_client.deposit(
            &user,
            &huge_amount,
            &huge_amount,
            &0,
            &0,
            &FAR_FUTURE_DEADLINE,
        );

        assert!(result.0 > 0 && result.1 > 0 && result.2 > 0);
    }

    #[test]
    fn fuzz_amount_unbalanced_deposit() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Try depositing with extreme ratio (1:1,000,000)
        // Pool has 100:100, so optimal ratio is 1:1
        // Depositing 1:1,000,000 should use much less of token_1
        let result = pair_client.deposit(
            &user,
            &1_0000000,           // 1 token
            &1_000_000_0000000,   // 1 million tokens
            &0,
            &0,
            &FAR_FUTURE_DEADLINE,
        );

        // Should succeed, but use optimal amounts (close to 1:1 ratio)
        assert!(result.0 > 0);
        assert!(result.1 > 0);
        // Verify ratio is maintained (amounts should be similar)
        assert!(result.0 * 2 > result.1 && result.1 * 2 > result.0);
    }

    // ==================== Slippage Fuzzing ====================

    #[test]
    fn fuzz_slippage_zero_tolerance() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Deposit with min = desired (zero slippage tolerance)
        // This should work for balanced pools
        let amount = 10_0000000i128;
        let result = pair_client.deposit(
            &user,
            &amount,
            &amount,
            &amount, // min_0 = desired_0
            &amount, // min_1 = desired_1
            &FAR_FUTURE_DEADLINE,
        );

        assert!(result.0 > 0 && result.1 > 0);
    }

    #[test]
    fn fuzz_slippage_reasonable_tolerance() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Deposit with reasonable slippage tolerance (5%)
        // Pool is 100:100, depositing 20:20
        let amount = 20_0000000i128;
        let min_with_5pct_slippage = (amount * 95) / 100; // 95% of amount

        let result = pair_client.deposit(
            &user,
            &amount,
            &amount,
            &min_with_5pct_slippage,
            &min_with_5pct_slippage,
            &FAR_FUTURE_DEADLINE,
        );

        // Should succeed - amounts are balanced and within tolerance
        assert!(result.0 >= min_with_5pct_slippage);
        assert!(result.1 >= min_with_5pct_slippage);
        assert!(result.2 > 0);
    }

    #[test]
    fn fuzz_slippage_unlimited() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Deposit with min = 0 (unlimited slippage)
        let result = pair_client.deposit(
            &user,
            &10_0000000,
            &10_0000000,
            &0, // No minimum
            &0, // No minimum
            &FAR_FUTURE_DEADLINE,
        );

        assert!(result.0 > 0 && result.1 > 0);
    }

    // ==================== Withdraw Fuzzing ====================

    #[test]
    fn fuzz_withdraw_all_shares() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Get user's LP balance
        let lp_balance = pair_client.balance(&user);

        // Withdraw all shares
        let result = pair_client.withdraw(&user, &lp_balance, &0, &0, &FAR_FUTURE_DEADLINE);

        assert!(result.0 > 0 && result.1 > 0);
        assert_eq!(pair_client.balance(&user), 0, "Should have 0 LP tokens left");
    }

    #[test]
    fn fuzz_withdraw_single_share() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        // Withdraw just 1 share
        let result = pair_client.withdraw(&user, &1, &0, &0, &FAR_FUTURE_DEADLINE);

        // Should succeed (might get 0 tokens due to rounding, but shouldn't fail)
        assert!(result.0 >= 0 && result.1 >= 0);
    }

    #[test]
    fn fuzz_withdraw_with_strict_minimums() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

        let lp_balance = pair_client.balance(&user);

        // Set impossible minimums (higher than reserves)
        let result = pair_client.try_withdraw(
            &user,
            &lp_balance,
            &1_000_000_0000000, // More than reserves
            &1_000_000_0000000,
            &FAR_FUTURE_DEADLINE,
        );

        assert!(result.is_err(), "Should fail with impossible minimums");
    }

    // ==================== Swap Fuzzing ====================

    #[test]
    fn fuzz_swap_dust_amount() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, token_0_client, _, admin, _, user) = setup_pair_with_liquidity(&env);

        let token_0 = token_0_client.address;

        // Try swapping dust (1 stroop)
        let result = pair_client.try_swap(&user, &token_0, &1, &0, &FAR_FUTURE_DEADLINE);

        // Should fail - below minimum trade amount
        assert!(result.is_err(), "Should fail for dust amounts");
    }

    #[test]
    fn fuzz_swap_entire_reserve() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, token_0_client, _, admin, _, user) = setup_pair_with_liquidity(&env);

        let token_0 = token_0_client.address;
        let reserves = pair_client.get_reserves();

        // Try to swap amount equal to entire reserve
        // This tests the mathematical limits of the AMM formula
        mint_token(&env, &token_0, &admin, &user, reserves.0);

        let amount_out = pair_client.swap(
            &user,
            &token_0,
            &reserves.0,
            &0,
            &FAR_FUTURE_DEADLINE,
        );

        // Should succeed but output will be much less than the other reserve
        // due to the constant product formula: can't drain pool completely
        assert!(amount_out > 0);
        assert!(
            amount_out < reserves.1,
            "Output must be less than target reserve"
        );
    }

    #[test]
    fn fuzz_swap_causes_extreme_price_impact() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, token_0_client, _, admin, _, user) = setup_pair_with_liquidity(&env);

        let token_0 = token_0_client.address;

        // Swap 90% of reserve (huge price impact)
        let huge_swap = 90_0000000i128; // Pool has 100 tokens
        mint_token(&env, &token_0, &admin, &user, huge_swap);

        let amount_out = pair_client.swap(&user, &token_0, &huge_swap, &0, &FAR_FUTURE_DEADLINE);

        // Should succeed but with poor rate due to price impact
        // With 0.3% fees and constant product formula:
        // Input: 90 tokens, Reserve before: 100:100
        // Output will be significant but less than proportional due to slippage
        assert!(amount_out > 0, "Should receive some output");

        // Verify the output is constrained by the constant product formula
        // Can't receive more than the reserve minus some minimum
        let reserves = pair_client.get_reserves();
        assert!(
            amount_out < 100_0000000, // Can't get more than original reserve
            "Output constrained by reserves"
        );
    }

    // ==================== Reserve Boundary Fuzzing ====================

    #[test]
    fn fuzz_pool_with_extreme_ratio() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let user = Address::generate(&env);

        let (token_0_client, token_0) = create_token(&env, &admin);
        let (token_1_client, token_1) = create_token(&env, &admin);

        let pair_client = register_pair(&env, &factory, &token_0, &token_1);

        // Create pool with extreme ratio (1:1,000,000)
        mint_token(&env, &token_0, &admin, &user, 1_000_0000000);
        mint_token(&env, &token_1, &admin, &user, 1_000_000_000_0000000);

        let result = pair_client.deposit(
            &user,
            &1_000_0000000,           // 1,000 tokens
            &1_000_000_000_0000000,   // 1 billion tokens
            &0,
            &0,
            &FAR_FUTURE_DEADLINE,
        );

        // Should create pool successfully
        assert!(result.0 > 0 && result.1 > 0 && result.2 > 0);

        // Verify reserves match
        let reserves = pair_client.get_reserves();
        assert_eq!(reserves.0, 1_000_0000000);
        assert_eq!(reserves.1, 1_000_000_000_0000000);
    }

    #[test]
    fn fuzz_multiple_operations_preserve_invariant() {
        let env = Env::default();
        env.mock_all_auths();

        let (pair_client, token_0_client, token_1_client, admin, _, user) =
            setup_pair_with_liquidity(&env);

        let token_0 = token_0_client.address;
        let token_1 = token_1_client.address;

        // Get initial K
        let initial_reserves = pair_client.get_reserves();
        let initial_k = initial_reserves.0 as i128 * initial_reserves.1 as i128;

        // Perform random operations
        mint_token(&env, &token_0, &admin, &user, 1_000_0000000);
        mint_token(&env, &token_1, &admin, &user, 1_000_0000000);

        // Swap
        pair_client.swap(&user, &token_0, &10_0000000, &0, &FAR_FUTURE_DEADLINE);

        // Get K after swap
        let reserves_after_swap = pair_client.get_reserves();
        let k_after_swap = reserves_after_swap.0 as i128 * reserves_after_swap.1 as i128;

        // K should increase or stay the same (fees go to LP)
        assert!(
            k_after_swap >= initial_k,
            "K invariant should never decrease after swap"
        );

        // Deposit more
        pair_client.deposit(&user, &50_0000000, &50_0000000, &0, &0, &FAR_FUTURE_DEADLINE);

        // K should be even higher
        let reserves_after_deposit = pair_client.get_reserves();
        let k_after_deposit = reserves_after_deposit.0 as i128 * reserves_after_deposit.1 as i128;

        assert!(
            k_after_deposit > k_after_swap,
            "K should increase after deposit"
        );
    }
}
