use astroswap_shared::{
    calculate_k, calculate_liquidity_tokens, calculate_withdrawal_amounts, emit_deposit, emit_swap,
    emit_withdraw, get_amount_in, get_amount_out, safe_sub, update_reserves_add, update_reserves_sub,
    update_reserves_swap, verify_k_invariant, AstroSwapError, PairInfo, DEFAULT_SWAP_FEE_BPS,
    MINIMUM_LIQUIDITY,
};
use soroban_sdk::{contract, contractimpl, token, Address, Env, String};

use crate::storage::{
    extend_instance_ttl, get_balance, get_factory, get_fee_bps, get_k_last, get_reserves,
    get_token_0, get_token_1, get_total_supply, is_initialized, is_locked, is_paused, set_factory,
    set_fee_bps, set_initialized, set_k_last, set_locked, set_paused, set_reserves, set_token_0, set_token_1,
};

use crate::token as lp_token;

#[contract]
pub struct AstroSwapPair;

#[contractimpl]
impl AstroSwapPair {
    /// Initialize the pair contract
    /// Called by the factory after deployment
    pub fn initialize(
        env: Env,
        factory: Address,
        token_0: Address,
        token_1: Address,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        // Tokens must be different
        if token_0 == token_1 {
            return Err(AstroSwapError::SameToken);
        }

        set_factory(&env, &factory);
        set_token_0(&env, &token_0);
        set_token_1(&env, &token_1);
        set_fee_bps(&env, DEFAULT_SWAP_FEE_BPS);
        set_initialized(&env);
        set_locked(&env, false);

        extend_instance_ttl(&env);

        Ok(())
    }

    // ==================== Reentrancy Guard ====================

    /// Internal function to acquire reentrancy lock
    fn acquire_lock(env: &Env) -> Result<(), AstroSwapError> {
        if is_locked(env) {
            return Err(AstroSwapError::InvalidArgument); // Reentrancy detected
        }
        set_locked(env, true);
        Ok(())
    }

    /// Internal function to release reentrancy lock
    fn release_lock(env: &Env) {
        set_locked(env, false);
    }

    /// Verify contract is not paused
    fn require_not_paused(env: &Env) -> Result<(), AstroSwapError> {
        if is_paused(env) {
            return Err(AstroSwapError::ContractPaused);
        }
        Ok(())
    }

    /// Verify caller is factory (for admin functions)
    fn require_factory(env: &Env) -> Result<(), AstroSwapError> {
        let factory = get_factory(env);
        factory.require_auth();
        Ok(())
    }

    // ==================== Admin Functions ====================

    /// Pause or unpause the pair contract
    /// Only factory can call (which requires admin auth)
    pub fn set_paused(env: Env, paused: bool) -> Result<(), AstroSwapError> {
        Self::require_factory(&env)?;
        set_paused(&env, paused);
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Check if the contract is paused
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
    }

    /// Deposit liquidity and receive LP tokens
    ///
    /// # Arguments
    /// * `user` - The address depositing liquidity
    /// * `amount_0_desired` - Desired amount of token_0 to deposit
    /// * `amount_1_desired` - Desired amount of token_1 to deposit
    /// * `amount_0_min` - Minimum amount of token_0 (slippage protection)
    /// * `amount_1_min` - Minimum amount of token_1 (slippage protection)
    ///
    /// # Returns
    /// * Tuple of (amount_0_used, amount_1_used, shares_minted)
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn deposit(
        env: Env,
        user: Address,
        amount_0_desired: i128,
        amount_1_desired: i128,
        amount_0_min: i128,
        amount_1_min: i128,
    ) -> Result<(i128, i128, i128), AstroSwapError> {
        // Check pause status first
        Self::require_not_paused(&env)?;

        // Reentrancy guard
        Self::acquire_lock(&env)?;

        user.require_auth();

        if amount_0_desired <= 0 || amount_1_desired <= 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        let (reserve_0, reserve_1) = get_reserves(&env);
        let total_supply = get_total_supply(&env);

        // Calculate optimal amounts
        let (amount_0, amount_1) = if total_supply == 0 {
            // First deposit - use desired amounts
            (amount_0_desired, amount_1_desired)
        } else {
            // Calculate optimal based on current ratio
            let amount_1_optimal = astroswap_shared::quote(amount_0_desired, reserve_0, reserve_1)?;

            if amount_1_optimal <= amount_1_desired {
                if amount_1_optimal < amount_1_min {
                    return Err(AstroSwapError::MinimumNotMet);
                }
                (amount_0_desired, amount_1_optimal)
            } else {
                let amount_0_optimal =
                    astroswap_shared::quote(amount_1_desired, reserve_1, reserve_0)?;
                if amount_0_optimal > amount_0_desired || amount_0_optimal < amount_0_min {
                    return Err(AstroSwapError::MinimumNotMet);
                }
                (amount_0_optimal, amount_1_desired)
            }
        };

        // Calculate LP tokens to mint
        let shares =
            calculate_liquidity_tokens(amount_0, amount_1, reserve_0, reserve_1, total_supply)?;

        if shares <= 0 {
            return Err(AstroSwapError::InsufficientLiquidity);
        }

        // Transfer tokens from user to pool
        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);

