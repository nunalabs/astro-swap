//! LP Token implementation (SEP-41 compatible)
//! This module implements the token interface for LP (Liquidity Provider) tokens

use astroswap_shared::AstroSwapError;
use soroban_sdk::{Address, Env, String, Symbol};

use crate::storage::{
    extend_balance_ttl, get_allowance, get_balance, get_total_supply, set_allowance, set_balance,
    set_total_supply,
};

/// LP Token name prefix
const LP_TOKEN_NAME: &str = "AstroSwap LP Token";

/// LP Token symbol prefix
const LP_TOKEN_SYMBOL: &str = "ASTRO-LP";

/// Decimals (same as most tokens)
const DECIMALS: u32 = 7;

/// Get the token name
pub fn name(_env: &Env) -> String {
    String::from_str(_env, LP_TOKEN_NAME)
}

/// Get the token symbol
pub fn symbol(_env: &Env) -> String {
    String::from_str(_env, LP_TOKEN_SYMBOL)
}

/// Get the decimals
pub fn decimals() -> u32 {
    DECIMALS
}

/// Get the total supply
pub fn total_supply(env: &Env) -> i128 {
    get_total_supply(env)
}

/// Get balance of an address
pub fn balance_of(env: &Env, owner: &Address) -> i128 {
    get_balance(env, owner)
}

/// Get allowance from owner to spender
pub fn allowance(env: &Env, owner: &Address, spender: &Address) -> i128 {
    get_allowance(env, owner, spender)
}

/// Transfer tokens from caller to recipient
pub fn transfer(
    env: &Env,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), AstroSwapError> {
    // Require authorization from sender
    from.require_auth();

    if amount <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    // Check balance
    let from_balance = get_balance(env, from);
    if from_balance < amount {
        return Err(AstroSwapError::InsufficientBalance);
    }

    // Update balances
    set_balance(env, from, from_balance - amount);
    set_balance(env, to, get_balance(env, to) + amount);

    // Extend TTL for both accounts
    extend_balance_ttl(env, from);
    extend_balance_ttl(env, to);

    // Emit transfer event
    env.events().publish(
        (Symbol::new(env, "transfer"), from.clone()),
        (to.clone(), amount),
    );

    Ok(())
}

/// Transfer tokens from one address to another using allowance
pub fn transfer_from(
    env: &Env,
    spender: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), AstroSwapError> {
    // Require authorization from spender
    spender.require_auth();

    if amount <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    // Check allowance
    let current_allowance = get_allowance(env, from, spender);
    if current_allowance < amount {
        return Err(AstroSwapError::InsufficientAllowance);
    }

    // Check balance
    let from_balance = get_balance(env, from);
    if from_balance < amount {
        return Err(AstroSwapError::InsufficientBalance);
    }

    // Update allowance
    set_allowance(env, from, spender, current_allowance - amount);

    // Update balances
    set_balance(env, from, from_balance - amount);
    set_balance(env, to, get_balance(env, to) + amount);

    // Extend TTL
    extend_balance_ttl(env, from);
    extend_balance_ttl(env, to);

    // Emit transfer event
    env.events().publish(
        (Symbol::new(env, "transfer"), from.clone()),
        (to.clone(), amount),
    );

    Ok(())
}

/// Approve spender to spend tokens on behalf of owner
pub fn approve(
    env: &Env,
    owner: &Address,
    spender: &Address,
    amount: i128,
) -> Result<(), AstroSwapError> {
    owner.require_auth();

    if amount < 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    set_allowance(env, owner, spender, amount);

    // Emit approval event
    env.events().publish(
        (Symbol::new(env, "approve"), owner.clone()),
        (spender.clone(), amount),
    );

    Ok(())
}

/// Mint new LP tokens (internal function)
pub fn mint(env: &Env, to: &Address, amount: i128) -> Result<(), AstroSwapError> {
    if amount <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    // Update total supply
    let new_supply = get_total_supply(env) + amount;
    set_total_supply(env, new_supply);

    // Update recipient balance
    set_balance(env, to, get_balance(env, to) + amount);
    extend_balance_ttl(env, to);

    // Emit mint event
    env.events()
        .publish((Symbol::new(env, "mint"),), (to.clone(), amount));

    Ok(())
}

/// Burn LP tokens (internal function)
pub fn burn(env: &Env, from: &Address, amount: i128) -> Result<(), AstroSwapError> {
    if amount <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    // Check balance
    let from_balance = get_balance(env, from);
    if from_balance < amount {
        return Err(AstroSwapError::InsufficientBalance);
    }

    // Update total supply
    let new_supply = get_total_supply(env) - amount;
    set_total_supply(env, new_supply);

    // Update sender balance
    set_balance(env, from, from_balance - amount);
    extend_balance_ttl(env, from);

    // Emit burn event
    env.events()
        .publish((Symbol::new(env, "burn"),), (from.clone(), amount));

    Ok(())
}

/// Burn LP tokens from an address using allowance
#[allow(dead_code)]
pub fn burn_from(
    env: &Env,
    spender: &Address,
    from: &Address,
    amount: i128,
) -> Result<(), AstroSwapError> {
    spender.require_auth();

    if amount <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    // Check allowance
    let current_allowance = get_allowance(env, from, spender);
    if current_allowance < amount {
        return Err(AstroSwapError::InsufficientAllowance);
    }

    // Update allowance
    set_allowance(env, from, spender, current_allowance - amount);

    // Burn the tokens
    burn(env, from, amount)
}
