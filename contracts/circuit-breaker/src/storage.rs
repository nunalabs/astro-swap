//! Storage module for Circuit Breaker contract

use astroswap_shared::AstroSwapError;
use soroban_sdk::{contracttype, Address, Env};

use crate::PausableContract;

/// Storage keys for the circuit breaker contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage
    Admin,
    Initialized,
    GlobalPaused,
    PausedAt,
    UnpauseScheduledAt,
    TimelockDelay,
    GuardianCount,
    PausableCount,

    // Persistent storage
    Guardian(u32),
    PausableContract(u32),
}

// ==================== Instance Storage ====================

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
pub fn get_admin(env: &Env) -> Result<Address, AstroSwapError> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Admin)
        .ok_or(AstroSwapError::NotInitialized)
}

/// Set the admin address
pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

/// Check if globally paused
pub fn is_global_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::GlobalPaused)
        .unwrap_or(false)
}

/// Set global paused state
pub fn set_global_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::GlobalPaused, &paused);
}

/// Get timestamp when pause was activated
pub fn get_paused_at(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::PausedAt)
        .unwrap_or(0)
}

/// Set timestamp when pause was activated
pub fn set_paused_at(env: &Env, timestamp: u64) {
    env.storage().instance().set(&DataKey::PausedAt, &timestamp);
}

/// Get scheduled unpause timestamp
pub fn get_unpause_scheduled_at(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::UnpauseScheduledAt)
        .unwrap_or(0)
}

/// Set scheduled unpause timestamp
pub fn set_unpause_scheduled_at(env: &Env, timestamp: u64) {
    env.storage()
        .instance()
        .set(&DataKey::UnpauseScheduledAt, &timestamp);
}

/// Get timelock delay
pub fn get_timelock_delay(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get::<DataKey, u64>(&DataKey::TimelockDelay)
        .unwrap_or(3600) // Default 1 hour
}

/// Set timelock delay
pub fn set_timelock_delay(env: &Env, delay: u64) {
    env.storage()
        .instance()
        .set(&DataKey::TimelockDelay, &delay);
}

/// Get guardian count
pub fn get_guardian_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::GuardianCount)
        .unwrap_or(0)
}

/// Set guardian count
pub fn set_guardian_count(env: &Env, count: u32) {
    env.storage()
        .instance()
        .set(&DataKey::GuardianCount, &count);
}

/// Get pausable contract count
pub fn get_pausable_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::PausableCount)
        .unwrap_or(0)
}

/// Set pausable contract count
pub fn set_pausable_count(env: &Env, count: u32) {
    env.storage()
        .instance()
        .set(&DataKey::PausableCount, &count);
}

// ==================== Persistent Storage ====================

/// Get guardian address by index
pub fn get_guardian(env: &Env, index: u32) -> Option<Address> {
    env.storage()
        .persistent()
        .get::<DataKey, Address>(&DataKey::Guardian(index))
}

/// Set guardian address
pub fn set_guardian(env: &Env, index: u32, guardian: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Guardian(index), guardian);
}

/// Remove guardian
pub fn remove_guardian(env: &Env, index: u32) {
    env.storage()
        .persistent()
        .remove(&DataKey::Guardian(index));
}

/// Get pausable contract info by index
pub fn get_pausable_contract(env: &Env, index: u32) -> Option<PausableContract> {
    env.storage()
        .persistent()
        .get::<DataKey, PausableContract>(&DataKey::PausableContract(index))
}

/// Set pausable contract info
pub fn set_pausable_contract(env: &Env, index: u32, contract: &PausableContract) {
    env.storage()
        .persistent()
        .set(&DataKey::PausableContract(index), contract);
}

/// Remove pausable contract
pub fn remove_pausable_contract(env: &Env, index: u32) {
    env.storage()
        .persistent()
        .remove(&DataKey::PausableContract(index));
}

// ==================== TTL Management ====================

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}
