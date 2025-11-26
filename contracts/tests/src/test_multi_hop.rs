//! Multi-Hop Swap Integration Tests
//!
//! Tests complex swap paths across multiple pairs:
//! - Create pairs: A/B, B/C
//! - Swap A → B → C via router
//! - Verify intermediate amounts
//! - Test multi-hop slippage protection

use crate::test_utils::{assert_approx_eq, calculate_output_amount, TestContext};
use astroswap_shared::PairClient;

#[test]
fn test_two_hop_swap() {
    let ctx = TestContext::new();

    // Create pair A/B with 10k A and 20k B
    let pair_ab = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    // Create pair B/C with 20k B and 40k C
    let pair_bc = ctx.setup_pair(
        &ctx.token_b_address,
        &ctx.token_c_address,
        20_000_0000000,
        40_000_0000000,
    );

    let pair_ab_client = PairClient::new(&ctx.env, &pair_ab);
    let pair_bc_client = PairClient::new(&ctx.env, &pair_bc);

    // Get initial reserves for calculation
    let (reserve_ab_0, reserve_ab_1) = pair_ab_client.get_reserves();
    let token_ab_0 = pair_ab_client.token_0();

    let (reserve_a, reserve_b_in_ab) = if ctx.token_a_address == token_ab_0 {
        (reserve_ab_0, reserve_ab_1)
    } else {
        (reserve_ab_1, reserve_ab_0)
    };

    let (reserve_bc_0, reserve_bc_1) = pair_bc_client.get_reserves();
    let token_bc_0 = pair_bc_client.token_0();

    let (reserve_b_in_bc, reserve_c) = if ctx.token_b_address == token_bc_0 {
        (reserve_bc_0, reserve_bc_1)
    } else {
        (reserve_bc_1, reserve_bc_0)
    };

    // Swap 1000 A → B → C
    let swap_amount = 1_000_0000000i128;

    // Calculate expected amounts
    // First hop: A → B
    let expected_b = calculate_output_amount(swap_amount, reserve_a, reserve_b_in_ab);

    // Second hop: B → C (using output from first hop as input)
    let expected_c = calculate_output_amount(expected_b, reserve_b_in_bc, reserve_c);

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_c_address.clone()
    ];

    let initial_a = ctx.token_a.balance(&ctx.user1);
    let initial_c = ctx.token_c.balance(&ctx.user1);

    let amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user1,
            &swap_amount,
            &(expected_c - 10_0000000), // Allow some slippage
            &path,
            &ctx.deadline(),
        );

    // Verify amounts
    let amount_a = amounts.get(0).unwrap();
    let amount_b = amounts.get(1).unwrap();
    let amount_c = amounts.get(2).unwrap();

    assert_eq!(amount_a, swap_amount);
    assert_approx_eq(amount_b, expected_b, 100); // Within 1%
    assert_approx_eq(amount_c, expected_c, 100); // Within 1%

    // Verify balances
    assert_eq!(ctx.token_a.balance(&ctx.user1), initial_a - swap_amount);
    assert_eq!(ctx.token_c.balance(&ctx.user1), initial_c + amount_c);

    // User should not hold any intermediate token B
    // (all B from first swap goes into second swap)
    // Note: User already had some B from initial distribution
    // so we just verify the swap worked, not the absolute balance
}

#[test]
fn test_three_hop_swap() {
    let ctx = TestContext::new();

    // Deploy 4 tokens and create chain: A → B → C → XLM
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    ctx.setup_pair(
        &ctx.token_b_address,
        &ctx.token_c_address,
        20_000_0000000,
        40_000_0000000,
    );

    ctx.setup_pair(
        &ctx.token_c_address,
        &ctx.xlm_address,
        40_000_0000000,
        80_000_0000000,
    );

    let swap_amount = 500_0000000i128;

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_c_address.clone(),
        ctx.xlm_address.clone()
    ];

    let initial_a = ctx.token_a.balance(&ctx.user2);
    let initial_xlm = ctx.xlm.balance(&ctx.user2);

    let amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user2,
            &swap_amount,
            &0i128, // Accept any output for this test
            &path,
            &ctx.deadline(),
        );

    // Verify 4 amounts returned (input + 3 outputs)
    assert_eq!(amounts.len(), 4);

    let final_xlm = amounts.get(3).unwrap();

    // Verify balances changed
    assert_eq!(ctx.token_a.balance(&ctx.user2), initial_a - swap_amount);
    assert_eq!(ctx.xlm.balance(&ctx.user2), initial_xlm + final_xlm);

    // Output should be positive
    assert!(final_xlm > 0);
}

