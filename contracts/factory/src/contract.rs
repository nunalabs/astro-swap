use astroswap_shared::{emit_pair_created, AstroSwapError, TokenMetadata};
use soroban_sdk::{contract, contractimpl, xdr::ToXdr, Address, Bytes, BytesN, Env, Vec};

use crate::storage::{
    add_pair_to_list, extend_instance_ttl, get_admin, get_fee_recipient, get_launchpad, get_pair,
    get_pair_by_index, get_pair_wasm_hash, get_pairs_count, get_protocol_fee_bps,
    increment_pairs_count, is_initialized, is_paused, is_public_pair_creation_enabled,
    is_token_graduated, set_admin, set_fee_recipient, set_graduated_token, set_initialized,
    set_launchpad, set_pair, set_pair_wasm_hash, set_paused, set_protocol_fee_bps,
    set_public_pair_creation, sort_tokens, GraduatedTokenInfo,
};

#[contract]
pub struct AstroSwapFactory;

#[contractimpl]
impl AstroSwapFactory {
    /// Constructor - atomic initialization, cannot be front-run (CAP-58)
    /// Called automatically when contract is deployed
    pub fn __constructor(
        env: Env,
        admin: Address,
        pair_wasm_hash: BytesN<32>,
        protocol_fee_bps: u32,
    ) {
        // Validate fee (max 1% = 100 bps)
        if protocol_fee_bps > 100 {
            // Use panic_with_error for proper error encoding in constructor
            env.panic_with_error(AstroSwapError::FeeTooHigh);
        }

        set_admin(&env, &admin);
        set_pair_wasm_hash(&env, &pair_wasm_hash);
        set_protocol_fee_bps(&env, protocol_fee_bps);
        set_public_pair_creation(&env, true); // Enable by default (testnet-friendly)
        set_initialized(&env);

        extend_instance_ttl(&env);
    }

