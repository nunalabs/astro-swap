//! Math utilities for AstroSwap contracts
//!
//! This module re-exports mathematical functions from astro-core-shared
//! and provides AstroSwap-specific wrappers and constants.

use crate::error::AstroSwapError;

// Re-export constants from astro-core-shared
pub use astro_core_shared::math::{
    BPS_DENOMINATOR as CORE_BPS_DENOMINATOR,
    MIN_TRADE_AMOUNT,
    ONE_TOKEN,
    PRECISION,
    STELLAR_DECIMALS,
};

// Local constants for DEX-specific configuration
/// Basis points denominator (100% = 10000)
pub const BPS_DENOMINATOR: u32 = 10_000;

/// Default swap fee in basis points (0.3%)
pub const DEFAULT_SWAP_FEE_BPS: u32 = 30;

/// Protocol fee portion in basis points (0.05% of total)
pub const PROTOCOL_FEE_BPS: u32 = 5;

/// LP fee portion in basis points (0.25% of total)
pub const LP_FEE_BPS: u32 = 25;

/// Minimum liquidity to prevent division by zero attacks
pub const MINIMUM_LIQUIDITY: i128 = 1000;

// ==================== Basic Safe Arithmetic ====================
// Wrapper functions that convert SharedError to AstroSwapError

/// Safe addition with overflow check
#[inline]
pub fn safe_add(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::safe_add(a, b).map_err(Into::into)
}

/// Safe subtraction with underflow check
#[inline]
pub fn safe_sub(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::safe_sub(a, b).map_err(Into::into)
}

/// Safe multiplication with overflow check
#[inline]
pub fn safe_mul(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::safe_mul(a, b).map_err(Into::into)
}

/// Safe division with zero check
#[inline]
pub fn safe_div(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::safe_div(a, b).map_err(Into::into)
}

// ==================== Advanced Safe Arithmetic ====================

/// Multiply then divide with phantom overflow protection: (a * b) / c
/// Rounds DOWN (floor) - favors the protocol
#[inline]
pub fn mul_div_down(a: i128, b: i128, c: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::mul_div_down(a, b, c).map_err(Into::into)
}

/// Multiply then divide with phantom overflow protection: (a * b) / c
/// Rounds UP (ceiling) - favors the user paying more / receiving less
#[inline]
pub fn mul_div_up(a: i128, b: i128, c: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::mul_div_up(a, b, c).map_err(Into::into)
}

// ==================== K Invariant Functions ====================

/// Calculate k = reserve_0 * reserve_1 with overflow protection
#[inline]
pub fn calculate_k(reserve_0: i128, reserve_1: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::calculate_k(reserve_0, reserve_1).map_err(Into::into)
}

/// Update reserves after deposit with overflow check
#[inline]
pub fn update_reserves_add(
    reserve_0: i128,
    reserve_1: i128,
    amount_0: i128,
    amount_1: i128,
) -> Result<(i128, i128), AstroSwapError> {
    astro_core_shared::math::update_reserves_add(reserve_0, reserve_1, amount_0, amount_1)
        .map_err(Into::into)
}

/// Update reserves after withdrawal with underflow check
#[inline]
pub fn update_reserves_sub(
    reserve_0: i128,
    reserve_1: i128,
    amount_0: i128,
    amount_1: i128,
) -> Result<(i128, i128), AstroSwapError> {
    astro_core_shared::math::update_reserves_sub(reserve_0, reserve_1, amount_0, amount_1)
        .map_err(Into::into)
}

/// Update reserves after swap with overflow/underflow check
#[inline]
pub fn update_reserves_swap(
    reserve_in: i128,
    reserve_out: i128,
    amount_in: i128,
    amount_out: i128,
    is_token_0_in: bool,
) -> Result<(i128, i128), AstroSwapError> {
    astro_core_shared::math::update_reserves_swap(
        reserve_in, reserve_out, amount_in, amount_out, is_token_0_in,
    )
    .map_err(Into::into)
}

/// Verify k invariant: k_new >= k_old
#[inline]
pub fn verify_k_invariant(
    new_reserve_0: i128,
    new_reserve_1: i128,
    old_reserve_0: i128,
    old_reserve_1: i128,
) -> Result<bool, AstroSwapError> {
    astro_core_shared::math::verify_k_invariant(
        new_reserve_0, new_reserve_1, old_reserve_0, old_reserve_1,
    )
    .map_err(Into::into)
}

