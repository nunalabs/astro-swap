#![no_std]
//! Math utilities for AstroSwap
//!
//! This crate provides high-precision mathematical operations
//! for DeFi calculations on Soroban.
//!
//! ## Safety Features
//! - All operations use checked arithmetic to prevent overflow/underflow
//! - Phantom overflow handling for mul_div operations
//! - Consistent rounding (down favors protocol, up for user payments)

/// Fixed-point precision (18 decimals)
pub const PRECISION: i128 = 1_000_000_000_000_000_000;

/// Basis points denominator
pub const BPS: u32 = 10_000;

/// Errors for math operations
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MathError {
    Overflow,
    Underflow,
    DivisionByZero,
    InvalidInput,
}

// ==================== Basic Safe Arithmetic ====================

/// Safe addition with overflow check
#[inline]
pub fn safe_add(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_add(b).ok_or(MathError::Overflow)
}

/// Safe subtraction with underflow check
#[inline]
pub fn safe_sub(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_sub(b).ok_or(MathError::Underflow)
}

/// Safe multiplication with overflow check
#[inline]
pub fn safe_mul(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_mul(b).ok_or(MathError::Overflow)
}

/// Safe division with zero check
#[inline]
pub fn safe_div(a: i128, b: i128) -> Result<i128, MathError> {
    if b == 0 {
        return Err(MathError::DivisionByZero);
    }
    a.checked_div(b).ok_or(MathError::Overflow)
}

// ==================== Advanced Safe Arithmetic ====================

/// Multiply then divide (a * b / c) with intermediate precision
/// DEPRECATED: Use mul_div_down or mul_div_up for explicit rounding control
#[inline]
pub fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, MathError> {
    mul_div_down(a, b, c)
}

/// Multiply then divide with phantom overflow protection: (a * b) / c
/// Rounds DOWN (floor) - favors the protocol
///
/// Handles phantom overflow where a*b overflows but (a*b)/c fits in i128.
/// Uses u128 intermediate calculation to prevent overflow.
#[inline]
pub fn mul_div_down(a: i128, b: i128, c: i128) -> Result<i128, MathError> {
    if c == 0 {
        return Err(MathError::DivisionByZero);
    }
    if a == 0 || b == 0 {
        return Ok(0);
    }

    // Handle negative numbers - for AMM math we expect positive values
    if a < 0 || b < 0 || c < 0 {
        return Err(MathError::InvalidInput);
    }

    // Try direct calculation first (most common case)
    if let Some(product) = a.checked_mul(b) {
        return product.checked_div(c).ok_or(MathError::Overflow);
    }

    // Phantom overflow: use u128 for intermediate calculation
    let a_u = a as u128;
    let b_u = b as u128;
    let c_u = c as u128;

    // For very large numbers, use decomposition: a*b/c = (a/c)*b + (a%c)*b/c
    let quotient = a_u / c_u;
    let remainder = a_u % c_u;

    // result = quotient * b + (remainder * b) / c
    let term1 = quotient.checked_mul(b_u).ok_or(MathError::Overflow)?;
    let term2_num = remainder.checked_mul(b_u).ok_or(MathError::Overflow)?;
    let term2 = term2_num / c_u;

    let result = term1.checked_add(term2).ok_or(MathError::Overflow)?;

    if result > i128::MAX as u128 {
        return Err(MathError::Overflow);
    }

    Ok(result as i128)
}

/// Multiply then divide with phantom overflow protection: (a * b) / c
/// Rounds UP (ceiling) - favors the user paying more / receiving less
/// Used for get_amount_in calculations
#[inline]
pub fn mul_div_up(a: i128, b: i128, c: i128) -> Result<i128, MathError> {
    if c == 0 {
        return Err(MathError::DivisionByZero);
    }
    if a == 0 || b == 0 {
        return Ok(0);
    }

    // Handle negative numbers
    if a < 0 || b < 0 || c < 0 {
        return Err(MathError::InvalidInput);
    }

    // floor((a * b + c - 1) / c) = ceil(a * b / c)
    let floor_result = mul_div_down(a, b, c)?;

    // Check if there's a remainder
    let a_u = a as u128;
    let b_u = b as u128;
    let c_u = c as u128;

    // Check remainder without overflow
    let quotient = a_u / c_u;
    let remainder_a = a_u % c_u;
    let term1_remainder = (quotient * b_u) % c_u;
    let term2_product = remainder_a * b_u;
    let term2_remainder = term2_product % c_u;

    // If there's any remainder, round up
    if term1_remainder > 0 || term2_remainder > 0 {
        safe_add(floor_result, 1)
    } else {
        Ok(floor_result)
    }
}

