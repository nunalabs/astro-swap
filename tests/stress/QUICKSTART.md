# AstroSwap Stress Testing - Quick Start Guide

## Overview

This directory contains comprehensive stress and load testing infrastructure for the AstroSwap DEX.

## Current Status

The stress testing framework has been created with the following components:

### ✅ Completed
- Configuration system (`src/config.rs`)
- Metrics collection (`src/metrics/collector.rs`)
- Report generation (`src/metrics/reporter.rs`)
- Account management (`src/utils/accounts.rs`)
- Token management (`src/utils/tokens.rs`)
- Test scenarios (swap_load, pool_stress, router_paths, concurrent)
- Binary runner (`src/bin/stress_runner.rs`)
- Shell scripts for automation
- Python analysis script

### ⚠️ Known Issues

The current implementation has compilation errors related to Soroban SDK usage patterns:

1. **Contract Deployment**: The WASM deployment approach needs adjustment
2. **HashMap with Soroban Address**: Need to use different data structures
3. **TokenClient Import**: Should use `soroban_token_sdk` properly

### 🔧 Required Fixes

To make the stress tests fully functional, the following adjustments are needed:

#### 1. Update Token Management
Replace `TokenClient` usage to match the pattern in existing tests:

```rust
// Instead of:
use soroban_token_sdk::TokenClient;

// Use:
use soroban_token_sdk::testutils::MockTokenClient;
```

#### 2. Fix Contract Registration
Update pair creation to use proper contract registration:

```rust
// Current approach needs refinement
let pair_wasm_hash = env.deployer().upload_contract_wasm(AstroSwapPair);

// May need to use ContractClient pattern instead
```

#### 3. HashMap for LP Positions
Replace std HashMap with a more appropriate structure for Soroban Addresses:

```rust
// Instead of:
HashMap<(Address, Address), i128>

// Consider:
Vec<(String, i128)> // with address.to_string() as key
// Or use a simplified tracking mechanism
```

## Structure

```
tests/stress/
├── Cargo.toml              # Dependencies
├── README.md               # Main documentation
├── QUICKSTART.md           # This file
├── src/
│   ├── lib.rs             # Library root
│   ├── config.rs          # Configuration types
│   ├── scenarios/         # Test scenarios
│   │   ├── mod.rs
│   │   ├── swap_load.rs
│   │   ├── pool_stress.rs
│   │   ├── router_paths.rs
│   │   └── concurrent.rs
│   ├── metrics/           # Metrics & reporting
│   │   ├── mod.rs
│   │   ├── collector.rs
│   │   └── reporter.rs
│   ├── utils/             # Utilities
│   │   ├── mod.rs
│   │   ├── accounts.rs
│   │   └── tokens.rs
│   └── bin/
│       └── stress_runner.rs
├── scripts/
│   ├── run_load_test.sh
│   ├── run_stress_test.sh
│   └── analyze_results.py
└── results/               # Test output
```

## Next Steps

### For Development

1. **Fix Compilation Errors**
   ```bash
   cd tests/stress
   cargo check
   ```

2. **Reference Existing Tests**
   Look at `/Users/munay/dev/Astro/astroswap/contracts/tests/src/test_utils.rs` for proper patterns

3. **Simplify Initial Version**
   Start with a minimal working version of one scenario before expanding

### Recommended Approach

1. **Start with Integration Tests Pattern**
   - Copy the pattern from `contracts/tests/`
   - Use `TestContext` approach for setup
   - Avoid complex data structures initially

2. **Incremental Build**
   - Get `swap_load.rs` working first
   - Then add `pool_stress.rs`
   - Finally add complex scenarios

3. **Test Locally**
   ```bash
   cargo test --package astroswap-stress-tests
   ```

## Alternative: Simplified Version

If full implementation is complex, consider a simplified approach:

### Option A: Extend Existing Tests
Add stress test functions to `contracts/tests/` instead of a separate crate:

```rust
// In contracts/tests/src/stress_tests.rs
#[test]
fn stress_test_swaps() {
    let ctx = TestContext::new();
    // Run 1000 swaps
    for i in 0..1000 {
        // ... swap logic
    }
}
```

### Option B: Script-Based Approach
Use the SDK TypeScript bindings with a Node.js script:

```typescript
// stress-test.ts
import { SorobanClient } from '@stellar/stellar-sdk';

async function stressTestSwaps() {
    // Connect to network
    // Execute many swap transactions
    // Collect metrics
}
```

## Usage (Once Fixed)

### Run Specific Scenario
```bash
cargo run --bin stress-runner -- \
  --scenario swap-load \
  --duration 60 \
  --tps 100 \
  --accounts 50 \
  --pairs 10
```

### Run All Scenarios
```bash
./scripts/run_stress_test.sh
```

### Analyze Results
```bash
python3 scripts/analyze_results.py results/latest.json --compare --export-csv
```

## Configuration

Edit `src/config.rs` to adjust:
- Test duration
- Target TPS
- Number of accounts/pairs
- Scenario-specific parameters

## Metrics Collected

- Transactions per second (TPS)
- Latency percentiles (p50, p95, p99)
- Success/failure rates
- Error categorization
- Operation-specific breakdowns

## Contributing

When fixing the compilation issues:
1. Follow patterns from `contracts/tests/`
2. Use Soroban SDK test utilities properly
3. Keep data structures simple
4. Test incrementally
5. Document any SDK quirks discovered

## Resources

- [Soroban SDK Docs](https://docs.rs/soroban-sdk/)
- [Existing Integration Tests](/Users/munay/dev/Astro/astroswap/contracts/tests/)
- [Test Utils Reference](/Users/munay/dev/Astro/astroswap/contracts/tests/src/test_utils.rs)

## Support

For issues or questions:
1. Check existing integration tests for patterns
2. Review Soroban SDK testutils documentation
3. Consider simpler approaches if blocked