// ==================== AMM Math Functions ====================

/// Integer square root using Newton's method
/// Re-exported from astro-core-shared
#[inline]
pub fn sqrt(value: i128) -> i128 {
    astro_core_shared::math::sqrt(value)
}

/// Calculate amount out for a swap using constant product formula
#[inline]
pub fn get_amount_out(
    amount_in: i128,
    reserve_in: i128,
    reserve_out: i128,
    fee_bps: u32,
) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)
        .map_err(Into::into)
}

/// Calculate amount in needed for a specific output
#[inline]
pub fn get_amount_in(
    amount_out: i128,
    reserve_in: i128,
    reserve_out: i128,
    fee_bps: u32,
) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::get_amount_in(amount_out, reserve_in, reserve_out, fee_bps)
        .map_err(Into::into)
}

/// Quote: given some amount of token A, how much of token B should be added
#[inline]
pub fn quote(amount_a: i128, reserve_a: i128, reserve_b: i128) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::quote(amount_a, reserve_a, reserve_b).map_err(Into::into)
}

// ==================== Basis Points Functions ====================

/// Apply basis points (percentage) to an amount - rounds DOWN
#[inline]
pub fn apply_bps(amount: i128, bps: u32) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::apply_bps(amount, bps).map_err(Into::into)
}

/// Apply basis points with round UP (for fee calculations)
#[inline]
pub fn apply_bps_round_up(amount: i128, bps: u32) -> Result<i128, AstroSwapError> {
    astro_core_shared::math::apply_bps_round_up(amount, bps).map_err(Into::into)
}

// ==================== DEX-Specific Functions ====================
// These functions are specific to AstroSwap and not in astro-core-shared

/// Calculate LP tokens to mint for a deposit
/// First deposit: sqrt(amount_a * amount_b) - MINIMUM_LIQUIDITY
/// Subsequent deposits: min((amount_a * total_supply) / reserve_a, (amount_b * total_supply) / reserve_b)
pub fn calculate_liquidity_tokens(
    amount_a: i128,
    amount_b: i128,
    reserve_a: i128,
    reserve_b: i128,
    total_supply: i128,
) -> Result<i128, AstroSwapError> {
    if amount_a <= 0 || amount_b <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }

    if total_supply == 0 {
        // First deposit: use geometric mean minus minimum liquidity
        let product = safe_mul(amount_a, amount_b)?;
        let liquidity = sqrt(product);

        if liquidity <= MINIMUM_LIQUIDITY {
            return Err(AstroSwapError::InsufficientLiquidity);
        }

        // Subtract minimum liquidity (locked forever to prevent attacks)
        Ok(liquidity - MINIMUM_LIQUIDITY)
    } else {
        // Subsequent deposits: proportional to existing liquidity
        let liquidity_a = mul_div_down(amount_a, total_supply, reserve_a)?;
        let liquidity_b = mul_div_down(amount_b, total_supply, reserve_b)?;

        // Return the minimum to maintain ratio
        Ok(core::cmp::min(liquidity_a, liquidity_b))
    }
}

/// Calculate tokens to return when withdrawing liquidity
/// Returns (amount_a, amount_b) based on share of pool
pub fn calculate_withdrawal_amounts(
    shares: i128,
    reserve_a: i128,
    reserve_b: i128,
    total_supply: i128,
) -> Result<(i128, i128), AstroSwapError> {
    if shares <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }
    if total_supply <= 0 {
        return Err(AstroSwapError::InsufficientLiquidity);
    }
    if shares > total_supply {
        return Err(AstroSwapError::InsufficientBalance);
    }

    let amount_a = mul_div_down(shares, reserve_a, total_supply)?;
    let amount_b = mul_div_down(shares, reserve_b, total_supply)?;

    Ok((amount_a, amount_b))
}

/// Calculate price impact of a swap
/// Returns impact in basis points
pub fn calculate_price_impact(
    amount_in: i128,
    reserve_in: i128,
    reserve_out: i128,
    fee_bps: u32,
) -> Result<u32, AstroSwapError> {
    // Expected output without price impact
    let expected_out = mul_div_down(amount_in, reserve_out, reserve_in)?;

    // Actual output with AMM
    let actual_out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)?;

    // Impact = (expected - actual) / expected * 10000
    if expected_out == 0 {
        return Ok(0);
    }

    let diff = safe_sub(expected_out, actual_out)?;
    let impact = mul_div_down(diff, BPS_DENOMINATOR as i128, expected_out)?;

    Ok(impact as u32)
}

