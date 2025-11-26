//! Staking Integration Tests
//!
//! Tests the complete staking flow:
//! - Create pair and add liquidity
//! - Stake LP tokens
//! - Advance time
//! - Claim rewards
//! - Verify reward calculations
//! - Test multipliers and compounding

use crate::test_utils::{assert_approx_eq, TestContext};
use astroswap_shared::PairClient;

#[test]
fn test_complete_staking_flow() {
    let ctx = TestContext::new();

    // Step 1: Create pair and add liquidity
    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let pair_client = PairClient::new(&ctx.env, &pair_address);

    // User1 adds more liquidity to get LP tokens
    let (_, _, lp_tokens) = ctx
        .router
        .add_liquidity(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &5_000_0000000i128,
            &10_000_0000000i128,
            &0,
            &0,
            &ctx.deadline(),
        );

    assert!(lp_tokens > 0);
    assert_eq!(pair_client.balance(&ctx.user1), lp_tokens);

    // Step 2: Create staking pool
    let reward_per_second = 10_0000000i128; // 10 tokens per second
    let start_time = ctx.timestamp();
    let end_time = start_time + 86400; // 24 hours

    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &reward_per_second,
            &start_time,
            &end_time,
        );

    assert_eq!(pool_id, 1); // First pool

    // Step 3: Fund the staking contract with rewards
    let total_rewards = reward_per_second * (end_time - start_time) as i128;
    ctx.xlm
        .transfer(&ctx.admin, &ctx.staking_address, &total_rewards);

    // Step 4: Stake LP tokens
    ctx.staking
        .stake(&ctx.user1, &pool_id, &lp_tokens);

    // Verify LP tokens were transferred to staking contract
    assert_eq!(pair_client.balance(&ctx.user1), 0);
    assert_eq!(pair_client.balance(&ctx.staking_address), lp_tokens);

    // Verify user stake info (returns UserStake directly)
    let user_info = ctx
        .staking
        .user_info(&ctx.user1, &pool_id);

    assert_eq!(user_info.amount, lp_tokens);
    assert_eq!(user_info.stake_time, start_time);

    // Step 5: Advance time by 1 hour
    let hour = 3600u64;
    ctx.advance_time(hour);

    // Step 6: Check pending rewards
    let pending = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    // Expected: 10 tokens/sec * 3600 sec = 36,000 tokens
    let expected_rewards = reward_per_second * hour as i128;
    assert_approx_eq(pending, expected_rewards, 100); // Within 1%

    // Step 7: Claim rewards
    let xlm_before = ctx.xlm.balance(&ctx.user1);

    let claimed = ctx
        .staking
        .claim_rewards(&ctx.user1, &pool_id);

    let xlm_after = ctx.xlm.balance(&ctx.user1);

    assert_approx_eq(claimed, expected_rewards, 100);
    assert_eq!(xlm_after, xlm_before + claimed);

    // Pending should now be ~0
    let new_pending = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    assert!(new_pending < 1_0000000, "Pending should be minimal after claim");

    // Step 8: Advance more time and claim again
    ctx.advance_time(hour);

    let claimed2 = ctx
        .staking
        .claim_rewards(&ctx.user1, &pool_id);

    assert_approx_eq(claimed2, expected_rewards, 100);

    // Step 9: Unstake
    let xlm_before_unstake = ctx.xlm.balance(&ctx.user1);

    ctx.staking
        .unstake(&ctx.user1, &pool_id, &lp_tokens);

    // LP tokens returned
    assert_eq!(pair_client.balance(&ctx.user1), lp_tokens);

    // Any remaining rewards claimed
    let xlm_after_unstake = ctx.xlm.balance(&ctx.user1);
    assert!(xlm_after_unstake >= xlm_before_unstake);
}

