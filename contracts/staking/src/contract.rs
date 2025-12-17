use astroswap_shared::{
    calculate_staking_multiplier, emit_claim, emit_stake, emit_unstake, safe_add, safe_div,
    safe_mul, safe_sub, AstroSwapError, StakingPool, UserStake, BPS_DENOMINATOR,
};
use soroban_sdk::{contract, contractimpl, token, Address, Env};

use crate::storage::{
    extend_instance_ttl, extend_pool_ttl, extend_user_stake_ttl, get_admin, get_pool,
    get_pool_count, get_reward_token, get_user_stake, increment_pool_count, is_initialized,
    is_locked, is_paused, set_admin, set_initialized, set_locked, set_paused, set_pool,
    set_reward_token, set_user_stake,
};

/// Precision for reward calculations
const REWARD_PRECISION: i128 = 1_000_000_000_000;

#[contract]
pub struct AstroSwapStaking;

#[contractimpl]
impl AstroSwapStaking {
    /// Initialize the staking contract
    pub fn initialize(
        env: Env,
        admin: Address,
        reward_token: Address,
    ) -> Result<(), AstroSwapError> {
        if is_initialized(&env) {
            return Err(AstroSwapError::AlreadyInitialized);
        }

        set_admin(&env, &admin);
        set_reward_token(&env, &reward_token);
        set_initialized(&env);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Create a new staking pool
    ///
    /// # Arguments
    /// * `admin` - Admin address (must match contract admin)
    /// * `lp_token` - LP token address to stake
    /// * `reward_per_second` - Rewards distributed per second
    /// * `start_time` - When rewards start accruing
    /// * `end_time` - When rewards stop accruing
    pub fn create_pool(
        env: Env,
        admin: Address,
        lp_token: Address,
        reward_per_second: i128,
        start_time: u64,
        end_time: u64,
    ) -> Result<u32, AstroSwapError> {
        Self::require_admin(&env, &admin)?;

        if start_time >= end_time {
            return Err(AstroSwapError::InvalidStakingPeriod);
        }

        let pool_id = increment_pool_count(&env);
        let reward_token = get_reward_token(&env).ok_or(AstroSwapError::NotInitialized)?;

        let pool = StakingPool {
            pool_id,
            lp_token,
            reward_token,
            total_staked: 0,
            reward_per_second,
            start_time,
            end_time,
            last_update_time: start_time,
            acc_reward_per_share: 0,
        };

        set_pool(&env, pool_id, &pool);
        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);

        Ok(pool_id)
    }

    // ==================== Reentrancy Guard ====================

    /// Internal function to acquire reentrancy lock
    fn acquire_lock(env: &Env) -> Result<(), AstroSwapError> {
        if is_locked(env) {
            return Err(AstroSwapError::Reentrancy);
        }
        set_locked(env, true);
        Ok(())
    }

    /// Internal function to release reentrancy lock
    fn release_lock(env: &Env) {
        set_locked(env, false);
    }

    /// Stake LP tokens in a pool
    ///
    /// # Arguments
    /// * `user` - User address
    /// * `pool_id` - Pool to stake in
    /// * `amount` - Amount of LP tokens to stake
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn stake(
        env: Env,
        user: Address,
        pool_id: u32,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        user.require_auth();
        Self::require_not_paused(&env)?;
        Self::acquire_lock(&env)?;

        if amount <= 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        let mut pool = get_pool(&env, pool_id).ok_or(AstroSwapError::StakingPoolNotFound)?;

        // Update pool rewards
        Self::update_pool(&env, &mut pool)?;

        // Get or create user stake
        let mut user_stake = get_user_stake(&env, &user, pool_id).unwrap_or(UserStake {
            amount: 0,
            reward_debt: 0,
            stake_time: env.ledger().timestamp(),
            multiplier: BPS_DENOMINATOR, // 1x
        });

        // Claim any pending rewards first
        if user_stake.amount > 0 {
            let pending = Self::calculate_pending_rewards(&pool, &user_stake)?;
            if pending > 0 {
                Self::transfer_rewards(&env, &pool.reward_token, &user, pending)?;
                emit_claim(&env, &user, pool_id, pending);
            }
        }

        // Transfer LP tokens from user
        let lp_client = token::Client::new(&env, &pool.lp_token);
        lp_client.transfer(&user, env.current_contract_address(), &amount);

        // Update user stake
        user_stake.amount = safe_add(user_stake.amount, amount)?;
        if user_stake.stake_time == 0 {
            user_stake.stake_time = env.ledger().timestamp();
        }

        // Update reward debt
        user_stake.reward_debt = safe_div(
            safe_mul(user_stake.amount, pool.acc_reward_per_share)?,
            REWARD_PRECISION,
        )?;

        // Update pool total
        pool.total_staked = safe_add(pool.total_staked, amount)?;

        // Save state
        set_pool(&env, pool_id, &pool);
        set_user_stake(&env, &user, pool_id, &user_stake);

        // Emit event
        emit_stake(&env, &user, pool_id, amount);

        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);
        extend_user_stake_ttl(&env, &user, pool_id);

