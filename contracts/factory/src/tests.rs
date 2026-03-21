use crate::contract::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_shared::TokenMetadata;
use soroban_sdk::{
    testutils::Address as _,
    token::Client as TokenClient,
    Address, BytesN, Env, String, Vec,
};

// ==================== Test Helpers ====================

/// Helper to create a test token
fn create_token<'a>(env: &Env, admin: &Address) -> (TokenClient<'a>, Address) {
    let addr = env.register_stellar_asset_contract_v2(admin.clone());
    let client = TokenClient::new(env, &addr.address());
    (client, addr.address())
}

/// Helper to register factory with constructor (CAP-58 compatible)
fn register_factory<'a>(
    env: &'a Env,
    admin: &Address,
    pair_wasm_hash: &BytesN<32>,
    protocol_fee_bps: u32,
) -> AstroSwapFactoryClient<'a> {
    let factory_addr = env.register(
        AstroSwapFactory,
        (admin.clone(), pair_wasm_hash.clone(), protocol_fee_bps),
    );
    AstroSwapFactoryClient::new(env, &factory_addr)
}

/// Helper to create a dummy WASM hash for unit tests
/// Note: Tests using this will fail if they try to actually deploy pairs
/// Use #[ignore] for integration tests that require real pair deployment
fn create_pair_wasm_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(
        env,
        &[
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
            25, 26, 27, 28, 29, 30, 31, 32,
        ],
    )
}

// ==================== Constructor Tests ====================

#[test]
fn test_constructor_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let protocol_fee_bps = 30; // 0.30%

    let client = register_factory(&env, &admin, &pair_hash, protocol_fee_bps);

    assert_eq!(client.admin(), admin);
    assert_eq!(client.protocol_fee_bps(), protocol_fee_bps);
    assert!(!client.is_paused());
    assert!(client.is_public_pair_creation_enabled());
}

#[test]
#[should_panic] // Panics with "fee too high" but Soroban wraps it in host error
fn test_constructor_with_excessive_fee_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let protocol_fee_bps = 101; // > 100 bps = > 1%, should fail

    let _addr = env.register(AstroSwapFactory, (admin, pair_hash, protocol_fee_bps));
}

#[test]
fn test_legacy_initialize_fails_after_constructor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);

    // Already initialized via constructor
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Legacy initialize should fail (already initialized)
    let result = client.try_initialize(&admin, &pair_hash, &30);
    assert!(result.is_err());
}

// ==================== Pair Creation Tests ====================

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_create_pair_success() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    // Create pair
    let pair_addr = client.create_pair(&admin, &token_a, &token_b);

    // Verify pair was created and registered
    assert!(client.pair_exists(&token_a, &token_b));
    assert_eq!(client.get_pair(&token_a, &token_b).unwrap(), pair_addr);
    assert_eq!(client.all_pairs_length(), 1);
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_create_pair_with_reversed_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    // Create pair with A, B
    let pair_addr_1 = client.create_pair(&admin, &token_a, &token_b);

    // Query with B, A (reversed) - should return same pair
    assert_eq!(client.get_pair(&token_b, &token_a).unwrap(), pair_addr_1);
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_create_pair_duplicate_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    // Create pair
    client.create_pair(&admin, &token_a, &token_b);

    // Try to create again - should fail
    let result = client.try_create_pair(&admin, &token_a, &token_b);
    assert!(result.is_err());
}

#[test]
fn test_create_pair_with_same_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token) = create_token(&env, &admin);

    // Try to create pair with same token
    let result = client.try_create_pair(&admin, &token, &token);
    assert!(result.is_err());
}

#[test]
fn test_create_pair_when_paused_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Pause factory
    client.set_paused(&admin, &true);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    // Try to create pair while paused
    let result = client.try_create_pair(&admin, &token_a, &token_b);
    assert!(result.is_err());
}

// ==================== Pair Query Tests ====================

#[test]
fn test_get_pair_nonexistent_returns_none() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    assert_eq!(client.get_pair(&token_a, &token_b), None);
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_get_pair_by_index() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    let pair_addr = client.create_pair(&admin, &token_a, &token_b);

    // Get pair by index (0-based)
    assert_eq!(client.get_pair_by_index(&0).unwrap(), pair_addr);
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_get_pairs_paginated() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Create 5 pairs
    for _i in 0..5 {
        let (_, token_a) = create_token(&env, &admin);
        let (_, token_b) = create_token(&env, &admin);
        client.create_pair(&admin, &token_a, &token_b);
    }

    // Get first 3 pairs
    let pairs = client.get_pairs_paginated(&0, &3);
    assert_eq!(pairs.len(), 3);

    // Get next 2 pairs
    let pairs = client.get_pairs_paginated(&3, &2);
    assert_eq!(pairs.len(), 2);
}

// ==================== Admin Function Tests ====================

#[test]
fn test_set_fee_to() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let fee_recipient = Address::generate(&env);

    // Set fee recipient
    client.set_fee_to(&admin, &fee_recipient);
    assert_eq!(client.fee_to().unwrap(), fee_recipient);
}

#[test]
fn test_set_fee_to_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let fee_recipient = Address::generate(&env);

    // Non-admin tries to set fee recipient
    let result = client.try_set_fee_to(&non_admin, &fee_recipient);
    assert!(result.is_err());
}

#[test]
fn test_set_protocol_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Change fee from 30 bps to 50 bps
    client.set_protocol_fee(&admin, &50);
    assert_eq!(client.protocol_fee_bps(), 50);
}

#[test]
fn test_set_protocol_fee_too_high_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Try to set fee > 1% (100 bps)
    let result = client.try_set_protocol_fee(&admin, &101);
    assert!(result.is_err());
}

