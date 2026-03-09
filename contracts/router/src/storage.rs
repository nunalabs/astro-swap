use astroswap_shared::AstroSwapError;
use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the router contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Factory,
    Admin,
    Initialized,
    Locked, // FIX #M5: Reentrancy lock for multi-hop swap protection
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

/// Get the factory address
/// Returns error if factory is not set (contract not initialized)
pub fn get_factory(env: &Env) -> Result<Address, AstroSwapError> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Factory)
        .ok_or(AstroSwapError::NotInitialized)
}

/// Set the factory address
pub fn set_factory(env: &Env, factory: &Address) {
    env.storage().instance().set(&DataKey::Factory, factory);
}

/// Get the admin address
/// Returns error if admin is not set (contract not initialized)
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

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

// ==================== Reentrancy Protection (FIX #M5) ====================

/// Check if the contract is locked (reentrancy protection)
pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Locked)
        .unwrap_or(false)
}

/// Set the reentrancy lock state
pub fn set_locked(env: &Env, locked: bool) {
    env.storage().instance().set(&DataKey::Locked, &locked);
}
