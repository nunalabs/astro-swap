use astroswap_shared::{emit_pair_created, AstroSwapError, TokenMetadata};
use soroban_sdk::{contract, contractimpl, xdr::ToXdr, Address, Bytes, BytesN, Env, Symbol, Vec};

use crate::storage::{
    add_pair_to_list, extend_instance_ttl, get_admin, get_fee_recipient, get_launchpad, get_pair,
    get_pair_by_index, get_pair_wasm_hash, get_pairs_count, get_protocol_fee_bps,
    increment_pairs_count, is_initialized, is_paused, is_token_graduated, set_admin,
    set_fee_recipient, set_graduated_token, set_initialized, set_launchpad, set_pair,
    set_pair_wasm_hash, set_paused, set_protocol_fee_bps, sort_tokens, GraduatedTokenInfo,
};

#[contract]
pub struct AstroSwapFactory;

#[contractimpl]
impl AstroSwapFactory {
    /// Initialize the factory contract
    /// Can only be called once
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
        set_initialized(&env);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Create a new trading pair
    /// Returns the address of the new pair contract
    pub fn create_pair(
        env: Env,
        token_a: Address,
        token_b: Address,
    ) -> Result<Address, AstroSwapError> {
        Self::require_not_paused(&env)?;

        // Tokens must be different
        if token_a == token_b {
            return Err(AstroSwapError::SameToken);
        }

        // Check if pair already exists
        if get_pair(&env, &token_a, &token_b).is_some() {
            return Err(AstroSwapError::PairExists);
        }

        // Sort tokens for consistent ordering
        let (token_0, token_1) = sort_tokens(&token_a, &token_b);

        // Deploy new pair contract
        let pair_wasm_hash = get_pair_wasm_hash(&env);

        // Create deterministic contract ID based on tokens using XDR serialization
        // This is the recommended pattern from Stellar docs for deterministic addresses
        let mut salt_preimage = Bytes::new(&env);
        salt_preimage.append(&token_0.clone().to_xdr(&env));
        salt_preimage.append(&token_1.clone().to_xdr(&env));
        let salt = env.crypto().sha256(&salt_preimage);

        // Deploy pair contract with deploy_v2 (no constructor args)
        let pair_address = env
            .deployer()
            .with_current_contract(salt)
            .deploy_v2(pair_wasm_hash, ());

        // Initialize the pair contract via cross-contract call
        env.invoke_contract::<()>(
            &pair_address,
            &Symbol::new(&env, "initialize"),
            Vec::from_array(
                &env,
                [
                    env.current_contract_address().to_val(), // factory
                    token_0.clone().to_val(),
                    token_1.clone().to_val(),
                ],
            ),
        );

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

        // Create the pair
        Self::create_pair(env, token, quote_token)
    }

    // ==================== View Functions ====================

    /// Get the admin address
    pub fn admin(env: Env) -> Address {
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

    // ==================== Internal Functions ====================

    /// Verify caller is admin
    fn require_admin(env: &Env, caller: &Address) -> Result<(), AstroSwapError> {
        caller.require_auth();

        if *caller != get_admin(env) {
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

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapFactory, ());
        let client = AstroSwapFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        client.initialize(&admin, &wasm_hash, &30);

        assert_eq!(client.admin(), admin);
        assert_eq!(client.protocol_fee_bps(), 30);
        assert_eq!(client.all_pairs_length(), 0);
    }

    #[test]
    fn test_cannot_initialize_twice() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapFactory, ());
        let client = AstroSwapFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // First initialization should succeed
        client.initialize(&admin, &wasm_hash, &30);

        // Second initialization should fail with AlreadyInitialized error (#1)
        let result = client.try_initialize(&admin, &wasm_hash, &30);
        assert!(result.is_err());
    }

    #[test]
    fn test_fee_too_high() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AstroSwapFactory, ());
        let client = AstroSwapFactoryClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let wasm_hash = BytesN::from_array(&env, &[0u8; 32]);

        // Fee of 200 bps (2%) should fail with FeeTooHigh error (#501)
        let result = client.try_initialize(&admin, &wasm_hash, &200);
        assert!(result.is_err());
    }
}
