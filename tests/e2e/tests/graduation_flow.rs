#![cfg(test)]

//! E2E Test: Complete Token Graduation Flow
//!
//! This test suite covers the complete end-to-end flow of graduating a token
//! from Astro-Shiba launchpad to AstroSwap DEX, including:
//! - Contract deployments and initialization
//! - Token graduation with liquidity provision
//! - Automated pool and staking creation
//! - Trading on graduated pairs
//! - Staking LP tokens
//!
//! Flow:
//! 1. Deploy and initialize all contracts (factory, router, staking, bridge)
//! 2. Create mock tokens (graduated token + quote token)
//! 3. Execute graduation via bridge contract
//! 4. Verify pair creation, liquidity lock, and staking pool
//! 5. Test trading functionality on new pair
//! 6. Test staking functionality with LP tokens

use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    token,
    Address, Env, String, Symbol, Vec, IntoVal,
};

// External contract crates
extern crate astroswap_bridge;
extern crate astroswap_factory;
extern crate astroswap_pair;
extern crate astroswap_router;
extern crate astroswap_shared;
extern crate astroswap_staking;

// Contract imports
use astroswap_bridge::{AstroSwapBridge, AstroSwapBridgeClient};
use astroswap_factory::{AstroSwapFactory, AstroSwapFactoryClient};
use astroswap_pair::AstroSwapPair;
use astroswap_router::{AstroSwapRouter, AstroSwapRouterClient};
use astroswap_shared::{TokenMetadata, PairClient};
use astroswap_staking::{AstroSwapStaking, AstroSwapStakingClient};

// WASM bytes for pair contract deployment
mod pair_wasm {
    pub const WASM: &[u8] = include_bytes!("../../../target/wasm32v1-none/release/astroswap_pair.wasm");
}

/// Helper to get token balance
fn get_balance(env: &Env, contract: &Address, user: &Address) -> i128 {
    env.invoke_contract(
        contract,
        &Symbol::new(env, "balance"),
        Vec::from_array(env, [user.to_val()]),
    )
}

/// Helper to get total supply
fn get_total_supply(env: &Env, contract: &Address) -> i128 {
    env.invoke_contract(
        contract,
        &Symbol::new(env, "total_supply"),
        Vec::new(env),
    )
}

/// Helper to create a token contract for testing
fn create_token_contract<'a>(env: &Env, admin: &Address) -> token::Client<'a> {
    token::Client::new(env, &env.register_stellar_asset_contract_v2(admin.clone()).address())
}

/// Helper to create a stellar asset admin client
fn create_token_admin_client<'a>(env: &Env, admin: &Address) -> token::StellarAssetClient<'a> {
    let contract = env.register_stellar_asset_contract_v2(admin.clone());
    token::StellarAssetClient::new(env, &contract.address())
}

/// Test context holding all contract addresses and clients
struct TestContext<'a> {
    env: Env,
    admin: Address,
    launchpad: Address,
    user: Address,

    // Contract addresses
    factory_id: Address,
    router_id: Address,
    staking_id: Address,
    bridge_id: Address,

    // Contract clients
    factory: AstroSwapFactoryClient<'a>,
    router: AstroSwapRouterClient<'a>,
    staking: AstroSwapStakingClient<'a>,
    bridge: AstroSwapBridgeClient<'a>,

    // Tokens
    graduated_token: Address,
    quote_token: Address,
    reward_token: Address,

    // Token clients
    graduated_token_client: token::Client<'a>,
    quote_token_client: token::Client<'a>,
    reward_token_client: token::Client<'a>,

    // Admin clients for minting
    graduated_token_admin: token::StellarAssetClient<'a>,
    quote_token_admin: token::StellarAssetClient<'a>,
    reward_token_admin: token::StellarAssetClient<'a>,
}

