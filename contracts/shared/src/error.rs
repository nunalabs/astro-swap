use astro_core_shared::types::SharedError;
use soroban_sdk::contracterror;

/// Error codes for AstroSwap contracts
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum AstroSwapError {
    // General errors (1-99)
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidArgument = 4,
    Overflow = 5,
    Underflow = 6,
    DivisionByZero = 7,
    Reentrancy = 8,

    // Token errors (100-199)
    InvalidToken = 100,
    SameToken = 101,
    InsufficientBalance = 102,
    InsufficientAllowance = 103,
    TransferFailed = 104,

    // Liquidity errors (200-299)
    InsufficientLiquidity = 200,
    InvalidAmount = 201,
    InsufficientShares = 202,
    MinimumNotMet = 203,
    PoolNotFound = 204,
    PairExists = 205,
    PairNotFound = 206,

    // Swap errors (300-399)
    SlippageExceeded = 300,
    DeadlineExpired = 301,
    InsufficientOutputAmount = 302,
    ExcessiveInputAmount = 303,
    InvalidPath = 304,
    PriceImpactTooHigh = 305,

    // Staking errors (400-499)
    StakingPoolNotFound = 400,
    InsufficientStake = 401,
    StakingNotStarted = 402,
    StakingEnded = 403,
    NoRewardsAvailable = 404,
    InvalidStakingPeriod = 405,
    StakeNotFound = 406,

    // Admin errors (500-599)
    InvalidFee = 500,
    FeeTooHigh = 501,
    TimelockNotExpired = 502,
    InvalidAdmin = 503,
    ContractPaused = 504,

    // Aggregator errors (600-699)
    ProtocolNotFound = 600,
    InvalidRoute = 601,
    RouteNotFound = 602,
    AdapterError = 603,

    // Bridge errors (700-799)
    TokenNotGraduated = 700,
    AlreadyGraduated = 701,
    InvalidLaunchpad = 702,
    GraduationFailed = 703,
    InvalidPair = 704,
}

/// Convert SharedError from astro-core-shared to AstroSwapError
impl From<SharedError> for AstroSwapError {
    fn from(err: SharedError) -> Self {
        match err {
            // Initialization errors (1-99)
            SharedError::AlreadyInitialized => AstroSwapError::AlreadyInitialized,
            SharedError::NotInitialized => AstroSwapError::NotInitialized,
            SharedError::InvalidInitParams => AstroSwapError::InvalidArgument,
            // Authorization errors (100-199)
            SharedError::Unauthorized => AstroSwapError::Unauthorized,
            SharedError::NotAdmin => AstroSwapError::InvalidAdmin,
            SharedError::NotOwner => AstroSwapError::Unauthorized,
            SharedError::RoleRequired => AstroSwapError::Unauthorized,
            // Validation errors (200-299)
            SharedError::InvalidAmount => AstroSwapError::InvalidAmount,
            SharedError::AmountExceedsMax => AstroSwapError::InvalidAmount,
            SharedError::AmountBelowMin => AstroSwapError::MinimumNotMet,
            SharedError::InvalidAddress => AstroSwapError::InvalidArgument,
            SharedError::InvalidBps => AstroSwapError::InvalidArgument,
            SharedError::InvalidTimestamp => AstroSwapError::InvalidArgument,
            SharedError::BelowMinimum => AstroSwapError::MinimumNotMet,
            SharedError::InvalidPercentage => AstroSwapError::InvalidArgument,
            // State errors (300-399)
            SharedError::ContractPaused => AstroSwapError::ContractPaused,
            SharedError::ContractNotPaused => AstroSwapError::InvalidArgument,
            SharedError::InvalidState => AstroSwapError::InvalidArgument,
            SharedError::AlreadyExecuted => AstroSwapError::InvalidArgument,
            SharedError::DeadlineExpired => AstroSwapError::DeadlineExpired,
            // Token/balance errors (400-499)
            SharedError::InsufficientBalance => AstroSwapError::InsufficientBalance,
            SharedError::TokenNotFound => AstroSwapError::InvalidToken,
            SharedError::TransferFailed => AstroSwapError::TransferFailed,
            SharedError::InsufficientAllowance => AstroSwapError::InsufficientAllowance,
            // Math errors (500-599)
            SharedError::Overflow => AstroSwapError::Overflow,
            SharedError::Underflow => AstroSwapError::Underflow,
            SharedError::DivisionByZero => AstroSwapError::DivisionByZero,
            // Cross-contract errors (600-699)
            SharedError::CrossContractCallFailed => AstroSwapError::AdapterError,
            SharedError::ExternalContractNotSet => AstroSwapError::InvalidArgument,
            // Rate limiting errors (700-799)
            SharedError::DailyLimitExceeded => AstroSwapError::InvalidAmount,
            SharedError::TransactionLimitExceeded => AstroSwapError::InvalidAmount,
            SharedError::CooldownNotElapsed => AstroSwapError::TimelockNotExpired,
            SharedError::LimitExceeded => AstroSwapError::InvalidAmount,
            SharedError::UnlockBufferNotElapsed => AstroSwapError::TimelockNotExpired,
        }
    }
}