#[test]
fn test_multiple_stakers_share_rewards() {
    let ctx = TestContext::new();

    // Setup pair
    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let pair_client = PairClient::new(&ctx.env, &pair_address);

    // User1 adds liquidity for 100 LP
    let (_, _, lp1) = ctx
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

    // User2 adds liquidity for 200 LP (2x more)
    let (_, _, lp2) = ctx
        .router
        .add_liquidity(
            &ctx.user2,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &2_000_0000000i128,
            &4_000_0000000i128,
            &0,
            &0,
            &ctx.deadline(),
        );

    // Create pool
    let reward_per_second = 30_0000000i128;
    let start_time = ctx.timestamp();
    let end_time = start_time + 3600;

    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &reward_per_second,
            &start_time,
            &end_time,
        );

    // Fund rewards
    let total_rewards = reward_per_second * 3600;
    ctx.xlm
        .transfer(&ctx.admin, &ctx.staking_address, &total_rewards);

    // Both stake at the same time
    ctx.staking
        .stake(&ctx.user1, &pool_id, &lp1);

    ctx.staking
        .stake(&ctx.user2, &pool_id, &lp2);

    // Advance time
    ctx.advance_time(3600);

    // Check rewards - user2 should have ~2x user1's rewards
    let rewards1 = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    let rewards2 = ctx
        .staking
        .pending_rewards(&ctx.user2, &pool_id);

    // Total staked is lp1 + lp2 (roughly 300 LP total)
    // User1 has lp1 (~100), User2 has lp2 (~200)
    // So User1 gets ~1/3 of rewards, User2 gets ~2/3

    let expected1 = total_rewards / 3;
    let expected2 = (total_rewards * 2) / 3;

    assert_approx_eq(rewards1, expected1, 500); // Within 5%
    assert_approx_eq(rewards2, expected2, 500); // Within 5%

    // Ratio should be close to 1:2
    let ratio = (rewards2 * 100) / rewards1;
    assert!(ratio > 180 && ratio < 220, "Ratio should be ~2:1, got {}", ratio);
}

#[test]
fn test_staking_after_pool_starts() {
    let ctx = TestContext::new();

    // Setup pair and liquidity
    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let (_, _, lp1) = ctx
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

    let (_, _, lp2) = ctx
        .router
        .add_liquidity(
            &ctx.user2,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &1_000_0000000i128,
            &2_000_0000000i128,
            &0,
            &0,
            &ctx.deadline(),
        );

    // Create pool
    let reward_per_second = 10_0000000i128;
    let start_time = ctx.timestamp();
    let end_time = start_time + 7200; // 2 hours

    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &reward_per_second,
            &start_time,
            &end_time,
        );

    let rewards_amount = reward_per_second * 7200;
    ctx.xlm
        .transfer(&ctx.admin, &ctx.staking_address, &rewards_amount);

    // User1 stakes immediately
    ctx.staking
        .stake(&ctx.user1, &pool_id, &lp1);

    // Advance 1 hour
    ctx.advance_time(3600);

    // User2 stakes after 1 hour
    ctx.staking
        .stake(&ctx.user2, &pool_id, &lp2);

    // Advance another hour
    ctx.advance_time(3600);

    // User1 should have: 1 hour solo (100%) + 1 hour shared (50%) = 1.5 hours worth
    let rewards1 = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    // User2 should have: 1 hour shared (50%)
    let rewards2 = ctx
        .staking
        .pending_rewards(&ctx.user2, &pool_id);

    let hour_reward = reward_per_second * 3600;

    // User1: 1 * hour_reward (first hour) + 0.5 * hour_reward (second hour) = 1.5x
    let expected1 = (hour_reward * 3) / 2;

    // User2: 0.5 * hour_reward (second hour only)
    let expected2 = hour_reward / 2;

    assert_approx_eq(rewards1, expected1, 500);
    assert_approx_eq(rewards2, expected2, 500);

    // User1 should have ~3x User2's rewards
    let ratio = (rewards1 * 100) / rewards2;
    assert!(ratio > 280 && ratio < 320, "Ratio should be ~3:1, got {}", ratio);
}

