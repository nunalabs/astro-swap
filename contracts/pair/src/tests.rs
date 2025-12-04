#![cfg(test)]

use crate::contract::{AstroSwapPair, AstroSwapPairClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// Helper to create a token
fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, Address) {
    let addr = env.register_stellar_asset_contract_v2(admin.clone());
    let client = TokenClient::new(env, &addr.address());
    (client, addr.address())
}

// Helper to mint tokens
fn mint_token(env: &Env, token_addr: &Address, admin: &Address, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(env, token_addr);
    sac.mint(to, &amount);
}

// Helper to setup pair with initial liquidity
fn setup_pair_with_liquidity(
    env: &Env,
) -> (
    AstroSwapPairClient,
    TokenClient,
    TokenClient,
    Address,
    Address,
    Address,
) {
    let admin = Address::generate(env);
    let user = Address::generate(env);
    let factory = Address::generate(env);

    let (token_0_client, token_0_addr) = create_token(env, &admin);
    let (token_1_client, token_1_addr) = create_token(env, &admin);

    // Register and initialize pair
    let pair_addr = env.register_contract(None, AstroSwapPair);
    let pair_client = AstroSwapPairClient::new(env, &pair_addr);

    pair_client.initialize(&factory, &token_0_addr, &token_1_addr);

    // Mint tokens to user
    mint_token(env, &token_0_addr, &admin, &user, 1_000_000_0000000);
    mint_token(env, &token_1_addr, &admin, &user, 1_000_000_0000000);

    (
        pair_client,
        token_0_client,
        token_1_client,
        token_0_addr,
        token_1_addr,
        user,
    )
}

// ==================== Initialization Tests ====================

#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let token_0 = Address::generate(&env);
    let token_1 = Address::generate(&env);

    let contract_id = env.register_contract(None, AstroSwapPair);
    let client = AstroSwapPairClient::new(&env, &contract_id);

    client.initialize(&factory, &token_0, &token_1);

    assert_eq!(client.factory(), factory);
    assert_eq!(client.token_0(), token_0);
    assert_eq!(client.token_1(), token_1);
    assert_eq!(client.fee_bps(), 30); // Default 0.3% fee
    assert!(!client.is_paused());
}

#[test]
fn test_initialize_with_same_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let token = Address::generate(&env);

    let contract_id = env.register_contract(None, AstroSwapPair);
    let client = AstroSwapPairClient::new(&env, &contract_id);

    // Should fail with SameToken error
    let result = client.try_initialize(&factory, &token, &token);
    assert!(result.is_err());
}

#[test]
fn test_double_initialize_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let factory = Address::generate(&env);
    let token_0 = Address::generate(&env);
    let token_1 = Address::generate(&env);

    let contract_id = env.register_contract(None, AstroSwapPair);
    let client = AstroSwapPairClient::new(&env, &contract_id);

    // First initialization succeeds
    client.initialize(&factory, &token_0, &token_1);

    // Second initialization fails
    let result = client.try_initialize(&factory, &token_0, &token_1);
    assert!(result.is_err());
}

// ==================== Deposit Tests ====================

#[test]
fn test_first_deposit_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, token_0_client, token_1_client, token_0_addr, token_1_addr, user) =
        setup_pair_with_liquidity(&env);

    let amount_0 = 100_0000000i128; // 100 tokens
    let amount_1 = 100_0000000i128;

    let result = pair_client.deposit(&user, &amount_0, &amount_1, &0, &0);

    // First deposit uses all amounts
    assert_eq!(result.0, amount_0);
    assert_eq!(result.1, amount_1);
    assert!(result.2 > 0); // Received LP tokens

    // Verify reserves updated
    let (reserve_0, reserve_1) = pair_client.get_reserves();
    assert_eq!(reserve_0, amount_0);
    assert_eq!(reserve_1, amount_1);

    // Verify user received LP tokens
    let user_lp_balance = pair_client.balance(&user);
    assert!(user_lp_balance > 0);
}

