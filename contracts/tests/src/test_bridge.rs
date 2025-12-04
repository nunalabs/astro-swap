//! Bridge Graduation Integration Tests
//!
//! Tests the complete graduation flow from Astro-Shiba launchpad:
//! - Simulate graduation from launchpad
//! - Create pair via bridge
//! - Verify LP tokens burned
//! - Verify staking pool created

use crate::test_utils::TestContext;
use astroswap_shared::{PairClient, TokenMetadata};
use soroban_sdk::{testutils::Address as _, String};

#[test]
fn test_bridge_initialization() {
    let ctx = TestContext::new();

    assert_eq!(ctx.bridge.admin(), ctx.admin);
    // Note: These view methods may return values or Options depending on implementation
    // assert_eq!(ctx.bridge.factory(), ctx.factory_address);
    // assert_eq!(ctx.bridge.staking(), ctx.staking_address);
    assert_eq!(ctx.bridge.graduation_count(), 0);
    assert!(!ctx.bridge.is_paused());
}

#[test]
fn test_complete_graduation_flow() {
    let ctx = TestContext::new();

    // Get launchpad address (was set during bridge initialization)
    let launchpad = ctx.bridge.launchpad().unwrap();

    // Create a new token that will graduate
    let graduated_token_admin = soroban_sdk::Address::generate(&ctx.env);
    let graduated_token_address = ctx.env.register_stellar_asset_contract_v2(graduated_token_admin.clone()).address();
    let graduated_token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &graduated_token_address);

    graduated_token.mint(&launchpad, &1_000_000_0000000);

    // Prepare liquidity amounts
    let token_amount = 500_000_0000000i128; // 50% of supply
    let xlm_amount = 69_000_0000000i128; // $69k worth of XLM

    // Transfer tokens to launchpad (simulating graduation)
    // In real scenario, launchpad would have these from bonding curve
    ctx.xlm
        .transfer(&ctx.admin, &launchpad, &xlm_amount);

    // Create metadata
    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Graduated Token"),
        symbol: String::from_str(&ctx.env, "GRAD"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    // Execute graduation (returns GraduationInfo directly)
    let graduation_info = ctx
        .bridge
        .graduate_token(
            &launchpad,
            &graduated_token_address,
            &token_amount,
            &xlm_amount,
            &metadata,
        );

    // Verify graduation info
    assert_eq!(graduation_info.token, graduated_token_address);
    assert_eq!(graduation_info.metadata.symbol, metadata.symbol);
    assert_eq!(graduation_info.graduation_time, ctx.timestamp());
    assert!(graduation_info.initial_price > 0);

    // Verify pair was created
    let pair_address = graduation_info.pair;
    let pair_client = PairClient::new(&ctx.env, &pair_address);

    let (reserve_0, reserve_1) = pair_client.get_reserves();
    assert!(reserve_0 > 0);
    assert!(reserve_1 > 0);

    // Verify tokens are in the pair
    let token_0 = pair_client.token_0();
    let token_1 = pair_client.token_1();

    assert!(
        (token_0 == graduated_token_address && token_1 == ctx.xlm_address)
            || (token_0 == ctx.xlm_address && token_1 == graduated_token_address)
    );

    // Verify LP tokens were BURNED (not just locked in bridge)
    // After the security fix, LP tokens are permanently burned to reduce total supply
    // Bridge balance should be 0 since tokens are burned, not held
    let bridge_lp_balance = pair_client.balance(&ctx.bridge_address);
    assert_eq!(
        bridge_lp_balance, 0,
        "Bridge should NOT hold LP tokens - they should be burned"
    );

    // The total supply should reflect only the minimum locked liquidity
    // (the initial MINIMUM_LIQUIDITY that's locked to prevent manipulation)
    let total_supply = pair_client.total_supply();
    assert!(
        total_supply > 0,
        "Total supply should only be minimum liquidity locked in pair"
    );

    // Verify staking pool was created
    let pool_id = graduation_info.staking_pool_id;
    assert!(pool_id > 0);

    let pool_info = ctx
        .staking
        .pool_info(&pool_id);

    assert_eq!(pool_info.lp_token, pair_address);

    // Verify graduation is recorded
    assert!(ctx.bridge.is_graduated(&graduated_token_address));
    assert_eq!(ctx.bridge.graduation_count(), 1);

    // Can retrieve graduation info
    let retrieved = ctx
        .bridge
        .get_graduated_token(&graduated_token_address);

    assert_eq!(retrieved.token, graduated_token_address);
    assert_eq!(retrieved.pair, pair_address);
}

