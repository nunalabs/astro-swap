# CLAUDE.md - AstroSwap DEX

> **AstroSwap is a professional DEX (Decentralized Exchange) built on Stellar Soroban.**

## Overview

AstroSwap provides AMM (Automated Market Maker) functionality with:
- Factory for pair creation
- Constant product pools (x * y = k)
- Router for optimal swap paths
- LP staking rewards
- Multi-DEX aggregation
- Cross-chain bridge

**Key Integration**: Tokens that graduate from astro-launchpad get their liquidity transferred here.

## Repository Structure

```
astro-swap/
├── contracts/
│   ├── factory/      # Pair creation factory
│   ├── pair/         # AMM pool (x * y = k)
│   ├── router/       # Swap routing
│   ├── staking/      # LP staking rewards
│   ├── aggregator/   # Multi-DEX aggregation
│   ├── bridge/       # Cross-chain bridge
│   ├── oracle/       # Price oracle integration
│   ├── shared/       # LOCAL shared code (TO BE REPLACED)
│   └── tests/        # Integration tests
│
├── sdk/              # TypeScript SDK (@astroswap/sdk)
│   └── src/
│       ├── contracts/
│       └── bindings/
│
├── frontend/         # Vite + React frontend
├── indexer/          # DEX event indexer
│
├── Makefile          # Build commands
├── DEPLOYMENT.md     # Deployment guide
└── CLAUDE.md         # This file
```

## Commands (Makefile)

```bash
# Build all contracts
make build

# Run all tests
make test

# Format code
make fmt

# Lint with clippy
make lint

# Optimize WASM binaries
make optimize

# Generate TypeScript bindings
make bindings

# Deploy to testnet
make deploy-testnet

# Individual builds
make build-factory
make build-pair
make build-router
make build-staking

# Individual tests
make test-factory
make test-pair
make test-router
make test-shared

# SDK
make sdk-install
make sdk-build
make sdk-test
```

## Contract Architecture

### Factory
Creates and tracks liquidity pairs.

```rust
// Create a new pair
pub fn create_pair(token_a: Address, token_b: Address) -> Address
// Get pair address
pub fn get_pair(token_a: Address, token_b: Address) -> Option<Address>
// Get all pairs
pub fn all_pairs() -> Vec<Address>
```

### Pair (AMM Pool)
Constant product AMM: `k = reserve_0 * reserve_1`

```rust
// Add liquidity
pub fn deposit(to: Address, desired_a: i128, desired_b: i128) -> (i128, i128, i128)
// Remove liquidity
pub fn withdraw(to: Address, share_amount: i128) -> (i128, i128)
// Swap tokens
pub fn swap(to: Address, buy_a: bool, amount_in: i128) -> i128
// Get reserves
pub fn get_reserves() -> (i128, i128)
```

### Router
Finds optimal swap paths and handles multi-hop swaps.

```rust
// Swap with exact input
pub fn swap_exact_tokens_for_tokens(
    amount_in: i128,
    amount_out_min: i128,
    path: Vec<Address>,
    to: Address,
    deadline: u64
) -> i128
// Get amount out
pub fn get_amounts_out(amount_in: i128, path: Vec<Address>) -> Vec<i128>
```

## Fee Structure

- **Total Fee**: 0.30% per swap
- **LP Fee**: 0.25% → stays in pool (increases k)
- **Protocol Fee**: 0.05% → treasury

## Shared Code (MIGRATION NEEDED)

**Current State**: Uses local `contracts/shared/` with duplicate math.

**Target State**: Use `astro-core-shared` as single source of truth.

```toml
# Cargo.toml (after migration)
[dependencies]
astro-core-shared = { git = "https://github.com/nunalabs/astro-core", tag = "v1.2.0" }
```

## Integration with astro-launchpad

When a token graduates from bonding curve:
1. SAC-factory calls graduation
2. Liquidity transfers to AstroSwap
3. New pair created in factory
4. LP tokens burned in locker (irreversible)

## SDK Usage

```typescript
import { AstroSwap } from '@astroswap/sdk';

const sdk = new AstroSwap({
  network: 'testnet',
  rpcUrl: 'https://soroban-testnet.stellar.org',
});

// Get swap quote
const quote = await sdk.getAmountOut({
  tokenIn: 'CUSDC...',
  tokenOut: 'CXLM...',
  amountIn: '1000000000',
});

// Execute swap
const result = await sdk.swap({
  tokenIn: 'CUSDC...',
  tokenOut: 'CXLM...',
  amountIn: '1000000000',
  minAmountOut: quote.amountOut * 0.99n, // 1% slippage
  signer: wallet,
});
```

## Environment Variables

```bash
# Network
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Contract IDs (after deployment)
FACTORY_CONTRACT_ID=CXXX...
ROUTER_CONTRACT_ID=CXXX...
STAKING_CONTRACT_ID=CXXX...
```

## Testing

```bash
# All tests
make test

# With coverage
make coverage

# Contract size verification
make verify-size
```

## Security Considerations

1. **K invariant**: Must never decrease after swaps
2. **Slippage protection**: User-defined minimum output
3. **Deadline**: Transactions expire to prevent stale execution
4. **Overflow protection**: All math uses checked operations
5. **Reentrancy**: Soroban's design prevents reentrancy

## Deployment

See `DEPLOYMENT.md` for detailed deployment instructions.

```bash
# Quick deploy to testnet
make deploy-testnet
```

## Contributing

1. Use `make fmt` before commits
2. Run `make lint` for linting
3. All tests must pass: `make test`
4. Prefer using astro-core-shared for math operations