        let token_0_client = token::Client::new(&env, &token_0);
        let token_1_client = token::Client::new(&env, &token_1);

        token_0_client.transfer(&user, &env.current_contract_address(), &amount_0);
        token_1_client.transfer(&user, &env.current_contract_address(), &amount_1);

        // Mint LP tokens
        if total_supply == 0 {
            // Lock minimum liquidity forever to prevent attacks
            lp_token::mint(&env, &env.current_contract_address(), MINIMUM_LIQUIDITY)?;
        }
        lp_token::mint(&env, &user, shares)?;

        // Update reserves (with overflow protection)
        let (new_reserve_0, new_reserve_1) =
            update_reserves_add(reserve_0, reserve_1, amount_0, amount_1)?;
        set_reserves(&env, new_reserve_0, new_reserve_1);

        // Update k_last for protocol fee (with overflow protection)
        let k = calculate_k(new_reserve_0, new_reserve_1)?;
        set_k_last(&env, k);

        // Emit event
        emit_deposit(
            &env,
            &user,
            &env.current_contract_address(),
            amount_0,
            amount_1,
            shares,
        );

        extend_instance_ttl(&env);

        // Release reentrancy lock
        Self::release_lock(&env);

        Ok((amount_0, amount_1, shares))
    }

    /// Withdraw liquidity by burning LP tokens
    ///
    /// # Arguments
    /// * `user` - The address withdrawing liquidity
    /// * `shares` - Amount of LP tokens to burn
    /// * `amount_0_min` - Minimum amount of token_0 to receive
    /// * `amount_1_min` - Minimum amount of token_1 to receive
    ///
    /// # Returns
    /// * Tuple of (amount_0_received, amount_1_received)
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn withdraw(
        env: Env,
        user: Address,
        shares: i128,
        amount_0_min: i128,
        amount_1_min: i128,
    ) -> Result<(i128, i128), AstroSwapError> {
        // Check pause status first
        Self::require_not_paused(&env)?;

        // Reentrancy guard
        Self::acquire_lock(&env)?;

        user.require_auth();

        if shares <= 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        let user_balance = get_balance(&env, &user);
        if user_balance < shares {
            Self::release_lock(&env);
            return Err(AstroSwapError::InsufficientBalance);
        }

        let (reserve_0, reserve_1) = get_reserves(&env);
        let total_supply = get_total_supply(&env);

        // Calculate amounts to return
        let (amount_0, amount_1) =
            calculate_withdrawal_amounts(shares, reserve_0, reserve_1, total_supply)?;

        // Check minimums (slippage protection)
        if amount_0 < amount_0_min || amount_1 < amount_1_min {
            Self::release_lock(&env);
            return Err(AstroSwapError::MinimumNotMet);
        }

        // Burn LP tokens
        lp_token::burn(&env, &user, shares)?;

        // Transfer tokens to user
        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);

        let token_0_client = token::Client::new(&env, &token_0);
        let token_1_client = token::Client::new(&env, &token_1);

        token_0_client.transfer(&env.current_contract_address(), &user, &amount_0);
        token_1_client.transfer(&env.current_contract_address(), &user, &amount_1);

        // Update reserves (with underflow protection)
        let (new_reserve_0, new_reserve_1) =
            update_reserves_sub(reserve_0, reserve_1, amount_0, amount_1)?;
        set_reserves(&env, new_reserve_0, new_reserve_1);

        // Update k_last (with overflow protection)
        let k = calculate_k(new_reserve_0, new_reserve_1)?;
        set_k_last(&env, k);

        // Emit event
        emit_withdraw(
            &env,
            &user,
            &env.current_contract_address(),
            shares,
            amount_0,
            amount_1,
        );

        extend_instance_ttl(&env);

        // Release reentrancy lock
        Self::release_lock(&env);

        Ok((amount_0, amount_1))
    }

    /// Execute a swap
    ///
    /// # Arguments
    /// * `user` - The address executing the swap
    /// * `token_in` - Address of the token being swapped in
    /// * `amount_in` - Amount of token_in to swap
    /// * `min_out` - Minimum amount of output token (slippage protection)
    ///
    /// # Returns
    /// * Amount of output token received
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn swap(
        env: Env,
        user: Address,
        token_in: Address,
        amount_in: i128,
        min_out: i128,
    ) -> Result<i128, AstroSwapError> {
        // Check pause status first
        Self::require_not_paused(&env)?;

        // Reentrancy guard
        Self::acquire_lock(&env)?;

        user.require_auth();

        if amount_in <= 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);

        // Determine swap direction
        let (reserve_in, reserve_out, token_out, is_token_0_in) = if token_in == token_0 {
            let (r0, r1) = get_reserves(&env);
            (r0, r1, token_1.clone(), true)
        } else if token_in == token_1 {
            let (r0, r1) = get_reserves(&env);
            (r1, r0, token_0.clone(), false)
        } else {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidToken);
        };

        // Calculate output amount
        let fee_bps = get_fee_bps(&env);
        let amount_out = match get_amount_out(amount_in, reserve_in, reserve_out, fee_bps) {
            Ok(out) => out,
            Err(e) => {
                Self::release_lock(&env);
                return Err(e);
            }
        };

        // Check slippage
        if amount_out < min_out {
            Self::release_lock(&env);
            return Err(AstroSwapError::SlippageExceeded);
        }

        // Transfer input tokens from user
        let token_in_client = token::Client::new(&env, &token_in);
        token_in_client.transfer(&user, &env.current_contract_address(), &amount_in);

        // Transfer output tokens to user
        let token_out_client = token::Client::new(&env, &token_out);
        token_out_client.transfer(&env.current_contract_address(), &user, &amount_out);

        // Update reserves (with overflow/underflow protection)
        let (new_reserve_0, new_reserve_1) =
            update_reserves_swap(reserve_in, reserve_out, amount_in, amount_out, is_token_0_in)?;
        set_reserves(&env, new_reserve_0, new_reserve_1);

        // Verify k invariant (should increase slightly due to fees)
        // Get original reserves for k comparison
        let (orig_reserve_0, orig_reserve_1) = if is_token_0_in {
            (reserve_in, reserve_out)
        } else {
            (reserve_out, reserve_in)
        };
        if !verify_k_invariant(new_reserve_0, new_reserve_1, orig_reserve_0, orig_reserve_1)? {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        // Emit event
        emit_swap(&env, &user, &token_in, &token_out, amount_in, amount_out);

        extend_instance_ttl(&env);

        // Release reentrancy lock
        Self::release_lock(&env);

        Ok(amount_out)
    }

    /// Low-level swap for router (tokens already in contract)
    /// Used by router for multi-hop swaps where tokens are pre-transferred
    ///
    /// # Arguments
    /// * `to` - Recipient of output tokens (next pair or final user)
    /// * `token_in` - Address of the input token
    /// * `min_out` - Minimum output amount (slippage protection)
    ///
    /// # Returns
    /// * (amount_in, amount_out) - Actual amounts swapped
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn swap_from_balance(
        env: Env,
        to: Address,
        token_in: Address,
        min_out: i128,
    ) -> Result<(i128, i128), AstroSwapError> {
        // Check pause status first
        Self::require_not_paused(&env)?;

        // Reentrancy guard
        Self::acquire_lock(&env)?;

        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);
        let (reserve_0, reserve_1) = get_reserves(&env);

        // Get current balances
        let token_0_client = token::Client::new(&env, &token_0);
        let token_1_client = token::Client::new(&env, &token_1);
        let balance_0 = token_0_client.balance(&env.current_contract_address());
        let balance_1 = token_1_client.balance(&env.current_contract_address());

        // Determine swap direction and calculate amount_in from balance diff (with underflow protection)
        let (amount_in, reserve_in, reserve_out, token_out, is_token_0_in) = if token_in == token_0 {
            let amount_in = match safe_sub(balance_0, reserve_0) {
                Ok(amt) if amt > 0 => amt,
                _ => {
                    Self::release_lock(&env);
                    return Err(AstroSwapError::InvalidAmount);
                }
            };
            (amount_in, reserve_0, reserve_1, token_1.clone(), true)
        } else if token_in == token_1 {
            let amount_in = match safe_sub(balance_1, reserve_1) {
                Ok(amt) if amt > 0 => amt,
                _ => {
                    Self::release_lock(&env);
                    return Err(AstroSwapError::InvalidAmount);
                }
            };
            (amount_in, reserve_1, reserve_0, token_0.clone(), false)
        } else {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidToken);
        };

        // Calculate output amount
        let fee_bps = get_fee_bps(&env);
        let amount_out = match get_amount_out(amount_in, reserve_in, reserve_out, fee_bps) {
            Ok(out) => out,
            Err(e) => {
                Self::release_lock(&env);
                return Err(e);
            }
        };

        // Check slippage
        if amount_out < min_out {
            Self::release_lock(&env);
            return Err(AstroSwapError::SlippageExceeded);
        }

        // Transfer output tokens to recipient
        let token_out_client = token::Client::new(&env, &token_out);
        token_out_client.transfer(&env.current_contract_address(), &to, &amount_out);

        // Update reserves based on actual balances after output transfer (with underflow protection)
        let (new_balance_0, new_balance_1) = if is_token_0_in {
            let new_b1 = safe_sub(balance_1, amount_out)?;
            (balance_0, new_b1)
        } else {
            let new_b0 = safe_sub(balance_0, amount_out)?;
            (new_b0, balance_1)
        };
        set_reserves(&env, new_balance_0, new_balance_1);

        // Verify k invariant (with overflow protection)
        if !verify_k_invariant(new_balance_0, new_balance_1, reserve_0, reserve_1)? {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        // Emit event
        emit_swap(&env, &to, &token_in, &token_out, amount_in, amount_out);

        extend_instance_ttl(&env);

        // Release reentrancy lock
        Self::release_lock(&env);

        Ok((amount_in, amount_out))
    }

    /// Force reserves to match actual token balances
    /// SECURITY: Only callable by factory contract to prevent manipulation
    /// This prevents attackers from manipulating reserves after sending tokens
    /// to the pair, which could be used in flash loan or arbitrage attacks.
    pub fn sync(env: Env) -> Result<(), AstroSwapError> {
        // SECURITY FIX: Only factory can call sync
        // This prevents reserve manipulation attacks where an attacker could:
        // 1. Send tokens directly to the pair
        // 2. Call sync to update reserves
        // 3. Exploit the price change in the same transaction
        let factory = get_factory(&env);
        factory.require_auth();

        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);

        let token_0_client = token::Client::new(&env, &token_0);
        let token_1_client = token::Client::new(&env, &token_1);

        let balance_0 = token_0_client.balance(&env.current_contract_address());
        let balance_1 = token_1_client.balance(&env.current_contract_address());

        set_reserves(&env, balance_0, balance_1);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Transfer excess tokens to a recipient
    /// SECURITY: Only callable by factory contract to prevent exploitation
    /// This function transfers the difference between actual balance and reserves
    ///
    /// In UniswapV2, skim() is used to recover tokens sent to the pair by mistake.
    /// We restrict this to factory only to prevent exploitation attacks where
    /// an attacker could front-run a deposit to extract the tokens.
    pub fn skim(env: Env, to: Address) -> Result<(), AstroSwapError> {
        // SECURITY FIX: Only factory can call skim
        // This prevents exploitation where anyone could extract excess tokens
        // that may exist temporarily during deposit/swap operations
        let factory = get_factory(&env);
        factory.require_auth();

        Self::acquire_lock(&env)?;

        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);
        let (reserve_0, reserve_1) = get_reserves(&env);

        let token_0_client = token::Client::new(&env, &token_0);
        let token_1_client = token::Client::new(&env, &token_1);

        let balance_0 = token_0_client.balance(&env.current_contract_address());
        let balance_1 = token_1_client.balance(&env.current_contract_address());

        // Transfer excess (using safe_sub for consistency even though we check balance > reserve)
        if balance_0 > reserve_0 {
            let excess_0 = safe_sub(balance_0, reserve_0)?;
            token_0_client.transfer(
                &env.current_contract_address(),
                &to,
                &excess_0,
            );
        }
        if balance_1 > reserve_1 {
            let excess_1 = safe_sub(balance_1, reserve_1)?;
            token_1_client.transfer(
                &env.current_contract_address(),
                &to,
                &excess_1,
            );
        }

        Self::release_lock(&env);
        extend_instance_ttl(&env);

        Ok(())
    }

    // ==================== View Functions ====================

    /// Get pair information
    pub fn get_info(env: Env) -> PairInfo {
        extend_instance_ttl(&env);

        let (reserve_a, reserve_b) = get_reserves(&env);

        PairInfo {
            token_a: get_token_0(&env),
            token_b: get_token_1(&env),
            reserve_a,
            reserve_b,
            total_shares: get_total_supply(&env),
            fee_bps: get_fee_bps(&env),
        }
    }

    /// Get token 0 address
    pub fn token_0(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_token_0(&env)
    }

    /// Get token 1 address
    pub fn token_1(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_token_1(&env)
    }

    /// Get reserves
    pub fn get_reserves(env: Env) -> (i128, i128) {
        extend_instance_ttl(&env);
        get_reserves(&env)
    }

    /// Get factory address
    pub fn factory(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_factory(&env)
    }

    /// Get fee in basis points
    pub fn fee_bps(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_fee_bps(&env)
    }

    /// Get k_last (product of reserves at last interaction)
    pub fn k_last(env: Env) -> i128 {
        extend_instance_ttl(&env);
        get_k_last(&env)
    }

    // ==================== Quote Functions ====================

    /// Get expected output amount for a swap
    pub fn get_amount_out(
        env: Env,
        amount_in: i128,
        token_in: Address,
    ) -> Result<i128, AstroSwapError> {
        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);
        let (reserve_0, reserve_1) = get_reserves(&env);
        let fee = get_fee_bps(&env);

        let (reserve_in, reserve_out) = if token_in == token_0 {
            (reserve_0, reserve_1)
        } else if token_in == token_1 {
            (reserve_1, reserve_0)
        } else {
            return Err(AstroSwapError::InvalidToken);
        };

        get_amount_out(amount_in, reserve_in, reserve_out, fee)
    }

    /// Get required input amount for a specific output
    pub fn get_amount_in(
        env: Env,
        amount_out: i128,
        token_out: Address,
    ) -> Result<i128, AstroSwapError> {
        let token_0 = get_token_0(&env);
        let token_1 = get_token_1(&env);
        let (reserve_0, reserve_1) = get_reserves(&env);
        let fee = get_fee_bps(&env);

        let (reserve_in, reserve_out) = if token_out == token_0 {
            (reserve_1, reserve_0)
        } else if token_out == token_1 {
            (reserve_0, reserve_1)
        } else {
            return Err(AstroSwapError::InvalidToken);
        };

        get_amount_in(amount_out, reserve_in, reserve_out, fee)
    }

    // ==================== LP Token Interface (SEP-41) ====================

    /// Get LP token name
    pub fn name(env: Env) -> String {
        lp_token::name(&env)
    }

    /// Get LP token symbol
    pub fn symbol(env: Env) -> String {
        lp_token::symbol(&env)
    }

    /// Get LP token decimals
    pub fn decimals(_env: Env) -> u32 {
        lp_token::decimals()
    }

    /// Get total supply of LP tokens
    pub fn total_supply(env: Env) -> i128 {
        extend_instance_ttl(&env);
        lp_token::total_supply(&env)
    }

    /// Get LP token balance
    pub fn balance(env: Env, owner: Address) -> i128 {
        extend_instance_ttl(&env);
        lp_token::balance_of(&env, &owner)
    }

    /// Get allowance
    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        extend_instance_ttl(&env);
        lp_token::allowance(&env, &owner, &spender)
    }

    /// Transfer LP tokens
    pub fn transfer(
        env: Env,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        lp_token::transfer(&env, &from, &to, amount)?;
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Transfer LP tokens using allowance
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        lp_token::transfer_from(&env, &spender, &from, &to, amount)?;
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Approve spender
    pub fn approve(
        env: Env,
        owner: Address,
        spender: Address,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        lp_token::approve(&env, &owner, &spender, amount)?;
        extend_instance_ttl(&env);
        Ok(())
    }

    /// Burn LP tokens (only callable by token owner)
    pub fn burn(env: Env, from: Address, amount: i128) -> Result<(), AstroSwapError> {
        from.require_auth();
        lp_token::burn(&env, &from, amount)?;
        extend_instance_ttl(&env);
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

        let contract_id = env.register_contract(None, AstroSwapPair);
        let client = AstroSwapPairClient::new(&env, &contract_id);

        let factory = Address::generate(&env);
        let token_0 = Address::generate(&env);
        let token_1 = Address::generate(&env);

        client.initialize(&factory, &token_0, &token_1);

        assert_eq!(client.factory(), factory);
        assert_eq!(client.token_0(), token_0);
        assert_eq!(client.token_1(), token_1);
        assert_eq!(client.fee_bps(), 30);
    }

    #[test]
    fn test_same_token_fails() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, AstroSwapPair);
        let client = AstroSwapPairClient::new(&env, &contract_id);

        let factory = Address::generate(&env);
        let token = Address::generate(&env);

        // Should fail with SameToken error (#101)
        let result = client.try_initialize(&factory, &token, &token);
        assert!(result.is_err());
    }
}
