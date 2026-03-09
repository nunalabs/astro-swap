#![no_std]
//! AstroSwap Bridge Contract
//!
//! Integration bridge between Astro-Shiba launchpad and AstroSwap DEX.
//! Handles token graduation and automatic pool/staking creation.
//!
//! ## Graduation Flow
//! 1. Token reaches graduation threshold on Astro-Shiba ($69k market cap)
//! 2. Launchpad calls `graduate_token()` with liquidity
//! 3. Bridge creates trading pair via Factory
//! 4. Bridge adds initial liquidity to the pair
//! 5. Bridge creates staking pool for LP tokens
//! 6. Bridge burns the LP tokens (permanently locked liquidity)
//! 7. Graduation event is emitted
//!
//! ## Security
//! - Only registered launchpad can initiate graduations
//! - LP tokens are burned (not held by any address)
//! - Admin can pause in case of emergency

mod storage;

use astroswap_shared::{
    emit_graduation, reentrancy::ReentrancyGuard, sqrt, AstroSwapError, FactoryClient,
    GraduatedToken, PairClient, TokenMetadata,
};
use soroban_sdk::{contract, contractevent, contractimpl, token, Address, Env, IntoVal, String, Symbol, Vec};

/// LP tokens burned event (permanent liquidity lock)
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LpBurned {
    pub pair: Address,
    pub amount: i128,
}

use crate::storage::{
    extend_graduated_token_ttl, extend_instance_ttl, get_admin, get_factory, get_graduated_token,
    get_graduation_by_index, get_graduation_count, get_launchpad, get_quote_token, get_staking,
    increment_graduation_count, is_initialized, is_locked, is_paused, is_token_graduated,
    set_admin, set_factory, set_graduated_token, set_graduation_index, set_initialized,
    set_launchpad, set_locked, set_paused, set_quote_token, set_staking,
};

/// Default staking duration: 365 days
const DEFAULT_STAKING_DURATION: u64 = 365 * 24 * 60 * 60;

#[contract]
pub struct AstroSwapBridge;

#[contractimpl]
impl AstroSwapBridge {
    // ==================== Constructor (CAP-58) ====================

    /// Constructor - runs atomically with contract deployment
    /// Prevents front-running attacks during initialization
    ///
    /// # Arguments
    /// * `admin` - Admin address for emergency functions
    /// * `factory` - AstroSwap factory contract address
    /// * `staking` - AstroSwap staking contract address
    /// * `launchpad` - Astro-Shiba launchpad contract address
    /// * `quote_token` - Quote token for pairs (XLM wrapper or USDC)
    pub fn __constructor(
        env: Env,
        admin: Address,
        factory: Address,
        staking: Address,
        launchpad: Address,
        quote_token: Address,
    ) {
        set_admin(&env, &admin);
        set_factory(&env, &factory);
        set_staking(&env, &staking);
        set_launchpad(&env, &launchpad);
        set_quote_token(&env, &quote_token);
        set_initialized(&env);

        extend_instance_ttl(&env);
    }

    // ==================== Legacy Initialization ====================

