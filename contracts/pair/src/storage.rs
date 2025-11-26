use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the pair contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage (small, global config)
    Factory,
    Token0,
    Token1,
    Reserve0,
    Reserve1,
    TotalSupply,
    KLast, // k = reserve0 * reserve1, for protocol fee calculation
    FeeBps,
    Initialized,
    Locked, // Reentrancy lock for extra security

    // Persistent storage (user data)
    Balance(Address),
    Allowance(Address, Address),
}

// ==================== Reentrancy Lock ====================

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
pub fn get_factory(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Factory)
        .expect("Factory not set")
}

/// Set the factory address
pub fn set_factory(env: &Env, factory: &Address) {
    env.storage().instance().set(&DataKey::Factory, factory);
}

/// Get token 0 address
pub fn get_token_0(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Token0)
        .expect("Token0 not set")
}

/// Set token 0 address
pub fn set_token_0(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::Token0, token);
}

/// Get token 1 address
pub fn get_token_1(env: &Env) -> Address {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::Token1)
        .expect("Token1 not set")
}

/// Set token 1 address
pub fn set_token_1(env: &Env, token: &Address) {
    env.storage().instance().set(&DataKey::Token1, token);
}

/// Get reserve 0
pub fn get_reserve_0(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::Reserve0)
        .unwrap_or(0)
}

/// Set reserve 0
pub fn set_reserve_0(env: &Env, reserve: i128) {
    env.storage().instance().set(&DataKey::Reserve0, &reserve);
}

/// Get reserve 1
pub fn get_reserve_1(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::Reserve1)
        .unwrap_or(0)
}

/// Set reserve 1
pub fn set_reserve_1(env: &Env, reserve: i128) {
    env.storage().instance().set(&DataKey::Reserve1, &reserve);
}

/// Get reserves (both at once)
pub fn get_reserves(env: &Env) -> (i128, i128) {
    (get_reserve_0(env), get_reserve_1(env))
}

/// Set reserves (both at once)
pub fn set_reserves(env: &Env, reserve_0: i128, reserve_1: i128) {
    set_reserve_0(env, reserve_0);
    set_reserve_1(env, reserve_1);
}

/// Get total supply of LP tokens
pub fn get_total_supply(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::TotalSupply)
        .unwrap_or(0)
}

/// Set total supply of LP tokens
pub fn set_total_supply(env: &Env, supply: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &supply);
}

/// Get k_last (for protocol fee calculation)
pub fn get_k_last(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get::<DataKey, i128>(&DataKey::KLast)
        .unwrap_or(0)
}

/// Set k_last
pub fn set_k_last(env: &Env, k: i128) {
    env.storage().instance().set(&DataKey::KLast, &k);
}

/// Get fee in basis points
pub fn get_fee_bps(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::FeeBps)
        .unwrap_or(30) // Default 0.3%
}

/// Set fee in basis points
pub fn set_fee_bps(env: &Env, fee: u32) {
    env.storage().instance().set(&DataKey::FeeBps, &fee);
}

// ==================== LP Token Storage ====================

/// Get LP token balance for an address
pub fn get_balance(env: &Env, address: &Address) -> i128 {
    env.storage()
        .persistent()
        .get::<DataKey, i128>(&DataKey::Balance(address.clone()))
        .unwrap_or(0)
}

/// Set LP token balance for an address
pub fn set_balance(env: &Env, address: &Address, balance: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(address.clone()), &balance);
}

/// Get allowance for spender from owner
pub fn get_allowance(env: &Env, owner: &Address, spender: &Address) -> i128 {
    env.storage()
        .persistent()
        .get::<DataKey, i128>(&DataKey::Allowance(owner.clone(), spender.clone()))
        .unwrap_or(0)
}

/// Set allowance for spender from owner
pub fn set_allowance(env: &Env, owner: &Address, spender: &Address, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Allowance(owner.clone(), spender.clone()), &amount);
}

// ==================== TTL Management ====================

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

/// Extend TTL for a user's balance
pub fn extend_balance_ttl(env: &Env, address: &Address) {
    let max_ttl = env.storage().max_ttl();
    env.storage().persistent().extend_ttl(
        &DataKey::Balance(address.clone()),
        max_ttl - 1000,
        max_ttl,
    );
}
