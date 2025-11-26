//! Aggregator Integration Tests
//!
//! Tests the DEX aggregator functionality:
//! - Register multiple protocols
//! - Get quotes from each
//! - Execute aggregated swap
//! - Verify best route selection

use crate::test_utils::{assert_approx_eq, TestContext};
use astroswap_shared::Protocol;
use soroban_sdk::testutils::Address as _;

#[test]
fn test_aggregator_initialization() {
    let ctx = TestContext::new();

    // Aggregator should be initialized with AstroSwap as Protocol 0
    assert_eq!(ctx.aggregator.admin(), ctx.admin);
    assert_eq!(ctx.aggregator.protocol_count(), 1);
    assert!(!ctx.aggregator.is_paused());

    // Check AstroSwap protocol info
    let astroswap_info = ctx
        .aggregator
        .get_protocol_info(&Protocol::AstroSwap)
        .unwrap();

    assert_eq!(astroswap_info.protocol_id, 0);
    assert_eq!(astroswap_info.factory_address, ctx.factory_address);
    assert!(astroswap_info.is_active);
    assert_eq!(astroswap_info.default_fee_bps, 30);
}

#[test]
fn test_aggregator_single_protocol_swap() {
    let ctx = TestContext::new();

    // Setup AstroSwap pair
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let swap_amount = 1_000_0000000i128;

    // Get quote from AstroSwap (returns i128 directly)
    let quote = ctx
        .aggregator
        .get_protocol_quote(
            &Protocol::AstroSwap,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &swap_amount,
        );

    assert!(quote > 0, "Quote should be positive");

    // Find best route (should use AstroSwap) - returns SwapRoute directly
    let route = ctx
        .aggregator
        .find_best_route(&ctx.token_a_address, &ctx.token_b_address, &swap_amount);

    assert_eq!(route.steps.len(), 1);
    assert_approx_eq(route.expected_output, quote, 100);

    // Execute swap via aggregator (returns i128 directly)
    let initial_a = ctx.token_a.balance(&ctx.user1);
    let _initial_b = ctx.token_b.balance(&ctx.user1);

    let actual_output = ctx
        .aggregator
        .swap(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &swap_amount,
            &(quote - 10_0000000), // Allow slippage
            &ctx.deadline(),
        );

    // Verify balances
    assert_eq!(ctx.token_a.balance(&ctx.user1), initial_a - swap_amount);

    // Account for aggregator fee (0.05% default)
    let _aggregator_fee = (swap_amount * 5) / 10_000;

    // Output should be positive and close to quote (accounting for fees)
    assert!(actual_output > 0);
    assert!(actual_output < quote); // Should be less due to aggregator fee
}

#[test]
fn test_register_multiple_protocols() {
    let ctx = TestContext::new();

    // Register a mock Soroswap protocol
    let soroswap_factory = soroban_sdk::Address::generate(&ctx.env);

    ctx.aggregator
        .register_protocol(&ctx.admin, &Protocol::Soroswap, &soroswap_factory, &25);

    assert_eq!(ctx.aggregator.protocol_count(), 2);

    let soroswap_info = ctx
        .aggregator
        .get_protocol_info(&Protocol::Soroswap)
        .unwrap();

    assert_eq!(soroswap_info.protocol_id, 1);
    assert_eq!(soroswap_info.factory_address, soroswap_factory);
    assert!(soroswap_info.is_active);
    assert_eq!(soroswap_info.default_fee_bps, 25);

    // Register Phoenix
    let phoenix_factory = soroban_sdk::Address::generate(&ctx.env);

    ctx.aggregator
        .register_protocol(&ctx.admin, &Protocol::Phoenix, &phoenix_factory, &20);

    assert_eq!(ctx.aggregator.protocol_count(), 3);
}

#[test]
fn test_disable_protocol() {
    let ctx = TestContext::new();

    // AstroSwap should be active initially
    let info = ctx
        .aggregator
        .get_protocol_info(&Protocol::AstroSwap)
        .unwrap();
    assert!(info.is_active);

    // Disable AstroSwap
    ctx.aggregator
        .set_protocol_active(&ctx.admin, &Protocol::AstroSwap, &false);

    let info = ctx
        .aggregator
        .get_protocol_info(&Protocol::AstroSwap)
        .unwrap();
    assert!(!info.is_active);

    // Re-enable
    ctx.aggregator
        .set_protocol_active(&ctx.admin, &Protocol::AstroSwap, &true);

    let info = ctx
        .aggregator
        .get_protocol_info(&Protocol::AstroSwap)
        .unwrap();
    assert!(info.is_active);
}

#[test]
fn test_aggregator_config_update() {
    let ctx = TestContext::new();

    let config = ctx.aggregator.config();
    assert_eq!(config.max_hops, 3);
    assert_eq!(config.max_splits, 2);
    assert_eq!(config.aggregator_fee_bps, 5);

    // Update config
    ctx.aggregator
        .set_config(&ctx.admin, &2, &1, &10);

    let new_config = ctx.aggregator.config();
    assert_eq!(new_config.max_hops, 2);
    assert_eq!(new_config.max_splits, 1);
    assert_eq!(new_config.aggregator_fee_bps, 10);
}

