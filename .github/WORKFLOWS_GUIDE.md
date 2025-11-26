# AstroSwap CI/CD Workflows Guide

Complete guide to GitHub Actions workflows for AstroSwap DEX on Stellar Soroban.

## 📋 Quick Reference

| Workflow | Trigger | Duration | Purpose |
|----------|---------|----------|---------|
| **Tests** | Push, PR | ~3-5 min | Run all contract tests + coverage |
| **Lint** | PR only | ~2-3 min | Format, clippy, security audit |
| **Build WASM** | Push, PR | ~5-7 min | Build & verify all contracts |
| **SDK** | Push, PR (sdk/) | ~2-3 min | TypeScript SDK checks |
| **Deploy Testnet** | Manual | ~8-10 min | Deploy to Stellar testnet |

## 🚀 Getting Started

### 1. Initial Setup

#### Add Required Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

```bash
# Required for deployment
DEPLOYER_SECRET_KEY=S... (your Stellar secret key)

# Optional for coverage reporting
CODECOV_TOKEN=... (get from codecov.io)
```

#### Fund Deployer Account

```bash
# Get deployer address from your secret key
stellar keys add deployer --secret-key "S..."
stellar keys address deployer
# Output: GXXX...

# Fund on testnet (visit Stellar Laboratory)
https://laboratory.stellar.org/#account-creator?network=test
```

### 2. Add Status Badges

Add to your `README.md`:

```markdown
## Status

![Tests](https://github.com/astroswap/astroswap/workflows/Tests/badge.svg)
![Lint](https://github.com/astroswap/astroswap/workflows/Lint/badge.svg)
![Build WASM](https://github.com/astroswap/astroswap/workflows/Build%20WASM/badge.svg)
![SDK](https://github.com/astroswap/astroswap/workflows/SDK/badge.svg)
[![codecov](https://codecov.io/gh/astroswap/astroswap/branch/main/graph/badge.svg)](https://codecov.io/gh/astroswap/astroswap)
```

## 📖 Workflow Details

### 1. test.yml - Automated Testing

**Triggers**:
- Push to `main` or `develop`
- Pull requests targeting `main` or `develop`

**Jobs**:

#### Job: `test`
Runs comprehensive test suite across all workspace members:

```yaml
- Checkout code
- Setup Rust (stable + wasm32 target)
- Cache cargo dependencies
- Run workspace tests (cargo test --workspace)
- Run individual contract tests (factory, pair, router, shared)
- Generate test summary
```

#### Job: `test-coverage`
Generates code coverage report:

```yaml
- Install cargo-tarpaulin
- Generate coverage (XML format)
- Upload to Codecov
```

**Output**:
- Test results summary in workflow logs
- Coverage report on Codecov (if configured)

**Local equivalent**:
```bash
# Run tests
cargo test --workspace --verbose

# Generate coverage
cargo install cargo-tarpaulin
cargo tarpaulin --workspace --timeout 300 --out Html
```

---

### 2. lint.yml - Code Quality

**Triggers**:
- Pull requests only (not on push to main)

**Jobs**:

#### Job: `format`
Validates code formatting:

```yaml
- cargo fmt --all -- --check
```

**Fails if**: Code is not formatted with `rustfmt`

#### Job: `clippy`
Runs Clippy linter with strict rules:

```yaml
- cargo clippy --workspace --all-targets -- -D warnings
```

**Fails if**: Any clippy warnings found

#### Job: `cargo-check`
Validates all code compiles:

```yaml
- cargo check --workspace --all-targets
```

#### Job: `audit`
Security vulnerability scan:

```yaml
- cargo audit --deny warnings
```

**Fails if**: Known vulnerabilities in dependencies

**Local equivalent**:
```bash
# Format check
cargo fmt --all -- --check

# Fix formatting
cargo fmt --all

# Clippy
cargo clippy --workspace --all-targets -- -D warnings

# Security audit
cargo install cargo-audit
cargo audit
```

---

### 3. build.yml - WASM Contract Builds

**Triggers**:
- Push to `main` or `develop`
- Pull requests

**Jobs**:

#### Job: `build` (Matrix Strategy)
Builds each contract in parallel:

```yaml
matrix:
  contract: [factory, pair, router, staking, aggregator, bridge]

Steps:
- Build for wasm32-unknown-unknown target
- Verify WASM file exists
- Check size < 256KB (Soroban limit)
- Upload artifact (30-day retention)
```

**Size Validation**:
- Maximum: 256KB (262,144 bytes)
- Warning: >90% (236KB)
- Failure: >100% (contract too large)

#### Job: `build-all`
Aggregates all builds:

