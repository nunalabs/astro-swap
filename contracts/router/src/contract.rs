use astroswap_shared::{
    get_amount_in, get_amount_out, AstroSwapError, FactoryClient, PairClient, MIN_TRADE_AMOUNT,
};
use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};

use crate::storage::{
    extend_instance_ttl, get_admin, get_factory, is_initialized, set_admin, set_factory,
    set_initialized,
};

#[contract]
pub struct AstroSwapRouter;

#[contractimpl]
impl AstroSwapRouter {
    /// Initialize the router contract
    pub fn initialize(env: Env, factory: Address, admin: Address) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        set_factory(&env, &factory);
        set_admin(&env, &admin);
        set_initialized(&env);

        extend_instance_ttl(&env);

        Ok(())
    }

    // Maximum path length to prevent excessive gas consumption
    const MAX_PATH_LENGTH: u32 = 5;

    /// Swap exact tokens for tokens
    /// Swaps a fixed amount of input tokens for as many output tokens as possible
    ///
    /// # Arguments
    /// * `user` - The address executing the swap
    /// * `amount_in` - Exact amount of input tokens
    /// * `amount_out_min` - Minimum amount of output tokens (slippage protection)
    /// * `path` - Vector of token addresses [tokenIn, ..., tokenOut]
    /// * `deadline` - Timestamp after which the transaction reverts
    ///
    /// # Returns
    /// * Vector of amounts for each swap in the path
    pub fn swap_exact_tokens_for_tokens(
        env: Env,
        user: Address,
        amount_in: i128,
        amount_out_min: i128,
        path: Vec<Address>,
        deadline: u64,
    ) -> Result<Vec<i128>, AstroSwapError> {
        user.require_auth();

        // Check deadline
        Self::check_deadline(&env, deadline)?;

        // Validate minimum trade amount (dust attack prevention)
        if amount_in < MIN_TRADE_AMOUNT {
            return Err(AstroSwapError::MinimumNotMet);
        }

        // Validate path
        Self::validate_path(&path)?;

        // Calculate amounts for the entire path
        let amounts = Self::get_amounts_out(&env, amount_in, &path)?;

        // Check slippage
        let final_amount = amounts.get(amounts.len() - 1).unwrap();
        if final_amount < amount_out_min {
            return Err(AstroSwapError::SlippageExceeded);
        }

        // Get factory and first pair
        let factory = get_factory(&env);
        let factory_client = FactoryClient::new(&env, &factory);

        let token_in = path.get(0).unwrap();
        let token_out = path.get(1).unwrap();

        // Get pair address
        let pair_address = factory_client
            .get_pair(&token_in, &token_out)
            .ok_or(AstroSwapError::PairNotFound)?;

        // Transfer input tokens from user to first pair
        let token_in_client = token::Client::new(&env, &token_in);
        token_in_client.transfer(&user, &pair_address, &amount_in);

        // Execute swaps along the path
        Self::execute_swaps(&env, &factory, &path, &amounts, &user)?;

        extend_instance_ttl(&env);

        Ok(amounts)
    }

    /// Swap tokens for exact tokens
    /// Swaps as few input tokens as possible for a fixed amount of output tokens
    pub fn swap_tokens_for_exact_tokens(
        env: Env,
        user: Address,
        amount_out: i128,
        amount_in_max: i128,
        path: Vec<Address>,
        deadline: u64,
    ) -> Result<Vec<i128>, AstroSwapError> {
        user.require_auth();

        // Check deadline
        Self::check_deadline(&env, deadline)?;

        // Validate minimum trade amount (dust attack prevention)
        if amount_out < MIN_TRADE_AMOUNT {
            return Err(AstroSwapError::MinimumNotMet);
        }

        // Validate path
        Self::validate_path(&path)?;

        // Calculate amounts for the entire path (reverse calculation)
        let amounts = Self::get_amounts_in(&env, amount_out, &path)?;

        // Check slippage
        let required_amount = amounts.get(0).unwrap();
        if required_amount > amount_in_max {
            return Err(AstroSwapError::ExcessiveInputAmount);
        }

        // Also validate that calculated input meets minimum (double protection)
        if required_amount < MIN_TRADE_AMOUNT {
            return Err(AstroSwapError::MinimumNotMet);
        }

        // Get factory and first pair
        let factory = get_factory(&env);
        let factory_client = FactoryClient::new(&env, &factory);

        let token_in = path.get(0).unwrap();
        let token_out = path.get(1).unwrap();

        // Get pair address
        let pair_address = factory_client
            .get_pair(&token_in, &token_out)
            .ok_or(AstroSwapError::PairNotFound)?;

        // Transfer input tokens from user to first pair
        let token_in_client = token::Client::new(&env, &token_in);
        token_in_client.transfer(&user, &pair_address, &required_amount);

        // Execute swaps along the path
        Self::execute_swaps(&env, &factory, &path, &amounts, &user)?;

        extend_instance_ttl(&env);

        Ok(amounts)
    }

    /// Add liquidity to a pair
    pub fn add_liquidity(
        env: Env,
        user: Address,
        token_a: Address,
        token_b: Address,
        amount_a_desired: i128,
        amount_b_desired: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        deadline: u64,
    ) -> Result<(i128, i128, i128), AstroSwapError> {
        user.require_auth();

        // Check deadline
        Self::check_deadline(&env, deadline)?;

        // Get factory and pair
        let factory = get_factory(&env);
        let factory_client = FactoryClient::new(&env, &factory);

        // Get or create pair
        let pair_address = match factory_client.get_pair(&token_a, &token_b) {
            Some(addr) => addr,
            None => factory_client.create_pair(&token_a, &token_b)?,
        };

        // Call pair's deposit function
        let pair_client = PairClient::new(&env, &pair_address);

        // Determine token order in the pair
        let token_0 = pair_client.token_0();

        let (amount_0_desired, amount_1_desired, amount_0_min, amount_1_min) = if token_a == token_0
        {
            (
                amount_a_desired,
                amount_b_desired,
                amount_a_min,
                amount_b_min,
            )
        } else {
            (
                amount_b_desired,
                amount_a_desired,
                amount_b_min,
                amount_a_min,
            )
        };

        // Deposit into pair
        let result = pair_client.deposit(
            &user,
            amount_0_desired,
            amount_1_desired,
            amount_0_min,
            amount_1_min,
        );

        extend_instance_ttl(&env);

        // Reorder result to match input token order
        if token_a == token_0 {
            Ok(result)
        } else {
            Ok((result.1, result.0, result.2))
        }
    }

    /// Remove liquidity from a pair
    pub fn remove_liquidity(
        env: Env,
        user: Address,
        token_a: Address,
        token_b: Address,
        liquidity: i128,
        amount_a_min: i128,
        amount_b_min: i128,
        deadline: u64,
    ) -> Result<(i128, i128), AstroSwapError> {
        user.require_auth();

        // Check deadline
        Self::check_deadline(&env, deadline)?;

        // Get factory and pair
        let factory = get_factory(&env);
        let factory_client = FactoryClient::new(&env, &factory);

        let pair_address = factory_client
            .get_pair(&token_a, &token_b)
            .ok_or(AstroSwapError::PairNotFound)?;

        let pair_client = PairClient::new(&env, &pair_address);

        // Determine token order
        let token_0 = pair_client.token_0();

        let (min_0, min_1) = if token_a == token_0 {
            (amount_a_min, amount_b_min)
        } else {
            (amount_b_min, amount_a_min)
        };

        // Call withdraw
        let result = pair_client.withdraw(&user, liquidity, min_0, min_1);

        extend_instance_ttl(&env);

        // Reorder result
        if token_a == token_0 {
            Ok(result)
        } else {
            Ok((result.1, result.0))
        }
    }

    // ==================== View Functions ====================

    /// Get expected output amounts for a swap path
    fn get_amounts_out(
        env: &Env,
        amount_in: i128,
        path: &Vec<Address>,
    ) -> Result<Vec<i128>, AstroSwapError> {
        if path.len() < 2 {
            return Err(AstroSwapError::InvalidPath);
        }

        let factory = get_factory(env);
        let factory_client = FactoryClient::new(env, &factory);

        let mut amounts = Vec::new(env);
        amounts.push_back(amount_in);

        for i in 0..(path.len() - 1) {
            let token_in = path.get(i).unwrap();
            let token_out = path.get(i + 1).unwrap();

            // Get pair
            let pair_address = factory_client
                .get_pair(&token_in, &token_out)
                .ok_or(AstroSwapError::PairNotFound)?;

            let pair_client = PairClient::new(env, &pair_address);
            let (reserve_0, reserve_1) = pair_client.get_reserves();
            let fee_bps = pair_client.fee_bps();

            // Determine reserves based on token order
            let token_0 = pair_client.token_0();
            let (reserve_in, reserve_out) = if token_in == token_0 {
                (reserve_0, reserve_1)
            } else {
                (reserve_1, reserve_0)
            };

            let current_amount = amounts.get(i as u32).unwrap();
            let amount_out_calc = get_amount_out(current_amount, reserve_in, reserve_out, fee_bps)?;
            amounts.push_back(amount_out_calc);
        }

        Ok(amounts)
    }

    /// Get required input amounts for a swap path
    fn get_amounts_in(
        env: &Env,
        amount_out: i128,
        path: &Vec<Address>,
    ) -> Result<Vec<i128>, AstroSwapError> {
        if path.len() < 2 {
            return Err(AstroSwapError::InvalidPath);
        }

        let factory = get_factory(env);
        let factory_client = FactoryClient::new(env, &factory);

        let path_len = path.len();
        let mut amounts = Vec::new(env);

        // Pre-fill with zeros
        for _ in 0..path_len {
            amounts.push_back(0i128);
        }

        // Set the final amount
        amounts.set(path_len - 1, amount_out);

        // Calculate backwards
        for i in (0..path_len - 1).rev() {
            let token_in = path.get(i).unwrap();
            let token_out = path.get(i + 1).unwrap();

            // Get pair
            let pair_address = factory_client
                .get_pair(&token_in, &token_out)
                .ok_or(AstroSwapError::PairNotFound)?;

            let pair_client = PairClient::new(env, &pair_address);
            let (reserve_0, reserve_1) = pair_client.get_reserves();
            let fee_bps = pair_client.fee_bps();

            // Determine reserves based on token order
            let token_0 = pair_client.token_0();
            let (reserve_in, reserve_out) = if token_in == token_0 {
                (reserve_0, reserve_1)
            } else {
                (reserve_1, reserve_0)
            };

            let current_amount_out = amounts.get(i as u32 + 1).unwrap();
            let amount_in_calc =
                get_amount_in(current_amount_out, reserve_in, reserve_out, fee_bps)?;
            amounts.set(i as u32, amount_in_calc);
        }

        Ok(amounts)
    }

    /// Quote: given some amount of token A, calculate optimal amount of token B
    pub fn quote(
        _env: Env,
        amount_a: i128,
        reserve_a: i128,
        reserve_b: i128,
    ) -> Result<i128, AstroSwapError> {
        astroswap_shared::quote(amount_a, reserve_a, reserve_b)
    }

    /// Get factory address
    pub fn factory(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_factory(&env)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    // ==================== Internal Functions ====================

    /// Check if deadline has passed
    fn check_deadline(env: &Env, deadline: u64) -> Result<(), AstroSwapError> {
        if env.ledger().timestamp() > deadline {
            return Err(AstroSwapError::DeadlineExpired);
        }
        Ok(())
    }

    /// Validate swap path
    /// - Must have at least 2 tokens
    /// - Must not exceed maximum length
    /// - Must not contain duplicate tokens
    fn validate_path(path: &Vec<Address>) -> Result<(), AstroSwapError> {
        let len = path.len();

        // Path must have at least 2 tokens
        if len < 2 {
            return Err(AstroSwapError::InvalidPath);
        }

        // Path must not exceed maximum length (prevents excessive gas)
        if len > Self::MAX_PATH_LENGTH {
            return Err(AstroSwapError::InvalidPath);
        }

        // Check for duplicate tokens in path (would indicate a loop)
        for i in 0..len {
            for j in (i + 1)..len {
                if path.get(i).unwrap() == path.get(j).unwrap() {
                    return Err(AstroSwapError::InvalidPath);
                }
            }
        }

        Ok(())
    }

    /// Execute swaps along the path using low-level swap_from_balance
    /// Tokens must be pre-transferred to the first pair
    fn execute_swaps(
        env: &Env,
        factory: &Address,
        path: &Vec<Address>,
        amounts: &Vec<i128>,
        recipient: &Address,
    ) -> Result<(), AstroSwapError> {
        let factory_client = FactoryClient::new(env, factory);

        for i in 0..(path.len() - 1) {
            let token_in = path.get(i).unwrap();
            let token_out = path.get(i + 1).unwrap();
            let min_out = amounts.get(i as u32 + 1).unwrap();

            // Get pair
            let pair_address = factory_client
                .get_pair(&token_in, &token_out)
                .ok_or(AstroSwapError::PairNotFound)?;

            let pair_client = PairClient::new(env, &pair_address);

            // Determine if this is the last swap
            let is_last = i == path.len() - 2;

            // Determine recipient: next pair or final user
            let swap_recipient = if is_last {
                recipient.clone()
            } else {
                // Get next pair address - output goes directly to next pair
                let next_token_in = path.get(i + 1).unwrap();
                let next_token_out = path.get(i + 2).unwrap();
                factory_client
                    .get_pair(&next_token_in, &next_token_out)
                    .ok_or(AstroSwapError::PairNotFound)?
            };

            // Execute low-level swap (tokens already in pair from previous transfer/swap)
            pair_client.swap_from_balance(&swap_recipient, &token_in, min_out)?;
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

        let contract_id = env.register_contract(None, AstroSwapRouter);
        let client = AstroSwapRouterClient::new(&env, &contract_id);

        let factory = Address::generate(&env);
        let admin = Address::generate(&env);

        client.initialize(&factory, &admin);

        assert_eq!(client.factory(), factory);
        assert_eq!(client.admin(), admin);
    }
}
