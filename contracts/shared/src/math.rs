use crate::error::AstroSwapError;

/// Precision for calculations (18 decimals)
pub const PRECISION: i128 = 1_000_000_000_000_000_000;

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

/// Safe addition with overflow check
pub fn safe_add(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    a.checked_add(b).ok_or(AstroSwapError::Overflow)
}

/// Safe subtraction with underflow check
pub fn safe_sub(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    a.checked_sub(b).ok_or(AstroSwapError::Underflow)
}

/// Safe multiplication with overflow check
pub fn safe_mul(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    a.checked_mul(b).ok_or(AstroSwapError::Overflow)
}

/// Safe division with zero check
pub fn safe_div(a: i128, b: i128) -> Result<i128, AstroSwapError> {
    if b == 0 {
        return Err(AstroSwapError::DivisionByZero);
    }
    a.checked_div(b).ok_or(AstroSwapError::Overflow)
}

/// Integer square root using Newton's method
/// Used for calculating initial LP tokens: sqrt(amount_a * amount_b)
pub fn sqrt(value: i128) -> i128 {
    if value == 0 {
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

/// Calculate amount out for a swap using constant product formula
/// Formula: amount_out = (reserve_out * amount_in_with_fee) / (reserve_in + amount_in_with_fee)
pub fn get_amount_out(
    amount_in: i128,
    reserve_in: i128,
    reserve_out: i128,
    fee_bps: u32,
) -> Result<i128, AstroSwapError> {
    if amount_in <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }
    if reserve_in <= 0 || reserve_out <= 0 {
        return Err(AstroSwapError::InsufficientLiquidity);
    }

    // Apply fee: amount_in_with_fee = amount_in * (10000 - fee) / 10000
    let fee_multiplier = (BPS_DENOMINATOR - fee_bps) as i128;
    let amount_in_with_fee = safe_mul(amount_in, fee_multiplier)?;

    // numerator = amount_in_with_fee * reserve_out
    let numerator = safe_mul(amount_in_with_fee, reserve_out)?;

    // denominator = reserve_in * 10000 + amount_in_with_fee
    let reserve_in_scaled = safe_mul(reserve_in, BPS_DENOMINATOR as i128)?;
    let denominator = safe_add(reserve_in_scaled, amount_in_with_fee)?;

    safe_div(numerator, denominator)
}

/// Calculate amount in needed for a specific output
/// Formula: amount_in = (reserve_in * amount_out * 10000) / ((reserve_out - amount_out) * (10000 - fee)) + 1
pub fn get_amount_in(
    amount_out: i128,
    reserve_in: i128,
    reserve_out: i128,
    fee_bps: u32,
) -> Result<i128, AstroSwapError> {
    if amount_out <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }
    if reserve_in <= 0 || reserve_out <= 0 {
        return Err(AstroSwapError::InsufficientLiquidity);
    }
    if amount_out >= reserve_out {
        return Err(AstroSwapError::InsufficientLiquidity);
    }

    // numerator = reserve_in * amount_out * 10000
    let numerator = safe_mul(safe_mul(reserve_in, amount_out)?, BPS_DENOMINATOR as i128)?;

    // denominator = (reserve_out - amount_out) * (10000 - fee)
    let reserve_diff = safe_sub(reserve_out, amount_out)?;
    let fee_multiplier = (BPS_DENOMINATOR - fee_bps) as i128;
    let denominator = safe_mul(reserve_diff, fee_multiplier)?;

    // Add 1 to round up
    safe_add(safe_div(numerator, denominator)?, 1)
}

/// Quote: given some amount of token A, how much of token B should be added
/// to maintain the ratio (used for adding liquidity)
pub fn quote(amount_a: i128, reserve_a: i128, reserve_b: i128) -> Result<i128, AstroSwapError> {
    if amount_a <= 0 {
        return Err(AstroSwapError::InvalidAmount);
    }
    if reserve_a <= 0 || reserve_b <= 0 {
        return Err(AstroSwapError::InsufficientLiquidity);
    }

    // amount_b = amount_a * reserve_b / reserve_a
    safe_div(safe_mul(amount_a, reserve_b)?, reserve_a)
}

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
        let liquidity_a = safe_div(safe_mul(amount_a, total_supply)?, reserve_a)?;
        let liquidity_b = safe_div(safe_mul(amount_b, total_supply)?, reserve_b)?;

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

    let amount_a = safe_div(safe_mul(shares, reserve_a)?, total_supply)?;
    let amount_b = safe_div(safe_mul(shares, reserve_b)?, total_supply)?;

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
    let expected_out = safe_div(safe_mul(amount_in, reserve_out)?, reserve_in)?;

    // Actual output with AMM
    let actual_out = get_amount_out(amount_in, reserve_in, reserve_out, fee_bps)?;

    // Impact = (expected - actual) / expected * 10000
    if expected_out == 0 {
        return Ok(0);
    }

    let impact = safe_div(
        safe_mul(safe_sub(expected_out, actual_out)?, BPS_DENOMINATOR as i128)?,
        expected_out,
    )?;

    Ok(impact as u32)
}