```yaml
- Build entire workspace
- Download all artifacts
- Generate size report (markdown table)
- Upload size report (90-day retention)
```

**Output Example**:
```
| Contract   | Size (bytes) | Size (KB) | Status         |
|------------|--------------|-----------|----------------|
| factory    | 145,234      | 141       | ✅ 55% used    |
| pair       | 198,456      | 193       | ✅ 75% used    |
| router     | 234,567      | 229       | ⚠️ 89% used    |
```

**Local equivalent**:
```bash
# Build all contracts
make build

# Check sizes
make verify-size

# Output:
# factory: 145234 bytes
# pair: 198456 bytes
# router: 234567 bytes
```

---

### 4. sdk.yml - TypeScript SDK

**Triggers**:
- Push/PR affecting `sdk/` directory or workflow file

**Jobs**:

#### Job: `setup`
Initializes pnpm environment:

```yaml
- Setup Node.js 20
- Setup pnpm v8
- Cache pnpm store
- Install dependencies (frozen-lockfile)
```

#### Job: `typecheck`
Validates TypeScript types:

```yaml
- pnpm typecheck
```

#### Job: `lint`
ESLint checks:

```yaml
- pnpm lint
```

#### Job: `build`
Builds SDK bundles:

```yaml
- pnpm build (creates CJS, ESM, .d.ts)
- Verify artifacts exist
- Report bundle sizes
- Upload dist/ artifact
```

#### Job: `test`
Runs Vitest test suite:

```yaml
- pnpm test
```

#### Job: `publish-dry-run` (PR only)
Validates package before publish:

```yaml
- pnpm publish --dry-run --no-git-checks
- Display package.json info
```

**Local equivalent**:
```bash
cd sdk

# Install
pnpm install

# Type check
pnpm typecheck

# Lint
pnpm lint

# Build
pnpm build

# Test
pnpm test

# Dry run publish
pnpm publish --dry-run
```

---

### 5. deploy-testnet.yml - Deployment

**Triggers**:
- Manual only (`workflow_dispatch`)

**Inputs**:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `contracts` | string | "all" | Contracts to deploy (comma-separated or "all") |
| `network` | choice | "testnet" | Network: `testnet` or `futurenet` |

**Jobs**:

#### Job: `validate`
Pre-deployment checks:

```yaml
- Run all tests (cargo test --workspace)
- Run clippy lints
- Generate validation summary
```

**Fails if**: Tests or lints fail

#### Job: `build`
Build and optimize contracts:

```yaml
- Determine contracts to build
- Build each contract (--release)
- Install Stellar CLI
- Optimize with stellar contract optimize
- Verify sizes < 256KB
- Upload optimized artifacts
```

**Optimization Results**:
```
Original → Optimized (Reduction)
145,234 → 128,567 bytes (-11%)
```

#### Job: `deploy`
Deploy to Stellar network:

```yaml
- Download optimized contracts
- Install Stellar CLI
- Configure network (testnet/futurenet)
- Setup deployer identity (from secret)
- Check deployer balance
- Deploy each contract
- Generate deployment manifest
- Save contract IDs
```

**Deployment Manifest**:
```json
{
  "network": "testnet",
  "timestamp": "2025-11-25T18:30:00Z",
  "deployer": "GXXX...",
  "contracts": {
    "factory": "CXXX...",
    "pair": "CYYY...",
    "router": "CZZZ..."
  }
}
```

**Environment Variables Output**:
```bash
FACTORY_CONTRACT_ID=CXXX...
PAIR_CONTRACT_ID=CYYY...
ROUTER_CONTRACT_ID=CZZZ...
```

#### Job: `verify`
Verify deployment:

```yaml
- Download deployment artifacts
- Verify each contract with stellar contract inspect
- Generate verification summary
```

**Local equivalent**:
```bash
# Build and optimize
make build
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/astroswap_factory.wasm \
  --wasm-out astroswap_factory.optimized.wasm

# Deploy
stellar contract deploy \
  --wasm astroswap_factory.optimized.wasm \
  --source deployer \
  --network testnet

# Verify
stellar contract inspect \
  --id CXXX... \
  --network testnet
```

## 🎯 Usage Examples

### Example 1: Regular Development Flow

```bash
# 1. Create feature branch
git checkout -b feature/new-amm-algorithm

# 2. Make changes to contracts/pair/src/lib.rs
vim contracts/pair/src/lib.rs

# 3. Run local checks (same as CI)
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

# 4. Commit and push
git add .
git commit -m "feat(pair): implement constant product AMM"
git push origin feature/new-amm-algorithm

# 5. Create PR
# - lint.yml runs automatically (format, clippy, audit)
# - test.yml runs automatically (tests, coverage)
# - build.yml runs automatically (WASM builds, size checks)

# 6. Review checks
# All green? → Ready to merge
# Failed? → Fix issues and push again
```

