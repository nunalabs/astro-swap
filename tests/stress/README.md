# AstroSwap Stress & Load Testing Suite

Comprehensive stress and load testing infrastructure for AstroSwap DEX contracts.

## Overview

This test suite validates the AstroSwap DEX under extreme conditions:
- **High-frequency swaps**: Concurrent swap operations across multiple pairs
- **Pool stress**: Rapid liquidity additions/removals
- **Router paths**: Multi-hop routing under load
- **Concurrent operations**: Mixed operation types with race condition testing

## Structure

```
tests/stress/
├── Cargo.toml              # Dependencies and binary configuration
├── README.md               # This file
├── src/
│   ├── lib.rs             # Public exports
│   ├── config.rs          # Test configuration
│   ├── scenarios/         # Test scenarios
│   │   ├── mod.rs
│   │   ├── swap_load.rs   # High-frequency swap testing
│   │   ├── pool_stress.rs # Pool operation stress testing
│   │   ├── router_paths.rs# Multi-hop routing stress
│   │   └── concurrent.rs  # Concurrent operation testing
│   ├── metrics/           # Metrics collection
│   │   ├── mod.rs
│   │   ├── collector.rs   # Real-time metrics collection
│   │   └── reporter.rs    # Results analysis and reporting
│   └── utils/             # Utilities
│       ├── mod.rs
│       ├── accounts.rs    # Test account generation
│       └── tokens.rs      # Token setup and management
├── scripts/
│   ├── run_load_test.sh   # Run load tests
│   ├── run_stress_test.sh # Run stress tests
│   └── analyze_results.py # Result analysis and visualization
└── results/               # Test results output
    └── .gitkeep
```

## Quick Start

### Run All Tests
```bash
cd tests/stress
./scripts/run_stress_test.sh
```

### Run Specific Scenario
```bash
# Swap load test
cargo run --bin stress-runner -- --scenario swap-load --duration 60 --tps 100

# Pool stress test
cargo run --bin stress-runner -- --scenario pool-stress --duration 120 --accounts 50

# Router paths test
cargo run --bin stress-runner -- --scenario router-paths --duration 90 --max-hops 4

# Concurrent operations
cargo run --bin stress-runner -- --scenario concurrent --duration 180 --workers 20
```

### Analyze Results
```bash
./scripts/analyze_results.py results/stress_test_20250925_143022.json
```

## Test Scenarios

### 1. Swap Load Test (`swap_load.rs`)
Tests high-frequency swap operations across multiple token pairs.

**Metrics:**
- Transactions per second (TPS)
- Average latency (p50, p95, p99)
- Success rate
- Slippage statistics

**Configuration:**
```bash
--scenario swap-load \
--duration 60 \
--tps 100 \
--pairs 5 \
--accounts 50
```

### 2. Pool Stress Test (`pool_stress.rs`)
Stress tests liquidity pool operations with rapid adds/removes.

**Metrics:**
- Add liquidity TPS
- Remove liquidity TPS
- Pool state consistency
- Fee accumulation accuracy

**Configuration:**
```bash
--scenario pool-stress \
--duration 120 \
--pools 10 \
--accounts 30 \
--min-liquidity 1000 \
--max-liquidity 1000000
```

### 3. Router Path Stress (`router_paths.rs`)
Tests multi-hop swap routing under load with complex paths.

**Metrics:**
- Path finding latency
- Multi-hop success rate
- Price impact per hop
- Total slippage

**Configuration:**
```bash
--scenario router-paths \
--duration 90 \
--max-hops 4 \
--paths-per-second 50 \
--pairs 10
```

### 4. Concurrent Operations (`concurrent.rs`)
Mixed operations testing for race conditions and conflicts.

**Metrics:**
- Operation mix ratio
- Conflict/retry rate
- Consistency checks
- Throughput per operation type

**Configuration:**
```bash
--scenario concurrent \
--duration 180 \
--workers 20 \
--swap-weight 50 \
--add-weight 25 \
--remove-weight 25
```

## Metrics Collected

### Performance Metrics
- **TPS**: Transactions per second
- **Latency**: p50, p95, p99 percentiles
- **Throughput**: Operations completed per second

### Success Metrics
- **Success Rate**: Percentage of successful operations
- **Error Rate**: Categorized error types
- **Retry Rate**: Operations requiring retries

### Resource Metrics
- **Gas Consumption**: Total and per-operation
- **Memory Usage**: Contract memory footprint
- **Storage Operations**: Read/write counts

### Financial Metrics
- **Slippage**: Actual vs expected output
- **Fee Collection**: Protocol and LP fees
- **Price Impact**: Per operation and cumulative

## Configuration

Configuration is defined in `src/config.rs`:

```rust
pub struct StressConfig {
    pub network: Network,          // Network to test on
    pub duration_seconds: u64,     // Test duration
    pub target_tps: u32,           // Target transactions/second
    pub num_accounts: u32,         // Number of test accounts
    pub num_pairs: u32,            // Number of trading pairs
    pub scenarios: Vec<Scenario>,  // Scenarios to run
    pub output_dir: String,        // Results output directory
}
```

## Output Format

Results are saved as JSON in `results/`:

```json
{
  "test_id": "stress_test_20250925_143022",
  "config": { ... },
  "start_time": "2025-09-25T14:30:22Z",
  "end_time": "2025-09-25T14:33:22Z",
  "duration_seconds": 180,
  "scenarios": [
    {
      "name": "swap_load",
      "metrics": {
        "total_operations": 10534,
        "successful": 10501,
        "failed": 33,
        "tps": 58.5,
        "latency_p50": 12,
        "latency_p95": 45,
        "latency_p99": 89,
        "errors": { ... }
      }
    }
  ]
}
```

## Scripts

### run_load_test.sh
Runs standard load tests with predefined configurations:
- Light load: 10 TPS, 30 seconds
- Medium load: 50 TPS, 60 seconds
- Heavy load: 100 TPS, 120 seconds

### run_stress_test.sh
Runs comprehensive stress tests:
- All scenarios sequentially
- Increasing load patterns
- Edge case testing

### analyze_results.py
Python analysis script with visualizations:
- Performance graphs
- Statistical summaries
- Comparison reports
- Bottleneck identification

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run Stress Tests
  run: |
    cd tests/stress
    ./scripts/run_stress_test.sh

- name: Analyze Results
  run: |
    python3 scripts/analyze_results.py results/latest.json
```

## Best Practices

1. **Baseline First**: Run tests on clean state to establish baseline
2. **Incremental Load**: Start with low TPS and increase gradually
3. **Monitor Resources**: Watch for memory leaks and resource exhaustion
4. **Statistical Significance**: Run multiple iterations for reliable metrics
5. **Isolate Scenarios**: Test scenarios individually before combined runs

## Troubleshooting

### Low TPS Achievement
- Check account generation parallelization
- Verify network isn't throttling
- Review operation complexity

### High Error Rate
- Check slippage tolerances
- Verify liquidity sufficiency
- Review concurrency settings

### Inconsistent Results
- Ensure clean state between runs
- Check for external interference
- Verify deterministic setup

## Contributing

When adding new scenarios:
1. Create new file in `src/scenarios/`
2. Implement `StressScenario` trait
3. Add to scenario registry in `mod.rs`
4. Document metrics and configuration
5. Update this README

## License

GPL-3.0 - See LICENSE file for details