    /// Initialize the bridge contract (LEGACY - use constructor for new deployments)
    ///
    /// # Arguments
    /// * `admin` - Admin address for emergency functions
    /// * `factory` - AstroSwap factory contract address
    /// * `staking` - AstroSwap staking contract address
    /// * `launchpad` - Astro-Shiba launchpad contract address
    /// * `quote_token` - Quote token for pairs (XLM wrapper or USDC)
    pub fn initialize(
        env: Env,
        admin: Address,
        factory: Address,
        staking: Address,
        launchpad: Address,
        quote_token: Address,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        set_admin(&env, &admin);
        set_factory(&env, &factory);
        set_staking(&env, &staking);
        set_launchpad(&env, &launchpad);
        set_quote_token(&env, &quote_token);
        set_initialized(&env);

        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Core Graduation Function ====================

    /// Graduate a token from Astro-Shiba launchpad
    ///
    /// This is the main function called by the launchpad when a token
    /// reaches the graduation threshold. It:
    /// 1. Creates a trading pair on AstroSwap
    /// 2. Adds initial liquidity
    /// 3. Burns LP tokens (permanent liquidity lock)
    /// 4. Creates a staking pool for the pair
    ///
    /// # Arguments
    /// * `caller` - Must be the registered launchpad contract
    /// * `token` - The graduated token address
    /// * `token_amount` - Amount of graduated token for liquidity
    /// * `quote_amount` - Amount of quote token (XLM) for liquidity
    /// * `metadata` - Token metadata from launchpad
    ///
    /// # Returns
    /// * `GraduatedToken` - Information about the graduated token
    ///
    /// # Security
    /// Uses RAII reentrancy guard - lock automatically released when guard goes out of scope
    pub fn graduate_token(
        env: Env,
        caller: Address,
        token: Address,
        token_amount: i128,
        quote_amount: i128,
        metadata: TokenMetadata,
    ) -> Result<GraduatedToken, AstroSwapError> {
        Self::require_not_paused(&env)?;
        Self::require_launchpad(&env, &caller)?;

        // RAII guard - automatically releases lock when function returns
        // This is critical since graduate_token makes multiple external calls
        let _guard = ReentrancyGuard::acquire(&env, is_locked, set_locked)?;

        // Verify token hasn't already graduated
        if is_token_graduated(&env, &token) {
            return Err(AstroSwapError::AlreadyGraduated);
        }

        // Validate amounts
        if token_amount <= 0 || quote_amount <= 0 {
            return Err(AstroSwapError::InsufficientLiquidity);
        }

        let quote_token = get_quote_token(&env).ok_or(AstroSwapError::InvalidArgument)?;
        let factory = get_factory(&env)?;

        // Step 1: Create trading pair via factory
        let factory_client = FactoryClient::new(&env, &factory);
        let pair_address = factory_client.create_pair(&caller, &token, &quote_token)?;

        // SECURITY: Verify pair was created successfully by checking it exists in factory
        // This prevents potential issues if create_pair silently fails or returns wrong address
        let verified_pair = factory_client.get_pair(&token, &quote_token);
        match verified_pair {
            Some(ref addr) if addr == &pair_address => { /* Verification passed */ }
            _ => {
                return Err(AstroSwapError::PairNotFound);
            }
        }

        let pair_client = PairClient::new(&env, &pair_address);

        // Verify pair is properly initialized by checking it has the correct tokens
        let pair_token_0 = pair_client.token_0();
        let pair_token_1 = pair_client.token_1();
        let has_token = pair_token_0 == token || pair_token_1 == token;
        let has_quote = pair_token_0 == quote_token || pair_token_1 == quote_token;
        if !has_token || !has_quote {
            return Err(AstroSwapError::InvalidPair);
        }

        // Step 2: Transfer tokens from launchpad to bridge (for deposit)
        // Note: Launchpad must approve bridge for these transfers beforehand
        let token_client = token::Client::new(&env, &token);
        let quote_client = token::Client::new(&env, &quote_token);

        // Transfer to this contract first
        token_client.transfer(&caller, env.current_contract_address(), &token_amount);
        quote_client.transfer(&caller, env.current_contract_address(), &quote_amount);

        // Approve pair contract to take tokens
        token_client.approve(
            &env.current_contract_address(),
            &pair_address,
            &token_amount,
            &(env.ledger().sequence() + 1000),
        );
        quote_client.approve(
            &env.current_contract_address(),
            &pair_address,
            &quote_amount,
            &(env.ledger().sequence() + 1000),
        );

        // Step 3: Add initial liquidity
        // Determine token order in the pair
        let token_0 = pair_client.token_0();
        let (amount_0, amount_1) = if token == token_0 {
            (token_amount, quote_amount)
        } else {
            (quote_amount, token_amount)
        };

        // Calculate expected LP tokens for slippage protection
        // For first deposit: LP = sqrt(amount_0 * amount_1) - MINIMUM_LIQUIDITY (1000)
        // We allow 1% slippage to account for rounding
        let expected_lp_squared = amount_0
            .checked_mul(amount_1)
            .ok_or(AstroSwapError::Overflow)?;
        let expected_lp = sqrt(expected_lp_squared);
        let min_lp = expected_lp
            .checked_mul(99)
            .ok_or(AstroSwapError::Overflow)?
            .checked_div(100)
            .ok_or(AstroSwapError::DivisionByZero)?;

        // Slippage-protected deposit
        // min_amount_0 and min_amount_1 ensure we receive the expected amounts
        // For initial deposit, these should match our input amounts (99% tolerance)
        let min_amount_0 = amount_0
            .checked_mul(99)
            .ok_or(AstroSwapError::Overflow)?
            .checked_div(100)
            .ok_or(AstroSwapError::DivisionByZero)?;
        let min_amount_1 = amount_1
            .checked_mul(99)
            .ok_or(AstroSwapError::Overflow)?
            .checked_div(100)
            .ok_or(AstroSwapError::DivisionByZero)?;

        let (_, _, lp_tokens) = pair_client.deposit(
            &env.current_contract_address(),
            amount_0,
            amount_1,
            min_amount_0, // 99% of expected amount_0
            min_amount_1, // 99% of expected amount_1
        );

        // Verify we received expected LP tokens (slippage protection)
        if lp_tokens < min_lp {
            return Err(AstroSwapError::SlippageExceeded);
        }

        // Step 4: Burn LP tokens by sending to zero/dead address
        // In Soroban, we can't send to address zero, so we use the contract itself
        // and the tokens become permanently locked
        // Alternative: Send to a known burn address or implement token burning
        let _burn_result = Self::burn_lp_tokens(&env, &pair_address, lp_tokens);

        // Step 5: Create staking pool for the pair (if staking contract is available)
        let staking = get_staking(&env)?;
        let pool_id = Self::create_staking_pool(&env, &staking, &pair_address)?;

        // Calculate initial price (always quote per token, regardless of token ordering)
        // Price with 7 decimals: (quote / token) * 10^7
        let initial_price = (quote_amount * 10_000_000) / token_amount;

        // Step 6: Store graduation info
        let graduation_info = GraduatedToken {
            token: token.clone(),
            pair: pair_address.clone(),
            staking_pool_id: pool_id,
            initial_price,
            graduation_time: env.ledger().timestamp(),
            metadata: metadata.clone(),
        };

        let index = increment_graduation_count(&env);
        set_graduated_token(&env, &token, &graduation_info);
        set_graduation_index(&env, index - 1, &token);

        // Step 7: Emit graduation event
        emit_graduation(&env, &token, &pair_address, initial_price);

        extend_instance_ttl(&env);
        extend_graduated_token_ttl(&env, &token);

        // Lock automatically released when _guard goes out of scope
        Ok(graduation_info)
    }

    // ==================== View Functions ====================

    /// Get information about a graduated token
    pub fn get_graduated_token(env: Env, token: Address) -> Result<GraduatedToken, AstroSwapError> {
        let info = get_graduated_token(&env, &token).ok_or(AstroSwapError::TokenNotGraduated)?;
        extend_graduated_token_ttl(&env, &token);
        Ok(info)
    }

    /// Check if a token has graduated
    pub fn is_graduated(env: Env, token: Address) -> bool {
        is_token_graduated(&env, &token)
    }

    /// Get total number of graduated tokens
    pub fn graduation_count(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_graduation_count(&env)
    }

    /// Get graduated token by index
    pub fn get_graduation_by_index(env: Env, index: u32) -> Result<GraduatedToken, AstroSwapError> {
        let token = get_graduation_by_index(&env, index).ok_or(AstroSwapError::InvalidArgument)?;
        Self::get_graduated_token(env, token)
    }

    /// Get factory address
    /// Returns error if contract is not initialized
    pub fn factory(env: Env) -> Result<Address, AstroSwapError> {
        extend_instance_ttl(&env);
        get_factory(&env)
    }

    /// Get staking address
    /// Returns error if contract is not initialized
    pub fn staking(env: Env) -> Result<Address, AstroSwapError> {
        extend_instance_ttl(&env);
        get_staking(&env)
    }

    /// Get launchpad address
    pub fn launchpad(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_launchpad(&env)
    }

    /// Get quote token address
    pub fn quote_token(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_quote_token(&env)
    }

    /// Get admin address
    /// Returns error if contract is not initialized
    pub fn admin(env: Env) -> Result<Address, AstroSwapError> {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    /// Check if bridge is paused
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    // ==================== Admin Functions ====================

    /// Update launchpad address
    pub fn set_launchpad(
        env: Env,
        admin: Address,
        launchpad: Address,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_launchpad(&env, &launchpad);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Update staking address
    pub fn set_staking(env: Env, admin: Address, staking: Address) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_staking(&env, &staking);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Update quote token address
    pub fn set_quote_token(
        env: Env,
        admin: Address,
        quote_token: Address,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_quote_token(&env, &quote_token);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Transfer admin role
    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_admin(&env, &new_admin);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Pause or unpause the bridge
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_paused(&env, paused);
        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Internal Functions ====================

    /// Lock LP tokens forever by transferring to a provably dead address
    ///
    /// # Security
    /// Instead of calling burn() which could be intercepted if the bridge
    /// contract is upgraded maliciously, we transfer LP tokens to a
    /// cryptographically dead address that no one can control.
    ///
    /// The dead address is derived from an all-zeros public key, making it
    /// mathematically impossible to generate a valid signature for it.
    fn burn_lp_tokens(env: &Env, pair: &Address, amount: i128) -> Result<(), AstroSwapError> {
        if amount <= 0 {
            return Ok(()); // Nothing to burn
        }

        // Dead address: GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF
        // This is a valid Stellar address with an all-zeros public key.
        // No one can ever sign transactions from this address, making tokens
        // sent here permanently locked.
        let dead_address_str = String::from_str(env, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF");
        let dead_address = Address::from_string(&dead_address_str);

        // Transfer LP tokens to dead address - permanently locked forever
        // This is safer than calling burn() because:
        // 1. No dependency on pair contract's burn implementation
        // 2. Even if bridge is upgraded, tokens are already transferred
        // 3. Verifiable on-chain that tokens went to provably dead address
        //
        // The pair contract implements the token interface, so we use token::Client
        let lp_token_client = token::Client::new(env, pair);
        lp_token_client.transfer(
            &env.current_contract_address(),
            &dead_address,
            &amount,
        );

        // Log the burn for transparency
        LpBurned {
            pair: pair.clone(),
            amount,
        }
        .publish(env);

        Ok(())
    }

    /// Create a staking pool for a graduated pair
    fn create_staking_pool(
        env: &Env,
        staking: &Address,
        lp_token: &Address,
    ) -> Result<u32, AstroSwapError> {
        // Call staking contract to create a new pool
        // The pool will use LP tokens as the stake token
        let admin = get_admin(env)?;
        let current_time = env.ledger().timestamp();
        let end_time = current_time + DEFAULT_STAKING_DURATION;

        let pool_id: u32 = env.invoke_contract(
            staking,
            &Symbol::new(env, "create_pool"),
            Vec::from_array(
                env,
                [
                    admin.to_val(),
                    lp_token.to_val(),
                    0i128.into_val(env), // reward_per_second - to be set by admin
                    current_time.into_val(env), // start_time
                    end_time.into_val(env), // end_time
                ],
            ),
        );

        Ok(pool_id)
    }

    /// Verify caller is admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        caller.require_auth();
        if *caller != get_admin(env)? {
            return Err(AstroSwapError::Unauthorized);
        }
        Ok(())
    }

    /// Verify caller is registered launchpad
    fn require_launchpad(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        caller.require_auth();
        let launchpad = get_launchpad(env).ok_or(AstroSwapError::InvalidLaunchpad)?;
        if *caller != launchpad {
            return Err(AstroSwapError::Unauthorized);
        }
        Ok(())
    }

    /// Verify contract is not paused
    fn require_not_paused(env: &Env) -> Result<(), AstroSwapError> {
        if is_paused(env) {
            return Err(AstroSwapError::ContractPaused);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    /// Helper to register bridge with constructor args (CAP-58 pattern)
    fn register_bridge<'a>(
        env: &'a Env,
        admin: &Address,
        factory: &Address,
        staking: &Address,
        launchpad: &Address,
        quote_token: &Address,
    ) -> AstroSwapBridgeClient<'a> {
        let bridge_addr = env.register(
            AstroSwapBridge,
            (
                admin.clone(),
                factory.clone(),
                staking.clone(),
                launchpad.clone(),
                quote_token.clone(),
            ),
        );
        AstroSwapBridgeClient::new(env, &bridge_addr)
    }

    #[test]
    fn test_constructor_initializes_bridge() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let staking = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let quote_token = Address::generate(&env);

        // Constructor runs atomically with registration (CAP-58)
        let client = register_bridge(&env, &admin, &factory, &staking, &launchpad, &quote_token);

        assert_eq!(client.admin(), admin);
        assert_eq!(client.factory(), factory);
        assert_eq!(client.staking(), staking);
        assert_eq!(client.launchpad(), Some(launchpad));
        assert_eq!(client.quote_token(), Some(quote_token));
        assert_eq!(client.graduation_count(), 0);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_legacy_initialize_fails_after_constructor() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let staking = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let quote_token = Address::generate(&env);

        // Contract is already initialized via constructor
        let client = register_bridge(&env, &admin, &factory, &staking, &launchpad, &quote_token);

        // Legacy initialize should fail with AlreadyInitialized error
        let other_admin = Address::generate(&env);
        let result = client.try_initialize(&other_admin, &factory, &staking, &launchpad, &quote_token);
        assert!(result.is_err());
    }

    #[test]
    fn test_is_graduated_false_for_unknown() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let staking = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let quote_token = Address::generate(&env);

        let client = register_bridge(&env, &admin, &factory, &staking, &launchpad, &quote_token);

        let unknown_token = Address::generate(&env);
        assert!(!client.is_graduated(&unknown_token));
    }

    #[test]
    fn test_pause_unpause() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let staking = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let quote_token = Address::generate(&env);

        let client = register_bridge(&env, &admin, &factory, &staking, &launchpad, &quote_token);

        assert!(!client.is_paused());

        client.set_paused(&admin, &true);
        assert!(client.is_paused());

        client.set_paused(&admin, &false);
        assert!(!client.is_paused());
    }

    #[test]
    fn test_update_launchpad() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let factory = Address::generate(&env);
        let staking = Address::generate(&env);
        let launchpad = Address::generate(&env);
        let quote_token = Address::generate(&env);
        let new_launchpad = Address::generate(&env);

        let client = register_bridge(&env, &admin, &factory, &staking, &launchpad, &quote_token);
        assert_eq!(client.launchpad(), Some(launchpad));

        client.set_launchpad(&admin, &new_launchpad);
        assert_eq!(client.launchpad(), Some(new_launchpad));
    }
}
