//! Storage module for AstroSwap Bridge
//!
//! Manages graduated token tracking and integration with Astro-Shiba launchpad.

use astroswap_shared::GraduatedToken;
use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the bridge contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage
    Admin,
    Initialized,
    Paused,
    Locked, // Reentrancy lock for graduation operations
    Factory,
    Staking,
    Launchpad,
    QuoteToken, // XLM or USDC address
    GraduationCount,

    // Persistent storage
    GraduatedToken(Address), // Token address -> GraduatedToken info
    GraduationIndex(u32),    // Index -> Token address (for enumeration)
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

/// Check if the contract is locked (reentrancy guard)
pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Locked)
        .unwrap_or(false)
}

/// Acquire reentrancy lock - returns error if already locked
pub fn acquire_lock(env: &Env) -> bool {
    if is_locked(env) {
        return false;
    }
    env.storage().instance().set(&DataKey::Locked, &true);
    true
}

/// Release reentrancy lock
pub fn release_lock(env: &Env) {
    env.storage().instance().set(&DataKey::Locked, &false);
}

/// Get factory address
pub fn get_factory(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Factory)
        .expect("Factory not set")
}

/// Set factory address
pub fn set_factory(env: &Env, factory: &Address) {
    env.storage().instance().set(&DataKey::Factory, factory);
}

/// Get staking address
pub fn get_staking(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Staking)
        .expect("Staking not set")
}

/// Set staking address
pub fn set_staking(env: &Env, staking: &Address) {
    env.storage().instance().set(&DataKey::Staking, staking);
}

/// Get launchpad address
pub fn get_launchpad(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Launchpad)
}

/// Set launchpad address
pub fn set_launchpad(env: &Env, launchpad: &Address) {
    env.storage().instance().set(&DataKey::Launchpad, launchpad);
}

/// Get quote token address (XLM wrapper or USDC)
pub fn get_quote_token(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::QuoteToken)
}

/// Set quote token address
pub fn set_quote_token(env: &Env, quote_token: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::QuoteToken, quote_token);
}

/// Get graduation count
pub fn get_graduation_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::GraduationCount)
        .unwrap_or(0)
}

/// Increment graduation count
pub fn increment_graduation_count(env: &Env) -> u32 {
    let count = get_graduation_count(env) + 1;
    env.storage()
        .instance()
        .set(&DataKey::GraduationCount, &count);
    count
}

// ==================== Graduated Token Storage ====================

/// Get graduated token info
pub fn get_graduated_token(env: &Env, token: &Address) -> Option<GraduatedToken> {
    env.storage()
        .persistent()
        .get::<DataKey, GraduatedToken>(&DataKey::GraduatedToken(token.clone()))
}

/// Set graduated token info
pub fn set_graduated_token(env: &Env, token: &Address, info: &GraduatedToken) {
    env.storage()
        .persistent()
        .set(&DataKey::GraduatedToken(token.clone()), info);
}

/// Check if token is graduated
pub fn is_token_graduated(env: &Env, token: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::GraduatedToken(token.clone()))
}

/// Store graduation index for enumeration
pub fn set_graduation_index(env: &Env, index: u32, token: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::GraduationIndex(index), token);
}

/// Get token by graduation index
pub fn get_graduation_by_index(env: &Env, index: u32) -> Option<Address> {
    env.storage()
        .persistent()
        .get::<DataKey, Address>(&DataKey::GraduationIndex(index))
}

// ==================== TTL Management ====================

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

/// Extend TTL for graduated token storage
pub fn extend_graduated_token_ttl(env: &Env, token: &Address) {
    let max_ttl = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(
        &DataKey::GraduatedToken(token.clone()),
        max_ttl - 1000,
        max_ttl,
    );
}