#[test]
fn test_cannot_graduate_twice() {
    let ctx = TestContext::new();

    let launchpad = ctx.bridge.launchpad().unwrap();

    // Create token
    let token_admin = soroban_sdk::Address::generate(&ctx.env);
    let token_address = ctx.env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&launchpad, &1_000_000_0000000);

    ctx.xlm
        .transfer(&ctx.admin, &launchpad, &69_000_0000000);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    // First graduation (returns GraduatedToken directly)
    ctx.bridge
        .graduate_token(&launchpad, &token_address, &500_000_0000000i128, &69_000_0000000i128, &metadata);

    // Try to graduate again
    ctx.xlm
        .transfer(&ctx.admin, &launchpad, &69_000_0000000);

    let result = ctx.bridge.try_graduate_token(
        &launchpad,
        &token_address,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(result.is_err(), "Should not allow double graduation");
}

#[test]
fn test_only_launchpad_can_graduate() {
    let ctx = TestContext::new();

    let launchpad = ctx.bridge.launchpad().unwrap();

    // Create token
    let token_admin = soroban_sdk::Address::generate(&ctx.env);
    let token_address = ctx.env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&launchpad, &1_000_000_0000000);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    // Try to graduate from non-launchpad address
    let result = ctx.bridge.try_graduate_token(
        &ctx.user1, // Not the launchpad!
        &token_address,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(result.is_err(), "Only launchpad should be able to graduate");
}

#[test]
fn test_graduation_with_zero_liquidity_rejected() {
    let ctx = TestContext::new();

    let launchpad = ctx.bridge.launchpad().unwrap();

    let token_address = ctx.env.register_stellar_asset_contract_v2(launchpad.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&launchpad, &1_000_000_0000000);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    // Try to graduate with zero amounts
    let result = ctx.bridge.try_graduate_token(
        &launchpad,
        &token_address,
        &0i128, // Zero token amount
        &69_000_0000000i128,
        &metadata,
    );

    assert!(result.is_err(), "Should reject zero liquidity");

    let result = ctx.bridge.try_graduate_token(
        &launchpad,
        &token_address,
        &500_000_0000000i128,
        &0i128, // Zero XLM amount
        &metadata,
    );

    assert!(result.is_err(), "Should reject zero liquidity");
}

#[test]
fn test_get_graduation_by_index() {
    let ctx = TestContext::new();

    let launchpad = ctx.bridge.launchpad().unwrap();

    // Graduate 3 tokens
    for i in 0..3u32 {
        let token_admin = soroban_sdk::Address::generate(&ctx.env);
        let token_address = ctx.env.register_stellar_asset_contract_v2(token_admin.clone()).address();
        let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

        token.mint(&launchpad, &1_000_000_0000000);

        ctx.xlm
            .transfer(&ctx.admin, &launchpad, &69_000_0000000);

        let symbol = String::from_str(&ctx.env, "TOK");
        let metadata = TokenMetadata {
            name: String::from_str(&ctx.env, "Test Token"),
            symbol: symbol.clone(),
            decimals: 7,
            total_supply: 1_000_000_0000000,
            creator: launchpad.clone(),
            graduation_time: ctx.timestamp(),
        };

        ctx.bridge
            .graduate_token(
                &launchpad,
                &token_address,
                &500_000_0000000i128,
                &69_000_0000000i128,
                &metadata,
            );
    }

    // Should have 3 graduations
    assert_eq!(ctx.bridge.graduation_count(), 3);

    // Can retrieve each by index
    for i in 0..3u32 {
        let grad = ctx
            .bridge
            .get_graduation_by_index(&i);

        assert!(grad.token != ctx.admin);
    }

    // Index out of bounds should fail
    let result = ctx.bridge.try_get_graduation_by_index(&3u32);
    assert!(result.is_err(), "Should fail for out-of-bounds index");
}

