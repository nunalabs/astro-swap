// Security Tests for Staking Contract
// Tests for reward manipulation, race conditions, precision attacks

use crate::contract::{AstroSwapStaking, AstroSwapStakingClient};
use astroswap_shared::AstroSwapError;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// ==================== Test Helpers ====================

const FAR_FUTURE_TIME: u64 = 9_999_999_999;

/// Helper to create a test token
fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, Address) {
    let addr = env.register_stellar_asset_contract_v2(admin.clone());
    let client = TokenClient::new(env, &addr.address());
    (client, addr.address())
}

/// Helper to mint tokens
fn mint_token(env: &Env, token_addr: &Address, _admin: &Address, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(env, token_addr);
    sac.mint(to, &amount);
}

/// Helper to register staking contract with constructor (CAP-58)
fn register_staking<'a>(
    env: &'a Env,
    admin: &Address,
    reward_token: &Address,
) -> AstroSwapStakingClient<'a> {
    let staking_addr = env.register(
        AstroSwapStaking,
        (admin.clone(), reward_token.clone()),
    );
    AstroSwapStakingClient::new(env, &staking_addr)
}

/// Helper to setup staking with reward token
fn setup_staking<'a>(env: &'a Env) -> (AstroSwapStakingClient<'a>, TokenClient<'a>, Address, Address, Address) {
    let admin = Address::generate(env);
    let user = Address::generate(env);

    let (reward_token_client, reward_token_addr) = create_token(env, &admin);

    let client = register_staking(env, &admin, &reward_token_addr);

    // Mint rewards to admin for funding
    mint_token(env, &reward_token_addr, &admin, &admin, 1_000_000_0000000i128);

    (client, reward_token_client, reward_token_addr, admin, user)
}

// ==================== CRITICAL: Reward Drain Attack ====================

#[test]
fn test_rapid_stake_unstake_drain() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, reward_token_client, reward_token_addr, admin, attacker) = setup_staking(&env);

    // Setup LP token
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards pool with 10M tokens
    let initial_funding = 10_000_0000000i128;
    client.fund_rewards(&admin, &initial_funding);

    let initial_contract_rewards = reward_token_client.balance(&client.address);
    assert_eq!(initial_contract_rewards, initial_funding);

    // Create pool with 1000 rewards per second
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint LP tokens to attacker
    mint_token(&env, &lp_token, &admin, &attacker, 10_000_0000000i128);

    let stake_amount = 100_0000000i128;

    // Attacker attempts rapid stake/unstake/claim to drain rewards
    let mut total_claimed: i128 = 0;
    let iterations = 100;

    for i in 0..iterations {
        // Stake
        client.stake(&attacker, &pool_id, &stake_amount);

        // Advance time by 1 second
        env.ledger().set(LedgerInfo {
            timestamp: env.ledger().timestamp() + 1,
            protocol_version: 25,
            sequence_number: env.ledger().sequence(),
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 16,
            min_persistent_entry_ttl: 16,
            max_entry_ttl: 6312000,
        });

        // Claim rewards
        let pending = client.pending_rewards(&attacker, &pool_id);
        if pending > 0 {
            client.claim_rewards(&attacker, &pool_id);
            total_claimed += pending;
        }

        // Unstake
        client.unstake(&attacker, &pool_id, &stake_amount);
    }

    let final_contract_rewards = reward_token_client.balance(&client.address);
    let total_drained = initial_funding - final_contract_rewards;

    // Calculate expected maximum rewards
    // reward_per_second = 1000, iterations = 100 seconds
    let expected_max_rewards = 1000 * iterations;

    // Allow 2x buffer for rounding/precision
    assert!(
        total_drained <= expected_max_rewards * 2,
        "Reward drain exploit! Drained {} but expected max {}",
        total_drained,
        expected_max_rewards
    );

    // Verify claimed amount is reasonable
    assert!(
        total_claimed <= expected_max_rewards * 2,
        "Claimed {} exceeds reasonable amount {}",
        total_claimed,
        expected_max_rewards * 2
    );

    // Contract should still have most rewards left
    assert!(
        final_contract_rewards > initial_funding / 2,
        "Too many rewards drained from contract"
    );
}

// ==================== HIGH: Reward Calculation Overflow ====================

#[test]
fn test_reward_overflow_large_stake() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &100_000_0000000);

    // Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint huge LP token amount (but within i128 safe range)
    let huge_amount = i128::MAX / 1_000_000;
    mint_token(&env, &lp_token, &admin, &user, huge_amount);

    // Attempt to stake huge amount
    let result = client.try_stake(&user, &pool_id, &huge_amount);

    // Should either:
    // 1. Succeed and handle calculations safely with checked math
    // 2. Reject with overflow error
    // Should NOT panic
    match result {
        Ok(_) => {
            // Advance time
            env.ledger().set(LedgerInfo {
                timestamp: env.ledger().timestamp() + 100,
                protocol_version: 25,
                sequence_number: env.ledger().sequence(),
                network_id: Default::default(),
                base_reserve: 10,
                min_temp_entry_ttl: 16,
                min_persistent_entry_ttl: 16,
                max_entry_ttl: 6312000,
            });

            // Calculate pending rewards - should not overflow
            let pending = client.pending_rewards(&user, &pool_id);
            assert!(pending >= 0, "Pending rewards should be non-negative");
        }
        Err(_) => {
            // Acceptable - contract rejected oversized stake
        }
    }
}

// ==================== HIGH: Division by Zero ====================

