# GitHub Actions Quick Start

## ⚡ 5-Minute Setup

### 1. Add Deployment Secret

```bash
# Settings → Secrets and variables → Actions → New repository secret
Name: DEPLOYER_SECRET_KEY
Value: S... (your Stellar secret key)
```

### 2. Fund Deployer Account

```bash
# Get your deployer address
stellar keys add deployer --secret-key "YOUR_SECRET_KEY"
stellar keys address deployer
# Output: GXXX...

# Fund on testnet: https://laboratory.stellar.org/#account-creator?network=test
# Minimum: ~100 XLM for contract deployments
```

### 3. Add Status Badges to README

```markdown
![Tests](https://github.com/YOUR_ORG/astroswap/workflows/Tests/badge.svg)
![Lint](https://github.com/YOUR_ORG/astroswap/workflows/Lint/badge.svg)
![Build WASM](https://github.com/YOUR_ORG/astroswap/workflows/Build%20WASM/badge.svg)
![SDK](https://github.com/YOUR_ORG/astroswap/workflows/SDK/badge.svg)
```

## 🎯 Common Tasks

### Deploy to Testnet

1. **Actions** tab → **Deploy to Testnet** → **Run workflow**
2. Set:
   - Contracts: `all` (or specific: `factory,router`)
   - Network: `testnet`
3. **Run workflow**
4. Get contract IDs from workflow summary

### Run Tests Locally (Same as CI)

```bash
# All tests
cargo test --workspace

# Format
cargo fmt --all

# Lint
cargo clippy --workspace --all-targets -- -D warnings

# Build
cargo build --target wasm32-unknown-unknown --release

# SDK
cd sdk && pnpm install && pnpm build && pnpm test
```

### Fix Common Issues

**Contract too large?**
```bash
cargo bloat --release --target wasm32-unknown-unknown
# Review and remove largest dependencies
```

**Tests failing?**
```bash
cargo clean
cargo test --workspace --verbose
```

**SDK build failing?**
```bash
cd sdk
rm -rf node_modules dist
pnpm install
pnpm build
```

## 📋 Workflow Triggers

| Workflow | When It Runs |
|----------|--------------|
| Tests | ✅ Push to main/develop<br>✅ Every PR |
| Lint | ✅ Every PR |
| Build WASM | ✅ Push to main/develop<br>✅ Every PR |
| SDK | ✅ Push/PR affecting `sdk/` |
| Deploy | ⚙️ Manual only |

## 🔍 Quick Links

- [Full Workflows Guide](./WORKFLOWS_GUIDE.md)
- [Workflows README](./workflows/README.md)
- [Stellar CLI Docs](https://developers.stellar.org/docs/tools/developer-tools#stellar-cli)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

## 📊 What Gets Checked

### Every PR

- ✅ All tests pass
- ✅ Code formatted (`cargo fmt`)
- ✅ No clippy warnings
- ✅ No security vulnerabilities
- ✅ Contracts build successfully
- ✅ Contracts < 256KB
- ✅ SDK typechecks
- ✅ SDK builds

### Before Merge

All checks must pass ✅

## 🚀 Deployment Checklist

Before deploying to testnet:

- [ ] All tests passing
- [ ] All lints passing
- [ ] Contract sizes verified
- [ ] Deployer account funded
- [ ] Network configured correctly

After deployment:

- [ ] Contract IDs saved
- [ ] Deployment manifest downloaded
- [ ] Contracts verified on network
- [ ] Environment variables updated

## 📦 Artifacts

Download from workflow runs:

| Artifact | What It Contains | Retention |
|----------|------------------|-----------|
| `astroswap_*-wasm` | Compiled contracts | 30 days |
| `size-report` | Size analysis | 90 days |
| `sdk-dist` | SDK bundles | 30 days |
| `deployment-manifest-*` | Contract IDs | 90 days |

## 🆘 Getting Help

**Workflow failing?**
1. Check workflow logs
2. Run same command locally
3. Review error messages
4. See [WORKFLOWS_GUIDE.md](./WORKFLOWS_GUIDE.md) troubleshooting

**Questions?**
Open an issue with the `ci/cd` label

---

**Ready?** Push to `main` or create a PR to see workflows in action!