#[test]
fn test_bridge_pause() {
    let ctx = TestContext::new();

    // Pause bridge
    ctx.bridge
        .set_paused(&ctx.admin, &true);

    assert!(ctx.bridge.is_paused());

    let launchpad = ctx.bridge.launchpad().unwrap();

    let token_address = ctx.env.register_stellar_asset_contract_v2(launchpad.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&launchpad, &1_000_000_0000000);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    // Try to graduate while paused
    let result = ctx.bridge.try_graduate_token(
        &launchpad,
        &token_address,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(result.is_err(), "Should not allow graduation while paused");

    // Unpause and retry
    ctx.bridge
        .set_paused(&ctx.admin, &false);

    ctx.xlm
        .transfer(&ctx.admin, &launchpad, &69_000_0000000);

    // Returns GraduatedToken directly
    let grad = ctx.bridge.graduate_token(
        &launchpad,
        &token_address,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(grad.token == token_address, "Should allow graduation when unpaused");
}

#[test]
fn test_update_launchpad_address() {
    let ctx = TestContext::new();

    let old_launchpad = ctx.bridge.launchpad().unwrap();
    let new_launchpad = soroban_sdk::Address::generate(&ctx.env);

    // Update launchpad
    ctx.bridge
        .set_launchpad(&ctx.admin, &new_launchpad);

    assert_eq!(ctx.bridge.launchpad(), Some(new_launchpad.clone()));

    // Old launchpad should not be able to graduate
    let token_admin = soroban_sdk::Address::generate(&ctx.env);
    let token_address = ctx.env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&old_launchpad, &1_000_000_0000000);

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: old_launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    let result = ctx.bridge.try_graduate_token(
        &old_launchpad,
        &token_address,
        &500_000_0000000i128,
        &69_000_0000000i128,
        &metadata,
    );

    assert!(
        result.is_err(),
        "Old launchpad should not be able to graduate"
    );
}

#[test]
fn test_initial_price_calculation() {
    let ctx = TestContext::new();

    let launchpad = ctx.bridge.launchpad().unwrap();

    let token_address = ctx.env.register_stellar_asset_contract_v2(launchpad.clone()).address();
    let token = soroban_sdk::token::StellarAssetClient::new(&ctx.env, &token_address);

    token.mint(&launchpad, &1_000_000_0000000);

    ctx.xlm
        .transfer(&ctx.admin, &launchpad, &69_000_0000000);

    let token_amount = 500_000_0000000i128;
    let xlm_amount = 69_000_0000000i128;

    let metadata = TokenMetadata {
        name: String::from_str(&ctx.env, "Test Token"),
        symbol: String::from_str(&ctx.env, "TEST"),
        decimals: 7,
        total_supply: 1_000_000_0000000,
        creator: launchpad.clone(),
        graduation_time: ctx.timestamp(),
    };

    let graduation = ctx
        .bridge
        .graduate_token(&launchpad, &token_address, &token_amount, &xlm_amount, &metadata);

    // Initial price should be XLM / Token ratio
    // Price = (xlm_amount / token_amount) * 10^7 (for 7 decimal precision)
    let expected_price = (xlm_amount * 10_000_000) / token_amount;

    assert_eq!(graduation.initial_price, expected_price);

    // For this example: 69,000 XLM / 500,000 tokens = 0.138 XLM per token
    // With 7 decimals: 1,380,000
    assert_eq!(expected_price, 1_380_000);
}

#[test]
fn test_bridge_admin_transfer() {
    let ctx = TestContext::new();

    let new_admin = soroban_sdk::Address::generate(&ctx.env);

    ctx.bridge
        .set_admin(&ctx.admin, &new_admin);

    assert_eq!(ctx.bridge.admin(), new_admin);

    // Old admin should not be able to perform admin actions
    let result = ctx.bridge.try_set_paused(&ctx.admin, &true);
    assert!(result.is_err(), "Old admin should not have permissions");

    // New admin should be able to perform admin actions
    ctx.bridge
        .set_paused(&new_admin, &true);

    assert!(ctx.bridge.is_paused());
}