#[test]
fn test_aggregator_fee_too_high_rejected() {
    let ctx = TestContext::new();

    // Try to set fee > 1%
    let result = ctx.aggregator.try_set_config(&ctx.admin, &3, &2, &150);

    assert!(result.is_err(), "Should reject fee > 1%");
}

#[test]
fn test_aggregator_pause() {
    let ctx = TestContext::new();

    // Setup pair
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    // Pause aggregator
    ctx.aggregator
        .set_paused(&ctx.admin, &true);

    assert!(ctx.aggregator.is_paused());

    // Try to swap while paused (use try_ for error testing)
    let result = ctx.aggregator.try_swap(
        &ctx.user1,
        &ctx.token_a_address,
        &ctx.token_b_address,
        &1_000_0000000,
        &0,
        &ctx.deadline(),
    );

    assert!(result.is_err(), "Should not allow swap while paused");

    // Unpause and retry
    ctx.aggregator
        .set_paused(&ctx.admin, &false);

    // Swap should work now (returns i128 directly)
    let output = ctx.aggregator.swap(
        &ctx.user1,
        &ctx.token_a_address,
        &ctx.token_b_address,
        &1_000_0000000,
        &0,
        &ctx.deadline(),
    );

    assert!(output > 0, "Should allow swap when unpaused");
}

#[test]
fn test_get_all_quotes() {
    let ctx = TestContext::new();

    // Setup AstroSwap pair
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let swap_amount = 1_000_0000000i128;

    // Get all quotes (should only have AstroSwap)
    let quotes = ctx
        .aggregator
        .get_all_quotes(&ctx.token_a_address, &ctx.token_b_address, &swap_amount);

    assert_eq!(quotes.len(), 1);

    let (protocol_id, quote) = quotes.get(0).expect("Should have one quote");

    assert_eq!(protocol_id, 0); // AstroSwap
    assert!(quote > 0);
}

#[test]
fn test_aggregator_fee_recipient() {
    let ctx = TestContext::new();

    // Initially no fee recipient
    assert!(ctx.aggregator.fee_recipient().is_none());

    // Set fee recipient
    let fee_recipient = soroban_sdk::Address::generate(&ctx.env);

    ctx.aggregator
        .set_fee_recipient(&ctx.admin, &fee_recipient);

    assert_eq!(ctx.aggregator.fee_recipient(), Some(fee_recipient.clone()));

    // Setup pair and do a swap
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let swap_amount = 1_000_0000000i128;
    let initial_recipient_balance = ctx.token_a.balance(&fee_recipient);

    ctx.aggregator
        .swap(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &swap_amount,
            &0,
            &ctx.deadline(),
        );

    // Fee recipient should have received aggregator fee
    let fee_collected = ctx.token_a.balance(&fee_recipient) - initial_recipient_balance;

    // Fee should be 0.05% of swap amount (5 bps)
    let expected_fee = (swap_amount * 5) / 10_000;

    assert_eq!(fee_collected, expected_fee);
}

#[test]
fn test_swap_with_precomputed_route() {
    let ctx = TestContext::new();

    // Setup pair
    ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let swap_amount = 1_000_0000000i128;

    // Find best route (returns SwapRoute directly)
    let route = ctx
        .aggregator
        .find_best_route(&ctx.token_a_address, &ctx.token_b_address, &swap_amount);

    let expected_output = route.expected_output;

    // Execute swap with pre-computed route
    let initial_b = ctx.token_b.balance(&ctx.user1);

    let actual_output = ctx
        .aggregator
        .swap_with_route(
            &ctx.user1,
            &route,
            &swap_amount,
            &(expected_output - 10_0000000), // Allow slippage
            &ctx.deadline(),
        );

    // Verify output
    assert!(actual_output > 0);
    assert_approx_eq(actual_output, expected_output, 500);

    let final_b = ctx.token_b.balance(&ctx.user1);
    assert_eq!(final_b - initial_b, actual_output);
}

#[test]
fn test_route_not_found_for_missing_pair() {
    let ctx = TestContext::new();

    // Try to find route for pair that doesn't exist (use try_ for error testing)
    let result = ctx
        .aggregator
        .try_find_best_route(&ctx.token_a_address, &ctx.token_c_address, &1_000_0000000i128);

    assert!(result.is_err(), "Should fail when no route exists");
}

#[test]
fn test_aggregator_admin_transfer() {
    let ctx = TestContext::new();

    let new_admin = soroban_sdk::Address::generate(&ctx.env);

    ctx.aggregator
        .set_admin(&ctx.admin, &new_admin);

    assert_eq!(ctx.aggregator.admin(), new_admin);

    // Old admin should not be able to perform admin actions
    let result = ctx.aggregator.try_set_paused(&ctx.admin, &true);
    assert!(result.is_err(), "Old admin should not have permissions");

    // New admin should be able to perform admin actions
    ctx.aggregator
        .set_paused(&new_admin, &true);

    assert!(ctx.aggregator.is_paused());
}
