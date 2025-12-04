//! Events for AstroSwap contracts
//!
//! Using modern #[contractevent] macro for type-safe event emission

use soroban_sdk::{contractevent, Address, Env};

/// Swap event - emitted when tokens are swapped
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Swap {
    pub user: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i128,
    pub amount_out: i128,
}

/// Deposit event - emitted when liquidity is added
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Deposit {
    pub user: Address,
    pub pair: Address,
    pub amount_a: i128,
    pub amount_b: i128,
    pub shares_minted: i128,
}

/// Withdraw event - emitted when liquidity is removed
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Withdraw {
    pub user: Address,
    pub pair: Address,
    pub shares_burned: i128,
    pub amount_a: i128,
    pub amount_b: i128,
}

/// PairCreated event - emitted when a new pair is created
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PairCreated {
    pub token_a: Address,
    pub token_b: Address,
    pub pair: Address,
    pub pair_count: u32,
}

/// Stake event - emitted when LP tokens are staked
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stake {
    pub user: Address,
    pub pool_id: u32,
    pub amount: i128,
}

/// Unstake event - emitted when LP tokens are unstaked
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Unstake {
    pub user: Address,
    pub pool_id: u32,
    pub amount: i128,
}

/// Claim event - emitted when staking rewards are claimed
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Claim {
    pub user: Address,
    pub pool_id: u32,
    pub reward_amount: i128,
}

/// Graduation event - emitted when a token graduates from Astro-Shiba
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Graduation {
    pub token: Address,
    pub pair: Address,
    pub initial_price: i128,
    pub timestamp: u64,
}

/// Emit a swap event
pub fn emit_swap(
    env: &Env,
    user: &Address,
    token_in: &Address,
    token_out: &Address,
    amount_in: i128,
    amount_out: i128,
) {
    Swap {
        user: user.clone(),
        token_in: token_in.clone(),
        token_out: token_out.clone(),
        amount_in,
        amount_out,
    }
    .publish(env);
}

/// Emit a deposit (add liquidity) event
pub fn emit_deposit(
    env: &Env,
    user: &Address,
    pair: &Address,
    amount_a: i128,
    amount_b: i128,
    shares_minted: i128,
) {
    Deposit {
        user: user.clone(),
        pair: pair.clone(),
        amount_a,
        amount_b,
        shares_minted,
    }
    .publish(env);
}

/// Emit a withdraw (remove liquidity) event
pub fn emit_withdraw(
    env: &Env,
    user: &Address,
    pair: &Address,
    shares_burned: i128,
    amount_a: i128,
    amount_b: i128,
) {
    Withdraw {
        user: user.clone(),
        pair: pair.clone(),
        shares_burned,
        amount_a,
        amount_b,
    }
    .publish(env);
}

/// Emit a pair created event
pub fn emit_pair_created(
    env: &Env,
    token_a: &Address,
    token_b: &Address,
    pair: &Address,
    pair_count: u32,
) {
    PairCreated {
        token_a: token_a.clone(),
        token_b: token_b.clone(),
        pair: pair.clone(),
        pair_count,
    }
    .publish(env);
}

/// Emit a stake event
pub fn emit_stake(env: &Env, user: &Address, pool_id: u32, amount: i128) {
    Stake {
        user: user.clone(),
        pool_id,
        amount,
    }
    .publish(env);
}

/// Emit an unstake event
pub fn emit_unstake(env: &Env, user: &Address, pool_id: u32, amount: i128) {
    Unstake {
        user: user.clone(),
        pool_id,
        amount,
    }
    .publish(env);
}

/// Emit a claim rewards event
pub fn emit_claim(env: &Env, user: &Address, pool_id: u32, reward_amount: i128) {
    Claim {
        user: user.clone(),
        pool_id,
        reward_amount,
    }
    .publish(env);
}

/// Emit a token graduation event (from Astro-Shiba)
pub fn emit_graduation(env: &Env, token: &Address, pair: &Address, initial_price: i128) {
    let timestamp = env.ledger().timestamp();
    Graduation {
        token: token.clone(),
        pair: pair.clone(),
        initial_price,
        timestamp,
    }
    .publish(env);
}