### Example 2: SDK Changes

```bash
# 1. Make changes to SDK
cd sdk
vim src/router.ts

# 2. Run local checks
pnpm typecheck
pnpm lint
pnpm build
pnpm test

# 3. Commit and push
git add sdk/
git commit -m "feat(sdk): add multi-hop swap support"
git push

# 4. CI runs sdk.yml workflow
# - Typechecks TypeScript
# - Lints with ESLint
# - Builds CJS + ESM bundles
# - Runs Vitest tests
# - Dry-run publish (on PR)
```

### Example 3: Deploy to Testnet

#### Option A: Deploy All Contracts

1. Go to **Actions** tab
2. Select **Deploy to Testnet**
3. Click **Run workflow**
4. Configure:
   - Contracts: `all`
   - Network: `testnet`
5. Click **Run workflow**

#### Option B: Deploy Specific Contracts

1. Run workflow with:
   - Contracts: `factory,router`
   - Network: `testnet`

#### Option C: Deploy to Futurenet

1. Run workflow with:
   - Contracts: `all`
   - Network: `futurenet`

**Retrieve Contract IDs**:

1. Wait for deployment to complete
2. Check workflow summary (contract IDs in table)
3. Download artifact: `deployment-manifest-testnet-{run-number}`
4. Extract contract IDs from `deployment.json`

### Example 4: Handling Failed Builds

**Scenario**: Contract size exceeds 256KB

```bash
# CI Output:
❌ Contract pair exceeds 256KB limit!
Size: 278,456 bytes (272 KB)

# Solution:
# 1. Analyze contract size
cd contracts/pair
cargo bloat --release --target wasm32-unknown-unknown

# 2. Optimize code
# - Remove unused dependencies
# - Inline small functions
# - Use &str instead of String where possible

# 3. Check profile settings in Cargo.toml
[profile.release]
opt-level = "z"        # Optimize for size
lto = true             # Link-time optimization
codegen-units = 1      # Single codegen unit
strip = "symbols"      # Strip debug symbols

# 4. Rebuild and verify
cargo build --target wasm32-unknown-unknown --release
wasm-opt -Oz input.wasm -o output.wasm  # Further optimization

# 5. Verify size
ls -lh target/wasm32-unknown-unknown/release/*.wasm
```

### Example 5: Security Audit Failure

**Scenario**: Vulnerable dependency detected

```bash
# CI Output:
❌ Security Audit Results
Crate:     time
Version:   0.1.45
Warning:   RUSTSEC-2020-0159
Title:     Potential segfault in time

# Solution:
# 1. Update dependencies
cargo update

# 2. If issue persists, check dependency tree
cargo tree -p time

# 3. Update specific dependency
cargo update -p time

# 4. If no update available, consider alternatives
# or add to audit exceptions (NOT recommended for production)
```

## 📊 Monitoring & Observability

### Workflow Status Indicators

**In GitHub UI**:
- ✅ Green check: All jobs passed
- ❌ Red X: One or more jobs failed
- 🟡 Yellow dot: Workflow running
- ⚪ Gray circle: Workflow queued

### Job Summaries

Each workflow generates markdown summaries visible in the workflow run:

**Tests**:
```markdown
### Test Results 🧪
- ✅ All workspace tests passed
- 📦 Tested packages: factory, pair, router, staking, aggregator, bridge, shared
```

**Build**:
```markdown
### 📦 Contract Size: factory
- Size: 145,234 bytes (141 KB)
- Limit: 262,144 bytes (256 KB)
- Status: ✅ Within limit (55% used)
```

**Deployment**:
```markdown
### 🚀 Deployment Results
| Contract | Contract ID | Status |
|----------|-------------|--------|
| factory  | CXXX...     | ✅ Deployed |
| pair     | CYYY...     | ✅ Deployed |
```

### Artifacts

Download build artifacts from workflow runs:

| Artifact | Retention | Contents |
|----------|-----------|----------|
| `astroswap_{contract}-wasm` | 30 days | Compiled WASM binary |
| `size-report` | 90 days | Contract size analysis |
| `sdk-dist` | 30 days | Built SDK bundles |
| `deployment-manifest-{network}-{run}` | 90 days | Deployment config + contract IDs |

## 🔧 Advanced Configuration

### Matrix Builds

Build contracts in parallel using matrix strategy:

```yaml
strategy:
  fail-fast: false  # Continue if one fails
  matrix:
    contract: [factory, pair, router, staking, aggregator, bridge]
```