    /// Legacy initialize for backwards compatibility with existing deployments
    /// New deployments should use constructor
    #[allow(dead_code)]
    pub fn initialize(
        env: Env,
        admin: Address,
        pair_wasm_hash: BytesN<32>,
        protocol_fee_bps: u32,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        // Validate fee (max 1% = 100 bps)
        if protocol_fee_bps > 100 {
            return Err(AstroSwapError::FeeTooHigh);
        }

        set_admin(&env, &admin);
        set_pair_wasm_hash(&env, &pair_wasm_hash);
        set_protocol_fee_bps(&env, protocol_fee_bps);
        set_public_pair_creation(&env, true); // Enable by default (testnet-friendly)
        set_initialized(&env);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Create a new trading pair
    /// Returns the address of the new pair contract
    ///
    /// # Access Control
    /// If public_pair_creation is disabled (default), only admin can create pairs.
    /// This prevents spam attacks. Admin can enable public creation later if desired.
    pub fn create_pair(
        env: Env,
        caller: Address,
        token_a: Address,
        token_b: Address,
    ) -> Result<Address, AstroSwapError> {
        Self::require_not_paused(&env)?;

        // Check if public pair creation is enabled
        if !is_public_pair_creation_enabled(&env) {
            // Only admin can create pairs when public creation is disabled
            Self::require_admin(&env, &caller)?;
        } else {
            // Public creation enabled - still require auth from caller
            caller.require_auth();
        }

        // Tokens must be different
        if token_a == token_b {
            return Err(AstroSwapError::SameToken);
        }

        // Validate that both addresses implement token interface
        // Uses lightweight decimals() check that works with SAC and custom tokens
        Self::validate_token_contract(&env, &token_a)?;
        Self::validate_token_contract(&env, &token_b)?;

        // Check if pair already exists
        if get_pair(&env, &token_a, &token_b).is_some() {
            return Err(AstroSwapError::PairExists);
        }

        // Sort tokens for consistent ordering
        let (token_0, token_1) = sort_tokens(&token_a, &token_b);

        // Deploy new pair contract
        let pair_wasm_hash = get_pair_wasm_hash(&env)?;

        // Create deterministic contract ID based on tokens using XDR serialization
        // This is the recommended pattern from Stellar docs for deterministic addresses
        let mut salt_preimage = Bytes::new(&env);
        salt_preimage.append(&token_0.clone().to_xdr(&env));
        salt_preimage.append(&token_1.clone().to_xdr(&env));
        let salt = env.crypto().sha256(&salt_preimage);

        // Deploy pair contract with constructor args (CAP-58)
        // Constructor signature: __constructor(factory, token_0, token_1)
        let pair_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(
                pair_wasm_hash,
                (
                    env.current_contract_address(), // factory
                    token_0.clone(),                // token_0
                    token_1.clone(),                // token_1
                ),
            );

        // Note: No separate initialize call needed - constructor handles it

        // Store pair mapping
        set_pair(&env, &token_0, &token_1, &pair_address);

        // Add to list and get index
        let pair_index = increment_pairs_count(&env);
        add_pair_to_list(&env, &pair_address, pair_index - 1);

        // Emit event
        emit_pair_created(&env, &token_0, &token_1, &pair_address, pair_index);

        extend_instance_ttl(&env);

        Ok(pair_address)
    }

    /// Get the pair address for two tokens
    pub fn get_pair(env: Env, token_a: Address, token_b: Address) -> Option<Address> {
        extend_instance_ttl(&env);
        get_pair(&env, &token_a, &token_b)
    }

    /// Get pair by index
    pub fn get_pair_by_index(env: Env, index: u32) -> Option<Address> {
        extend_instance_ttl(&env);
        get_pair_by_index(&env, index)
    }

    /// Get total number of pairs
    pub fn all_pairs_length(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_pairs_count(&env)
    }

    /// Get pairs with pagination
    ///
    /// Returns a vector of pair addresses starting at `start_index` up to `limit` pairs.
    /// This is more efficient than calling `get_pair_by_index` multiple times.
    ///
    /// # Arguments
    /// * `start_index` - Index to start from (0-based)
    /// * `limit` - Maximum number of pairs to return (capped at 100)
    ///
    /// # Returns
    /// * Vector of pair addresses
    pub fn get_pairs_paginated(env: Env, start_index: u32, limit: u32) -> Vec<Address> {
        extend_instance_ttl(&env);

        let total = get_pairs_count(&env);
        let mut pairs = Vec::new(&env);

        // Cap limit at 100 to prevent excessive gas usage
        let max_limit = 100u32;
        let effective_limit = if limit > max_limit { max_limit } else { limit };

        // Return empty if start_index is beyond total pairs
        if start_index >= total {
            return pairs;
        }

        // Calculate end index (exclusive)
        let end_index = {
            let potential_end = start_index.saturating_add(effective_limit);
            if potential_end > total { total } else { potential_end }
        };

        // Collect pairs
        for i in start_index..end_index {
            if let Some(pair) = get_pair_by_index(&env, i) {
                pairs.push_back(pair);
            }
        }

        pairs
    }

    /// Check if a pair exists
    pub fn pair_exists(env: Env, token_a: Address, token_b: Address) -> bool {
        get_pair(&env, &token_a, &token_b).is_some()
    }

    // ==================== Admin Functions ====================

    /// Set the fee recipient address
    /// Only admin can call
    pub fn set_fee_to(env: Env, caller: Address, recipient: Address) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_fee_recipient(&env, &recipient);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Set the protocol fee in basis points
    /// Only admin can call
    pub fn set_protocol_fee(env: Env, caller: Address, fee_bps: u32) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;

        // Max fee is 1% (100 bps)
        if fee_bps > 100 {
            return Err(AstroSwapError::FeeTooHigh);
        }

        set_protocol_fee_bps(&env, fee_bps);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Update the pair WASM hash for future deployments
    /// Only admin can call
    pub fn set_pair_wasm_hash(
        env: Env,
        caller: Address,
        wasm_hash: BytesN<32>,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_pair_wasm_hash(&env, &wasm_hash);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Transfer admin role to new address
    /// Only current admin can call
    pub fn set_admin(env: Env, caller: Address, new_admin: Address) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_admin(&env, &new_admin);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Pause or unpause the factory
    /// Only admin can call
    pub fn set_paused(env: Env, caller: Address, paused: bool) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_paused(&env, paused);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Set the Astro-Shiba launchpad address
    /// Only admin can call
    pub fn set_launchpad(
        env: Env,
        caller: Address,
        launchpad: Address,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_launchpad(&env, &launchpad);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Enable or disable public pair creation
    /// Only admin can call
    ///
    /// When disabled (default), only admin can create pairs (prevents spam).
    /// When enabled, anyone can create pairs (more permissionless but riskier).
    pub fn set_public_pair_creation(
        env: Env,
        caller: Address,
        enabled: bool,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &caller)?;
        set_public_pair_creation(&env, enabled);
        extend_instance_ttl(&env);
        Ok(())
    }

    // ==================== Astro-Shiba Integration ====================

    /// Register a graduated token from Astro-Shiba launchpad
    /// Only launchpad contract can call
    pub fn register_graduated_token(
        env: Env,
        caller: Address,
        token: Address,
        metadata: TokenMetadata,
    ) -> Result<(), AstroSwapError> {
        // Verify caller is the launchpad
        let launchpad = get_launchpad(&env).ok_or(AstroSwapError::InvalidLaunchpad)?;
        if caller != launchpad {
            return Err(AstroSwapError::Unauthorized);
        }

        // Check if already graduated
        if is_token_graduated(&env, &token) {
            return Err(AstroSwapError::AlreadyGraduated);
        }

        // Create pair with XLM (or USDC as quote token)
        // For now, we'll store as pending graduation
        let info = GraduatedTokenInfo {
            token: token.clone(),
            pair: env.current_contract_address(), // Placeholder, updated when pair is created
            metadata,
            graduation_time: env.ledger().timestamp(),
        };

        set_graduated_token(&env, &token, &info);
        extend_instance_ttl(&env);

        Ok(())
    }

    /// Create a pair for a graduated token with initial liquidity
    /// Only launchpad contract can call
    pub fn create_graduated_pair(
        env: Env,
        caller: Address,
        token: Address,
        quote_token: Address,
    ) -> Result<Address, AstroSwapError> {
        // Verify caller is the launchpad
        let launchpad = get_launchpad(&env).ok_or(AstroSwapError::InvalidLaunchpad)?;
        if caller != launchpad {
            return Err(AstroSwapError::Unauthorized);
        }

        // Verify token is graduated
        if !is_token_graduated(&env, &token) {
            return Err(AstroSwapError::TokenNotGraduated);
        }

        // Create the pair (launchpad is authorized to create graduated pairs)
        Self::create_pair(env, caller, token, quote_token)
    }

    // ==================== View Functions ====================

    /// Get the admin address
    /// Returns error if contract is not initialized
    pub fn admin(env: Env) -> Result<Address, AstroSwapError> {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    /// Get the fee recipient address
    pub fn fee_to(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_fee_recipient(&env)
    }

    /// Get the protocol fee in basis points
    pub fn protocol_fee_bps(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_protocol_fee_bps(&env)
    }

    /// Check if the factory is paused
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    /// Get the launchpad address
    pub fn launchpad(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_launchpad(&env)
    }

    /// Check if a token has graduated from Astro-Shiba
    pub fn is_graduated(env: Env, token: Address) -> bool {
        is_token_graduated(&env, &token)
    }

    /// Check if public pair creation is enabled
    pub fn is_public_pair_creation_enabled(env: Env) -> bool {
        is_public_pair_creation_enabled(&env)
    }

    // ==================== Internal Functions ====================

    /// Verify caller is admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        caller.require_auth();

        if *caller != get_admin(env)? {
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

    /// Validate that an address is a valid Soroban token contract
    ///
    /// # Security
    /// This prevents creating pairs with invalid addresses, which could:
    /// 1. Waste storage and confuse users in the UI
    /// 2. Create pairs with non-token contracts that can't be traded
    ///
    /// # Implementation
    /// Attempts to call token.decimals(). If this succeeds, we know
    /// the address implements at least part of the token interface.
    /// This is a lightweight check that works with both SAC and custom tokens.
    fn validate_token_contract(env: &Env, token: &Address) -> Result<(), AstroSwapError> {
        use soroban_sdk::token;

        // Try to get token decimals - minimal validation
        let token_client = token::Client::new(env, token);

        // Calling decimals() - if it panics/fails, the error will be caught
        // by the Soroban runtime and converted to an error return
        let _ = token_client.decimals();

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    /// Helper to register factory with constructor args (CAP-58 pattern)
    fn register_factory<'a>(
        env: &'a Env,
        admin: &Address,
        wasm_hash: &BytesN<32>,
        protocol_fee_bps: u32,
    ) -> AstroSwapFactoryClient<'a> {
        let factory_addr = env.register(
            AstroSwapFactory,
            (admin.clone(), wasm_hash.clone(), protocol_fee_bps),
        );
        AstroSwapFactoryClient::new(env, &factory_addr)
    }

    #[test]
    fn test_constructor_initializes_factory() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Constructor runs atomically with registration (CAP-58)
        let client = register_factory(&env, &admin, &wasm_hash, 30);

        // Verify state is initialized correctly
        assert_eq!(client.admin(), admin);
        assert_eq!(client.protocol_fee_bps(), 30);
        assert_eq!(client.all_pairs_length(), 0);
    }

    #[test]
    fn test_legacy_initialize_fails_after_constructor() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Contract is already initialized via constructor
        let client = register_factory(&env, &admin, &wasm_hash, 30);

        // Legacy initialize should fail with AlreadyInitialized error
        let other_admin = Address::generate(&env);
        let result = client.try_initialize(&other_admin, &wasm_hash, &30);
        assert!(result.is_err());
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #501)")]
    fn test_constructor_fee_too_high_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Constructor should panic with FeeTooHigh error (#501) when fee > 100 bps
        let _factory_addr = env.register(
            AstroSwapFactory,
            (admin.clone(), wasm_hash.clone(), 200u32), // 2% fee - too high
        );
    }
}
