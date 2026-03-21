# Testing Roadmap 2026 - astro-swap DEX

> **Objetivo**: Alcanzar 95%+ de cobertura con tests comprehensivos de seguridad, performance, y funcionalidad antes del mainnet launch.

**Estado Actual**: 120 unit tests ✓ | **Meta**: 200+ tests con fuzzing, property-based, e integración

---

## 📊 Análisis de Gaps - Security Audit

### Resumen Ejecutivo

El security audit identificó **27 tests de seguridad críticos faltantes** en 4 categorías:

| Categoría | Tests Críticos | Tests High | Tests Medium | Total |
|-----------|----------------|------------|--------------|-------|
| **Reentrancy** | 3 | 1 | 2 | 6 |
| **Flash Loans** | 2 | 1 | 0 | 3 |
| **K Invariant** | 1 | 2 | 1 | 4 |
| **Integer Overflow** | 0 | 2 | 0 | 2 |
| **Access Control** | 1 | 2 | 3 | 6 |
| **Price Manipulation** | 0 | 1 | 1 | 2 |
| **Otros** | 0 | 2 | 2 | 4 |
| **TOTAL** | **7** | **11** | **9** | **27** |

---

## 🔴 CRÍTICO - Tests que DEBEN implementarse antes de mainnet

### 1. Reentrancy Attack Tests

**Prioridad**: MÁXIMA
**Archivos**: `pair/src/security_tests.rs`, `router/src/security_tests.rs`

```rust
// contracts/pair/src/security_tests.rs

#[test]
fn test_reentrancy_attack_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy malicious token that attempts reentrancy on transfer callback
    let malicious_token = deploy_malicious_token(&env);

    // Attempt deposit with reentrancy
    let result = pair.try_deposit(
        &user,
        &malicious_token,
        &token_b,
        &1000_0000000,
        &1000_0000000,
        &0,
        &0,
    );

    // Should fail with ReentrancyLock error
    assert!(matches!(
        result.unwrap_err(),
        AstroSwapError::ReentrancyLock
    ));
}

#[test]
fn test_reentrancy_attack_swap() {
    // Similar pattern for swap operations
    // Verify RAII guard blocks reentrant calls
}

#[test]
fn test_malicious_pair_callback() {
    // Router contract calling malicious pair
    // Verify ReentrancyGuard protection
}
```

**Implementación**: El código ya tiene `ReentrancyGuard` (RAII pattern), solo falta verificar que funciona bajo ataque real.

---

### 2. Flash Loan Attack Tests

**Prioridad**: MÁXIMA
**Archivos**: `pair/src/security_tests.rs`

```rust
#[test]
fn test_flash_loan_k_manipulation() {
    let env = Env::default();
    env.mock_all_auths();

    let (pair, token_a, token_b) = setup_pair(&env);

    // Add initial liquidity
    pair.deposit(&user, &token_a, &token_b, &1000_0000000, &1000_0000000, &0, &0);

    let k_before = get_k(&pair);

    // Simulate flash loan attack:
    // 1. Deposit large amounts
    // 2. Swap to manipulate price
    // 3. Withdraw immediately
    // All in same transaction/block

    pair.deposit(&attacker, &token_a, &token_b, &10000_0000000, &10000_0000000, &0, &0);
    pair.swap(&attacker, &5000_0000000, &0, &attacker);
    pair.withdraw(&attacker, &lp_tokens, &0, &0);

    let k_after = get_k(&pair);

    // K should NEVER decrease
    assert!(k_after >= k_before, "K invariant violated!");
}

#[test]
fn test_swap_from_balance_exploitation() {
    // swap_from_balance() doesn't require auth
    // Verify accidentally-sent tokens cannot be stolen

    // Send tokens directly to pair
    token_a_client.transfer(&whale, &pair_address, &1000_0000000);

    // Attacker tries to exploit with swap_from_balance
    let result = pair.try_swap_from_balance(&attacker, &0, &999_0000000);

    // Should fail or only allow factory/authorized calls
    assert!(result.is_err());
}
```

---

