# astro-swap - DEX AMM

> **Purpose**: Professional Uniswap V2-style DEX on Stellar/Soroban

## Context

**Stack**: Rust/Soroban contracts + Vite frontend + TypeScript SDK

**Contracts**:
- `pair/` - AMM pool (x * y = k)
- `router/` - Swap routing
- `factory/` - Pair creation

**Dependency**: Uses `astro-core-shared v1.5.0` for AMM math

## Key Invariant

```rust
// K must NEVER decrease after swaps
let k_before = reserve_0 * reserve_1;
let k_after = new_reserve_0 * new_reserve_1;
assert!(k_after >= k_before);
```

## Commands

```bash
make build          # All contracts
make test           # All tests
make bindings       # Generate TypeScript bindings
make deploy-testnet # Deploy to Stellar testnet

# Individual
make build-pair     # Pair contract only
make test-router    # Router tests only
```

## Fee Structure

- LP fee: 0.25% (stays in pool, increases k)
- Protocol fee: 0.05% (treasury)
- **Total**: 0.30% per swap

## Integration

Receives liquidity from astro-launchpad when tokens graduate ($69k cap).

## Critical Files

- `contracts/pair/src/lib.rs` - Core AMM logic
- `contracts/router/src/lib.rs` - Multi-hop routing
- `sdk/src/contracts/router.ts` - TypeScript SDK

---

**Lines**: ~60 | **Type**: DEX | **Protocol**: Uniswap V2-style