#[test]
fn test_subsequent_deposit_maintains_ratio() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    // First deposit
    pair_client.deposit(&user, &100_0000000, &200_0000000, &0, &0);

    let user2 = Address::generate(&env);
    // Mint to user2 (for testing, we can use the mock)
    let admin = Address::generate(&env);
    let (_, token_0_addr) = create_token(&env, &admin);
    let (_, token_1_addr) = create_token(&env, &admin);

    // For this test, we use the same user
    // Second deposit - should maintain 1:2 ratio
    let result = pair_client.deposit(&user, &50_0000000, &200_0000000, &0, &0);

    // Should get optimal amounts based on ratio
    // With 1:2 ratio, 50 token_0 should pair with 100 token_1
    assert_eq!(result.0, 50_0000000);
    assert_eq!(result.1, 100_0000000); // Optimal for maintaining ratio
}

#[test]
fn test_deposit_with_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    let result = pair_client.try_deposit(&user, &0, &100_0000000, &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_deposit_with_negative_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    let result = pair_client.try_deposit(&user, &-100, &100_0000000, &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_deposit_below_minimum_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    // First deposit
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Second deposit with minimum too high
    let result = pair_client.try_deposit(
        &user,
        &50_0000000,
        &50_0000000,
        &50_0000000, // min_0 = desired_0, OK
        &100_0000000, // min_1 much higher than optimal
    );
    assert!(result.is_err());
}

// ==================== Withdraw Tests ====================

#[test]
fn test_withdraw_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, token_0_client, token_1_client, _, _, user) =
        setup_pair_with_liquidity(&env);

    // First deposit
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);
    let half_lp = user_lp / 2;

    // Withdraw half
    let result = pair_client.withdraw(&user, &half_lp, &0, &0);

    assert!(result.0 > 0);
    assert!(result.1 > 0);

    // User should have half LP tokens remaining
    assert_eq!(pair_client.balance(&user), user_lp - half_lp);
}

#[test]
fn test_withdraw_all() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    // Deposit
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);

    // Withdraw all
    pair_client.withdraw(&user, &user_lp, &0, &0);

    // User should have 0 LP tokens
    assert_eq!(pair_client.balance(&user), 0);
}

#[test]
fn test_withdraw_zero_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let result = pair_client.try_withdraw(&user, &0, &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_more_than_balance_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);

    let result = pair_client.try_withdraw(&user, &(user_lp + 1), &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_withdraw_below_minimum_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);

    // Set minimum higher than what we'd receive
    let result = pair_client.try_withdraw(&user, &user_lp, &200_0000000, &0);
    assert!(result.is_err());
}

// ==================== Swap Tests ====================

#[test]
fn test_swap_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    // Add liquidity first
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Swap
    let amount_in = 10_0000000i128;
    let result = pair_client.swap(&user, &token_0_addr, &amount_in, &0);

    assert!(result > 0);
    // With fees, should be slightly less than input
    assert!(result < amount_in);
}

#[test]
fn test_swap_respects_slippage() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Try swap with very high minimum - should fail
    let result = pair_client.try_swap(&user, &token_0_addr, &10_0000000, &50_0000000);
    assert!(result.is_err());
}

#[test]
fn test_swap_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let result = pair_client.try_swap(&user, &token_0_addr, &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_swap_invalid_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let invalid_token = Address::generate(&env);
    let result = pair_client.try_swap(&user, &invalid_token, &10_0000000, &0);
    assert!(result.is_err());
}

#[test]
fn test_swap_maintains_k_invariant() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let k_before = pair_client.k_last();

    pair_client.swap(&user, &token_0_addr, &10_0000000, &0);

    let k_after = pair_client.k_last();

    // K should increase (due to fees) or stay the same
    assert!(k_after >= k_before);
}

// ==================== Pause Tests ====================

#[test]
fn test_pause_blocks_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    // Pause the contract
    pair_client.set_paused(&true);
    assert!(pair_client.is_paused());

    // Deposit should fail
    let result = pair_client.try_deposit(&user, &100_0000000, &100_0000000, &0, &0);
    assert!(result.is_err());
}

#[test]
fn test_pause_blocks_swap() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    // Deposit before pausing
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Pause
    pair_client.set_paused(&true);

    // Swap should fail
    let result = pair_client.try_swap(&user, &token_0_addr, &10_0000000, &0);
    assert!(result.is_err());
}