/// Calculate staking multiplier based on time staked
/// Progressive rewards: starts at 1x, increases to 1.3x over 60 days
pub fn calculate_staking_multiplier(stake_duration_seconds: u64) -> u32 {
    // Note: DAY = 86_400, used for reference in comments below
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
        assert_eq!(calculate_staking_multiplier(0), 10_000); // Day 0
        assert_eq!(calculate_staking_multiplier(86_400 * 5), 10_000); // Day 5
        assert_eq!(calculate_staking_multiplier(86_400 * 10), 11_000); // Day 10
        assert_eq!(calculate_staking_multiplier(86_400 * 20), 12_000); // Day 20
        assert_eq!(calculate_staking_multiplier(86_400 * 45), 12_500); // Day 45
        assert_eq!(calculate_staking_multiplier(86_400 * 90), 13_000); // Day 90
    }

    #[test]
    fn test_get_amount_in() {
        // To get 906 out, we need approximately 1000 in (inverse of get_amount_out)
        let result = get_amount_in(906, 10000, 10000, 30).unwrap();
        // Should be approximately 1000
        assert!(result > 990 && result < 1100);
    }

    #[test]
    fn test_zero_input_fails() {
        // Zero amount should fail
        let result = get_amount_out(0, 10000, 10000, 30);
        assert!(result.is_err());
    }

    #[test]
    fn test_zero_reserves_fail() {
        // Zero reserves should fail
        let result = get_amount_out(1000, 0, 10000, 30);
        assert!(result.is_err());

        let result = get_amount_out(1000, 10000, 0, 30);
        assert!(result.is_err());
    }

    #[test]
    fn test_insufficient_liquidity() {
        // Trying to swap more than reserve should fail
        let result = get_amount_out(20000, 10000, 10000, 30);
        // This should return an amount less than reserve_out but won't error
        assert!(result.is_ok());
        // The output can't exceed reserve_out
        assert!(result.unwrap() < 10000);
    }

    #[test]
    fn test_withdrawal_amounts() {
        // Withdrawing 10% of LP tokens should give 10% of reserves
        let (amount_0, amount_1) = calculate_withdrawal_amounts(1000, 10000, 10000, 10000).unwrap();
        assert_eq!(amount_0, 1000);
        assert_eq!(amount_1, 1000);
    }

    #[test]
    fn test_safe_math_overflow_protection() {
        // Large numbers should not overflow
        let large = i128::MAX / 2;
        let result = safe_mul(large, 2);
        assert!(result.is_ok());

        // But overflow should be caught
        let result = safe_mul(i128::MAX, 2);
        assert!(result.is_err());
    }

    #[test]
    fn test_fee_calculation() {
        // Test with different fee tiers
        // 0.3% fee (30 bps)
        let result_30 = get_amount_out(1000, 10000, 10000, 30).unwrap();

        // 1% fee (100 bps)
        let result_100 = get_amount_out(1000, 10000, 10000, 100).unwrap();

        // Higher fee should result in less output
        assert!(result_30 > result_100);

        // Zero fee
        let result_0 = get_amount_out(1000, 10000, 10000, 0).unwrap();
        assert!(result_0 > result_30);
    }

    #[test]
    fn test_price_impact() {
        // Small swap on large pool - low impact
        let result_small = calculate_price_impact(100, 1000000, 1000000, 30).unwrap();

        // Large swap on small pool - high impact
        let result_large = calculate_price_impact(10000, 100000, 100000, 30).unwrap();

        // Larger swaps relative to pool size should have higher price impact
        assert!(result_large > result_small);
    }
}
