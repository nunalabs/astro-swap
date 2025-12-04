use astroswap_shared::{StakingPool, UserStake};
use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the staking contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage
    Admin,
    Initialized,
    Paused,
    Locked, // Reentrancy guard
    PoolCount,
    RewardToken,

    // Persistent storage
    Pool(u32),
    UserStake(Address, u32),
    UserRewardDebt(Address, u32),
}

/// Check if the contract is initialized
pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Initialized)
        .unwrap_or(false)
}

/// Set initialized flag
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::Initialized, &true);
}

/// Get the admin address
pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Admin)
        .expect("Admin not set")
}

/// Set the admin address
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

/// Check if the contract is paused
pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Paused)
        .unwrap_or(false)
}

/// Set paused state
pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

/// Check if contract is locked (reentrancy guard)
pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Locked)
        .unwrap_or(false)
}

/// Set lock state (reentrancy guard)
pub fn set_locked(env: &Env, locked: bool) {
    env.storage().instance().set(&DataKey::Locked, &locked);
}

/// Get the total number of pools
pub fn get_pool_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::PoolCount)
        .unwrap_or(0)
}

/// Increment pool count and return new count
pub fn increment_pool_count(env: &Env) -> u32 {
    let count = get_pool_count(env) + 1;
    env.storage().instance().set(&DataKey::PoolCount, &count);
    count
}

/// Get the global reward token
pub fn get_reward_token(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::RewardToken)
}

/// Set the global reward token
pub fn set_reward_token(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::RewardToken, token);
}

// ==================== Pool Storage ====================

/// Get a staking pool by ID
pub fn get_pool(env: &Env, pool_id: u32) -> Option<StakingPool> {
    env.storage()
        .persistent()
        .get::<DataKey, StakingPool>(&DataKey::Pool(pool_id))
}

/// Set a staking pool
pub fn set_pool(env: &Env, pool_id: u32, pool: &StakingPool) {
    env.storage()
        .persistent()
        .set(&DataKey::Pool(pool_id), pool);
}

/// Check if a pool exists
#[allow(dead_code)]
pub fn pool_exists(env: &Env, pool_id: u32) -> bool {
    env.storage().persistent().has(&DataKey::Pool(pool_id))
}

// ==================== User Stake Storage ====================

/// Get user's stake in a pool
pub fn get_user_stake(env: &Env, user: &Address, pool_id: u32) -> Option<UserStake> {
    env.storage()
        .persistent()
        .get::<DataKey, UserStake>(&DataKey::UserStake(user.clone(), pool_id))
}

/// Set user's stake in a pool
pub fn set_user_stake(env: &Env, user: &Address, pool_id: u32, stake: &UserStake) {
    env.storage()
        .persistent()
        .set(&DataKey::UserStake(user.clone(), pool_id), stake);
}

/// Remove user's stake
#[allow(dead_code)]
pub fn remove_user_stake(env: &Env, user: &Address, pool_id: u32) {
    env.storage()
        .persistent()
        .remove(&DataKey::UserStake(user.clone(), pool_id));
}

/// Get user's reward debt
#[allow(dead_code)]
pub fn get_user_reward_debt(env: &Env, user: &Address, pool_id: u32) -> i128 {
    env.storage()
        .persistent()
        .get::<DataKey, i128>(&DataKey::UserRewardDebt(user.clone(), pool_id))
        .unwrap_or(0)
}

/// Set user's reward debt
#[allow(dead_code)]
pub fn set_user_reward_debt(env: &Env, user: &Address, pool_id: u32, debt: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::UserRewardDebt(user.clone(), pool_id), &debt);
}

// ==================== TTL Management ====================

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

/// Extend TTL for pool storage
pub fn extend_pool_ttl(env: &Env, pool_id: u32) {
    let max_ttl = env.storage().max_ttl();
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Pool(pool_id), max_ttl - 1000, max_ttl);
}

/// Extend TTL for user stake storage
pub fn extend_user_stake_ttl(env: &Env, user: &Address, pool_id: u32) {
    let max_ttl = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(
        &DataKey::UserStake(user.clone(), pool_id),
        max_ttl - 1000,
        max_ttl,
    );
}