### 3. K Invariant Property Testing

**Prioridad**: MÁXIMA
**Archivos**: `pair/src/property_tests.rs`

Basado en [Soroban Fuzzing Best Practices](https://soroban.stellar.org/docs/tutorials/fuzzing):

```rust
// contracts/pair/src/property_tests.rs

use proptest::prelude::*;
use soroban_sdk::arbitrary::Arbitrary;

// Property: K should NEVER decrease after any sequence of operations
proptest! {
    #[test]
    fn test_k_never_decreases_property(
        operations in prop::collection::vec(
            operation_strategy(),
            1..50 // Test 1-50 random operations
        )
    ) {
        let env = Env::default();
        let (pair, token_a, token_b) = setup_pair(&env);

        // Add initial liquidity
        pair.deposit(&user1, &token_a, &token_b, &1000_0000000, &1000_0000000, &0, &0);

        let mut k_history = vec![get_k(&pair)];

        for op in operations {
            match op {
                Op::Deposit(amount_a, amount_b) => {
                    let _ = pair.try_deposit(&user1, &token_a, &token_b, &amount_a, &amount_b, &0, &0);
                }
                Op::Swap(amount_in) => {
                    let _ = pair.try_swap(&user1, &amount_in, &0, &user1);
                }
                Op::Withdraw(lp_amount) => {
                    let _ = pair.try_withdraw(&user1, &lp_amount, &0, &0);
                }
            }

            k_history.push(get_k(&pair));
        }

        // Verify K never decreased
        for window in k_history.windows(2) {
            assert!(
                window[1] >= window[0],
                "K decreased from {} to {}",
                window[0],
                window[1]
            );
        }
    }
}

fn operation_strategy() -> impl Strategy<Value = Operation> {
    prop_oneof![
        (1_000_000i128..1_000_000_000_000i128, 1_000_000i128..1_000_000_000_000i128)
            .prop_map(|(a, b)| Operation::Deposit(a, b)),
        (1_000_000i128..100_000_000_000i128)
            .prop_map(Operation::Swap),
        (1_000i128..100_000_000i128)
            .prop_map(Operation::Withdraw),
    ]
}
```

**Referencias**:
- [Soroban Fuzzing Tutorial](https://soroban.stellar.org/docs/tutorials/fuzzing)
- [Smart Contract Fuzzing Guide 2026](https://www.quillaudits.com/blog/smart-contract/smart-contract-fuzzing)

---

### 4. Rapid Stake/Unstake Drain Test

**Prioridad**: MÁXIMA
**Archivos**: `staking/src/security_tests.rs`

```rust
#[test]
fn test_rapid_stake_unstake_drain() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, lp_token, reward_token, admin, attacker) = setup_staking(&env);

    // Fund rewards
    client.fund_rewards(&admin, &10_000_0000000);

    let pool_id = client.create_pool(&admin, &lp_token, &1000, &0, &FAR_FUTURE);

    // Mint LP tokens to attacker
    mint_token(&env, &lp_token, &admin, &attacker, &1_000_0000000);

    let initial_rewards = reward_token.balance(&client.address());

    // Rapidly stake/unstake/claim to drain rewards
    for _ in 0..100 {
        client.stake(&attacker, &pool_id, &100_0000000);
        env.ledger().set_timestamp(env.ledger().timestamp() + 1); // Advance 1 second
        client.claim_rewards(&attacker, &pool_id);
        client.unstake(&attacker, &pool_id, &100_0000000);
    }

    let final_rewards = reward_token.balance(&client.address());
    let drained = initial_rewards - final_rewards;

    // Verify attacker can't drain more than mathematically possible
    let expected_max = 1000 * 100; // reward_per_second * seconds
    assert!(
        drained <= expected_max * 2, // 2x buffer for rounding
        "Reward drain exploit detected!"
    );
}
```

---

## 🟡 HIGH PRIORITY - Tests importantes para robustez

### 5. Integer Overflow/Underflow Tests

**Archivos**: `pair/src/security_tests.rs`

```rust
#[test]
fn test_overflow_max_reserves() {
    let env = Env::default();

    // Test near i128::MAX
    let max_safe = i128::MAX / 2;

    let result = pair.try_deposit(
        &user,
        &token_a,
        &token_b,
        &max_safe,
        &max_safe,
        &0,
        &0,
    );

    // Should handle gracefully (reject or succeed safely)
    if result.is_err() {
        assert!(matches!(
            result.unwrap_err(),
            AstroSwapError::Overflow
        ));
    }
}

#[test]
fn test_overflow_lp_token_mint() {
    // First deposit with amounts that could overflow sqrt()
    // Verify MINIMUM_LIQUIDITY prevents manipulation
}
```

### 6. Path Validation Tests

**Archivos**: `router/src/security_tests.rs`

```rust
#[test]
fn test_path_with_duplicate_tokens() {
    let env = Env::default();

    let token_a = Address::generate(&env);
    let token_b = Address::generate(&env);

    // Path: A → B → A (circular)
    let mut path = Vec::new(&env);
    path.push_back(token_a.clone());
    path.push_back(token_b);
    path.push_back(token_a); // Duplicate!

    let result = router.try_swap_exact_tokens_for_tokens(
        &user,
        &100_0000000,
        &0,
        &path,
        &deadline,
    );

    // Should fail - duplicate tokens not allowed
    assert!(result.is_err());
}
```

---

## 🟢 PERFORMANCE & OPTIMIZATION

### 7. Gas Benchmarking Tests

**Prioridad**: MEDIUM
**Archivos**: `pair/src/bench_tests.rs`

Basado en [Soroban Performance Notes](https://github.com/stellar/stellar-protocol/discussions/1460):

```rust
// contracts/pair/src/bench_tests.rs

#[test]
fn bench_swap_gas_usage() {
    let env = Env::default();
    let (pair, token_a, token_b) = setup_pair(&env);

    // Add liquidity
    pair.deposit(&user, &token_a, &token_b, &1000_0000000, &1000_0000000, &0, &0);

    // Measure CPU instructions for swap
    let cpu_before = env.budget().cpu_instruction_cost();

    pair.swap(&user, &100_0000000, &0, &user);

    let cpu_after = env.budget().cpu_instruction_cost();
    let cpu_used = cpu_after - cpu_before;

    // Log for regression testing
    println!("Swap CPU instructions: {}", cpu_used);

    // Set baseline threshold (adjust based on optimization)
    assert!(cpu_used < 1_000_000, "Swap too expensive!");
}

#[test]
fn bench_deposit_vs_withdraw() {
    // Compare gas costs
    // Deposit should be similar to withdraw
}
```

**Referencias**:
- [Soroban Performance Discussion](https://github.com/stellar/stellar-protocol/discussions/1460)
- [CAP-0054: VM Instantiation Cost Model](https://github.com/stellar/stellar-protocol/discussions/1460)

---

### 8. Storage TTL Tests

**Prioridad**: MEDIUM
**Archivos**: `*/src/storage_tests.rs`

Basado en [TTL Testing Guide](https://developers.stellar.org/docs/build/guides/archival/test-ttl-extension):

```rust
// contracts/pair/src/storage_tests.rs

#[test]
fn test_ttl_extension_on_swap() {
    let env = Env::default();
    let (pair, token_a, token_b) = setup_pair(&env);

    pair.deposit(&user, &token_a, &token_b, &1000_0000000, &1000_0000000, &0, &0);

    // Get initial TTL (SDK 21+)
    let ttl_before = env.storage().instance().get_ttl();

    // Perform swap
    pair.swap(&user, &100_0000000, &0, &user);

    // TTL should be extended
    let ttl_after = env.storage().instance().get_ttl();

    assert!(
        ttl_after > ttl_before,
        "Instance storage TTL not extended"
    );
}

#[test]
fn test_persistent_vs_temporary_storage() {
    // Verify critical data uses Persistent storage
    // Verify cache/temporary data uses Temporary storage
}
```

**Referencias**:
- [Test TTL Extension Logic](https://developers.stellar.org/docs/build/guides/archival/test-ttl-extension)
- [Choosing Right Storage Type](https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage)

---

## 🔵 INTEGRATION & E2E TESTS

### 9. Cross-Contract Integration Tests

**Prioridad**: HIGH
**Archivos**: `tests/integration_tests.rs`

Basado en [Cross-Contract Call Examples](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/cross-contract-call) y [57Blocks Best Practices](https://57blocks.com/blog/soroban-integration-testing-best-practices):

```rust
// tests/integration_tests.rs

#[test]
fn test_complete_swap_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy all contracts
    let factory = deploy_factory(&env);
    let router = deploy_router(&env, &factory);
    let token_a = deploy_token(&env, "Token A", "TKA");
    let token_b = deploy_token(&env, "Token B", "TKB");

    // Create pair through factory
    let pair_addr = factory.create_pair(&admin, &token_a, &token_b);

    // Add liquidity through router
    router.add_liquidity(
        &user1,
        &token_a,
        &token_b,
        &1000_0000000,
        &1000_0000000,
        &0,
        &0,
        &deadline,
    );

    // Swap through router
    let mut path = Vec::new(&env);
    path.push_back(token_a.clone());
    path.push_back(token_b.clone());

    let amounts = router.swap_exact_tokens_for_tokens(
        &user2,
        &100_0000000,
        &0,
        &path,
        &deadline,
    );

    // Verify results
    assert!(amounts.len() == 2);
    assert!(amounts.get(0).unwrap() == 100_0000000);
    assert!(amounts.get(1).unwrap() > 0);
}

#[test]
fn test_token_graduation_to_dex() {
    // Integration with astro-launchpad
    // 1. Token graduates from launchpad
    // 2. Factory registers graduated token
    // 3. Liquidity automatically added to DEX
    // 4. LP tokens burned (irreversible)
}

#[test]
fn test_multi_hop_swap_a_to_c() {
    // Path: A → B → C
    // Verify router correctly executes both swaps
    // Verify final output matches expected slippage
}
```

**Referencias**:
- [Cross Contract Calls](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/cross-contract-call)
- [Integration Testing Best Practices](https://57blocks.com/blog/soroban-integration-testing-best-practices)

---

### 10. Localnet E2E Tests

**Prioridad**: MEDIUM
**Setup**: Docker Quickstart

```bash
# Start local Soroban network
docker run --rm -it \
  -p 8000:8000 \
  --name stellar \
  stellar/quickstart:soroban-dev@sha256:... \
  --local \
  --enable-soroban-rpc

# Run E2E tests against localhost:8000
cargo test --test e2e_tests -- --test-threads=1
```

```rust
// tests/e2e_tests.rs

#[test]
#[ignore] // Only run with `cargo test -- --ignored`
fn test_e2e_deploy_and_swap() {
    // Connect to local network
    let rpc_url = "http://localhost:8000/soroban/rpc";

    // Deploy contracts
    // Execute real transactions
    // Verify on-chain state
}
```

---

## 📋 Implementation Roadmap

### Phase 1: Critical Security (Week 1-2)
- [ ] P-1: Reentrancy attack tests (pair deposit)
- [ ] P-2: Reentrancy attack tests (pair swap)
- [ ] R-3: Malicious pair callback (router)
- [ ] P-4: Flash loan K manipulation
- [ ] P-5: swap_from_balance exploitation
- [ ] S-2: Rapid stake/unstake drain
- [ ] P-8: K invariant property testing

**Deliverable**: 7 critical security tests passing

### Phase 2: High Priority Robustness (Week 3)
- [ ] Integer overflow tests (P-10, P-11)
- [ ] Path validation tests (R-1, R-4)
- [ ] Access control tests (F-1, F-3)
- [ ] Price manipulation tests (P-6, P-9)
- [ ] Reward calculation tests (S-1, S-3, S-4)

**Deliverable**: 11 high priority tests passing

### Phase 3: Performance & Optimization (Week 4)
- [ ] Gas benchmarking suite
- [ ] Storage TTL tests
- [ ] Memory usage profiling
- [ ] VM module caching verification

**Deliverable**: Performance baseline established

### Phase 4: Integration & E2E (Week 5)
- [ ] Cross-contract integration tests
- [ ] Token graduation flow
- [ ] Multi-hop swap scenarios
- [ ] Localnet E2E tests

**Deliverable**: Full integration test suite

### Phase 5: Property-Based & Fuzzing (Week 6)
- [ ] Setup cargo-fuzz
- [ ] Implement property tests for all invariants
- [ ] Run 1M+ fuzzing iterations
- [ ] Fix any discovered edge cases

**Deliverable**: 95%+ code coverage with fuzzing

---

## 🛠️ Tools & Setup

### Required Dependencies

```toml
# Cargo.toml

[dev-dependencies]
soroban-sdk = { version = "25.2.0", features = ["testutils"] }
proptest = "1.4"
proptest-arbitrary-interop = "0.1"
arbitrary = "1.3"

[profile.fuzzing]
inherits = "release"
debug = true
```

### Fuzzing Setup

```bash
# Install cargo-fuzz
cargo install cargo-fuzz

# Initialize fuzzing for pair contract
cd contracts/pair
cargo fuzz init

# Run fuzzer
cargo fuzz run fuzz_pair_operations -- -max_total_time=3600
```

### CI/CD Integration

```yaml
# .github/workflows/tests.yml

name: Comprehensive Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: cargo test --all

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security tests
        run: cargo test --test security_tests

  property-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run property tests
        run: cargo test --test property_tests

  fuzzing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install cargo-fuzz
        run: cargo install cargo-fuzz
      - name: Run fuzzing (10 min)
        run: cargo fuzz run fuzz_target --fuzz-dir=. -- -max_total_time=600
```

---

## 📊 Success Metrics

| Métrica | Actual | Meta | Status |
|---------|--------|------|--------|
| **Unit Tests** | 120 | 150+ | 🟡 80% |
| **Security Tests** | 0 | 27 | 🔴 0% |
| **Property Tests** | 0 | 10+ | 🔴 0% |
| **Integration Tests** | 0 | 15+ | 🔴 0% |
| **Code Coverage** | ~70% | 95%+ | 🟡 73% |
| **Fuzzing Iterations** | 0 | 1M+ | 🔴 0% |
| **Performance Benchmarks** | 0 | 20+ | 🔴 0% |

**Meta Final**: 200+ tests totales con 95%+ cobertura antes de mainnet

---

## 🔗 Referencias

### Documentación Oficial
- [Soroban Fuzzing Tutorial](https://soroban.stellar.org/docs/tutorials/fuzzing)
- [Test TTL Extension Logic](https://developers.stellar.org/docs/build/guides/archival/test-ttl-extension)
- [Cross Contract Calls](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/cross-contract-call)
- [Choosing Right Storage Type](https://developers.stellar.org/docs/build/guides/storage/choosing-the-right-storage)

### Best Practices Guides
- [Definitive Guide to Testing Smart Contracts on Stellar](https://stellar.org/blog/developers/the-definitive-guide-to-testing-smart-contracts-on-stellar)
- [Soroban Integration Testing Best Practices](https://57blocks.com/blog/soroban-integration-testing-best-practices)
- [Smart Contract Fuzzing Guide 2026](https://www.quillaudits.com/blog/smart-contract/smart-contract-fuzzing)
- [Veridise Soroban Security Checklist](https://veridise.com/blog/audit-insights/building-on-stellar-soroban-grab-this-security-checklist-to-avoid-vulnerabilities/)

### Advanced Topics
- [Soroban Performance Notes](https://github.com/stellar/stellar-protocol/discussions/1460)
- [CAP-81: Efficient Eviction Scan](https://github.com/stellar/stellar-protocol)
- [CAP-82: Checked 256-bit Arithmetic](https://github.com/stellar/stellar-protocol)

---

**Última actualización**: 2026-03-16
**Versión**: 1.0
**Autor**: Security Audit + Soroban Research