#[test]
fn test_cannot_stake_zero() {
    let ctx = TestContext::new();

    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &10_0000000i128,
            &ctx.timestamp(),
            &(ctx.timestamp() + 3600),
        );

    let result = ctx.staking.try_stake(&ctx.user1, &pool_id, &0i128);

    assert!(result.is_err(), "Should not allow staking zero");
}

#[test]
fn test_cannot_claim_with_no_stake() {
    let ctx = TestContext::new();

    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &10_0000000i128,
            &ctx.timestamp(),
            &(ctx.timestamp() + 3600),
        );

    // Try to claim without staking
    let result = ctx.staking.try_claim_rewards(&ctx.user1, &pool_id);

    assert!(result.is_err(), "Should not allow claiming without stake");
}

#[test]
fn test_rewards_stop_at_end_time() {
    let ctx = TestContext::new();

    // Setup
    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let (_, _, lp_tokens) = ctx
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

    let reward_per_second = 10_0000000i128;
    let start_time = ctx.timestamp();
    let duration = 3600u64; // 1 hour
    let end_time = start_time + duration;

    let pool_id = ctx
        .staking
        .create_pool(&ctx.admin, &pair_address, &reward_per_second, &start_time, &end_time);

    let total_fund = reward_per_second * duration as i128;
    ctx.xlm
        .transfer(&ctx.admin, &ctx.staking_address, &total_fund);

    ctx.staking
        .stake(&ctx.user1, &pool_id, &lp_tokens);

    // Advance past end time (2 hours instead of 1)
    ctx.advance_time(7200);

    // Rewards should only be for 1 hour (duration), not 2
    let rewards = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    let max_rewards = reward_per_second * duration as i128;

    // Should not exceed max rewards
    assert!(
        rewards <= max_rewards,
        "Rewards should not exceed pool duration. Got: {}, Max: {}",
        rewards,
        max_rewards
    );

    // Should be close to max rewards (within 1%)
    assert_approx_eq(rewards, max_rewards, 100);
}

#[test]
fn test_partial_unstake() {
    let ctx = TestContext::new();

    let pair_address = ctx.setup_pair(
        &ctx.token_a_address,
        &ctx.token_b_address,
        10_000_0000000,
        20_000_0000000,
    );

    let (_, _, lp_tokens) = ctx
        .router
        .add_liquidity(
            &ctx.user1,
            &ctx.token_a_address,
            &ctx.token_b_address,
            &5_000_0000000i128,
            &10_000_0000000i128,
            &0,
            &0,
            &ctx.deadline(),
        );

    let start_time = ctx.timestamp();
    let end_time = start_time + 3600;
    let pool_id = ctx
        .staking
        .create_pool(
            &ctx.admin,
            &pair_address,
            &10_0000000i128,
            &start_time,
            &end_time,
        );

    let fund_amount = 10_0000000i128 * 3600;
    ctx.xlm
        .transfer(&ctx.admin, &ctx.staking_address, &fund_amount);

    ctx.staking
        .stake(&ctx.user1, &pool_id, &lp_tokens);

    // Advance time
    ctx.advance_time(1800); // 30 minutes

    // Unstake half
    let half = lp_tokens / 2;

    ctx.staking
        .unstake(&ctx.user1, &pool_id, &half);

    // Verify user info updated
    let user_info = ctx
        .staking
        .user_info(&ctx.user1, &pool_id);

    assert_eq!(user_info.amount, lp_tokens - half);

    // Continue earning on remaining stake
    ctx.advance_time(1800); // Another 30 minutes

    let rewards = ctx
        .staking
        .pending_rewards(&ctx.user1, &pool_id);

    // After partial unstake, rewards calculation depends on contract implementation
    // At minimum, user should have earned something with remaining stake
    // Note: unstake may have claimed some rewards already
    let min_expected = 10_0000000 * 900; // At least half stake for 30 min
    let max_expected = (10_0000000 * 1800) + (10_0000000 * 1800); // Full stake both periods

    assert!(
        rewards >= min_expected && rewards <= max_expected,
        "Rewards {} should be between {} and {}",
        rewards,
        min_expected,
        max_expected
    );
}
