# AstroSwap Testnet Deployment Log

**Network**: Stellar Testnet
**Date**: 2026-03-16
**Deployer**: Manual step-by-step process

## Pre-requisites
- ✅ All 8 contracts compiled (WASM optimized)
- ✅ Stellar CLI v25.2.0 installed (upgraded from v23.0.0 to fix CVE-2026-29795)
- ✅ Testnet identity and funding

## Deployment Order

### Phase 1: Core DEX Infrastructure
1. **Factory** - Creates trading pairs
2. **Pair WASM** - Upload to be used by Factory
3. **Router** - Entry point for swaps

### Phase 2: Supporting Contracts
4. **Staking** - LP token staking
5. **Oracle** - Price feeds
6. **Aggregator** - Multi-DEX routing
7. **Bridge** - Token graduation from launchpad
8. **Circuit Breaker** - Emergency controls

---

## Deployment Steps

### Step 1: Setup Testnet Identity

```bash
# Create or use existing testnet identity
stellar keys generate testnet-deployer --network testnet
```

**Identity**: [TO BE FILLED]
**Public Key**: [TO BE FILLED]

### Step 2: Fund Account

```bash
# Get testnet XLM from friendbot
stellar keys fund testnet-deployer --network testnet
```

**Balance**: [TO BE FILLED]

---

## Contract Deployments

### ✅ Oracle Contract (Deployed)

**Contract ID**: `CD4RVY5KVQTEISP3POBHC2KYNN5DQGIAYL6GOZ2ITSKV6PEZRMZ57MF3`
**WASM Hash**: `1a5b06ef04449deaee3db5cc825b9f44bac3d8f110b0702a54af5ab74abbca30`
**Explorer**: https://stellar.expert/explorer/testnet/contract/CD4RVY5KVQTEISP3POBHC2KYNN5DQGIAYL6GOZ2ITSKV6PEZRMZ57MF3
**Admin**: `GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4`
**Staleness Threshold**: 3600 seconds (1 hour)

**Deployment Command**:
```bash
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract deploy \
  --wasm target/wasm32v1-none/release/astroswap_oracle.wasm \
  --source-account astroswap-deployer-testnet \
  --network testnet \
  -- \
  --admin GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4 \
  --staleness_threshold 3600
```

**Status**: ✅ Successfully deployed and initialized

---

### ✅ Pair WASM (Uploaded)

**WASM Hash**: `1b464493f99739b21d7bc4f45c4a1c588cff9dc4198fe93d2befe306b6376c43`
**Size**: 48KB
**Explorer**: https://stellar.expert/explorer/testnet/tx/1a17781b22d4ccc52ab5fdacc8c5a4cb4ab8f6dfe071bd8363339cf1c4554169

**Upload Command**:
```bash
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract upload \
  --wasm target/wasm32v1-none/release/astroswap_pair.wasm \
  --source-account astroswap-deployer-testnet \
  --network testnet
```

**Status**: ✅ WASM uploaded successfully

---

### ✅ Factory Contract (Deployed)

**Contract ID**: `CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK`
**WASM Hash**: `3bbdf46448b0fd3c810d67c6e545d7fd3a9a893749449b7634aaedf630b0c03e`
**Size**: 29KB
**Explorer**: https://stellar.expert/explorer/testnet/contract/CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK
**Admin**: `GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4`
**Pair WASM Hash**: `1b464493f99739b21d7bc4f45c4a1c588cff9dc4198fe93d2befe306b6376c43`
**Protocol Fee**: 5 bps (0.05%)

**Deployment Command**:
```bash
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract deploy \
  --wasm-hash 3bbdf46448b0fd3c810d67c6e545d7fd3a9a893749449b7634aaedf630b0c03e \
  --source-account astroswap-deployer-testnet \
  --network testnet \
  -- \
  --admin GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4 \
  --pair_wasm_hash 1b464493f99739b21d7bc4f45c4a1c588cff9dc4198fe93d2befe306b6376c43 \
  --protocol_fee_bps 5
```

