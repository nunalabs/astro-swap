//! Full Swap Flow Integration Tests
//!
//! Tests the complete lifecycle of a trading pair:
//! 1. Deploy factory, pair, router
//! 2. Create pair for TokenA/TokenB
//! 3. Add liquidity via router
//! 4. Execute swap
//! 5. Verify balances and reserves
//! 6. Remove liquidity

use crate::test_utils::{assert_approx_eq, calculate_output_amount, TestContext};
use astroswap_shared::PairClient;

#[test]
fn test_full_swap_flow() {
    let ctx = TestContext::new();

    // Step 1: Create pair (returns Address directly)
    let pair_address = ctx
        .factory
        .create_pair(&ctx.token_a_address, &ctx.token_b_address);

    assert!(pair_address != ctx.token_a_address);
    assert!(pair_address != ctx.token_b_address);

    // Verify pair exists
    let retrieved_pair = ctx.factory.get_pair(&ctx.token_a_address, &ctx.token_b_address);
    assert_eq!(retrieved_pair, Some(pair_address.clone()));

    // Step 2: Add initial liquidity via router
    let liquidity_a = 10_000_0000000i128;
    let liquidity_b = 20_000_0000000i128;

    let initial_a = ctx.token_a.balance(&ctx.user1);
    let initial_b = ctx.token_b.balance(&ctx.user1);

    let (amount_a, amount_b, shares) = ctx
        .router
        .add_liquidity(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &liquidity_a,
            &liquidity_b,
            &0,
            &0,
            &ctx.deadline(),
        );

    assert_eq!(amount_a, liquidity_a);
    assert_eq!(amount_b, liquidity_b);
    assert!(shares > 0);

    // Verify tokens were transferred
    assert_eq!(ctx.token_a.balance(&ctx.user1), initial_a - liquidity_a);
    assert_eq!(ctx.token_b.balance(&ctx.user1), initial_b - liquidity_b);

    // Verify reserves
    let pair_client = PairClient::new(&ctx.env, &pair_address);
    let (reserve_0, reserve_1) = pair_client.get_reserves();
    let token_0 = pair_client.token_0();

    let (reserve_a, reserve_b) = if ctx.token_a_address == token_0 {
        (reserve_0, reserve_1)
    } else {
        (reserve_1, reserve_0)
    };

    assert_eq!(reserve_a, liquidity_a);
    assert_eq!(reserve_b, liquidity_b);

    // Step 3: Execute swap
    let swap_amount = 1_000_0000000i128;
    let initial_a_user2 = ctx.token_a.balance(&ctx.user2);
    let initial_b_user2 = ctx.token_b.balance(&ctx.user2);

    // Calculate expected output
    let expected_output = calculate_output_amount(swap_amount, reserve_a, reserve_b);

    // Perform swap: Token A -> Token B
    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone()
    ];

    let amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user2,
            &swap_amount,
            &(expected_output - 1_0000000), // Allow 1 token slippage
            &path,
            &ctx.deadline(),
        );

    let actual_output = amounts.get(1).unwrap();

    // Verify balances changed correctly
    assert_eq!(
        ctx.token_a.balance(&ctx.user2),
        initial_a_user2 - swap_amount
    );
    assert_eq!(
        ctx.token_b.balance(&ctx.user2),
        initial_b_user2 + actual_output
    );

    // Verify output is close to expected (within 1%)
    assert_approx_eq(actual_output, expected_output, 100);

    // Verify reserves updated
    let (new_reserve_0, new_reserve_1) = pair_client.get_reserves();
    let (new_reserve_a, new_reserve_b) = if ctx.token_a_address == token_0 {
        (new_reserve_0, new_reserve_1)
    } else {
        (new_reserve_1, new_reserve_0)
    };

    assert_eq!(new_reserve_a, reserve_a + swap_amount);
    assert_eq!(new_reserve_b, reserve_b - actual_output);

    // Step 4: Remove liquidity
    let lp_balance = pair_client.balance(&ctx.user1);
    assert_eq!(lp_balance, shares);

    let balance_a_before_remove = ctx.token_a.balance(&ctx.user1);
    let balance_b_before_remove = ctx.token_b.balance(&ctx.user1);

    let (removed_a, removed_b) = ctx
        .router
        .remove_liquidity(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &shares,
            &0,
            &0,
            &ctx.deadline(),
        );

    // Verify LP tokens were burned
    assert_eq!(pair_client.balance(&ctx.user1), 0);

    // Verify tokens received
    assert_eq!(
        ctx.token_a.balance(&ctx.user1),
        balance_a_before_remove + removed_a
    );
    assert_eq!(
        ctx.token_b.balance(&ctx.user1),
        balance_b_before_remove + removed_b
    );

    // Removed amounts should roughly equal deposited + fees earned
    // (we can't be exact because of the swap that happened)
    assert!(removed_a > liquidity_a); // Should have gained from swap fees
    assert!(removed_b < liquidity_b); // Should have lost some to the swap
}

