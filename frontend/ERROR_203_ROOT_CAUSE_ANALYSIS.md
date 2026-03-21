# Error #203 Root Cause Analysis & Resolution

**Date**: 2026-03-17
**Status**: ✅ RESOLVED
**Transaction**: [16247dc6414da550e5fdeb30447e882bbd926265c3a46875d5b59948a8cc6d15](https://stellar.expert/explorer/testnet/tx/16247dc6414da550e5fdeb30447e882bbd926265c3a46875d5b59948a8cc6d15)

## Executive Summary

Error #203 (`MinimumNotMet`) was **NOT an approval issue**. It was a **slippage check failure** for first liquidity additions. The root cause was a type mismatch in `getReserves()` that prevented proper detection of empty pools.

## The Real Problem

### 1. Error #203 is `MinimumNotMet` (Slippage Check)

From `contracts/shared/src/error.rs:30`:
```rust
MinimumNotMet = 203,  // Slippage protection failed
```

This error occurs in `pair/src/contract.rs:242` and `251`:
```rust
if amount_1_optimal < amount_1_min {
    return Err(AstroSwapError::MinimumNotMet);  // Error #203
}
```

### 2. First Liquidity Must Have `amount_min = 0`

For **first liquidity** (empty pool), the contract expects `amount_min = 0` because there's no existing ratio to check against. Setting non-zero minimums causes MinimumNotMet error.

### 3. Bug: `getReserves()` Type Mismatch

**Problem**: Soroban returns tuples as JavaScript arrays, but the code expected an object.

```typescript
// BEFORE (contracts.ts:152)
return result as { reserve0: string; reserve1: string; blockTimestampLast: number };
// result was actually: [reserve0, reserve1, timestamp]  // ARRAY!

// Code tried to access: reserves.reserve0  // undefined!
```

**Result**: The first liquidity check always failed, causing:
```typescript
isFirstLiquidity = false  // ❌ WRONG!
rawAmountAMin = '1223850000'  // ❌ Should be '0'
rawAmountBMin = '9950000'     // ❌ Should be '0'
→ Error #203: MinimumNotMet
```

## The Fix

### 1. Fixed `getReserves()` (contracts.ts:140-169)

```typescript
export async function getReserves(
  pairAddress: string,
  sourceAddress: string
): Promise<{ reserve0: string; reserve1: string; blockTimestampLast: number } | null> {
  try {
    const result = await callContract(pairAddress, 'get_reserves', [], sourceAddress);

    // ✅ FIX: Soroban returns tuple as array [reserve0, reserve1, timestamp]
    if (Array.isArray(result) && result.length === 3) {
      return {
        reserve0: result[0]?.toString() || '0',
        reserve1: result[1]?.toString() || '0',
        blockTimestampLast: Number(result[2]) || 0,
      };
    }

    return null;
  } catch (error) {
    console.error('Error getting reserves:', error);
    return null;
  }
}
```

### 2. Simplified First Liquidity Check (usePool.ts:172-198)

```typescript
let isFirstLiquidity = false;
try {
  const pairAddress = await getPairAddress(tokenA.address, tokenB.address, address);

  if (pairAddress) {
    const reserves = await getReserves(pairAddress, address);

    if (reserves) {
      const reserve0 = BigInt(reserves.reserve0);
      const reserve1 = BigInt(reserves.reserve1);

      if (reserve0 === 0n && reserve1 === 0n) {
        isFirstLiquidity = true;  // ✅ CORRECT!
        console.log('🆕 First liquidity detected - disabling slippage protection');
      }
    }
  }
} catch (error) {
  isFirstLiquidity = true;  // Fail-safe
}

// Set minimums based on first liquidity flag
const rawAmountAMin = isFirstLiquidity ? '0' : /* calculate with slippage */;
const rawAmountBMin = isFirstLiquidity ? '0' : /* calculate with slippage */;
```

## Successful Test Results

```
📊 Transaction parameters: {
  rawAmountA: '10000000',
  rawAmountB: '1230000000',
  rawAmountAMin: '0',         // ✅ ZERO - first liquidity!
  rawAmountBMin: '0',         // ✅ ZERO - first liquidity!
}

✅ Simulation successful
✅ Transaction signed (took 9.9s)
✅ Transaction confirmed
✅ addLiquidity success: 16247dc6414da550e5fdeb30447e882bbd926265c3a46875d5b59948a8cc6d15
```

## Critical Discovery: Approvals Are NOT Needed

During debugging, we discovered that the entire approval system is **unnecessary** for this DEX architecture.

### Why Approvals Aren't Needed

The pair contract uses `transfer()` not `transfer_from()`:

```rust
// pair/src/contract.rs:272-273
token_0_client.transfer(&user, env.current_contract_address(), &amount_0);
token_1_client.transfer(&user, env.current_contract_address(), &amount_1);
```

**Key difference**:
- `transfer(from, to, amount)` - Only requires `from.require_auth()` (user signature) ✅
- `transfer_from(spender, from, to, amount)` - Requires prior `approve()` ❌

### What This Means

1. **No approvals needed** - User signature is sufficient
2. **ApprovalManager is unused** - The system checks allowances, but contracts never call `transfer_from()`
3. **Approval guard shows false positives** - Reports MAX allowance exists, but it's irrelevant

### Evidence from Logs

```
🔍 RPC allowance result: {allowance: '170141183460469231731687303715884105727'}  // MAX
🔍 Token approval check: {needsApproval: false, canProceed: true}

// But transaction succeeds WITHOUT these approvals being used!
```

## Recommendations

### Immediate (Keep Current Code)

1. ✅ Keep the approval system as-is (no harm, adds extra validation layer)
2. ✅ Ensure first liquidity detection works correctly
3. ✅ Test subsequent liquidity additions with slippage protection

### Future Optimization (Optional)

1. **Remove approval system entirely** - Not needed for `transfer()` architecture
2. **Simplify Pool.tsx UI** - Remove approval UI/buttons
3. **Remove ApprovalManager** (~800 lines of unused code)
4. **Update documentation** - Clarify that approvals are NOT required

**Trade-off**: Current system adds defensive validation, but increases complexity and gas costs for no functional benefit.

## Files Modified

1. `/frontend/src/lib/contracts.ts` - Fixed `getReserves()` array handling
2. `/frontend/src/hooks/usePool.ts` - Fixed first liquidity detection
3. `/frontend/src/lib/stellar/approval-manager.ts` - Added logging (kept for now)
4. `/frontend/src/hooks/useApprovalGuard.ts` - Added logging (kept for now)
5. `/frontend/src/pages/Pool.tsx` - Added guards and logging (kept for now)

## Lessons Learned

1. **Check error codes first** - Error #203 was never about approvals
2. **Verify type assumptions** - Soroban tuples → JS arrays, not objects
3. **Read contract code** - `transfer()` vs `transfer_from()` makes ALL the difference
4. **Test edge cases** - First liquidity is a special case requiring `amount_min = 0`

## Next Steps

- [x] Fix first liquidity detection
- [x] Test successful transaction on testnet
- [ ] Test second liquidity addition (with slippage protection)
- [ ] Decide whether to remove unnecessary approval system
- [ ] Update user documentation

---

**Resolution**: The issue was a simple type mismatch causing first liquidity detection to fail. No approval-related changes were actually needed for the core functionality.
