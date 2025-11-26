# AstroSwap

Professional Decentralized Exchange (DEX) built on Stellar Soroban.

## Overview

AstroSwap is a modular, scalable, and secure AMM (Automated Market Maker) DEX designed for the Stellar ecosystem. It features:

- **Constant Product AMM** (x*y=k formula)
- **Multi-hop Swaps** - Trade through multiple pools in a single transaction
- **LP Staking** - Earn rewards by staking liquidity provider tokens
- **Aggregator** - Find best prices across multiple DEX protocols
- **Astro-Shiba Integration** - Seamless graduation of tokens from launchpad

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ASTROSWAP ECOSYSTEM                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  │ FACTORY  │───▶│  PAIRS   │◀───│  ROUTER  │         │
│  │ Contract │    │ (Pools)  │    │ Contract │         │
│  └──────────┘    └──────────┘    └──────────┘         │
│                        │                               │
│                        ▼                               │
│                  ┌──────────┐                         │
│                  │ STAKING  │                         │
│                  │ Contract │                         │
│                  └──────────┘                         │
│                        │                               │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │              AGGREGATOR CONTRACT                 │  │
│  │    (Multi-protocol: AstroSwap, Soroswap, etc.)  │  │
│  └─────────────────────────────────────────────────┘  │
│                        │                               │
│                        ▼                               │
│  ┌─────────────────────────────────────────────────┐  │
│  │             ASTRO-SHIBA BRIDGE                   │  │
│  │       (Token graduation from launchpad)         │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Contracts

| Contract | Description |
|----------|-------------|
| `factory` | Creates and manages trading pairs |
| `pair` | Individual liquidity pool (AMM) |
| `router` | Facilitates swaps and liquidity management |
| `staking` | LP token staking for rewards |
| `aggregator` | Multi-DEX routing and price optimization |
| `bridge` | Integration with Astro-Shiba launchpad |

## Quick Start

### Prerequisites

- Rust 1.74+
- Stellar CLI
- Docker (optional, for local testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/astro-shiba/astroswap.git
cd astroswap

# Setup development environment
make setup

# Build all contracts
make build

# Run tests
make test
```

### Build

```bash
# Build all contracts
make build

# Build individual contract
make build-factory
make build-pair
make build-router
```

### Test

```bash
# Run all tests
make test

# Test individual contract
make test-factory
make test-pair
make test-shared
```

### Deploy

```bash
# Deploy to testnet
make deploy-testnet

# Deploy to mainnet
make deploy-mainnet
```

## Usage

### Swap Tokens

```typescript
import { AstroSwapRouter } from '@astroswap/sdk';

const router = new AstroSwapRouter(networkConfig);

// Swap exact tokens for tokens
const result = await router.swapExactTokensForTokens({
  user: userAddress,
  amountIn: 1000000n,
  amountOutMin: 950000n,
  path: [tokenA, tokenB],
  deadline: Math.floor(Date.now() / 1000) + 3600
});
```

### Add Liquidity

```typescript
const result = await router.addLiquidity({
  user: userAddress,
  tokenA: tokenAAddress,
  tokenB: tokenBAddress,
  amountADesired: 1000000n,
  amountBDesired: 1000000n,
  amountAMin: 950000n,
  amountBMin: 950000n,
  deadline: Math.floor(Date.now() / 1000) + 3600
});
```

### Stake LP Tokens

```typescript
import { AstroSwapStaking } from '@astroswap/sdk';

const staking = new AstroSwapStaking(networkConfig);

// Stake LP tokens
await staking.stake({
  user: userAddress,
  poolId: 1,
  amount: lpTokenAmount
});

// Claim rewards
const rewards = await staking.claimRewards({
  user: userAddress,
  poolId: 1
});
```

## Fee Structure

| Operation | Fee | Distribution |
|-----------|-----|--------------|
| Swap | 0.30% | 0.25% LPs + 0.05% Protocol |
| Add Liquidity | 0% | - |
| Remove Liquidity | 0% | - |
| Stake | 0% | - |
| Unstake | 0% | - |

## Security

- **No Reentrancy**: Soroban architecture prevents reentrancy attacks by design
- **Slippage Protection**: All swaps support minimum output amounts
- **Deadline**: Transactions revert if not executed by deadline
- **Authorization**: Granular `require_auth` on all user operations
- **Audited**: Professional security audits planned before mainnet

## Development

### Project Structure

```
astroswap/
├── contracts/
│   ├── factory/     # Pair factory
│   ├── pair/        # AMM liquidity pool
│   ├── router/      # Swap router
│   ├── staking/     # LP staking
│   ├── aggregator/  # DEX aggregator
│   ├── bridge/      # Launchpad bridge
│   └── shared/      # Shared types and utilities
├── packages/
│   ├── math/        # Math utilities
│   └── curve/       # Reward curves
├── sdk/             # TypeScript SDK
├── frontend/        # React frontend
├── scripts/         # Deployment scripts
└── tests/           # Integration tests
```

### Commands

```bash
make build       # Build all contracts
make test        # Run tests
make fmt         # Format code
make lint        # Run linter
make optimize    # Optimize WASM
make bindings    # Generate TypeScript bindings
make docs        # Generate documentation
make coverage    # Run code coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

GPL-3.0

## Links

- [Documentation](https://docs.astroswap.finance)
- [Discord](https://discord.gg/astroswap)
- [Twitter](https://twitter.com/astroswap)
- [Astro-Shiba Launchpad](https://astro-shiba.finance)

---

**AstroSwap** - The professional DEX for the Astro ecosystem on Stellar