        Self::release_lock(&env);

        Ok(())
    }

    /// Unstake LP tokens from a pool
    ///
    /// # Arguments
    /// * `user` - User address
    /// * `pool_id` - Pool to unstake from
    /// * `amount` - Amount of LP tokens to unstake
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn unstake(
        env: Env,
        user: Address,
        pool_id: u32,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        user.require_auth();
        Self::acquire_lock(&env)?;

        if amount <= 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::InvalidAmount);
        }

        let mut pool = match get_pool(&env, pool_id) {
            Some(p) => p,
            None => {
                Self::release_lock(&env);
                return Err(AstroSwapError::StakingPoolNotFound);
            }
        };
        let mut user_stake = match get_user_stake(&env, &user, pool_id) {
            Some(s) => s,
            None => {
                Self::release_lock(&env);
                return Err(AstroSwapError::StakeNotFound);
            }
        };

        if user_stake.amount < amount {
            Self::release_lock(&env);
            return Err(AstroSwapError::InsufficientStake);
        }

        // Update pool rewards
        Self::update_pool(&env, &mut pool)?;

        // Calculate and transfer pending rewards
        let pending = Self::calculate_pending_rewards(&pool, &user_stake)?;
        if pending > 0 {
            // Apply multiplier (multiplier is u32, safely fits in i128)
            let multiplier = Self::get_current_multiplier(&env, &user_stake);
            let boosted_reward = safe_div(
                safe_mul(pending, i128::from(multiplier))?,
                i128::from(BPS_DENOMINATOR),
            )?;
            Self::transfer_rewards(&env, &pool.reward_token, &user, boosted_reward)?;
            emit_claim(&env, &user, pool_id, boosted_reward);
        }

        // Update user stake
        user_stake.amount = safe_sub(user_stake.amount, amount)?;
        user_stake.reward_debt = safe_div(
            safe_mul(user_stake.amount, pool.acc_reward_per_share)?,
            REWARD_PRECISION,
        )?;

        // Reset stake time if fully unstaked
        if user_stake.amount == 0 {
            user_stake.stake_time = 0;
            user_stake.multiplier = BPS_DENOMINATOR;
        }

        // Update pool total
        pool.total_staked = safe_sub(pool.total_staked, amount)?;

        // Transfer LP tokens back to user
        let lp_client = token::Client::new(&env, &pool.lp_token);
        lp_client.transfer(&env.current_contract_address(), &user, &amount);

        // Save state
        set_pool(&env, pool_id, &pool);
        set_user_stake(&env, &user, pool_id, &user_stake);

        // Emit event
        emit_unstake(&env, &user, pool_id, amount);

        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);
        extend_user_stake_ttl(&env, &user, pool_id);

        Self::release_lock(&env);

        Ok(())
    }

    /// Claim pending rewards without unstaking
    ///
    /// # Security
    /// Uses reentrancy guard to prevent flash loan attacks
    pub fn claim_rewards(env: Env, user: Address, pool_id: u32) -> Result<i128, AstroSwapError> {
        user.require_auth();
        Self::acquire_lock(&env)?;

        let mut pool = match get_pool(&env, pool_id) {
            Some(p) => p,
            None => {
                Self::release_lock(&env);
                return Err(AstroSwapError::StakingPoolNotFound);
            }
        };
        let mut user_stake = match get_user_stake(&env, &user, pool_id) {
            Some(s) => s,
            None => {
                Self::release_lock(&env);
                return Err(AstroSwapError::StakeNotFound);
            }
        };

        // Update pool rewards
        Self::update_pool(&env, &mut pool)?;

        // Calculate pending rewards
        let pending = Self::calculate_pending_rewards(&pool, &user_stake)?;

        if pending == 0 {
            Self::release_lock(&env);
            return Err(AstroSwapError::NoRewardsAvailable);
        }

        // Apply multiplier (multiplier is u32, safely fits in i128)
        let multiplier = Self::get_current_multiplier(&env, &user_stake);
        let boosted_reward = safe_div(
            safe_mul(pending, i128::from(multiplier))?,
            i128::from(BPS_DENOMINATOR),
        )?;

        // Transfer rewards
        Self::transfer_rewards(&env, &pool.reward_token, &user, boosted_reward)?;

        // Update reward debt
        user_stake.reward_debt = safe_div(
            safe_mul(user_stake.amount, pool.acc_reward_per_share)?,
            REWARD_PRECISION,
        )?;

        // Save state
        set_pool(&env, pool_id, &pool);
        set_user_stake(&env, &user, pool_id, &user_stake);

        // Emit event
        emit_claim(&env, &user, pool_id, boosted_reward);

        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);
        extend_user_stake_ttl(&env, &user, pool_id);

        Self::release_lock(&env);

        Ok(boosted_reward)
    }

    /// Compound rewards back into stake (if reward token == LP token)
    pub fn compound(env: Env, user: Address, pool_id: u32) -> Result<i128, AstroSwapError> {
        user.require_auth();

        let pool = get_pool(&env, pool_id).ok_or(AstroSwapError::StakingPoolNotFound)?;

        // Can only compound if reward token is the LP token
        if pool.reward_token != pool.lp_token {
            return Err(AstroSwapError::InvalidArgument);
        }

        // Claim rewards
        let rewards = Self::claim_rewards(env.clone(), user.clone(), pool_id)?;

        // Stake the rewards
        Self::stake(env, user, pool_id, rewards)?;

        Ok(rewards)
    }

    // ==================== Admin Functions ====================

    /// Update pool reward rate
    pub fn update_pool_rewards(
        env: Env,
        admin: Address,
        pool_id: u32,
        reward_per_second: i128,
    ) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;

        let mut pool = get_pool(&env, pool_id).ok_or(AstroSwapError::StakingPoolNotFound)?;

        // Update pool first to settle current rewards
        Self::update_pool(&env, &mut pool)?;

        pool.reward_per_second = reward_per_second;
        set_pool(&env, pool_id, &pool);

        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);

        Ok(())
    }

    /// Fund the reward pool
    pub fn fund_rewards(env: Env, funder: Address, amount: i128) -> Result<(), AstroSwapError> {
        funder.require_auth();

        let reward_token = get_reward_token(&env).ok_or(AstroSwapError::NotInitialized)?;
        let token_client = token::Client::new(&env, &reward_token);

        token_client.transfer(&funder, env.current_contract_address(), &amount);

        extend_instance_ttl(&env);

        Ok(())
    }

    /// Pause/unpause the contract
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), AstroSwapError> {
        Self::require_admin(&env, &admin)?;
        set_paused(&env, paused);
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

    // ==================== View Functions ====================

    /// Get pending rewards for a user
    pub fn pending_rewards(env: Env, user: Address, pool_id: u32) -> Result<i128, AstroSwapError> {
        let pool = get_pool(&env, pool_id).ok_or(AstroSwapError::StakingPoolNotFound)?;
        let user_stake =
            get_user_stake(&env, &user, pool_id).ok_or(AstroSwapError::StakeNotFound)?;

        // Calculate pending with current acc_reward_per_share
        let mut simulated_pool = pool.clone();
        Self::update_pool_internal(&env, &mut simulated_pool)?;

        let pending = Self::calculate_pending_rewards(&simulated_pool, &user_stake)?;

        // Apply multiplier (multiplier is u32, safely fits in i128)
        let multiplier = Self::get_current_multiplier(&env, &user_stake);
        safe_div(
            safe_mul(pending, i128::from(multiplier))?,
            i128::from(BPS_DENOMINATOR),
        )
    }

    /// Get pool information
    pub fn pool_info(env: Env, pool_id: u32) -> Result<StakingPool, AstroSwapError> {
        extend_instance_ttl(&env);
        extend_pool_ttl(&env, pool_id);
        get_pool(&env, pool_id).ok_or(AstroSwapError::StakingPoolNotFound)
    }

    /// Get user stake information
    pub fn user_info(env: Env, user: Address, pool_id: u32) -> Result<UserStake, AstroSwapError> {
        extend_instance_ttl(&env);
        extend_user_stake_ttl(&env, &user, pool_id);
        get_user_stake(&env, &user, pool_id).ok_or(AstroSwapError::StakeNotFound)
    }

    /// Get current multiplier for a user
    pub fn get_multiplier(env: Env, user: Address, pool_id: u32) -> Result<u32, AstroSwapError> {
        let user_stake =
            get_user_stake(&env, &user, pool_id).ok_or(AstroSwapError::StakeNotFound)?;
        Ok(Self::get_current_multiplier(&env, &user_stake))
    }

    /// Get pool count
    pub fn pool_count(env: Env) -> u32 {
        extend_instance_ttl(&env);
        get_pool_count(&env)
    }

    /// Get admin address
    pub fn admin(env: Env) -> Address {
        extend_instance_ttl(&env);
        get_admin(&env)
    }

    /// Get reward token address
    pub fn reward_token(env: Env) -> Option<Address> {
        extend_instance_ttl(&env);
        get_reward_token(&env)
    }

    /// Check if contract is paused
    pub fn is_paused(env: Env) -> bool {
        is_paused(&env)
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

    /// Update pool's accumulated rewards
    fn update_pool(env: &Env, pool: &mut StakingPool) -> Result<(), AstroSwapError> {
        Self::update_pool_internal(env, pool)?;
        set_pool(env, pool.pool_id, pool);
        Ok(())
    }

    /// Internal pool update (doesn't save)
    fn update_pool_internal(env: &Env, pool: &mut StakingPool) -> Result<(), AstroSwapError> {
        let current_time = env.ledger().timestamp();

        if current_time <= pool.last_update_time {
            return Ok(());
        }

        if pool.total_staked == 0 {
            pool.last_update_time = current_time;
            return Ok(());
        }

        // Calculate time elapsed (capped at end_time)
        let effective_time = if current_time > pool.end_time {
            pool.end_time
        } else {
            current_time
        };

        if effective_time <= pool.last_update_time {
            return Ok(());
        }

        let time_elapsed = effective_time - pool.last_update_time;

        // Calculate rewards (time_elapsed is u64, safely fits in i128)
        let reward = safe_mul(pool.reward_per_second, i128::from(time_elapsed))?;
        let reward_per_share_increase =
            safe_div(safe_mul(reward, REWARD_PRECISION)?, pool.total_staked)?;

        pool.acc_reward_per_share = safe_add(pool.acc_reward_per_share, reward_per_share_increase)?;
        pool.last_update_time = current_time;

        Ok(())
    }

    /// Calculate pending rewards for a user
    fn calculate_pending_rewards(
        pool: &StakingPool,
        user_stake: &UserStake,
    ) -> Result<i128, AstroSwapError> {
        let accumulated = safe_div(
            safe_mul(user_stake.amount, pool.acc_reward_per_share)?,
            REWARD_PRECISION,
        )?;

        safe_sub(accumulated, user_stake.reward_debt)
    }

    /// Get current multiplier based on stake duration
    fn get_current_multiplier(env: &Env, user_stake: &UserStake) -> u32 {
        if user_stake.stake_time == 0 {
            return BPS_DENOMINATOR;
        }

        let current_time = env.ledger().timestamp();
        let stake_duration = current_time.saturating_sub(user_stake.stake_time);

        calculate_staking_multiplier(stake_duration)
    }

    /// Transfer rewards to user
    fn transfer_rewards(
        env: &Env,
        reward_token: &Address,
        to: &Address,
        amount: i128,
    ) -> Result<(), AstroSwapError> {
        if amount <= 0 {
            return Ok(());
        }

        let token_client = token::Client::new(env, reward_token);
        let contract_balance = token_client.balance(&env.current_contract_address());

        if contract_balance < amount {
            return Err(AstroSwapError::InsufficientBalance);
        }

        token_client.transfer(&env.current_contract_address(), to, &amount);

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

        let contract_id = env.register(AstroSwapStaking, ());
        let client = AstroSwapStakingClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let reward_token = Address::generate(&env);

        client.initialize(&admin, &reward_token);

        assert_eq!(client.admin(), admin);
        assert_eq!(client.reward_token(), Some(reward_token));
        assert_eq!(client.pool_count(), 0);
    }
}