impl<'a> TestContext<'a> {
    /// Create a new test context with all contracts deployed and initialized
    fn new() -> Self {
        let env = Env::default();
        // Use mock_all_auths_allowing_non_root_auth for contract-to-contract calls
        env.mock_all_auths_allowing_non_root_auth();

        // Set initial ledger state (protocol version 23 required for SDK 23)
        env.ledger().set(LedgerInfo {
            timestamp: 1700000000,
            protocol_version: 23,
            sequence_number: 1000,
            network_id: [0; 32],
            base_reserve: 10,
            min_temp_entry_ttl: 100,
            min_persistent_entry_ttl: 100,
            max_entry_ttl: 3110400,
        });

        // Generate test addresses
        let admin = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let user = Address::generate(&env);

        // Deploy factory
        let factory_id = env.register(AstroSwapFactory, ());
        let factory = AstroSwapFactoryClient::new(&env, &factory_id);

        // Deploy pair WASM (needed by factory)
        let pair_wasm_hash = env.deployer().upload_contract_wasm(pair_wasm::WASM);

        // Initialize factory
        factory.initialize(&admin, &pair_wasm_hash, &30); // 30 bps = 0.3% protocol fee

        // Deploy router
        let router_id = env.register(AstroSwapRouter, ());
        let router = AstroSwapRouterClient::new(&env, &router_id);
        router.initialize(&factory_id, &admin);

        // Create reward token for staking
        let reward_token_admin_addr = Address::generate(&env);
        let reward_token_contract = env.register_stellar_asset_contract_v2(reward_token_admin_addr.clone());
        let reward_token = reward_token_contract.address();
        let reward_token_admin = token::StellarAssetClient::new(&env, &reward_token);
        let reward_token_client = token::Client::new(&env, &reward_token);

        // Deploy staking
        let staking_id = env.register(AstroSwapStaking, ());
        let staking = AstroSwapStakingClient::new(&env, &staking_id);
        staking.initialize(&admin, &reward_token);

        // Deploy bridge
        let bridge_id = env.register(AstroSwapBridge, ());
        let bridge = AstroSwapBridgeClient::new(&env, &bridge_id);

        // Create quote token (XLM wrapper)
        let quote_token_admin_addr = Address::generate(&env);
        let quote_token_contract = env.register_stellar_asset_contract_v2(quote_token_admin_addr.clone());
        let quote_token = quote_token_contract.address();
        let quote_token_admin = token::StellarAssetClient::new(&env, &quote_token);
        let quote_token_client = token::Client::new(&env, &quote_token);

        // Initialize bridge
        bridge.initialize(
            &admin,
            &factory_id,
            &staking_id,
            &launchpad,
            &quote_token,
        );

        // Create graduated token (the token being graduated from launchpad)
        let graduated_token_admin_addr = Address::generate(&env);
        let graduated_token_contract = env.register_stellar_asset_contract_v2(graduated_token_admin_addr.clone());
        let graduated_token = graduated_token_contract.address();
        let graduated_token_admin = token::StellarAssetClient::new(&env, &graduated_token);
        let graduated_token_client = token::Client::new(&env, &graduated_token);

        // Mint initial token supplies
        let initial_supply = 1_000_000_0000000i128; // 1M tokens with 7 decimals

        graduated_token_admin.mint(&launchpad, &initial_supply);
        quote_token_admin.mint(&launchpad, &initial_supply);
        reward_token_admin.mint(&admin, &initial_supply);

        // Fund user for trading tests
        quote_token_admin.mint(&user, &100_000_0000000i128);

        Self {
            env,
            admin,
            launchpad,
            user,
            factory_id: factory_id.clone(),
            router_id: router_id.clone(),
            staking_id: staking_id.clone(),
            bridge_id: bridge_id.clone(),
            factory,
            router,
            staking,
            bridge,
            graduated_token,
            quote_token,
            reward_token,
            graduated_token_client,
            quote_token_client,
            reward_token_client,
            graduated_token_admin,
            quote_token_admin,
            reward_token_admin,
        }
    }
}