#[test]
fn test_swap_with_slippage_protection() {
    let ctx = TestContext::new();

    // Setup pair
    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let pair_client = PairClient::new(&ctx.env, &pair_address);
    let (reserve_0, reserve_1) = pair_client.get_reserves();
    let token_0 = pair_client.token_0();

    let (reserve_a, reserve_b) = if ctx.token_a_address == token_0 {
        (reserve_0, reserve_1)
    } else {
        (reserve_1, reserve_0)
    };

    let swap_amount = 1_000_0000000i128;
    let expected_output = calculate_output_amount(swap_amount, reserve_a, reserve_b);

    // Set minimum output too high (should fail)
    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone()
    ];

    let result = ctx.router.try_swap_exact_tokens_for_tokens(
        &ctx.user1,
        &swap_amount,
        &(expected_output + 1_0000000), // Require more than possible
        &path,
        &ctx.deadline(),
    );

    assert!(result.is_err(), "Swap should fail with excessive slippage");

    // Now try with reasonable slippage (returns Vec directly)
    let amounts = ctx.router.swap_exact_tokens_for_tokens(
        &ctx.user1,
        &swap_amount,
        &(expected_output - 10_0000000), // Allow 10 tokens slippage
        &path,
        &ctx.deadline(),
    );

    assert!(amounts.len() > 0, "Swap should succeed with reasonable slippage");
}

#[test]
fn test_add_liquidity_with_ratio_adjustment() {
    let ctx = TestContext::new();

    // Create pair and add initial liquidity
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    // Now try to add liquidity with different ratio
    // Pool ratio is 1:2 (A:B)
    // User wants to add 1000:3000 but should be adjusted to 1000:2000
    let (amount_a, amount_b, _) = ctx
        .router
        .add_liquidity(
            &ctx.user2,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &1_000_0000000i128,
            &3_000_0000000i128, // Excess, should be adjusted
            &0,
            &0,
            &ctx.deadline(),
        );

    // Should use all of amount_a and adjust amount_b to maintain ratio
    assert_eq!(amount_a, 1_000_0000000);
    assert_eq!(amount_b, 2_000_0000000); // Adjusted to 1:2 ratio
}

#[test]
fn test_cannot_create_duplicate_pair() {
    let ctx = TestContext::new();

    // Create first pair (returns Address directly)
    let pair1 = ctx
        .factory
        .create_pair(&ctx.token_a_address, &ctx.token_b_address);

    // Try to create duplicate (should fail - use try_ for error testing)
    let result = ctx
        .factory
        .try_create_pair(&ctx.token_a_address, &ctx.token_b_address);

    assert!(result.is_err(), "Should not allow duplicate pairs");

    // Verify original pair still exists
    let retrieved = ctx
        .factory
        .get_pair(&ctx.token_a_address, &ctx.token_b_address);
    assert_eq!(retrieved, Some(pair1));
}

#[test]
fn test_swap_tokens_for_exact_tokens() {
    let ctx = TestContext::new();

    // Setup pair with reserves
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    // User wants exactly 1000 token B
    let exact_output = 1_000_0000000i128;

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone()
    ];

    let initial_a = ctx.token_a.balance(&ctx.user1);
    let initial_b = ctx.token_b.balance(&ctx.user1);

    let amounts = ctx
        .router
        .swap_tokens_for_exact_tokens(
            &ctx.user1,
            &exact_output,
            &2_000_0000000i128, // Max input willing to spend
            &path,
            &ctx.deadline(),
        );

    let input_amount = amounts.get(0).unwrap();
    let output_amount = amounts.get(1).unwrap();

    // Verify output received (may have slight rounding in user's favor)
    assert!(output_amount >= exact_output, "Should receive at least exact output");
    assert!(ctx.token_b.balance(&ctx.user1) >= initial_b + exact_output);

    // Verify input was deducted
    assert_eq!(ctx.token_a.balance(&ctx.user1), initial_a - input_amount);

    // Input should be reasonable (less than max)
    assert!(input_amount < 2_000_0000000);
    assert!(input_amount > 0);
}

#[test]
fn test_expired_deadline_rejected() {
    let ctx = TestContext::new();

    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone()
    ];

    // Advance time first to avoid underflow
    ctx.advance_time(100);

    // Use past deadline (current time - 1)
    let past_deadline = ctx.timestamp() - 1;

    let result = ctx.router.try_swap_exact_tokens_for_tokens(
        &ctx.user1,
        &1_000_0000000i128,
        &0i128,
        &path,
        &past_deadline,
    );

    assert!(result.is_err(), "Should reject expired deadline");
}

#[test]
fn test_minimum_liquidity_lock() {
    let ctx = TestContext::new();

    // Create pair (returns Address directly)
    let pair_address = ctx
        .factory
        .create_pair(&ctx.token_a_address, &ctx.token_b_address);

    let pair_client = PairClient::new(&ctx.env, &pair_address);

    // Add initial liquidity (returns tuple directly)
    let (_, _, shares) = ctx
        .router
        .add_liquidity(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &1_000_0000000i128,
            &2_000_0000000i128,
            &0,
            &0,
            &ctx.deadline(),
        );

    // Check total supply includes locked minimum liquidity
    let total_supply = pair_client.total_supply();

    // MINIMUM_LIQUIDITY is 1000 (defined in shared)
    let expected_locked = 1000i128;

    assert_eq!(total_supply, shares + expected_locked);

    // Minimum liquidity should be locked in pair contract
    let locked = pair_client.balance(&pair_address);
    assert_eq!(locked, expected_locked);
}
