#![no_std]
//! Math utilities for AstroSwap
//!
//! This crate provides high-precision mathematical operations
//! for DeFi calculations on Soroban.

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

/// Safe addition with overflow check
pub fn safe_add(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_add(b).ok_or(MathError::Overflow)
}

/// Safe subtraction with underflow check
pub fn safe_sub(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_sub(b).ok_or(MathError::Underflow)
}

/// Safe multiplication with overflow check
pub fn safe_mul(a: i128, b: i128) -> Result<i128, MathError> {
    a.checked_mul(b).ok_or(MathError::Overflow)
}

/// Safe division with zero check
pub fn safe_div(a: i128, b: i128) -> Result<i128, MathError> {
    if b == 0 {
        return Err(MathError::DivisionByZero);
    }
    a.checked_div(b).ok_or(MathError::Overflow)
}

/// Multiply then divide (a * b / c) with intermediate precision
pub fn mul_div(a: i128, b: i128, c: i128) -> Result<i128, MathError> {
    if c == 0 {
        return Err(MathError::DivisionByZero);
    }

    // Use i128::MAX to check for overflow
    let product = safe_mul(a, b)?;
    safe_div(product, c)
}

/// Integer square root using Newton's method
pub fn sqrt(value: i128) -> i128 {
    if value == 0 {
        return 0;
    }
    if value < 0 {
        return 0; // Invalid input
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
}