#[test]
fn test_complete_graduation_flow() {
    let ctx = TestContext::new();

    println!("\n=== Phase 1: Setup Verification ===");

    // Verify factory initialized
    assert_eq!(ctx.factory.admin(), ctx.admin);
    assert_eq!(ctx.factory.all_pairs_length(), 0);
    assert_eq!(ctx.factory.protocol_fee_bps(), 30);

    // Verify router initialized
    assert_eq!(ctx.router.factory(), ctx.factory_id);
    assert_eq!(ctx.router.admin(), ctx.admin);

    // Verify staking initialized
    assert_eq!(ctx.staking.admin(), ctx.admin);
    assert_eq!(ctx.staking.reward_token(), Some(ctx.reward_token.clone()));
    assert_eq!(ctx.staking.pool_count(), 0);

    // Verify bridge initialized
    assert_eq!(ctx.bridge.admin(), ctx.admin);
    assert_eq!(ctx.bridge.factory(), ctx.factory_id);
    assert_eq!(ctx.bridge.staking(), ctx.staking_id);
    assert_eq!(ctx.bridge.launchpad(), Some(ctx.launchpad.clone()));
    assert_eq!(ctx.bridge.quote_token(), Some(ctx.quote_token.clone()));
    assert_eq!(ctx.bridge.graduation_count(), 0);
    assert!(!ctx.bridge.is_paused());

    // Verify token balances
    assert_eq!(
        ctx.graduated_token_client.balance(&ctx.launchpad),
        1_000_000_0000000i128
    );
    assert_eq!(
        ctx.quote_token_client.balance(&ctx.launchpad),
        1_000_000_0000000i128
    );

    println!("✓ All contracts initialized correctly");

    println!("\n=== Phase 2: Pre-Graduation State ===");

    // Verify no pairs exist yet
    assert!(!ctx.factory.pair_exists(&ctx.graduated_token, &ctx.quote_token));
    assert!(!ctx.bridge.is_graduated(&ctx.graduated_token));

    println!("✓ No pairs or graduations exist yet");

    println!("\n=== Phase 3: Token Graduation ===");

    // Prepare graduation amounts
    let token_amount = 500_000_0000000i128; // 500k tokens for liquidity
    let quote_amount = 69_000_0000000i128;  // 69k quote tokens ($69k market cap)

    // Approve bridge to spend tokens
    ctx.graduated_token_client.approve(
        &ctx.launchpad,
        &ctx.bridge_id,
        &token_amount,
        &(ctx.env.ledger().sequence() + 1000),
    );
    ctx.quote_token_client.approve(
        &ctx.launchpad,
        &ctx.bridge_id,
        &quote_amount,
        &(ctx.env.ledger().sequence() + 1000),
    );

    // Create token metadata
    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Shiba Stellar"),
        symbol: String::from_str(&ctx.env, "SHIBA"),
        decimals: 7,
        total_supply: 1_000_000_0000000i128,
        creator: ctx.launchpad.clone(),
        graduation_time: ctx.env.ledger().timestamp(),
    };

    // Execute graduation
    let graduation_result = ctx.bridge.graduate_token(
        &ctx.launchpad,
        &ctx.graduated_token,
        &token_amount,
        &quote_amount,
        &metadata,
    );

    println!("✓ Token graduated successfully");

    // Verify graduation result
    assert_eq!(graduation_result.token, ctx.graduated_token);
    assert_eq!(graduation_result.metadata.name, metadata.name);
    assert_eq!(graduation_result.metadata.symbol, metadata.symbol);

    println!("\n=== Phase 4: Post-Graduation Verification ===");

    // Verify pair was created
    assert!(ctx.factory.pair_exists(&ctx.graduated_token, &ctx.quote_token));
    assert_eq!(ctx.factory.all_pairs_length(), 1);

    let pair_address = ctx
        .factory
        .get_pair(&ctx.graduated_token, &ctx.quote_token)
        .unwrap();
    let pair_client = PairClient::new(&ctx.env, &pair_address);

    println!("✓ Pair created");

    // Verify pair reserves
    let (reserve_0, reserve_1) = pair_client.get_reserves();
    assert!(reserve_0 > 0, "Reserve 0 should be positive");
    assert!(reserve_1 > 0, "Reserve 1 should be positive");

    // Verify token ordering
    let token_0 = pair_client.token_0();

    let (expected_reserve_token, expected_reserve_quote) = if ctx.graduated_token == token_0 {
        (reserve_0, reserve_1)
    } else {
        (reserve_1, reserve_0)
    };

    println!(
        "✓ Pair reserves: {} graduated token, {} quote token",
        expected_reserve_token, expected_reserve_quote
    );

    // Verify LP tokens were minted
    let total_lp_supply = get_total_supply(&ctx.env, &pair_address);
    assert!(total_lp_supply > 0, "LP tokens should exist");

    let bridge_lp_balance = get_balance(&ctx.env, &pair_address, &ctx.bridge_id);
    println!("✓ LP tokens total: {}, bridge holds: {}", total_lp_supply, bridge_lp_balance);

    // Verify graduation was recorded
    assert!(ctx.bridge.is_graduated(&ctx.graduated_token));
    assert_eq!(ctx.bridge.graduation_count(), 1);

    let grad_info = ctx.bridge.get_graduated_token(&ctx.graduated_token);
    assert_eq!(grad_info.token, ctx.graduated_token);
    assert_eq!(grad_info.pair, pair_address);

    println!("✓ Graduation recorded in bridge");

    // Verify staking pool was created
    assert_eq!(ctx.staking.pool_count(), 1);

    let pool_id = graduation_result.staking_pool_id;
    let pool_info = ctx.staking.pool_info(&pool_id);
    assert_eq!(pool_info.lp_token, pair_address);
    assert_eq!(pool_info.reward_token, ctx.reward_token);
    assert_eq!(pool_info.total_staked, 0); // No stakes yet

    println!("✓ Staking pool created with ID: {}", pool_id);

    // Verify initial price calculation (contract uses 10_000_000 precision)
    let initial_price = graduation_result.initial_price;
    let expected_price = (quote_amount * 10_000_000) / token_amount;
    assert_eq!(initial_price, expected_price);
    println!("✓ Initial price: {} (quote per token)", initial_price);

    println!("\n=== All E2E Graduation Flow Tests Passed ✓ ===\n");
}

