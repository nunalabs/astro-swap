use soroban_sdk::contracterror;

/// Error codes for Oracle contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OracleError {
    // Initialization errors (800-819)
    AlreadyInitialized = 800,
    NotInitialized = 801,

    // Authorization errors (820-829)
    Unauthorized = 820,

    // Price feed errors (830-849)
    PriceFeedNotFound = 830,
    StalePrice = 831,
    InvalidPrice = 832,
    InvalidTimestamp = 833,
    PriceNotAvailable = 834,

    // TWAP errors (850-869)
    InsufficientObservations = 850,
    InvalidWindow = 851,
    WindowTooLarge = 852,
    ObservationTooOld = 853,

    // Configuration errors (870-889)
    InvalidStalenessThreshold = 870,
    InvalidDecimals = 871,
    InvalidFeedId = 872,

    // Math errors (890-899)
    Overflow = 890,
    DivisionByZero = 891,
}