#[test]
fn test_set_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Transfer admin
    client.set_admin(&admin, &new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_set_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    assert!(!client.is_paused());

    // Pause
    client.set_paused(&admin, &true);
    assert!(client.is_paused());

    // Unpause
    client.set_paused(&admin, &false);
    assert!(!client.is_paused());
}

#[test]
fn test_set_public_pair_creation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Initially enabled (default in constructor for testnet)
    assert!(client.is_public_pair_creation_enabled());

    // Disable public creation (mainnet mode - admin only)
    client.set_public_pair_creation(&admin, &false);
    assert!(!client.is_public_pair_creation_enabled());
}

// ==================== Graduated Token Tests (Launchpad Integration) ====================

#[test]
fn test_register_graduated_token() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Set launchpad address
    let launchpad = Address::generate(&env);
    client.set_launchpad(&admin, &launchpad);

    let (_, token) = create_token(&env, &admin);

    // Create metadata for graduated token
    let metadata = TokenMetadata {
        name: String::from_str(&env, "Graduated Token"),
        symbol: String::from_str(&env, "GRAD"),
        decimals: 7,
        total_supply: 100_000_0000000i128,
        creator: admin.clone(),
        graduation_time: 0,
    };

    // Register token as graduated
    client.register_graduated_token(&launchpad, &token, &metadata);

    assert!(client.is_graduated(&token));
}

#[test]
fn test_register_graduated_token_non_launchpad_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let launchpad = Address::generate(&env);
    client.set_launchpad(&admin, &launchpad);

    let (_, token) = create_token(&env, &admin);
    let non_launchpad = Address::generate(&env);

    // Create metadata
    let metadata = TokenMetadata {
        name: String::from_str(&env, "Test Token"),
        symbol: String::from_str(&env, "TEST"),
        decimals: 7,
        total_supply: 100_000_0000000i128,
        creator: admin.clone(),
        graduation_time: 0,
    };

    // Non-launchpad tries to register token
    let result = client.try_register_graduated_token(&non_launchpad, &token, &metadata);
    assert!(result.is_err());
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_create_graduated_pair() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let launchpad = Address::generate(&env);
    client.set_launchpad(&admin, &launchpad);

    let (_, graduated_token) = create_token(&env, &admin);
    let (_, quote_token) = create_token(&env, &admin);

    // Create metadata
    let metadata = TokenMetadata {
        name: String::from_str(&env, "Graduated Token"),
        symbol: String::from_str(&env, "GRAD"),
        decimals: 7,
        total_supply: 100_000_0000000i128,
        creator: admin.clone(),
        graduation_time: 0,
    };

    // Register token as graduated
    client.register_graduated_token(&launchpad, &graduated_token, &metadata);

    // Create graduated pair (only launchpad can call this)
    let pair_addr = client.create_graduated_pair(&launchpad, &graduated_token, &quote_token);

    assert!(client.pair_exists(&graduated_token, &quote_token));
    assert_eq!(
        client.get_pair(&graduated_token, &quote_token).unwrap(),
        pair_addr
    );
}

#[test]
fn test_create_graduated_pair_non_graduated_token_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let launchpad = Address::generate(&env);
    client.set_launchpad(&admin, &launchpad);

    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);

    // Try to create graduated pair without registering token first
    let result = client.try_create_graduated_pair(&launchpad, &token_a, &token_b);
    assert!(result.is_err());
}

// ==================== Integration Tests ====================

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_multiple_pairs_creation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    let mut tokens = Vec::new(&env);
    for _ in 0..5 {
        let (_, token) = create_token(&env, &admin);
        tokens.push_back(token);
    }

    // Create pairs: 0-1, 0-2, 0-3, 0-4, 1-2
    client.create_pair(&admin, &tokens.get(0).unwrap(), &tokens.get(1).unwrap());
    client.create_pair(&admin, &tokens.get(0).unwrap(), &tokens.get(2).unwrap());
    client.create_pair(&admin, &tokens.get(0).unwrap(), &tokens.get(3).unwrap());
    client.create_pair(&admin, &tokens.get(0).unwrap(), &tokens.get(4).unwrap());
    client.create_pair(&admin, &tokens.get(1).unwrap(), &tokens.get(2).unwrap());

    assert_eq!(client.all_pairs_length(), 5);

    // Verify all pairs exist
    assert!(client.pair_exists(&tokens.get(0).unwrap(), &tokens.get(1).unwrap()));
    assert!(client.pair_exists(&tokens.get(0).unwrap(), &tokens.get(2).unwrap()));
    assert!(client.pair_exists(&tokens.get(1).unwrap(), &tokens.get(2).unwrap()));
}

#[test]
#[ignore = "Requires E2E setup with real pair WASM"]
fn test_factory_state_persistence() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let pair_hash = create_pair_wasm_hash(&env);
    let client = register_factory(&env, &admin, &pair_hash, 30);

    // Create pair
    let (_, token_a) = create_token(&env, &admin);
    let (_, token_b) = create_token(&env, &admin);
    client.create_pair(&admin, &token_a, &token_b);

    // Change settings
    let fee_recipient = Address::generate(&env);
    client.set_fee_to(&admin, &fee_recipient);
    client.set_protocol_fee(&admin, &50);
    client.set_paused(&admin, &true);

    // Verify state persisted
    assert_eq!(client.all_pairs_length(), 1);
    assert_eq!(client.fee_to().unwrap(), fee_recipient);
    assert_eq!(client.protocol_fee_bps(), 50);
    assert!(client.is_paused());
}
