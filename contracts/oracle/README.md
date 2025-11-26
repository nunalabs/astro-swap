# AstroSwap Oracle Contract

A price oracle contract for AstroSwap DEX with support for Time-Weighted Average Price (TWAP) calculations and DIA oracle integration.

## Features

- **Price Feed Management**: Store and update price data for tokens
- **TWAP Support**: Calculate time-weighted average prices over configurable windows
- **Staleness Detection**: Automatic detection of stale price data
- **DIA Integration**: Support for external oracle feeds (e.g., DIA)
- **Admin Controls**: Secure admin-only functions for price updates and configuration

## Contract Interface

### Initialization

```rust
fn initialize(admin: Address, staleness_threshold: u64) -> Result<(), OracleError>
```

Initialize the oracle contract with an admin address and staleness threshold (in seconds).

### Price Management

```rust
fn update_price(
    token: Address,
    price: i128,
    decimals: u32,
    source: String
) -> Result<(), OracleError>
```

Update the price for a token. Only callable by admin.

```rust
fn get_price(token: Address) -> Result<PriceData, OracleError>
```

Get the current price for a token. Returns error if price is stale.

```rust
fn is_price_fresh(token: Address) -> bool
```

Check if a token's price is fresh (not stale).

### TWAP Functions

```rust
fn get_twap(token: Address, window: u64) -> Result<i128, OracleError>
```

Calculate Time-Weighted Average Price over a specified window (in seconds).

**Window Constraints:**
- Minimum: 300 seconds (5 minutes)
- Maximum: 86400 seconds (24 hours)

### Feed Management

```rust
fn add_price_feed(token: Address, feed_id: String) -> Result<(), OracleError>
```

Map a token to a DIA feed identifier (e.g., "BTC/USD").

```rust
fn get_feed_id(token: Address) -> Result<String, OracleError>
```

Get the DIA feed ID for a token.

### Admin Functions

```rust
fn set_staleness_threshold(threshold: u64) -> Result<(), OracleError>
```

Update the staleness threshold. Must be between 1 and 86400 seconds (24 hours).

```rust
fn set_admin(new_admin: Address) -> Result<(), OracleError>
```

Transfer admin privileges to a new address.

```rust
fn get_admin() -> Address
fn get_staleness_threshold() -> u64
```

Query current admin and staleness threshold.

## Data Structures

### PriceData

```rust
pub struct PriceData {
    pub price: i128,          // Price value (scaled by decimals)
    pub timestamp: u64,       // Last update timestamp
    pub decimals: u32,        // Number of decimals
    pub source: String,       // Price source identifier
}
```

### Observation (Internal)

```rust
pub struct Observation {
    pub timestamp: u64,
    pub cumulative_price: i128,
    pub price: i128,
}
```

Stored observations for TWAP calculations (max 100 per token).

## Error Codes

| Error | Code | Description |
|-------|------|-------------|
| `AlreadyInitialized` | 800 | Contract already initialized |
| `NotInitialized` | 801 | Contract not initialized |
| `Unauthorized` | 820 | Caller not authorized |
| `PriceFeedNotFound` | 830 | No price feed for token |
| `StalePrice` | 831 | Price data is stale |
| `InvalidPrice` | 832 | Invalid price value |
| `InsufficientObservations` | 850 | Not enough data for TWAP |
| `InvalidWindow` | 851 | TWAP window out of range |
| `InvalidStalenessThreshold` | 870 | Invalid threshold value |

## Usage Example

```rust
use soroban_sdk::{Address, Env, String};

// Initialize oracle
let admin = Address::from_str(&env, "GXXX...");
oracle.initialize(admin, 3600); // 1 hour staleness

// Add price feed
oracle.add_price_feed(
    token_address,
    String::from_str(&env, "BTC/USD")
);

// Update price (admin only)
oracle.update_price(
    token_address,
    50_000_00000000, // $50,000 with 8 decimals
    8,
    String::from_str(&env, "DIA")
);

// Get current price
let price_data = oracle.get_price(token_address)?;
println!("Price: {}, Decimals: {}", price_data.price, price_data.decimals);

// Calculate 1-hour TWAP
let twap = oracle.get_twap(token_address, 3600)?;
```

## TWAP Algorithm

The contract implements cumulative price tracking for efficient TWAP calculation:

1. **Observation Storage**: Each price update stores:
   - Current price
   - Cumulative price (previous + price * time_elapsed)
   - Timestamp

2. **TWAP Calculation**:
   ```
   TWAP = (cumulative_price_end - cumulative_price_start) / time_elapsed
   ```

3. **Circular Buffer**: Max 100 observations per token, oldest overwritten first

## Integration with DIA Oracle

The contract is designed to integrate with [DIA](https://diadata.org/) for external price feeds:

1. Map tokens to DIA feed IDs using `add_price_feed`
2. Off-chain service fetches prices from DIA API
3. Service calls `update_price` with fetched data
4. Contract stores prices and maintains TWAP observations

## Security Considerations

- **Admin-Only Updates**: Only admin can update prices and configuration
- **Staleness Protection**: Prevents using outdated prices
- **Overflow Protection**: Safe math operations throughout
- **Price Validation**: Rejects zero or negative prices
- **Decimal Limits**: Max 18 decimals to prevent overflow

## Building & Testing

```bash
# Build contract
cargo build --package astroswap-oracle --release

# Run tests
cargo test --package astroswap-oracle

# Generate optimized WASM
soroban contract build --package astroswap-oracle
```

## Deployment

```bash
# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/astroswap_oracle.wasm \
  --source <ADMIN_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Initialize
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015" \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --staleness_threshold 3600
```

## License

GPL-3.0

## Contributing

See main repository for contribution guidelines.
