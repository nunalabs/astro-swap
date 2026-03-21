# Deployment Script Validation - AstroSwap

**Date**: 2026-03-11
**Reviewed**: `scripts/deploy.sh`
**Status**: ⚠️ REQUIRES UPDATES

---

## Critical Issues

### 1. CAP-58 Constructor Pattern Not Used

**Issue**: The deployment script uses legacy `initialize()` calls instead of the new CAP-58 constructor pattern implemented in all contracts.

**Current Script** (Lines 101-118):
```bash
initialize_factory() {
    local factory_id=$1
    local pair_hash=$2

    stellar contract invoke \
        --id "${factory_id}" \
        -- \
        initialize \
        --admin "${DEPLOYER_ADDRESS}" \
        --pair_wasm_hash "${pair_hash}" \
        --protocol_fee_bps 30
}
```

**Problem**:
- All contracts now use CAP-58 `__constructor` which runs atomically during `contract deploy`
- The legacy `initialize()` function will fail with `AlreadyInitialized` error
- Constructor parameters must be passed during deployment, not after

**Impact**: 🔴 **CRITICAL** - Deployment will fail on all contract initializations

---

## Required Updates

### Factory Deployment

**Current (❌ BROKEN)**:
```bash
# Line 206-207
FACTORY_ID=$(deploy_contract "factory")
initialize_factory "${FACTORY_ID}" "${PAIR_HASH}"
```

**Updated (✅ CORRECT)**:
```bash
# Deploy factory with constructor args
info "Deploying factory with constructor..."

FACTORY_ID=$(stellar contract deploy \
    --wasm-hash "${FACTORY_HASH}" \
    --source "${DEPLOYER_KEY}" \
    --network "${NETWORK}" \
    -- \
    --admin "${DEPLOYER_ADDRESS}" \
    --pair_wasm_hash "${PAIR_HASH}" \
    --protocol_fee_bps 30 \
    2>&1 | tail -1)

success "Factory deployed and initialized: ${FACTORY_ID}"
```

### Router Deployment

**Current (❌ BROKEN)**:
```bash
# Line 210-211
ROUTER_ID=$(deploy_contract "router")
initialize_router "${ROUTER_ID}" "${FACTORY_ID}"
```

**Updated (✅ CORRECT)**:
```bash
# Deploy router with constructor args
info "Deploying router with constructor..."

ROUTER_ID=$(stellar contract deploy \
    --wasm-hash "${ROUTER_HASH}" \
    --source "${DEPLOYER_KEY}" \
    --network "${NETWORK}" \
    -- \
    --factory "${FACTORY_ID}" \
    --admin "${DEPLOYER_ADDRESS}" \
    2>&1 | tail -1)

success "Router deployed and initialized: ${ROUTER_ID}"
```

### Staking Deployment

**Current (❌ BROKEN)**:
```bash
# Line 214-224
STAKING_ID=$(deploy_contract "staking")
initialize_staking "${STAKING_ID}" "${REWARD_TOKEN}"
```

**Updated (✅ CORRECT)**:
```bash
# Deploy staking with constructor args
info "Deploying staking with constructor..."

STAKING_ID=$(stellar contract deploy \
    --wasm-hash "${STAKING_HASH}" \
    --source "${DEPLOYER_KEY}" \
    --network "${NETWORK}" \
    -- \
    --admin "${DEPLOYER_ADDRESS}" \
    --reward_token "${REWARD_TOKEN}" \
    2>&1 | tail -1)

success "Staking deployed and initialized: ${STAKING_ID}"
```

### Aggregator Deployment

**Current (❌ BROKEN)**:
```bash
# Line 227-228
AGGREGATOR_ID=$(deploy_contract "aggregator")
initialize_aggregator "${AGGREGATOR_ID}" "${FACTORY_ID}"
```

**Updated (✅ CORRECT)**:
```bash
# Deploy aggregator with constructor args
info "Deploying aggregator with constructor..."

AGGREGATOR_ID=$(stellar contract deploy \
    --wasm-hash "${AGGREGATOR_HASH}" \
    --source "${DEPLOYER_KEY}" \
    --network "${NETWORK}" \
    -- \
    --admin "${DEPLOYER_ADDRESS}" \
    --astroswap_factory "${FACTORY_ID}" \
    2>&1 | tail -1)

success "Aggregator deployed and initialized: ${AGGREGATOR_ID}"
```

### Bridge Deployment

**Current (⚠️ INCOMPLETE)**:
```bash
# Line 231-233
BRIDGE_ID=$(deploy_contract "bridge")
# Bridge initialization requires launchpad address - skip for now
```

**Updated (✅ CORRECT)**:
```bash
# Deploy bridge with constructor args
info "Deploying bridge with constructor..."

# Ensure required parameters are set
if [ -z "${LAUNCHPAD_ADDRESS}" ]; then
    error "LAUNCHPAD_ADDRESS required for bridge deployment"
fi

if [ -z "${QUOTE_TOKEN}" ]; then
    error "QUOTE_TOKEN required for bridge deployment"
fi

BRIDGE_ID=$(stellar contract deploy \
    --wasm-hash "${BRIDGE_HASH}" \
    --source "${DEPLOYER_KEY}" \
    --network "${NETWORK}" \
    -- \
    --admin "${DEPLOYER_ADDRESS}" \
    --factory "${FACTORY_ID}" \
    --staking "${STAKING_ID}" \
    --launchpad "${LAUNCHPAD_ADDRESS}" \
    --quote_token "${QUOTE_TOKEN}" \
    2>&1 | tail -1)

success "Bridge deployed and initialized: ${BRIDGE_ID}"
```

