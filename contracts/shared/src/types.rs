use soroban_sdk::{contracttype, Address, String, Vec};

/// Token metadata for graduated tokens from Astro-Shiba
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
    pub total_supply: i128,
    pub creator: Address,
    pub graduation_time: u64,
}

/// Information about a trading pair
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PairInfo {
    pub token_a: Address,
    pub token_b: Address,
    pub reserve_a: i128,
    pub reserve_b: i128,
    pub total_shares: i128,
    pub fee_bps: u32,
}

/// User's position in a liquidity pool
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityPosition {
    pub pair: Address,
    pub shares: i128,
    pub token_a_deposited: i128,
    pub token_b_deposited: i128,
    pub timestamp: u64,
}

/// Staking pool information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StakingPool {
    pub pool_id: u32,
    pub lp_token: Address,
    pub reward_token: Address,
    pub total_staked: i128,
    pub reward_per_second: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub last_update_time: u64,
    pub acc_reward_per_share: i128,
}

/// User's staking information
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UserStake {
    pub amount: i128,
    pub reward_debt: i128,
    pub stake_time: u64,
    pub multiplier: u32, // Basis points (10000 = 1x)
}

/// Route step for aggregator
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RouteStep {
    pub protocol_id: u32,
    pub pool_address: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: i128,
    pub expected_out: i128,
}

/// Complete swap route
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SwapRoute {
    pub steps: Vec<RouteStep>,
    pub expected_output: i128,
    pub total_fee_bps: u32,
}

/// Protocol identifiers for aggregator
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Protocol {
    AstroSwap = 0,
    Soroswap = 1,
    Phoenix = 2,
    Aqua = 3,
}

/// Graduation status for tokens from Astro-Shiba
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GraduatedToken {
    pub token: Address,
    pub pair: Address,
    pub staking_pool_id: u32,
    pub initial_price: i128,
    pub graduation_time: u64,
    pub metadata: TokenMetadata,
}
