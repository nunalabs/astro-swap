//! Contract interfaces for cross-contract calls
//!
//! This module provides type-safe interfaces for invoking other AstroSwap contracts
//! without requiring WASM imports at compile time. This approach is more modular
//! and allows contracts to be built independently.

use crate::AstroSwapError;
use soroban_sdk::{Address, Env, IntoVal, Symbol, Vec};

/// Factory contract interface
/// Provides methods to interact with the AstroSwap Factory contract
pub struct FactoryClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> FactoryClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Get pair address for two tokens
    pub fn get_pair(&self, token_a: &Address, token_b: &Address) -> Option<Address> {
        let result: Option<Address> = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_pair"),
            Vec::from_array(self.env, [token_a.to_val(), token_b.to_val()]),
        );
        result
    }

    /// Create a new trading pair
    pub fn create_pair(
        &self,
        token_a: &Address,
        token_b: &Address,
    ) -> Result<Address, AstroSwapError> {
        let result: Address = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "create_pair"),
            Vec::from_array(self.env, [token_a.to_val(), token_b.to_val()]),
        );
        Ok(result)
    }

    /// Get admin address
    pub fn admin(&self) -> Address {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "admin"),
            Vec::new(self.env),
        )
    }

    /// Get protocol fee in basis points
    pub fn protocol_fee_bps(&self) -> u32 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "protocol_fee_bps"),
            Vec::new(self.env),
        )
    }

    /// Check if factory is paused
    pub fn is_paused(&self) -> bool {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "is_paused"),
            Vec::new(self.env),
        )
    }
}

/// Pair contract interface
/// Provides methods to interact with AstroSwap Pair contracts
pub struct PairClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> PairClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Get token 0 address
    pub fn token_0(&self) -> Address {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "token_0"),
            Vec::new(self.env),
        )
    }

    /// Get token 1 address
    pub fn token_1(&self) -> Address {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "token_1"),
            Vec::new(self.env),
        )
    }

    /// Get reserves
    pub fn get_reserves(&self) -> (i128, i128) {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_reserves"),
            Vec::new(self.env),
        )
    }

    /// Get fee in basis points
    pub fn fee_bps(&self) -> u32 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "fee_bps"),
            Vec::new(self.env),
        )
    }

    /// Execute a swap
    pub fn swap(
        &self,
        user: &Address,
        token_in: &Address,
        amount_in: i128,
        min_out: i128,
    ) -> Result<i128, AstroSwapError> {
        let result: i128 = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "swap"),
            Vec::from_array(
                self.env,
                [
                    user.to_val(),
                    token_in.to_val(),
                    amount_in.into_val(self.env),
                    min_out.into_val(self.env),
                ],
            ),
        );
        Ok(result)
    }

    /// Deposit liquidity
    pub fn deposit(
        &self,
        user: &Address,
        amount_0_desired: i128,
        amount_1_desired: i128,
        amount_0_min: i128,
        amount_1_min: i128,
    ) -> (i128, i128, i128) {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "deposit"),
            Vec::from_array(
                self.env,
                [
                    user.to_val(),
                    amount_0_desired.into_val(self.env),
                    amount_1_desired.into_val(self.env),
                    amount_0_min.into_val(self.env),
                    amount_1_min.into_val(self.env),
                ],
            ),
        )
    }

    /// Withdraw liquidity
    pub fn withdraw(
        &self,
        user: &Address,
        shares: i128,
        amount_0_min: i128,
        amount_1_min: i128,
    ) -> (i128, i128) {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "withdraw"),
            Vec::from_array(
                self.env,
                [
                    user.to_val(),
                    shares.into_val(self.env),
                    amount_0_min.into_val(self.env),
                    amount_1_min.into_val(self.env),
                ],
            ),
        )
    }

    /// Get expected output amount for a swap
    pub fn get_amount_out(
        &self,
        amount_in: i128,
        token_in: &Address,
    ) -> Result<i128, AstroSwapError> {
        let result: i128 = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "get_amount_out"),
            Vec::from_array(self.env, [amount_in.into_val(self.env), token_in.to_val()]),
        );
        Ok(result)
    }

    /// Low-level swap for router (tokens already in contract)
    /// Returns (amount_in, amount_out)
    pub fn swap_from_balance(
        &self,
        to: &Address,
        token_in: &Address,
        min_out: i128,
        deadline: u64,
    ) -> Result<(i128, i128), AstroSwapError> {
        let result: (i128, i128) = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "swap_from_balance"),
            Vec::from_array(
                self.env,
                [
                    to.to_val(),
                    token_in.to_val(),
                    min_out.into_val(self.env),
                    deadline.into_val(self.env),
                ],
            ),
        );
        Ok(result)
    }

    /// Get LP token balance
    pub fn balance(&self, owner: &Address) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "balance"),
            Vec::from_array(self.env, [owner.to_val()]),
        )
    }

    /// Get total supply of LP tokens
    pub fn total_supply(&self) -> i128 {
        self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "total_supply"),
            Vec::new(self.env),
        )
    }

    /// Burn LP tokens
    /// This permanently removes LP tokens from circulation
    /// Used by bridge to lock liquidity during token graduation
    pub fn burn(&self, from: &Address, amount: i128) -> Result<(), AstroSwapError> {
        let _: () = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "burn"),
            Vec::from_array(
                self.env,
                [from.to_val(), amount.into_val(self.env)],
            ),
        );
        Ok(())
    }
}

/// Staking contract interface
pub struct StakingClient<'a> {
    env: &'a Env,
    contract_id: Address,
}

impl<'a> StakingClient<'a> {
    pub fn new(env: &'a Env, contract_id: &Address) -> Self {
        Self {
            env,
            contract_id: contract_id.clone(),
        }
    }

    /// Stake LP tokens
    pub fn stake(&self, user: &Address, pool_id: u32, amount: i128) -> Result<(), AstroSwapError> {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "stake"),
            Vec::from_array(
                self.env,
                [
                    user.to_val(),
                    pool_id.into_val(self.env),
                    amount.into_val(self.env),
                ],
            ),
        );
        Ok(())
    }

    /// Unstake LP tokens
    pub fn unstake(
        &self,
        user: &Address,
        pool_id: u32,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        self.env.invoke_contract::<()>(
            &self.contract_id,
            &Symbol::new(self.env, "unstake"),
            Vec::from_array(
                self.env,
                [
                    user.to_val(),
                    pool_id.into_val(self.env),
                    amount.into_val(self.env),
                ],
            ),
        );
        Ok(())
    }

    /// Claim rewards
    pub fn claim_rewards(&self, user: &Address, pool_id: u32) -> Result<i128, AstroSwapError> {
        let result: i128 = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "claim_rewards"),
            Vec::from_array(self.env, [user.to_val(), pool_id.into_val(self.env)]),
        );
        Ok(result)
    }

    /// Get pending rewards
    pub fn pending_rewards(&self, user: &Address, pool_id: u32) -> Result<i128, AstroSwapError> {
        let result: i128 = self.env.invoke_contract(
            &self.contract_id,
            &Symbol::new(self.env, "pending_rewards"),
            Vec::from_array(self.env, [user.to_val(), pool_id.into_val(self.env)]),
        );
        Ok(result)
    }
}