/// Calculate k = reserve_0 * reserve_1 with overflow protection
/// Used for constant product invariant verification
#[inline]
pub fn calculate_k(reserve_0: i128, reserve_1: i128) -> Result<i128, MathError> {
    if reserve_0 < 0 || reserve_1 < 0 {
        return Err(MathError::InvalidInput);
    }
    safe_mul(reserve_0, reserve_1)
}

/// Update reserves after deposit with overflow check
#[inline]
pub fn update_reserves_add(
    reserve_0: i128,
    reserve_1: i128,
    amount_0: i128,
    amount_1: i128,
) -> Result<(i128, i128), MathError> {
    let new_reserve_0 = safe_add(reserve_0, amount_0)?;
    let new_reserve_1 = safe_add(reserve_1, amount_1)?;
    Ok((new_reserve_0, new_reserve_1))
}

/// Update reserves after withdrawal with underflow check
/// Also validates that results are non-negative (AMM safety)
#[inline]
pub fn update_reserves_sub(
    reserve_0: i128,
    reserve_1: i128,
    amount_0: i128,
    amount_1: i128,
) -> Result<(i128, i128), MathError> {
    let new_reserve_0 = safe_sub(reserve_0, amount_0)?;
    let new_reserve_1 = safe_sub(reserve_1, amount_1)?;

    // AMM safety: reserves must never go negative
    if new_reserve_0 < 0 || new_reserve_1 < 0 {
        return Err(MathError::Underflow);
    }

    Ok((new_reserve_0, new_reserve_1))
}

/// Update reserves after swap with overflow/underflow check
#[inline]
pub fn update_reserves_swap(
    reserve_in: i128,
    reserve_out: i128,
    amount_in: i128,
    amount_out: i128,
    is_token_0_in: bool,
) -> Result<(i128, i128), MathError> {
    let new_reserve_in = safe_add(reserve_in, amount_in)?;
    let new_reserve_out = safe_sub(reserve_out, amount_out)?;

    // AMM safety: reserves must never go negative
    if new_reserve_out < 0 {
        return Err(MathError::Underflow);
    }

    if is_token_0_in {
        Ok((new_reserve_in, new_reserve_out))
    } else {
        Ok((new_reserve_out, new_reserve_in))
    }
}

/// Verify k invariant: k_new >= k_old (with overflow protection)
#[inline]
pub fn verify_k_invariant(
    new_reserve_0: i128,
    new_reserve_1: i128,
    old_reserve_0: i128,
    old_reserve_1: i128,
) -> Result<bool, MathError> {
    let k_new = calculate_k(new_reserve_0, new_reserve_1)?;
    let k_old = calculate_k(old_reserve_0, old_reserve_1)?;
    Ok(k_new >= k_old)
}

/// Integer square root using Newton's method
/// Returns 0 for negative or zero values (invalid input for AMM context)
pub fn sqrt(value: i128) -> i128 {
    if value <= 0 {
        return 0;
    }

    let mut x = value;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + value / x) / 2;
    }

    x
}

/// Calculate percentage in basis points
/// (amount * bps) / 10000
pub fn percentage_bps(amount: i128, bps: u32) -> Result<i128, MathError> {
    safe_div(safe_mul(amount, bps as i128)?, BPS as i128)
}

/// Calculate remainder after percentage
/// amount - (amount * bps) / 10000
pub fn remainder_after_bps(amount: i128, bps: u32) -> Result<i128, MathError> {
    let fee = percentage_bps(amount, bps)?;
    safe_sub(amount, fee)
}

/// Min of two values
pub fn min(a: i128, b: i128) -> i128 {
    if a < b {
        a
    } else {
        b
    }
}

