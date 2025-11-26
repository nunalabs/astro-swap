use soroban_sdk::{symbol_short, Address, Env, Symbol};

// Event symbols
const SWAP: Symbol = symbol_short!("swap");
const DEPOSIT: Symbol = symbol_short!("deposit");
const WITHDRAW: Symbol = symbol_short!("withdraw");
const PAIR_CREATED: Symbol = symbol_short!("pair_cre");
const STAKE: Symbol = symbol_short!("stake");
const UNSTAKE: Symbol = symbol_short!("unstake");
const CLAIM: Symbol = symbol_short!("claim");
const GRADUATE: Symbol = symbol_short!("graduate");

/// Emit a swap event
pub fn emit_swap(
    env: &Env,
    user: &Address,
    token_in: &Address,
    token_out: &Address,
    amount_in: i128,
    amount_out: i128,
) {
    env.events().publish(
        (SWAP, user.clone()),
        (token_in.clone(), token_out.clone(), amount_in, amount_out),
    );
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
    env.events().publish(
        (DEPOSIT, user.clone()),
        (pair.clone(), amount_a, amount_b, shares_minted),
    );
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
    env.events().publish(
        (WITHDRAW, user.clone()),
        (pair.clone(), shares_burned, amount_a, amount_b),
    );
}

/// Emit a pair created event
pub fn emit_pair_created(
    env: &Env,
    token_a: &Address,
    token_b: &Address,
    pair: &Address,
    pair_count: u32,
) {
    env.events().publish(
        (PAIR_CREATED,),
        (token_a.clone(), token_b.clone(), pair.clone(), pair_count),
    );
}

/// Emit a stake event
pub fn emit_stake(env: &Env, user: &Address, pool_id: u32, amount: i128) {
    env.events()
        .publish((STAKE, user.clone()), (pool_id, amount));
}

/// Emit an unstake event
pub fn emit_unstake(env: &Env, user: &Address, pool_id: u32, amount: i128) {
    env.events()
        .publish((UNSTAKE, user.clone()), (pool_id, amount));
}

/// Emit a claim rewards event
pub fn emit_claim(env: &Env, user: &Address, pool_id: u32, reward_amount: i128) {
    env.events()
        .publish((CLAIM, user.clone()), (pool_id, reward_amount));
}

/// Emit a token graduation event (from Astro-Shiba)
pub fn emit_graduation(env: &Env, token: &Address, pair: &Address, initial_price: i128) {
    let timestamp = env.ledger().timestamp();
    env.events().publish(
        (GRADUATE,),
        (token.clone(), pair.clone(), initial_price, timestamp),
    );
}