#[test]
fn test_claim_when_total_staked_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint and stake
    mint_token(&env, &lp_token, &admin, &user, 100_0000000);
    client.stake(&user, &pool_id, &100_0000000);

    // Advance time
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 10,
        protocol_version: 25,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    // User unstakes everything
    client.unstake(&user, &pool_id, &100_0000000);

    // Now total_staked = 0
    // Try to update pool rewards (should handle div-by-zero gracefully)
    let pool_info = client.pool_info(&pool_id);
    assert_eq!(pool_info.total_staked, 0);

    // Creating new stake should work
    client.stake(&user, &pool_id, &50_0000000);

    let pool_info_after = client.pool_info(&pool_id);
    assert_eq!(pool_info_after.total_staked, 50_0000000);
}

// ==================== HIGH: Multiplier Manipulation ====================

#[test]
fn test_multiplier_timestamp_manipulation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint and stake
    mint_token(&env, &lp_token, &admin, &user, 100_0000000);
    client.stake(&user, &pool_id, &100_0000000);

    let initial_multiplier = client.get_multiplier(&user, &pool_id);

    // Advance time significantly
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 365 * 24 * 3600, // 1 year
        protocol_version: 25,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    let final_multiplier = client.get_multiplier(&user, &pool_id);

    // Multiplier should increase with time, but have a reasonable cap
    assert!(
        final_multiplier >= initial_multiplier,
        "Multiplier should increase over time"
    );

    // Should not overflow or become unreasonably large
    // Assuming reasonable cap of 10x (adjust based on contract logic)
    assert!(
        final_multiplier <= 100000, // 10x if base is 10000 (100%)
        "Multiplier grew to unreasonable value: {}",
        final_multiplier
    );
}

// ==================== MEDIUM: Race Condition ====================

#[test]
fn test_stake_unstake_same_block() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint LP tokens
    mint_token(&env, &lp_token, &admin, &user, 100_0000000);

    // Stake
    client.stake(&user, &pool_id, &100_0000000);

    // Immediately unstake in same block (no time advancement)
    client.unstake(&user, &pool_id, &100_0000000);

    // Check rewards - should be 0 or minimal
    let pending = client.pending_rewards(&user, &pool_id);

    // In same block, rewards should be minimal or zero
    assert!(
        pending < 1000, // Less than 1 second of rewards
        "Rewards in same block should be minimal"
    );

    // Verify stake is 0
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, 0);
}

// ==================== MEDIUM: Compound with Mismatched Tokens ====================

#[test]
fn test_compound_mismatched_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, reward_token_addr, admin, user) = setup_staking(&env);

    // Create LP token (different from reward token)
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // Create pool with LP token != reward token
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint and stake LP tokens
    mint_token(&env, &lp_token, &admin, &user, 100_0000000);
    client.stake(&user, &pool_id, &100_0000000);

    // Advance time
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 10,
        protocol_version: 25,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    // Try to compound - should fail because reward_token != lp_token
    let result = client.try_compound(&user, &pool_id);

    // compound() at line 322 requires reward_token == lp_token
    // Should fail for mismatched tokens
    assert!(
        result.is_err(),
        "Compound should fail when reward_token != lp_token"
    );
}

// ==================== MEDIUM: Small Stake Precision ====================

#[test]
fn test_small_stake_reward_precision() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, reward_token_client, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // Create pool with low reward rate
    let pool_id = client.create_pool(&admin, &lp_token, &10, &0, &FAR_FUTURE_TIME); // 10 per second

    // Stake tiny amount (1 stroop = 0.0000001 token)
    mint_token(&env, &lp_token, &admin, &user, 1000);
    client.stake(&user, &pool_id, &100);

    // Advance time
    env.ledger().set(LedgerInfo {
        timestamp: env.ledger().timestamp() + 10,
        protocol_version: 25,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 16,
        min_persistent_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    // Check pending rewards
    let pending = client.pending_rewards(&user, &pool_id);

    // Due to REWARD_PRECISION division, very small stakes may get 0 or minimal rewards
    // This is acceptable behavior (precision loss is inevitable with small amounts)

    // Claim rewards
    if pending > 0 {
        client.claim_rewards(&user, &pool_id);
        let reward_balance = reward_token_client.balance(&user);
        assert_eq!(reward_balance, pending, "Claimed amount should match pending");
    }

    // Document that small stakes may have precision loss
    // This is not a bug, but expected behavior with integer math
}

// ==================== Access Control ====================

#[test]
fn test_non_admin_cannot_create_pool() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    // Non-admin tries to create pool
    let result = client.try_create_pool(&user, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    assert!(
        result.is_err(),
        "Non-admin should not be able to create pool"
    );
}

#[test]
fn test_non_admin_cannot_update_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Non-admin tries to update pool rewards
    let result = client.try_update_pool_rewards(&user, &pool_id, &2000);

    assert!(
        result.is_err(),
        "Non-admin should not be able to update pool rewards"
    );
}

// ==================== Paused State ====================

#[test]
fn test_stake_when_paused_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    client.fund_rewards(&admin, &10_000_0000000);
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000);

    // Pause contract
    client.set_paused(&admin, &true);

    // Try to stake when paused
    let result = client.try_stake(&user, &pool_id, &100_0000000);

    assert!(result.is_err(), "Stake should fail when contract is paused");
}

#[test]
fn test_unstake_when_paused_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    client.fund_rewards(&admin, &10_000_0000000);
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000);

    // Stake first
    client.stake(&user, &pool_id, &100_0000000);

    // Pause contract
    client.set_paused(&admin, &true);

    // Unstake should still work when paused (users can always withdraw)
    let result = client.try_unstake(&user, &pool_id, &50_0000000);

    assert!(
        result.is_ok(),
        "Unstake should succeed even when paused (emergency exit)"
    );
}