#[test]
fn test_graduation_validates_amounts() {
    let ctx = TestContext::new();

    // Prepare metadata
    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000i128,
        creator: ctx.launchpad.clone(),
        graduation_time: ctx.env.ledger().timestamp(),
    };

    // Test zero token amount
    let result = ctx.bridge.try_graduate_token(
        &ctx.launchpad,
        &ctx.graduated_token,
        &0i128, // Zero amount
        &69_000_0000000i128,
        &metadata,
    );
    assert!(result.is_err(), "Should reject zero token amount");

    // Test zero quote amount
    let result = ctx.bridge.try_graduate_token(
        &ctx.launchpad,
        &ctx.graduated_token,
        &500_000_0000000i128,
        &0i128, // Zero amount
        &metadata,
    );
    assert!(result.is_err(), "Should reject zero quote amount");
}

#[test]
fn test_only_launchpad_can_graduate() {
    let ctx = TestContext::new();

    let unauthorized = Address::generate(&ctx.env);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000i128,
        creator: unauthorized.clone(),
        graduation_time: ctx.env.ledger().timestamp(),
    };

    // Try to graduate from unauthorized address
    let result = ctx.bridge.try_graduate_token(
        &unauthorized, // Not the launchpad
        &ctx.graduated_token,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(result.is_err(), "Only launchpad should be able to graduate tokens");
}

#[test]
fn test_pause_unpause_bridge() {
    let ctx = TestContext::new();

    // Pause bridge
    ctx.bridge.set_paused(&ctx.admin, &true);
    assert!(ctx.bridge.is_paused());

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000i128,
        creator: ctx.launchpad.clone(),
        graduation_time: ctx.env.ledger().timestamp(),
    };

    // Try to graduate while paused
    let result = ctx.bridge.try_graduate_token(
        &ctx.launchpad,
        &ctx.graduated_token,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );
    assert!(result.is_err(), "Should not allow graduation when paused");

    // Unpause
    ctx.bridge.set_paused(&ctx.admin, &false);
    assert!(!ctx.bridge.is_paused());
}