**Status**: ✅ Successfully deployed and initialized

---

### ✅ Router Contract (Deployed)

**Contract ID**: `CDVUOVR6VUGOXITMIOR6TIP6MVOPNPKRPUC4JUYP4GUBJKE4GLJZWVE3`
**WASM Hash**: `5e9614b5554e8a3fd0c77f99b3c02b6155e4591fd2eb45c7634ee42a794287a6`
**Size**: 33KB
**Explorer**: https://stellar.expert/explorer/testnet/contract/CDVUOVR6VUGOXITMIOR6TIP6MVOPNPKRPUC4JUYP4GUBJKE4GLJZWVE3
**Admin**: `GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4`
**Factory**: `CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK`

**Deployment Command**:
```bash
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract deploy \
  --wasm-hash 5e9614b5554e8a3fd0c77f99b3c02b6155e4591fd2eb45c7634ee42a794287a6 \
  --source-account astroswap-deployer-testnet \
  --network testnet \
  -- \
  --admin GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4 \
  --factory CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK
```

**Status**: ✅ Successfully deployed and initialized

---

### ✅ Aggregator Contract (Deployed)

**Contract ID**: `CDX7AWG64SBNGJAURHN522N7Y3FUWBVPN2D5GULEMXEE244ULQHOSWN3`
**WASM Hash**: `fdc9158457f5fc00e64311643aa66a83f5511656f52db701e508e12600541704`
**Size**: 36KB
**Explorer**: https://stellar.expert/explorer/testnet/contract/CDX7AWG64SBNGJAURHN522N7Y3FUWBVPN2D5GULEMXEE244ULQHOSWN3
**Admin**: `GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4`
**AstroSwap Factory**: `CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK`

**Deployment Command**:
```bash
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract deploy \
  --wasm-hash fdc9158457f5fc00e64311643aa66a83f5511656f52db701e508e12600541704 \
  --source-account astroswap-deployer-testnet \
  --network testnet \
  -- \
  --admin GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4 \
  --astroswap_factory CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK
```

**Status**: ✅ Successfully deployed and initialized

---

### ✅ Circuit Breaker Contract (Deployed)

**Contract ID**: `CDW3USZ73PJ7DT6O47JLNO73AJNANWGDHRKK3KIM3D57USP4UNLGAL4A`
**WASM Hash**: `33421dc4b64d9b547ecb9220fafb0159a7499de873ad239eaae819be18b2b9b7`
**Size**: 30KB
**Explorer**: https://stellar.expert/explorer/testnet/contract/CDW3USZ73PJ7DT6O47JLNO73AJNANWGDHRKK3KIM3D57USP4UNLGAL4A
**Admin**: `GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4`
**Timelock Delay**: 86400 seconds (24 hours)

**Deployment Commands**:
```bash
# Deploy contract
export STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
stellar contract deploy \
  --wasm-hash 33421dc4b64d9b547ecb9220fafb0159a7499de873ad239eaae819be18b2b9b7 \
  --source-account astroswap-deployer-testnet \
  --network testnet

# Initialize contract
stellar contract invoke \
  --id CDW3USZ73PJ7DT6O47JLNO73AJNANWGDHRKK3KIM3D57USP4UNLGAL4A \
  --source-account astroswap-deployer-testnet \
  --network testnet \
  -- \
  initialize \
  --admin GCXJ6ID2FQ66MKIQT7JVOSS67HFQ7EPRODJ7VV7WUDBZZOLUSLEYZQE4 \
  --timelock_delay 86400
```

**Status**: ✅ Successfully deployed and initialized

---

### ⏳ Staking Contract (Pending)

**WASM Hash**: `932e2be5c6741cc63403146e8902701cf5a95b42e00a369684654a2498755072`
**Size**: 39KB
**Status**: WASM uploaded, waiting for reward token deployment

**Blocker**: Needs `reward_token` address for initialization