/// Calculate staking multiplier based on time staked
/// Progressive rewards: starts at 1x, increases to 1.3x over 60 days
pub fn calculate_staking_multiplier(stake_duration_seconds: u64) -> u32 {
    match stake_duration_seconds {
        0..=604_800 => 10_000,           // 0-7 days: 1.0x
        604_801..=1_209_600 => 11_000,   // 8-14 days: 1.1x
        1_209_601..=2_592_000 => 12_000, // 15-30 days: 1.2x
        2_592_001..=5_184_000 => 12_500, // 31-60 days: 1.25x
        _ => 13_000,                     // 60+ days: 1.3x
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt(0), 0);
        assert_eq!(sqrt(1), 1);
        assert_eq!(sqrt(4), 2);
        assert_eq!(sqrt(9), 3);
        assert_eq!(sqrt(100), 10);
        assert_eq!(sqrt(1000000), 1000);
    }

    #[test]
    fn test_get_amount_out() {
        // 1000 in with reserves of 10000/10000 and 0.3% fee
        let result = get_amount_out(1000, 10000, 10000, 30).unwrap();
        // Should be approximately 906 (less than 1000 due to constant product and fee)
        assert!(result > 900 && result < 1000);
    }

    #[test]
    fn test_quote() {
        // If reserves are 1:1, amounts should be equal
        assert_eq!(quote(100, 1000, 1000).unwrap(), 100);

        // If reserve_b is 2x reserve_a, amount_b should be 2x amount_a
        assert_eq!(quote(100, 1000, 2000).unwrap(), 200);
    }

    #[test]
    fn test_calculate_liquidity_tokens() {
        // First deposit
        let tokens = calculate_liquidity_tokens(10000, 10000, 0, 0, 0).unwrap();
        assert_eq!(tokens, 10000 - MINIMUM_LIQUIDITY);

        // Second deposit (proportional)
        let tokens = calculate_liquidity_tokens(1000, 1000, 10000, 10000, 9000).unwrap();
        assert_eq!(tokens, 900);
    }

    #[test]
    fn test_staking_multiplier() {
        assert_eq!(calculate_staking_multiplier(0), 10_000);
        assert_eq!(calculate_staking_multiplier(86_400 * 5), 10_000);
        assert_eq!(calculate_staking_multiplier(86_400 * 10), 11_000);
        assert_eq!(calculate_staking_multiplier(86_400 * 20), 12_000);
        assert_eq!(calculate_staking_multiplier(86_400 * 45), 12_500);
        assert_eq!(calculate_staking_multiplier(86_400 * 90), 13_000);
    }

    #[test]
    fn test_withdrawal_amounts() {
        let (amount_0, amount_1) = calculate_withdrawal_amounts(1000, 10000, 10000, 10000).unwrap();
        assert_eq!(amount_0, 1000);
        assert_eq!(amount_1, 1000);
    }

    #[test]
    fn test_mul_div_down_basic() {
        assert_eq!(mul_div_down(10, 20, 5).unwrap(), 40);
        assert_eq!(mul_div_down(10, 3, 4).unwrap(), 7);
    }

    #[test]
    fn test_mul_div_up_basic() {
        assert_eq!(mul_div_up(10, 20, 5).unwrap(), 40);
        assert_eq!(mul_div_up(10, 3, 4).unwrap(), 8);
    }

    #[test]
    fn test_min_trade_amount_constant() {
        // Verify MIN_TRADE_AMOUNT is 0.1 XLM (1_000_000 stroops)
        assert_eq!(MIN_TRADE_AMOUNT, 1_000_000);
    }

    #[test]
    fn test_k_invariant_after_swap() {
        let reserve_0 = 1_000_000i128;
        let reserve_1 = 1_000_000i128;
        let amount_in = 10_000i128;
        let fee_bps = 30u32;

        let amount_out = get_amount_out(amount_in, reserve_0, reserve_1, fee_bps).unwrap();

        let new_reserve_0 = reserve_0 + amount_in;
        let new_reserve_1 = reserve_1 - amount_out;

        let k_before = calculate_k(reserve_0, reserve_1).unwrap();
        let k_after = calculate_k(new_reserve_0, new_reserve_1).unwrap();

        // K should increase due to fees
        assert!(k_after >= k_before, "K should not decrease after swap with fees");
    }
}
