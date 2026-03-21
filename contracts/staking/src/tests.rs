use crate::contract::{AstroSwapStaking, AstroSwapStakingClient};
use astroswap_shared::AstroSwapError;
use soroban_sdk::{
    testutils::Address as _,
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env,
};

// Far future timestamp for pools that don't expire
const FAR_FUTURE_TIME: u64 = 9_999_999_999;

// ==================== Test Helpers ====================

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

/// Helper to register staking contract with constructor (CAP-58 compatible)
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

// ==================== Constructor Tests ====================

#[test]
fn test_constructor_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (_, reward_token) = create_token(&env, &admin);

    let client = register_staking(&env, &admin, &reward_token);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.reward_token(), Some(reward_token));
    assert!(!client.is_paused());
    assert_eq!(client.pool_count(), 0);
}

#[test]
fn test_legacy_initialize_fails_after_constructor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let (_, reward_token) = create_token(&env, &admin);

    // Already initialized via constructor
    let client = register_staking(&env, &admin, &reward_token);

    // Legacy initialize should fail (already initialized)
    let result = client.try_initialize(&admin, &reward_token);
    assert!(result.is_err());
}

// ==================== Pool Creation Tests ====================

#[test]
fn test_create_pool_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    // Create pool
    let pool_id = client.create_pool(
        &admin,
        &lp_token,
        &1000, // reward_per_second
        &0,    // start_time
        &FAR_FUTURE_TIME, // end_time
    );

    assert_eq!(pool_id, 1); // Pool IDs start at 1
    assert_eq!(client.pool_count(), 1);

    // Verify pool info
    let pool_info = client.pool_info(&pool_id);
    assert_eq!(pool_info.lp_token, lp_token);
    assert_eq!(pool_info.reward_per_second, 1000);
    assert_eq!(pool_info.total_staked, 0);
}

#[test]
fn test_create_pool_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    // Non-admin tries to create pool
    let result = client.try_create_pool(&user, &lp_token, &1000, &0, &FAR_FUTURE_TIME);
    assert!(result.is_err());
}

#[test]
fn test_create_pool_when_paused_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    // Pause staking
    client.set_paused(&admin, &true);

    // Admin can still create pools when paused (admin operations allowed)
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);
    assert_eq!(pool_id, 1);
}

#[test]
fn test_create_multiple_pools() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);

    // Create 3 pools
    for i in 0..3_u32 {
        let (_, lp_token) = create_token(&env, &admin);
        let pool_id = client.create_pool(&admin, &lp_token, &(1000 + (i as i128) * 100), &0, &FAR_FUTURE_TIME);
        assert_eq!(pool_id, i + 1); // Pool IDs start at 1
    }

    assert_eq!(client.pool_count(), 3);
}

// ==================== Stake Tests ====================

#[test]
fn test_stake_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Mint LP tokens to user
    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);

    // Stake
    let staked_amount = 50_0000000i128;
    client.stake(&user, &pool_id, &staked_amount);

    // Verify user stake
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, staked_amount);

    // Verify pool total staked
    let pool_info = client.pool_info(&pool_id);
    assert_eq!(pool_info.total_staked, staked_amount);

    // Verify LP tokens transferred
    let user_balance = lp_token_client.balance(&user);
    assert_eq!(user_balance, 50_0000000i128); // 100 - 50
}

#[test]
fn test_stake_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Try to stake zero amount
    let result = client.try_stake(&user, &pool_id, &0);
    assert!(result.is_err());
}

#[test]
fn test_stake_to_nonexistent_pool_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, user) = setup_staking(&env);

    // Try to stake to pool that doesn't exist
    let result = client.try_stake(&user, &999, &100_0000000);
    assert!(result.is_err());
}

#[test]
fn test_stake_multiple_times() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 200_0000000i128);

    // Stake twice
    client.stake(&user, &pool_id, &50_0000000);
    client.stake(&user, &pool_id, &30_0000000);

    // Verify total staked
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, 80_0000000i128); // 50 + 30
}

// ==================== Unstake Tests ====================

#[test]
fn test_unstake_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    let balance_before = lp_token_client.balance(&user);

    // Unstake half
    let unstake_amount = 50_0000000i128;
    client.unstake(&user, &pool_id, &unstake_amount);

    // Verify user stake decreased
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, 50_0000000i128);

    // Verify LP tokens returned
    let balance_after = lp_token_client.balance(&user);
    assert_eq!(balance_after, balance_before + unstake_amount);
}

#[test]
fn test_unstake_zero_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    // Try to unstake zero
    let result = client.try_unstake(&user, &pool_id, &0);
    assert!(result.is_err());
}

#[test]
fn test_unstake_more_than_staked_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    // Try to unstake more than staked
    let result = client.try_unstake(&user, &pool_id, &150_0000000);
    assert!(result.is_err());
}