---

## Constructor Parameter Validation

### Factory Constructor
```rust
pub fn __constructor(
    env: Env,
    admin: Address,
    pair_wasm_hash: BytesN<32>,
    protocol_fee_bps: u32,
)
```

**Validation Rules**:
- ✅ `admin`: Valid Stellar address (G... format)
- ✅ `pair_wasm_hash`: 32-byte WASM hash from `stellar contract install`
- ✅ `protocol_fee_bps`: Must be ≤ 100 (1%) - enforced by contract

**Recommended Values**:
- `protocol_fee_bps`: 30 (0.30%) ✅ **CORRECT in script**

### Router Constructor
```rust
pub fn __constructor(
    env: Env,
    factory: Address,
    admin: Address,
)
```

**Validation Rules**:
- ✅ `factory`: Valid deployed factory contract ID
- ✅ `admin`: Valid Stellar address

### Staking Constructor
```rust
pub fn __constructor(
    env: Env,
    admin: Address,
    reward_token: Address,
)
```

**Validation Rules**:
- ✅ `admin`: Valid Stellar address
- ✅ `reward_token`: Valid token contract address

**Current Issue**:
- Line 219: Uses XLM SAC as placeholder ⚠️
- **Recommendation**: Use actual reward token for production

### Aggregator Constructor
```rust
pub fn __constructor(
    env: Env,
    admin: Address,
    astroswap_factory: Address,
)
```

**Validation Rules**:
- ✅ `admin`: Valid Stellar address
- ✅ `astroswap_factory`: Valid deployed factory contract ID

### Bridge Constructor
```rust
pub fn __constructor(
    env: Env,
    admin: Address,
    factory: Address,
    staking: Address,
    launchpad: Address,
    quote_token: Address,
)
```

**Validation Rules**:
- ✅ `admin`: Valid Stellar address
- ✅ `factory`: Valid deployed factory contract ID
- ✅ `staking`: Valid deployed staking contract ID
- ✅ `launchpad`: Valid astro-launchpad contract ID
- ✅ `quote_token`: Valid quote token (e.g., USDC)

**Current Issue**:
- Script skips bridge initialization ⚠️
- **Recommendation**: Add required environment variables

---

## Deployment Order Validation

✅ **Current order is CORRECT**:

1. **Pair WASM Install** - Factory needs the hash
2. **Factory Deploy** - Router and Aggregator need factory ID
3. **Router Deploy** - Needs factory ID
4. **Staking Deploy** - Bridge needs staking ID
5. **Aggregator Deploy** - Needs factory ID
6. **Bridge Deploy** - Needs factory, staking, launchpad, quote token

---

## Environment Variables Required

### Testnet
```bash
export NETWORK=testnet
export REWARD_TOKEN="<reward-token-address>"
export LAUNCHPAD_ADDRESS="<launchpad-contract-id>"
export QUOTE_TOKEN="<usdc-token-address>"
```

### Mainnet
```bash
export NETWORK=mainnet
export REWARD_TOKEN="<production-reward-token>"
export LAUNCHPAD_ADDRESS="<production-launchpad-contract>"
export QUOTE_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"  # XLM
```

---

## Updated deploy_contract Function

The generic `deploy_contract()` function should be removed since each contract needs custom constructor args:

```bash
# Remove this function (Lines 66-98)
deploy_contract() {
    # ...
}

# Replace with contract-specific deploy functions
# See examples above for Factory, Router, Staking, etc.
```

---

## Testing Checklist

Before deploying to mainnet:

- [ ] Update deployment script with CAP-58 constructor calls
- [ ] Validate all constructor parameters match contract requirements
- [ ] Test deployment on testnet with actual values
- [ ] Verify all contracts initialize correctly
- [ ] Confirm `initialize()` legacy function fails (as expected)
- [ ] Validate factory fee is ≤ 100 bps
- [ ] Set production reward token address
- [ ] Set production launchpad address
- [ ] Set production quote token address
- [ ] Test end-to-end flow (create pair, add liquidity, swap)

---

## Risk Assessment

**Current Script**: 🔴 **HIGH RISK**
- Will fail on all contract deployments
- Uses deprecated `initialize()` calls
- Missing required bridge parameters

**After Updates**: 🟢 **LOW RISK**
- CAP-58 atomic initialization
- All parameters validated
- Clear deployment order
- Environment-specific configuration

---

## Recommended Next Steps

1. **Immediate**: Update `scripts/deploy.sh` with CAP-58 constructor pattern
2. **Testing**: Deploy to testnet and verify all contracts initialize
3. **Documentation**: Add deployment guide to README
4. **CI/CD**: Add pre-deployment validation checks
5. **Mainnet**: Set production environment variables before deployment

---

## References

- CAP-58: https://github.com/stellar/stellar-protocol/blob/master/core/cap-0058.md
- Soroban SDK 25.x: https://docs.rs/soroban-sdk/25.2.0
- Security Audit: `SECURITY_AUDIT_COMPLETE_2026-03-11.md`
- Security Fixes: `SECURITY_FIXES_2026-03-11.md`
