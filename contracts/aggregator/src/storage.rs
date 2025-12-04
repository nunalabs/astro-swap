//! Storage module for AstroSwap Aggregator
//!
//! Manages protocol adapters, routing configuration, and contract state.

use soroban_sdk::{contracttype, Address, Env};

/// Protocol adapter information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolAdapter {
    /// Protocol ID (matches Protocol enum)
    pub protocol_id: u32,
    /// Factory or router address for this protocol
    pub factory_address: Address,
    /// Whether this protocol is active
    pub is_active: bool,
    /// Default fee in basis points (for estimation)
    pub default_fee_bps: u32,
}

/// Aggregator configuration
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AggregatorConfig {
    /// Maximum number of hops in a route
    pub max_hops: u32,
    /// Maximum split paths for a single swap
    pub max_splits: u32,
    /// Fee charged by aggregator in basis points
    pub aggregator_fee_bps: u32,
}

/// Storage keys for the aggregator contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage
    Admin,
    Initialized,
    Paused,
    Locked, // Reentrancy lock for extra security
    Config,
    ProtocolCount,

    // Persistent storage
    Protocol(u32), // Protocol adapter by ID
    FeeRecipient,  // Address to receive aggregator fees
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

/// Check if the contract is locked (reentrancy protection)
pub fn is_locked(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<DataKey, bool>(&DataKey::Locked)
        .unwrap_or(false)
}

/// Set the lock state
pub fn set_locked(env: &Env, locked: bool) {
    env.storage().instance().set(&DataKey::Locked, &locked);
}

/// Get aggregator configuration
pub fn get_config(env: &Env) -> AggregatorConfig {
    env.storage()
        .instance()
        .get::<DataKey, AggregatorConfig>(&DataKey::Config)
        .unwrap_or(AggregatorConfig {
            max_hops: 3,
            max_splits: 2,
            aggregator_fee_bps: 5, // 0.05% aggregator fee
        })
}

/// Set aggregator configuration
pub fn set_config(env: &Env, config: &AggregatorConfig) {
    env.storage().instance().set(&DataKey::Config, config);
}

/// Get total number of registered protocols
pub fn get_protocol_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::ProtocolCount)
        .unwrap_or(0)
}

/// Set protocol count
pub fn set_protocol_count(env: &Env, count: u32) {
    env.storage()
        .instance()
        .set(&DataKey::ProtocolCount, &count);
}

// ==================== Protocol Storage ====================

/// Get a protocol adapter by ID
pub fn get_protocol(env: &Env, protocol_id: u32) -> Option<ProtocolAdapter> {
    env.storage()
        .persistent()
        .get::<DataKey, ProtocolAdapter>(&DataKey::Protocol(protocol_id))
}

/// Set a protocol adapter
pub fn set_protocol(env: &Env, protocol_id: u32, adapter: &ProtocolAdapter) {
    env.storage()
        .persistent()
        .set(&DataKey::Protocol(protocol_id), adapter);
}

/// Check if a protocol exists
#[allow(dead_code)]
pub fn protocol_exists(env: &Env, protocol_id: u32) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::Protocol(protocol_id))
}

/// Remove a protocol adapter
#[allow(dead_code)]
pub fn remove_protocol(env: &Env, protocol_id: u32) {
    env.storage()
        .persistent()
        .remove(&DataKey::Protocol(protocol_id));
}

// ==================== Fee Recipient ====================

/// Get fee recipient address
pub fn get_fee_recipient(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::FeeRecipient)
}

/// Set fee recipient address
pub fn set_fee_recipient(env: &Env, recipient: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::FeeRecipient, recipient);
}

// ==================== TTL Management ====================

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

/// Extend TTL for protocol storage
#[allow(dead_code)]
pub fn extend_protocol_ttl(env: &Env, protocol_id: u32) {
    let max_ttl = env.storage().max_ttl();
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::Protocol(protocol_id), max_ttl - 1000, max_ttl);
}
