#![no_std]
//! Reward curve library for AstroSwap staking
//!
//! Provides various curve types for calculating reward multipliers
//! based on staking duration or other parameters.

use soroban_sdk::contracttype;

/// Basis points (100% = 10000)
pub const BPS: u32 = 10_000;

/// One day in seconds
pub const DAY: u64 = 86_400;

/// Linear curve parameters
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LinearCurve {
    pub min_value: u32,
    pub max_value: u32,
    pub duration: u64,
}

/// Exponential decay parameters
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExponentialDecayCurve {
    pub initial_value: u32,
    pub decay_rate: u32, // basis points per period
    pub period: u64,
}

/// Stepped curve with 5 fixed levels
/// Uses tuple struct for Soroban compatibility (no arrays or Vecs in contracttype)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SteppedCurve {
    // 5 steps: (threshold, value) pairs
    pub step0_threshold: u64,
    pub step0_value: u32,
    pub step1_threshold: u64,
    pub step1_value: u32,
    pub step2_threshold: u64,
    pub step2_value: u32,
    pub step3_threshold: u64,
    pub step3_value: u32,
    pub step4_threshold: u64,
    pub step4_value: u32,
}

impl SteppedCurve {
    /// Create a new stepped curve with 5 levels
    pub fn new(steps: [(u64, u32); 5]) -> Self {
        Self {
            step0_threshold: steps[0].0,
            step0_value: steps[0].1,
            step1_threshold: steps[1].0,
            step1_value: steps[1].1,
            step2_threshold: steps[2].0,
            step2_value: steps[2].1,
            step3_threshold: steps[3].0,
            step3_value: steps[3].1,
            step4_threshold: steps[4].0,
            step4_value: steps[4].1,
        }
    }

    /// Evaluate the curve at a given time
    pub fn evaluate(&self, time: u64) -> u32 {
        if time <= self.step0_threshold {
            return self.step0_value;
        }
        if time <= self.step1_threshold {
            return self.step1_value;
        }
        if time <= self.step2_threshold {
            return self.step2_value;
        }
        if time <= self.step3_threshold {
            return self.step3_value;
        }
        self.step4_value
    }
}

/// Curve type for reward calculations (using tuple variants for Soroban compatibility)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CurveType {
    /// Constant value regardless of input
    Constant(u32),
    /// Linear curve: starts at min_value, increases to max_value over duration
    Linear(LinearCurve),
    /// Step function: discrete multiplier levels
    Stepped(SteppedCurve),
    /// Exponential decay: starts high, decreases over time
    ExponentialDecay(ExponentialDecayCurve),
}

impl CurveType {
    /// Create a constant curve
    pub fn constant(value: u32) -> Self {
        CurveType::Constant(value)
    }

    /// Create a linear curve from min to max over duration
    pub fn linear(min_value: u32, max_value: u32, duration: u64) -> Self {
        CurveType::Linear(LinearCurve {
            min_value,
            max_value,
            duration,
        })
    }

    /// Create the default AstroSwap staking curve
    /// 1.0x -> 1.3x over 60 days
    pub fn default_staking() -> Self {
        CurveType::Stepped(SteppedCurve::new([
            (DAY * 7, 10_000),  // 0-7 days: 1.0x
            (DAY * 14, 11_000), // 8-14 days: 1.1x
            (DAY * 30, 12_000), // 15-30 days: 1.2x
            (DAY * 60, 12_500), // 31-60 days: 1.25x
            (u64::MAX, 13_000), // 60+ days: 1.3x
        ]))
    }

    /// Evaluate the curve at a given point (time in seconds)
    pub fn evaluate(&self, time: u64) -> u32 {
        match self {
            CurveType::Constant(value) => *value,

            CurveType::Linear(params) => {
                if time >= params.duration {
                    params.max_value
                } else if params.duration == 0 {
                    params.min_value
                } else {
                    let range = params.max_value.saturating_sub(params.min_value) as u64;
                    let increase = (range * time) / params.duration;
                    params.min_value.saturating_add(increase as u32)
                }
            }

            CurveType::Stepped(stepped) => stepped.evaluate(time),

            CurveType::ExponentialDecay(params) => {
                if params.period == 0 {
                    return params.initial_value;
                }

                let periods = time / params.period;
                let mut value = params.initial_value;

                // Apply decay for each period (capped to prevent excessive iteration)
                let max_periods = core::cmp::min(periods, 1000);
                for _ in 0..max_periods {
                    let decay = (value as u64 * params.decay_rate as u64) / BPS as u64;
                    value = value.saturating_sub(decay as u32);
                }

                value
            }
        }
    }
}

/// Calculate reward multiplier for staking duration
/// Uses the default AstroSwap staking curve
/// Optimized inline implementation to avoid struct allocation
pub fn calculate_staking_multiplier(duration_seconds: u64) -> u32 {
    match duration_seconds {
        0..=604_800 => 10_000,           // 0-7 days: 1.0x
        604_801..=1_209_600 => 11_000,   // 8-14 days: 1.1x
        1_209_601..=2_592_000 => 12_000, // 15-30 days: 1.2x
        2_592_001..=5_184_000 => 12_500, // 31-60 days: 1.25x
        _ => 13_000,                     // 60+ days: 1.3x
    }
}

/// Calculate vesting release percentage
/// Linear vesting over duration
pub fn calculate_vesting_percentage(elapsed: u64, cliff: u64, duration: u64) -> u32 {
    if elapsed < cliff {
        return 0;
    }

    if duration == 0 || elapsed >= cliff + duration {
        return BPS;
    }

    let vesting_time = elapsed - cliff;
    ((vesting_time as u128 * BPS as u128) / duration as u128) as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constant_curve() {
        let curve = CurveType::constant(15_000);
        assert_eq!(curve.evaluate(0), 15_000);
        assert_eq!(curve.evaluate(1000), 15_000);
        assert_eq!(curve.evaluate(u64::MAX), 15_000);
    }

    #[test]
    fn test_linear_curve() {
        let curve = CurveType::linear(10_000, 20_000, 100);

        assert_eq!(curve.evaluate(0), 10_000);
        assert_eq!(curve.evaluate(50), 15_000);
        assert_eq!(curve.evaluate(100), 20_000);
        assert_eq!(curve.evaluate(200), 20_000); // Capped at max
    }

    #[test]
    fn test_staking_multiplier() {
        assert_eq!(calculate_staking_multiplier(0), 10_000);
        assert_eq!(calculate_staking_multiplier(DAY * 5), 10_000);
        assert_eq!(calculate_staking_multiplier(DAY * 10), 11_000);
        assert_eq!(calculate_staking_multiplier(DAY * 100), 13_000);
    }

    #[test]
    fn test_vesting() {
        // 30 day cliff, 365 day duration
        let cliff = DAY * 30;
        let duration = DAY * 365;

        // Before cliff: 0%
        assert_eq!(calculate_vesting_percentage(DAY * 10, cliff, duration), 0);

        // At cliff: 0%
        assert_eq!(calculate_vesting_percentage(cliff, cliff, duration), 0);

        // Halfway through vesting
        let halfway = cliff + duration / 2;
        assert_eq!(
            calculate_vesting_percentage(halfway, cliff, duration),
            5_000
        );

        // Fully vested
        assert_eq!(
            calculate_vesting_percentage(cliff + duration, cliff, duration),
            BPS
        );
    }
}
