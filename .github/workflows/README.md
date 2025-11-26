# GitHub Actions Workflows

This directory contains CI/CD workflows for AstroSwap DEX.

## Workflows

### 🧪 [test.yml](./test.yml)
**Trigger**: Push to `main`/`develop`, Pull Requests

Runs comprehensive test suite:
- Workspace-wide tests with `cargo test`
- Individual contract tests (factory, pair, router, shared)
- Code coverage with `cargo-tarpaulin`
- Uploads coverage to Codecov

**Status**: ![Tests](https://github.com/astroswap/astroswap/workflows/Tests/badge.svg)

---

### 🔍 [lint.yml](./lint.yml)
**Trigger**: Pull Requests only

Code quality checks:
- **Format**: `cargo fmt --check` - Ensures consistent code formatting
- **Clippy**: `cargo clippy -- -D warnings` - Catches common mistakes
- **Cargo Check**: Validates all workspace members compile
- **Security Audit**: `cargo audit` - Checks for vulnerable dependencies

**Status**: ![Lint](https://github.com/astroswap/astroswap/workflows/Lint/badge.svg)

---

### 📦 [build.yml](./build.yml)
**Trigger**: Push to `main`/`develop`, Pull Requests

Builds and validates WASM contracts:
- Compiles all contracts for `wasm32-unknown-unknown` target
- Verifies contract sizes < 256KB (Soroban limit)
- Matrix strategy builds each contract in parallel
- Uploads WASM artifacts for 30 days
- Generates comprehensive size report

**Contract Size Limits**:
- Maximum: 256KB (262,144 bytes)
- Warning threshold: 90% (236KB)

**Status**: ![Build WASM](https://github.com/astroswap/astroswap/workflows/Build%20WASM/badge.svg)

---

### 🛠️ [sdk.yml](./sdk.yml)
**Trigger**: Push/PR affecting `sdk/` directory

TypeScript SDK checks:
- **TypeCheck**: `pnpm typecheck` - Validates TypeScript types
- **Lint**: `pnpm lint` - ESLint checks
- **Build**: `pnpm build` - Builds CJS, ESM, and type definitions
- **Test**: `pnpm test` - Runs Vitest test suite
- **Publish Dry Run**: Validates package before publish (PR only)

**Outputs**: CommonJS, ESM modules, and TypeScript definitions

**Status**: ![SDK](https://github.com/astroswap/astroswap/workflows/SDK/badge.svg)

---

### 🚀 [deploy-testnet.yml](./deploy-testnet.yml)
**Trigger**: Manual (`workflow_dispatch`)

Deploys contracts to Stellar Testnet/Futurenet:

**Inputs**:
- `contracts`: Which contracts to deploy (comma-separated or "all")
- `network`: Target network (testnet/futurenet)

**Stages**:
1. **Validate**: Run tests and lints before deployment
2. **Build**: Compile and optimize contracts with `stellar contract optimize`
3. **Deploy**: Deploy to Stellar network using `stellar-cli`
4. **Verify**: Validate deployment with `stellar contract inspect`

**Outputs**:
- Contract IDs for each deployed contract
- Deployment manifest (JSON)
- Environment variables file

**Requirements**:
- `DEPLOYER_SECRET_KEY` secret must be configured
- Deployer account must have sufficient XLM balance

**Status**: ![Deploy to Testnet](https://github.com/astroswap/astroswap/workflows/Deploy%20to%20Testnet/badge.svg)

---

## Setup

### Required Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret | Description | Used By |
|--------|-------------|---------|
| `DEPLOYER_SECRET_KEY` | Stellar account secret key for deploying contracts | `deploy-testnet.yml` |
| `CODECOV_TOKEN` | Codecov upload token (optional) | `test.yml` |

### Badge URLs

Add these to your README.md:

```markdown
![Tests](https://github.com/astroswap/astroswap/workflows/Tests/badge.svg)
![Lint](https://github.com/astroswap/astroswap/workflows/Lint/badge.svg)
![Build WASM](https://github.com/astroswap/astroswap/workflows/Build%20WASM/badge.svg)
![SDK](https://github.com/astroswap/astroswap/workflows/SDK/badge.svg)
```

---

## Local Testing

Replicate CI checks locally:

```bash
# Tests
cargo test --workspace

# Linting
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo audit

# Build
cargo build --target wasm32-unknown-unknown --release

# SDK
cd sdk
pnpm install
pnpm typecheck
pnpm lint
pnpm build
pnpm test
```

---

## Deployment Workflow

### 1. Deploy to Testnet

Go to **Actions → Deploy to Testnet → Run workflow**:

1. Select contracts to deploy (or "all")
2. Choose network: `testnet` or `futurenet`
3. Click "Run workflow"

### 2. Monitor Deployment

- Check workflow logs for contract IDs
- Download deployment manifest artifact
- Verify contracts on Stellar Expert

### 3. Update Environment

Use the generated `env.txt` file to update your environment:

```bash
# From deployment artifacts
export FACTORY_CONTRACT_ID=CXXX...
export PAIR_CONTRACT_ID=CXXX...
export ROUTER_CONTRACT_ID=CXXX...
```

---

## Caching Strategy

All workflows use aggressive caching:

- **Cargo**: Registry, git, and build artifacts
- **pnpm**: Store directory for npm packages
- **Cache keys**: Based on `Cargo.lock` and `pnpm-lock.yaml` hashes

**Cache benefits**:
- Faster CI runs (2-3x speedup)
- Reduced GitHub Actions minutes
- Consistent dependency versions

---

## Troubleshooting

### Deployment Fails: "DEPLOYER_SECRET_KEY not configured"

**Solution**: Add the secret in repository settings:
```bash
Settings → Secrets and variables → Actions → New repository secret
Name: DEPLOYER_SECRET_KEY
Value: S... (your Stellar secret key)
```

### Contract Size Exceeds 256KB

**Solution**: Optimize contract code:
- Remove unused dependencies
- Enable LTO in `Cargo.toml`
- Use `opt-level = "z"` in release profile
- Remove debug assertions

### Tests Fail on CI but Pass Locally

**Solution**:
- Check Rust version: `rustup show`
- Clear local cache: `cargo clean`
- Update dependencies: `cargo update`

### SDK Build Fails

**Solution**:
- Check Node.js version: `node --version` (must be 20+)
- Clear pnpm cache: `pnpm store prune`
- Reinstall: `rm -rf node_modules && pnpm install`

---

## Best Practices

1. **Run Locally First**: Test workflows locally before pushing
2. **Fail Fast**: Use `fail-fast: false` in matrix builds
3. **Cache Aggressively**: All workflows cache dependencies
4. **Security First**: Never commit secret keys
5. **Verify Sizes**: Check contract sizes before deployment
6. **Document Changes**: Update this README when adding workflows

---

## Future Enhancements

Planned workflow improvements:

- [ ] Mainnet deployment workflow with manual approvals
- [ ] Automated SDK publishing to npm
- [ ] Performance benchmarking
- [ ] Gas cost analysis
- [ ] Integration tests against live testnet
- [ ] Automated changelog generation
- [ ] Dependency update automation (Dependabot)

---

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Stellar CLI](https://developers.stellar.org/docs/smart-contracts/getting-started/setup)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Cargo Book](https://doc.rust-lang.org/cargo/)

---

**Last Updated**: 2025-11-25
**Maintained by**: AstroSwap Team