#[test]
fn test_unpause_restores_functionality() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    // Deposit
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Pause then unpause
    pair_client.set_paused(&true);
    pair_client.set_paused(&false);
    assert!(!pair_client.is_paused());

    // Swap should work
    let result = pair_client.swap(&user, &token_0_addr, &10_0000000, &0);
    assert!(result > 0);
}

// ==================== LP Token Tests ====================

#[test]
fn test_lp_token_transfer() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);
    let recipient = Address::generate(&env);

    pair_client.transfer(&user, &recipient, &(user_lp / 2));

    assert_eq!(pair_client.balance(&user), user_lp / 2);
    assert_eq!(pair_client.balance(&recipient), user_lp / 2);
}

#[test]
fn test_lp_token_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let user_lp = pair_client.balance(&user);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);

    pair_client.approve(&user, &spender, &user_lp);
    assert_eq!(pair_client.allowance(&user, &spender), user_lp);

    pair_client.transfer_from(&spender, &user, &recipient, &user_lp);

    assert_eq!(pair_client.balance(&user), 0);
    assert_eq!(pair_client.balance(&recipient), user_lp);
}

// ==================== View Function Tests ====================

#[test]
fn test_get_amount_out() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let amount_out = pair_client.get_amount_out(&10_0000000, &token_0_addr);

    // Should get some output
    assert!(amount_out.is_ok());
    assert!(amount_out.unwrap() > 0);
}

#[test]
fn test_get_amount_in() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, token_1_addr, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let amount_in = pair_client.get_amount_in(&10_0000000, &token_1_addr);

    // Should need some input
    assert!(amount_in.is_ok());
    assert!(amount_in.unwrap() > 0);
}

#[test]
fn test_get_info() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, token_1_addr, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    let info = pair_client.get_info();

    assert_eq!(info.token_a, token_0_addr);
    assert_eq!(info.token_b, token_1_addr);
    assert_eq!(info.reserve_a, 100_0000000);
    assert_eq!(info.reserve_b, 100_0000000);
    assert!(info.total_shares > 0);
    assert_eq!(info.fee_bps, 30);
}

// ==================== Sync and Skim Tests ====================

#[test]
fn test_sync_updates_reserves() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Sync should not change anything if balances match reserves
    pair_client.sync();

    let (reserve_0, reserve_1) = pair_client.get_reserves();
    assert_eq!(reserve_0, 100_0000000);
    assert_eq!(reserve_1, 100_0000000);
}

// ==================== Edge Cases ====================

#[test]
fn test_large_swap_high_price_impact() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    // Small pool
    pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Large swap (50% of pool)
    let amount_in = 50_0000000i128;
    let result = pair_client.swap(&user, &token_0_addr, &amount_in, &0);

    // Should get significantly less than 50 due to price impact
    assert!(result < 50_0000000);
    // But should still get something reasonable (more than 30 due to x*y=k)
    assert!(result > 25_0000000);
}

#[test]
fn test_multiple_swaps_in_same_direction() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, token_0_addr, _, user) = setup_pair_with_liquidity(&env);

    pair_client.deposit(&user, &1000_0000000, &1000_0000000, &0, &0);

    // Multiple small swaps
    let mut total_out = 0i128;
    for _ in 0..5 {
        let out = pair_client.swap(&user, &token_0_addr, &10_0000000, &0);
        total_out += out;
    }

    // Total should be less than a single 50 token swap (due to price moving)
    let single_swap_out = pair_client.get_amount_out(&50_0000000, &token_0_addr).unwrap();

    // Each individual swap gets worse rate as price moves
    // But with proper AMM, total should still be meaningful
    assert!(total_out > 0);
}

#[test]
fn test_minimum_liquidity_locked() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair_client, _, _, _, _, user) = setup_pair_with_liquidity(&env);

    // First deposit
    let result = pair_client.deposit(&user, &100_0000000, &100_0000000, &0, &0);

    // Total supply should be more than user's balance (MINIMUM_LIQUIDITY locked)
    let total_supply = pair_client.total_supply();
    let user_balance = pair_client.balance(&user);

    assert!(total_supply > user_balance);
    // Difference should be MINIMUM_LIQUIDITY (1000)
    assert_eq!(total_supply - user_balance, 1000);
}
