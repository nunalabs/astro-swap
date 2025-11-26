use astroswap_shared::TokenMetadata;
use soroban_sdk::{contracttype, Address, BytesN, Env};

/// Storage keys for the factory contract
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // Instance storage (small, global config)
    Admin,
    FeeRecipient,
    ProtocolFeeBps,
    PairWasmHash,
    Initialized,
    Paused,
    PairsCount,
    LaunchpadAddress,

    // Persistent storage (unbounded)
    Pair(Address, Address),
    AllPairs(u32),
    GraduatedToken(Address),
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

/// Get the fee recipient address
pub fn get_fee_recipient(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::FeeRecipient)
}

/// Set the fee recipient address
pub fn set_fee_recipient(env: &Env, recipient: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::FeeRecipient, recipient);
}

/// Get the protocol fee in basis points
pub fn get_protocol_fee_bps(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::ProtocolFeeBps)
        .unwrap_or(30) // Default 0.3%
}

/// Set the protocol fee in basis points
pub fn set_protocol_fee_bps(env: &Env, fee_bps: u32) {
    env.storage()
        .instance()
        .set(&DataKey::ProtocolFeeBps, &fee_bps);
}

/// Get the pair contract WASM hash
pub fn get_pair_wasm_hash(env: &Env) -> BytesN<32> {
    env.storage()
        .instance()
        .get::<DataKey, BytesN<32>>(&DataKey::PairWasmHash)
        .expect("Pair WASM hash not set")
}

/// Set the pair contract WASM hash
pub fn set_pair_wasm_hash(env: &Env, hash: &BytesN<32>) {
    env.storage().instance().set(&DataKey::PairWasmHash, hash);
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

/// Get the total number of pairs
pub fn get_pairs_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get::<DataKey, u32>(&DataKey::PairsCount)
        .unwrap_or(0)
}

/// Increment pairs count and return new count
pub fn increment_pairs_count(env: &Env) -> u32 {
    let count = get_pairs_count(env) + 1;
    env.storage().instance().set(&DataKey::PairsCount, &count);
    count
}

/// Get the launchpad address (Astro-Shiba)
pub fn get_launchpad(env: &Env) -> Option<Address> {
    env.storage()
        .instance()
        .get::<DataKey, Address>(&DataKey::LaunchpadAddress)
}

/// Set the launchpad address
pub fn set_launchpad(env: &Env, launchpad: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::LaunchpadAddress, launchpad);
}

/// Sort two token addresses to ensure consistent ordering
pub fn sort_tokens(token_a: &Address, token_b: &Address) -> (Address, Address) {
    if token_a < token_b {
        (token_a.clone(), token_b.clone())
    } else {
        (token_b.clone(), token_a.clone())
    }
}

/// Get pair address for two tokens
pub fn get_pair(env: &Env, token_a: &Address, token_b: &Address) -> Option<Address> {
    let (token_0, token_1) = sort_tokens(token_a, token_b);
    env.storage()
        .persistent()
        .get::<DataKey, Address>(&DataKey::Pair(token_0, token_1))
}

/// Set pair address for two tokens
pub fn set_pair(env: &Env, token_a: &Address, token_b: &Address, pair: &Address) {
    let (token_0, token_1) = sort_tokens(token_a, token_b);
    env.storage()
        .persistent()
        .set(&DataKey::Pair(token_0, token_1), pair);
}

/// Get pair by index
pub fn get_pair_by_index(env: &Env, index: u32) -> Option<Address> {
    env.storage()
        .persistent()
        .get::<DataKey, Address>(&DataKey::AllPairs(index))
}

/// Add pair to index list
pub fn add_pair_to_list(env: &Env, pair: &Address, index: u32) {
    env.storage()
        .persistent()
        .set(&DataKey::AllPairs(index), pair);
}

/// Information about a graduated token
#[contracttype]
#[derive(Clone)]
pub struct GraduatedTokenInfo {
    pub token: Address,
    pub pair: Address,
    pub metadata: TokenMetadata,
    pub graduation_time: u64,
}

/// Check if a token has graduated
pub fn is_token_graduated(env: &Env, token: &Address) -> bool {
    env.storage()
        .persistent()
        .has(&DataKey::GraduatedToken(token.clone()))
}

/// Get graduated token info
#[allow(dead_code)]
pub fn get_graduated_token(env: &Env, token: &Address) -> Option<GraduatedTokenInfo> {
    env.storage()
        .persistent()
        .get::<DataKey, GraduatedTokenInfo>(&DataKey::GraduatedToken(token.clone()))
}

/// Set graduated token info
pub fn set_graduated_token(env: &Env, token: &Address, info: &GraduatedTokenInfo) {
    env.storage()
        .persistent()
        .set(&DataKey::GraduatedToken(token.clone()), info);
}

/// Extend TTL for instance storage
pub fn extend_instance_ttl(env: &Env) {
    let max_ttl = env.storage().max_ttl();
    env.storage().instance().extend_ttl(max_ttl - 1000, max_ttl);
}

/// Extend TTL for persistent storage
#[allow(dead_code)]
pub fn extend_persistent_ttl(env: &Env, key: &DataKey) {
    let max_ttl = env.storage().max_ttl();
    env.storage()
        .persistent()
        .extend_ttl(key, max_ttl - 1000, max_ttl);
}