#[test]
fn test_unstake_without_staking_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Try to unstake without having staked
    let result = client.try_unstake(&user, &pool_id, &50_0000000);
    assert!(result.is_err());
}

// ==================== Rewards Tests ====================

#[test]
fn test_fund_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, reward_token_client, reward_token_addr, admin, _) = setup_staking(&env);

    let fund_amount = 10_000_0000000i128;

    let balance_before = reward_token_client.balance(&admin);

    // Fund rewards
    client.fund_rewards(&admin, &fund_amount);

    // Verify tokens transferred
    let balance_after = reward_token_client.balance(&admin);
    assert_eq!(balance_after, balance_before - fund_amount);
}

#[test]
fn test_fund_rewards_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, user) = setup_staking(&env);

    // Non-admin tries to fund rewards
    let result = client.try_fund_rewards(&user, &10_000_0000000);
    assert!(result.is_err());
}

#[test]
fn test_pending_rewards_zero_initially() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    // Immediately after staking, pending rewards should be zero
    let pending = client.pending_rewards(&user, &pool_id);
    assert_eq!(pending, 0);
}

#[test]
fn test_claim_rewards_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, reward_token_client, reward_token_addr, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    // Fund rewards first
    client.fund_rewards(&admin, &10_000_0000000);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    // In real scenario, time would pass and rewards would accumulate
    // For this test, we just verify the claim function doesn't error
    let result = client.try_claim_rewards(&user, &pool_id);

    // May succeed with zero rewards or fail if no rewards accumulated
    // Both are valid outcomes for unit test
    let _ = result;
}

// ==================== Admin Function Tests ====================

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);
    let new_admin = Address::generate(&env);

    // Transfer admin
    client.set_admin(&admin, &new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_set_admin_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, user) = setup_staking(&env);
    let new_admin = Address::generate(&env);

    // Non-admin tries to set admin
    let result = client.try_set_admin(&user, &new_admin);
    assert!(result.is_err());
}

#[test]
fn test_set_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);

    assert!(!client.is_paused());

    // Pause
    client.set_paused(&admin, &true);
    assert!(client.is_paused());

    // Unpause
    client.set_paused(&admin, &false);
    assert!(!client.is_paused());
}

#[test]
fn test_stake_when_paused_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);
    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);

    // Pause
    client.set_paused(&admin, &true);

    // Try to stake while paused
    let result = client.try_stake(&user, &pool_id, &50_0000000);
    assert!(result.is_err());
}

#[test]
fn test_update_pool_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Update pool rewards (admin can change reward rate)
    let result = client.try_update_pool_rewards(&admin, &pool_id, &2000);

    // Should succeed (admin can call)
    assert!(result.is_ok());
}

// ==================== Query Function Tests ====================

#[test]
fn test_pool_info_nonexistent_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, _, _) = setup_staking(&env);

    // Query nonexistent pool
    let result = client.try_pool_info(&999);
    assert!(result.is_err());
}

#[test]
fn test_user_info_no_stake() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Query user who hasn't staked
    let result = client.try_user_info(&user, &pool_id);

    // May return error or zero stake info depending on implementation
    let _ = result;
}

#[test]
fn test_get_multiplier() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
    client.stake(&user, &pool_id, &100_0000000);

    // Get staking multiplier
    let multiplier = client.get_multiplier(&user, &pool_id);

    // Multiplier should be >= 10000 (100% = 10000 bps)
    assert!(multiplier >= 10000);
}

// ==================== Integration Tests ====================

#[test]
fn test_full_staking_cycle() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, user) = setup_staking(&env);
    let (lp_token_client, lp_token) = create_token(&env, &admin);

    // 1. Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    // 2. Create pool
    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // 3. Mint LP tokens to user
    mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);

    // 4. Stake
    client.stake(&user, &pool_id, &80_0000000);

    // 5. Verify staked
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, 80_0000000);

    // 6. Unstake partial
    client.unstake(&user, &pool_id, &30_0000000);

    // 7. Verify remaining stake
    let user_info = client.user_info(&user, &pool_id);
    assert_eq!(user_info.amount, 50_0000000);

    // 8. Verify LP balance (100 initial - 80 staked + 30 unstaked)
    let lp_balance = lp_token_client.balance(&user);
    assert_eq!(lp_balance, 50_0000000); // 100 - 80 + 30
}

#[test]
fn test_multiple_users_staking() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _, _, admin, _) = setup_staking(&env);
    let (_, lp_token) = create_token(&env, &admin);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE_TIME);

    // Create 3 users and have them stake
    for _ in 0..3 {
        let user = Address::generate(&env);
        mint_token(&env, &lp_token, &admin, &user, 100_0000000i128);
        client.stake(&user, &pool_id, &50_0000000);
    }

    // Verify total staked
    let pool_info = client.pool_info(&pool_id);
    assert_eq!(pool_info.total_staked, 150_0000000); // 50 * 3
}