**Benefits**:
- Faster builds (6x parallelization)
- Isolated failures (one contract failing doesn't block others)
- Clearer logs (separate job per contract)

### Caching Strategy

Aggressive caching for faster builds:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      ~/.cargo/bin/
      ~/.cargo/registry/index/
      ~/.cargo/registry/cache/
      ~/.cargo/git/db/
      target/
    key: ${{ runner.os }}-cargo-${{ hashFiles('**/Cargo.lock') }}
```

**Cache Invalidation**:
- Key changes when `Cargo.lock` changes
- Automatic cleanup after 7 days of inactivity
- Manual cache clearing: Settings → Actions → Caches

### Conditional Jobs

SDK workflow only runs when SDK files change:

```yaml
on:
  push:
    paths:
      - 'sdk/**'
      - '.github/workflows/sdk.yml'
```

**Benefits**:
- Saves CI minutes
- Faster feedback
- Reduced notification noise

## 🛡️ Security Best Practices

### Secret Management

**DO**:
- ✅ Store secrets in GitHub Secrets
- ✅ Use environment protection rules
- ✅ Rotate secrets regularly
- ✅ Use least-privilege principle

**DON'T**:
- ❌ Hardcode secrets in workflows
- ❌ Log secrets in workflow output
- ❌ Share secrets across repositories
- ❌ Use personal keys for production

### Deployment Protection

Add environment protection rules:

1. Go to **Settings → Environments**
2. Create environment: `testnet`
3. Add protection rules:
   - ✅ Required reviewers (for mainnet)
   - ✅ Wait timer (5 minutes)
   - ✅ Environment secrets (DEPLOYER_SECRET_KEY)

### Audit Logging

All deployments are logged with:
- Deployer address
- Timestamp (UTC)
- Contract IDs
- Network
- Git commit SHA

Retrieve from workflow artifacts: `deployment-manifest-*.json`

## 🐛 Troubleshooting

### Issue: Workflow not triggering

**Symptoms**: Push to branch doesn't trigger workflow

**Solutions**:
1. Check branch name matches trigger (e.g., `main` vs `master`)
2. Verify workflow file is in `.github/workflows/`
3. Check YAML syntax (use [YAML Lint](http://www.yamllint.com/))
4. Ensure workflows are enabled: Settings → Actions → General

### Issue: Cargo cache miss

**Symptoms**: Every run downloads dependencies

**Solutions**:
1. Verify `Cargo.lock` is committed
2. Check cache key includes `Cargo.lock` hash
3. Ensure cache path is correct
4. Wait for cache to populate (first run always misses)

### Issue: Deployment fails with "insufficient balance"

**Symptoms**: Deploy job fails during contract deployment

**Solutions**:
1. Check deployer balance:
   ```bash
   stellar account balance deployer --network testnet
   ```
2. Fund account on Stellar Laboratory
3. Verify network configuration (testnet vs mainnet)

### Issue: Contract size exceeds limit

**Symptoms**: Build job fails with "Contract exceeds 256KB!"

**Solutions**:
1. Run `cargo bloat` to identify large dependencies
2. Enable LTO in `Cargo.toml`
3. Use `opt-level = "z"` instead of `"s"`
4. Remove unused features from dependencies
5. Split large contracts into smaller modules

### Issue: SDK tests fail on CI but pass locally

**Symptoms**: Tests pass on local machine, fail in GitHub Actions

**Solutions**:
1. Check Node.js version matches (20.x)
2. Verify pnpm version (8.x)
3. Clear pnpm cache:
   ```bash
   pnpm store prune
   rm -rf node_modules
   pnpm install
   ```
4. Check for hardcoded paths (use relative paths)

## 📚 Resources

### GitHub Actions
- [Workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Caching dependencies](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Matrix builds](https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs)

### Stellar/Soroban
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools#stellar-cli)
- [Contract deployment](https://developers.stellar.org/docs/smart-contracts/getting-started/deploy-to-testnet)
- [Soroban contracts](https://soroban.stellar.org/docs)

### Rust
- [Cargo Book](https://doc.rust-lang.org/cargo/)
- [rustfmt](https://github.com/rust-lang/rustfmt)
- [Clippy lints](https://rust-lang.github.io/rust-clippy/master/)

### Tools
- [cargo-tarpaulin](https://github.com/xd009642/tarpaulin) - Code coverage
- [cargo-audit](https://github.com/RustSec/rustsec/tree/main/cargo-audit) - Security audit
- [cargo-bloat](https://github.com/RazrFalcon/cargo-bloat) - Binary size profiler

---

**Questions or issues?** Open an issue or contact the AstroSwap team.

**Last Updated**: 2025-11-25