---

### ⏳ Bridge Contract (Pending)

**WASM Hash**: `8e4f019a483e44d09b6236b658c7cfc24fe19687469b74b9f0224de87a5061c5`
**Size**: 35KB
**Status**: WASM uploaded, waiting for dependencies

**Blockers**:
- Needs Staking contract address
- Needs Launchpad contract address (from astro-launchpad repo)
- Needs quote token address (XLM or USDC)

---

## ⚠️ Issue Resolved: CVE-2026-29795

**Problem**: Initial deployment attempts with stellar-cli v23.0.0 failed with error:
```
xdr processing error: xdr value max length exceeded
```

**Root Cause**: [CVE-2026-29795](https://advisories.gitlab.com/pkg/cargo/stellar-xdr/CVE-2026-29795/) - stellar-xdr's StringM::from_str was not validating max length correctly in versions up to 25.0.0

**Solution**: Upgraded stellar-cli from v23.0.0 to v25.2.0
```bash
cargo install --locked stellar-cli --force
```

**Result**: ✅ All contracts deployed successfully after upgrade

**References**:
- [CVE-2026-29795 Advisory](https://advisories.gitlab.com/pkg/cargo/stellar-xdr/CVE-2026-29795/)
- [Soroban Documentation](https://soroban.stellar.org/docs/reference/releases)
- [Protocol 25 Upgrade Guide](https://stellar.org/blog/developers/stellar-x-ray-protocol-25-upgrade-guide)

---


## Deployment Summary

### ✅ Successfully Deployed (6/8 contracts)

| Contract | Contract ID | Status |
|----------|-------------|--------|
| **Oracle** | `CD4RVY5KVQTEISP3POBHC2KYNN5DQGIAYL6GOZ2ITSKV6PEZRMZ57MF3` | ✅ Deployed |
| **Pair WASM** | `1b464493f99739b21d7bc4f45c4a1c588cff9dc4198fe93d2befe306b6376c43` | ✅ Uploaded |
| **Factory** | `CAZR26GTYRHGOA2VACISBCYI7AMEHDW6WPPGHPUHCAXO7TV2EE5USRKK` | ✅ Deployed |
| **Router** | `CDVUOVR6VUGOXITMIOR6TIP6MVOPNPKRPUC4JUYP4GUBJKE4GLJZWVE3` | ✅ Deployed |
| **Aggregator** | `CDX7AWG64SBNGJAURHN522N7Y3FUWBVPN2D5GULEMXEE244ULQHOSWN3` | ✅ Deployed |
| **Circuit Breaker** | `CDW3USZ73PJ7DT6O47JLNO73AJNANWGDHRKK3KIM3D57USP4UNLGAL4A` | ✅ Deployed & Initialized |

### ⏳ Pending (2/8 contracts)

| Contract | WASM Hash | Blocker |
|----------|-----------|---------|
| **Staking** | `932e2be5c6741cc63403146e8902701cf5a95b42e00a369684654a2498755072` | Needs reward token |
| **Bridge** | `8e4f019a483e44d09b6236b658c7cfc24fe19687469b74b9f0224de87a5061c5` | Needs Staking + Launchpad |

---

## Next Steps

### 1. Create Test Token for Staking

Deploy a test ERC20-like token to use as reward token for the Staking contract.

### 2. Complete Staking Deployment

Once test token is deployed, use it to initialize Staking contract.

### 3. Create First Trading Pair

Use Factory to create a test trading pair (e.g., XLM/TestToken) and test the complete swap flow.

### 4. Validate All User Flows

- Add liquidity
- Execute swaps
- Multi-hop routing
- Aggregator functionality
- Emergency circuit breaker

---

**Last Updated**: 2026-03-16 (After CLI upgrade to v25.2.0)
**Deployer**: astroswap-deployer-testnet
**Network**: Stellar Testnet
**Status**: 6/8 contracts deployed ✅ | 2/8 pending dependencies ⏳