#[test]
fn test_multi_hop_slippage_protection() {
    let ctx = TestContext::new();

    // Setup pairs
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    ctx.setup_pair(
        &ctx.token_b_address,
        &ctx.token_c_address,
        20_000_0000000,
        40_000_0000000,
    );

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_c_address.clone()
    ];

    // First, do a successful swap to get expected output
    let swap_amount = 1_000_0000000i128;

    let amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user1,
            &swap_amount,
            &0i128,
            &path,
            &ctx.deadline(),
        );

    let expected_output = amounts.get(2).unwrap();

    // Now try with user2 and set min output too high
    let result = ctx.router.try_swap_exact_tokens_for_tokens(
        &ctx.user2,
        &swap_amount,
        &(expected_output + 100_0000000), // Require way more
        &path,
        &ctx.deadline(),
    );

    assert!(
        result.is_err(),
        "Should fail when slippage protection triggers"
    );
}

#[test]
fn test_reverse_path_gives_different_rate() {
    let ctx = TestContext::new();

    // Create asymmetric pairs to test that A→B→C ≠ C→B→A
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        30_000_0000000, // 1:3 ratio
    );

    ctx.setup_pair(
        &ctx.token_b_address,
        &ctx.token_c_address,
        30_000_0000000,
        60_000_0000000, // 1:2 ratio
    );

    let swap_amount = 1_000_0000000i128;

    // Forward path: A → B → C
    let forward_path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_c_address.clone()
    ];

    let forward_amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user1,
            &swap_amount,
            &0i128,
            &forward_path,
            &ctx.deadline(),
        );

    let c_received = forward_amounts.get(2).unwrap();

    // Reverse path: C → B → A (using same amount of C)
    let reverse_path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_c_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_a_address.clone()
    ];

    let reverse_amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(
            &ctx.user2,
            &c_received,
            &0i128,
            &reverse_path,
            &ctx.deadline(),
        );

    let a_received = reverse_amounts.get(2).unwrap();

    // Due to fees (0.3% per swap = 0.6% total for 2 hops each way),
    // we should get back less than we started with
    assert!(
        a_received < swap_amount,
        "Round-trip should lose value to fees"
    );

    // Loss should be approximately 1.2% (0.6% each direction)
    // But price impact also matters, so we allow up to 5% loss
    let loss_pct = ((swap_amount - a_received) * 10000) / swap_amount;
    assert!(loss_pct > 50, "Should lose at least 0.5%"); // At least 50 bps
    assert!(loss_pct < 500, "Should lose less than 5%"); // Less than 500 bps
}

#[test]
fn test_invalid_path_rejected() {
    let ctx = TestContext::new();

    // Create only A/B pair
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    // Try path A → C (no pair exists)
    let invalid_path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_c_address.clone()
    ];

    let result = ctx.router.try_swap_exact_tokens_for_tokens(
        &ctx.user1,
        &1_000_0000000i128,
        &0i128,
        &invalid_path,
        &ctx.deadline(),
    );

    assert!(result.is_err(), "Should reject path with missing pair");

    // Try path with only one token
    let single_token_path = soroban_sdk::vec![&ctx.env, ctx.token_a_address.clone()];

    let result = ctx.router.try_swap_exact_tokens_for_tokens(
        &ctx.user1,
        &1_000_0000000i128,
        &0i128,
        &single_token_path,
        &ctx.deadline(),
    );

    assert!(result.is_err(), "Should reject single-token path");
}

#[test]
fn test_price_impact_increases_with_amount() {
    let ctx = TestContext::new();

    // Setup pairs
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    ctx.setup_pair(
        &ctx.token_b_address,
        &ctx.token_c_address,
        20_000_0000000,
        40_000_0000000,
    );

    let path = soroban_sdk::vec![
        &ctx.env,
        ctx.token_a_address.clone(),
        ctx.token_b_address.clone(),
        ctx.token_c_address.clone()
    ];

    // Small swap
    let small_amount = 100_0000000i128;
    let small_amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(&ctx.user1, &small_amount, &0i128, &path, &ctx.deadline());

    let small_output = small_amounts.get(2).unwrap();
    let small_rate = (small_output * 1_0000000) / small_amount; // Rate with 7 decimals

    // Large swap
    let large_amount = 2_000_0000000i128;
    let large_amounts = ctx
        .router
        .swap_exact_tokens_for_tokens(&ctx.user2, &large_amount, &0i128, &path, &ctx.deadline());

    let large_output = large_amounts.get(2).unwrap();
    let large_rate = (large_output * 1_0000000) / large_amount;

    // Large swap should have worse rate due to price impact
    assert!(
        large_rate < small_rate,
        "Large swap should have worse rate. Small: {}, Large: {}",
        small_rate,
        large_rate
    );

    // Rate difference should be significant (at least 5%)
    let rate_diff_pct = ((small_rate - large_rate) * 10000) / small_rate;
    assert!(
        rate_diff_pct > 500,
        "Rate difference should be > 5%, got: {} bps",
        rate_diff_pct
    );
}