/// Max of two values
pub fn max(a: i128, b: i128) -> i128 {
    if a > b {
        a
    } else {
        b
    }
}

/// Clamp value between min and max
pub fn clamp(value: i128, min_val: i128, max_val: i128) -> i128 {
    max(min_val, min(max_val, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_safe_operations() {
        assert_eq!(safe_add(1, 2), Ok(3));
        assert_eq!(safe_sub(5, 3), Ok(2));
        assert_eq!(safe_mul(3, 4), Ok(12));
        assert_eq!(safe_div(10, 2), Ok(5));
        assert_eq!(safe_div(10, 0), Err(MathError::DivisionByZero));
    }

    #[test]
    fn test_sqrt() {
        assert_eq!(sqrt(0), 0);
        assert_eq!(sqrt(1), 1);
        assert_eq!(sqrt(4), 2);
        assert_eq!(sqrt(9), 3);
        assert_eq!(sqrt(100), 10);
        assert_eq!(sqrt(10000), 100);
    }

    #[test]
    fn test_percentage_bps() {
        // 1% of 10000 = 100
        assert_eq!(percentage_bps(10000, 100), Ok(100));
        // 0.3% of 10000 = 30
        assert_eq!(percentage_bps(10000, 30), Ok(30));
    }

    #[test]
    fn test_min_max() {
        assert_eq!(min(5, 10), 5);
        assert_eq!(max(5, 10), 10);
        assert_eq!(clamp(5, 0, 10), 5);
        assert_eq!(clamp(-5, 0, 10), 0);
        assert_eq!(clamp(15, 0, 10), 10);
    }

    // ==================== New Tests for Advanced Safe Math ====================

    #[test]
    fn test_mul_div_down_basic() {
        // Simple case: (10 * 20) / 5 = 40
        assert_eq!(mul_div_down(10, 20, 5).unwrap(), 40);

        // With remainder: (10 * 3) / 4 = 7 (rounds down from 7.5)
        assert_eq!(mul_div_down(10, 3, 4).unwrap(), 7);

        // Zero cases
        assert_eq!(mul_div_down(0, 100, 10).unwrap(), 0);
        assert_eq!(mul_div_down(100, 0, 10).unwrap(), 0);
    }

    #[test]
    fn test_mul_div_down_phantom_overflow() {
        // This would overflow in direct multiplication but result fits
        let large_a = i128::MAX / 100;
        let large_b = 50;
        let divisor = 25;
        // (large_a * 50) / 25 = large_a * 2
        let result = mul_div_down(large_a, large_b, divisor);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), large_a * 2);
    }

    #[test]
    fn test_mul_div_down_division_by_zero() {
        let result = mul_div_down(100, 200, 0);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), MathError::DivisionByZero);
    }

    #[test]
    fn test_mul_div_down_negative_rejection() {
        // Negative numbers should be rejected for AMM safety
        assert!(mul_div_down(-10, 20, 5).is_err());
        assert!(mul_div_down(10, -20, 5).is_err());
        assert!(mul_div_down(10, 20, -5).is_err());
    }

    #[test]
    fn test_mul_div_up_basic() {
        // Exact division: (10 * 20) / 5 = 40
        assert_eq!(mul_div_up(10, 20, 5).unwrap(), 40);

        // With remainder: (10 * 3) / 4 = 8 (rounds up from 7.5)
        assert_eq!(mul_div_up(10, 3, 4).unwrap(), 8);

        // Another rounding case: (7 * 3) / 10 = 3 (rounds up from 2.1)
        assert_eq!(mul_div_up(7, 3, 10).unwrap(), 3);
    }

    #[test]
    fn test_mul_div_up_exact_vs_down() {
        // When there's a remainder, up should be greater than down
        let down = mul_div_down(10, 3, 4).unwrap();
        let up = mul_div_up(10, 3, 4).unwrap();
        assert!(up > down);
        assert_eq!(up - down, 1);

        // When exact, they should be equal
        let down_exact = mul_div_down(10, 20, 5).unwrap();
        let up_exact = mul_div_up(10, 20, 5).unwrap();
        assert_eq!(down_exact, up_exact);
    }

    #[test]
    fn test_calculate_k_basic() {
        assert_eq!(calculate_k(100, 200).unwrap(), 20000);
        assert_eq!(calculate_k(0, 100).unwrap(), 0);
        assert_eq!(calculate_k(1, 1).unwrap(), 1);
    }

    #[test]
    fn test_calculate_k_overflow() {
        // Very large reserves should trigger overflow
        let result = calculate_k(i128::MAX, 2);
        assert!(result.is_err());
    }

    #[test]
    fn test_calculate_k_negative_rejection() {
        assert!(calculate_k(-100, 200).is_err());
        assert!(calculate_k(100, -200).is_err());
    }

    #[test]
    fn test_update_reserves_add() {
        let (new_0, new_1) = update_reserves_add(100, 200, 50, 100).unwrap();
        assert_eq!(new_0, 150);
        assert_eq!(new_1, 300);
    }

    #[test]
    fn test_update_reserves_add_overflow() {
        let result = update_reserves_add(i128::MAX, 100, 1, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_update_reserves_sub() {
        let (new_0, new_1) = update_reserves_sub(100, 200, 50, 100).unwrap();
        assert_eq!(new_0, 50);
        assert_eq!(new_1, 100);
    }

    #[test]
    fn test_update_reserves_sub_underflow() {
        // Test true underflow (below i128::MIN)
        let result = update_reserves_sub(i128::MIN + 10, 200, 20, 50);
        assert!(result.is_err()); // i128::MIN + 10 - 20 causes underflow
    }

    #[test]
    fn test_update_reserves_sub_negative_result() {
        // Test AMM safety: reserves going negative should fail
        // Even though i128 can hold negative values, negative reserves don't make sense
        let result = update_reserves_sub(100, 200, 150, 100);
        assert!(result.is_err()); // 100 - 150 = -50, should fail AMM validation
    }

    #[test]
    fn test_update_reserves_swap_token_0_in() {
        // Token 0 in: reserve_in increases, reserve_out decreases
        let (new_0, new_1) = update_reserves_swap(1000, 1000, 100, 90, true).unwrap();
        assert_eq!(new_0, 1100); // reserve_in + amount_in
        assert_eq!(new_1, 910);  // reserve_out - amount_out
    }

    #[test]
    fn test_update_reserves_swap_token_1_in() {
        // Token 1 in: positions are swapped
        let (new_0, new_1) = update_reserves_swap(1000, 1000, 100, 90, false).unwrap();
        assert_eq!(new_0, 910);  // reserve_out - amount_out (becomes reserve_0)
        assert_eq!(new_1, 1100); // reserve_in + amount_in (becomes reserve_1)
    }

    #[test]
    fn test_verify_k_invariant_increase() {
        // K increases: valid
        let result = verify_k_invariant(110, 110, 100, 100).unwrap();
        assert!(result);
    }

    #[test]
    fn test_verify_k_invariant_same() {
        // K stays same: valid
        let result = verify_k_invariant(100, 100, 100, 100).unwrap();
        assert!(result);
    }

    #[test]
    fn test_verify_k_invariant_decrease() {
        // K decreases: invalid
        let result = verify_k_invariant(90, 90, 100, 100).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_large_reserves_realistic() {
        // Test with realistic DeFi amounts
        // 1 million tokens with 7 decimals (Stellar standard)
        let million_7dec = 1_000_000_i128 * 10_000_000; // 10^13

        // Should handle multiplication of realistic reserves
        let k = calculate_k(million_7dec, million_7dec);
        assert!(k.is_ok());

        // 10 billion with 7 decimals should still work
        let ten_billion_7dec = 10_000_000_000_i128 * 10_000_000; // 10^17
        let k2 = calculate_k(ten_billion_7dec, ten_billion_7dec);
        // This will overflow (10^34 > i128::MAX ~= 1.7 * 10^38 but close)
        // Actually 10^34 is fine, let's test with larger
        assert!(k2.is_ok());

        // Very large amounts should fail gracefully (i128::MAX / 2)
        let very_large = i128::MAX / 2;
        let result = calculate_k(very_large, 3);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), MathError::Overflow);
    }
}
