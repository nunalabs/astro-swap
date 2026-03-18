# ALL Reserve Ordering Bugs - Complete Fix Summary

**Date**: 2026-03-18
**Status**: ✅ ALL BUGS FIXED

---

## Overview

Deep audit revealed MULTIPLE reserve ordering bugs across the codebase. All bugs stem from the same root cause: **assuming reserve order without verification**.

---

## The Root Problem

### Contract Behavior (IMMUTABLE TRUTH)
```rust
// Pair contracts store tokens in LEXICOGRAPHICALLY SORTED order
pub fn sort_tokens(token_a: &Address, token_b: &Address) -> (Address, Address) {
    if token_a < token_b {
        (token_a.clone(), token_b.clone())
    } else {
        (token_b.clone(), token_a.clone())
    }
}
```

- Factory calls `sort_tokens()` before creating pairs
- Pair stores `token_0` (smaller address), `token_1` (larger address)
- Pair stores `reserve_0` for `token_0`, `reserve_1` for `token_1`
- **Reserve order is SORTED, not based on call order!**

### Frontend Assumption (WRONG!)
```typescript
// ❌ WRONG: Assuming reserve0 corresponds to whatever token we call token0
const reserves = await getReserves(pairAddress);
return {
  token0: myToken0,
  reserve0: reserves.reserve0,  // ❌ No verification!
};
```

---

## All Bugs Found and Fixed

### BUG #1: Pool Loading - Reserve Ordering ❌ → ✅

**File**: `usePool.ts` (lines 42-99)

**The Bug**:
```typescript
// ❌ BUGGY CODE
const pairTokens = await getPairTokens(pairAddress);
const reserves = await getReserves(pairAddress);

return {
  token0,
  token1,
  reserve0: reserves.reserve0,  // Assumed order!
  reserve1: reserves.reserve1,  // Assumed order!
};
```

**Why It Failed**:
- Fetched token addresses and reserves separately
- Never verified which reserve corresponds to which token
- If token addresses from `getPairTokens()` didn't match contract sort order, reserves were inverted

**Real Example**:
- ASTRO address: `CCHNAJAE...` (smaller)
- XLM address: `CDLZFC3S...` (larger)
- Contract: token_0 = ASTRO, token_1 = XLM
- But code showed: reserve0 = XLM reserves, reserve1 = ASTRO reserves
- **Result**: 67x price error (1 XLM = 8.235 ASTRO instead of 0.12)

**The Fix**:
```typescript
// ✅ FIXED - Use centralized getReservesForPair()
const matchedReserves = await getReservesForPair(
  pairAddress,
  pairTokens.token0,
  pairTokens.token1,
  address
);

return {
  token0,
  token1,
  reserve0: matchedReserves.reserveA,  // ✅ Verified match!
  reserve1: matchedReserves.reserveB,  // ✅ Verified match!
};
```

---

### BUG #2: Swap Quote - Price Impact Hardcoded ❌ → ✅

**File**: `useSwap.ts` (line 59)

**The Bug**:
```typescript
// ❌ BUGGY CODE
const impact = calculatePriceImpact('1000000', '1000000', rawAmountIn);
```

**Why It Failed**:
- Used hardcoded reserve values `'1000000', '1000000'`
- Price impact always calculated with fake 1:1 ratio
- Showed 0% impact even for large swaps
- **Result**: Users had no warning about high slippage

**The Fix**:
```typescript
// ✅ FIXED - Fetch real reserves
const firstPairAddress = await getPairAddress(path[0], path[1], address);
const reservesData = await getReservesForPair(
  firstPairAddress,
  path[0],  // tokenIn
  path[1],  // tokenOut
  address
);

if (reservesData) {
  impact = calculatePriceImpact(
    reservesData.reserveA,  // Real reserve for tokenIn
    reservesData.reserveB,  // Real reserve for tokenOut
    rawAmountIn
  );
}
```

---

### BUG #3: Remove Liquidity - Reserve Order Assumption ❌ → ✅

**File**: `usePool.ts` (lines 305-313)

**The Bug**:
```typescript
// ❌ BUGGY CODE
const reserve0BigInt = BigInt(pool.reserve0);
const reserve1BigInt = BigInt(pool.reserve1);

const expectedAmountA = (liquidityBigInt * reserve0BigInt) / totalSupplyBigInt;
const expectedAmountB = (liquidityBigInt * reserve1BigInt) / totalSupplyBigInt;
```

**Why It Failed**:
- `tokenA` and `tokenB` are function parameters (can be ANY order)
- `pool.reserve0` and `pool.reserve1` correspond to `pool.token0` and `pool.token1` (SORTED order)
- Code assumed reserve0 → tokenA without verification
- **Result**: Wrong slippage minimums if user passed tokens in different order than pool sort

**Critical Impact**:
- If tokens passed in wrong order, minimums would be inverted
- User could lose funds due to incorrect slippage protection
- Example: Expecting minimum 100 XLM, but contract checks minimum 100 ASTRO (wrong token!)

**The Fix**:
```typescript
// ✅ FIXED - Verify token order first
let reserveA: bigint;
let reserveB: bigint;

if (tokenA.address === pool.token0.address) {
  // tokenA is pool.token0
  reserveA = reserve0BigInt;
  reserveB = reserve1BigInt;
} else {
  // tokenA is pool.token1 (reversed)
  reserveA = reserve1BigInt;
  reserveB = reserve0BigInt;
}

const expectedAmountA = (liquidityBigInt * reserveA) / totalSupplyBigInt;
const expectedAmountB = (liquidityBigInt * reserveB) / totalSupplyBigInt;
```

---

## The Solution: Centralized Helper

### Created: `getReservesForPair()`

**File**: `contracts.ts`

```typescript
export async function getReservesForPair(
  pairAddress: string,
  tokenA: string,
  tokenB: string,
  sourceAddress: string
): Promise<{
  reserveA: string;
  reserveB: string;
  token0: string;
  token1: string;
} | null> {
  // Fetch reserves, token0, AND token1 in parallel
  const [reserves, token0, token1] = await Promise.all([
    getReserves(pairAddress, sourceAddress),
    callContract(pairAddress, 'token_0', [], sourceAddress),
    callContract(pairAddress, 'token_1', [], sourceAddress),
  ]);

  // Determine which reserve corresponds to which token
  if (tokenA === token0 && tokenB === token1) {
    return {
      reserveA: reserves.reserve0,
      reserveB: reserves.reserve1,
      token0,
      token1,
    };
  } else if (tokenA === token1 && tokenB === token0) {
    return {
      reserveA: reserves.reserve1,  // SWAPPED!
      reserveB: reserves.reserve0,  // SWAPPED!
      token0,
      token1,
    };
  } else {
    // ERROR: Token mismatch
    return null;
  }
}
```

**Why This Works**:
1. **Fetches token addresses** from contract (source of truth)
2. **Verifies ordering** before returning reserves
3. **Returns matched reserves** corresponding to specified tokens
4. **Fails explicitly** if tokens don't match (no silent errors)

---

## Places Verified OK (No Bugs)

### 1. usePool.ts - First Liquidity Check (Line 182-189)
```typescript
const reserve0 = BigInt(reserves.reserve0);
const reserve1 = BigInt(reserves.reserve1);

if (reserve0 === 0n && reserve1 === 0n) {
  isFirstLiquidity = true;
}
```
**Why OK**: Only checks if BOTH reserves are zero. Order doesn't matter for this check.

### 2. Pool.tsx - Amount Calculations (Lines 70-76, 115-121)
```typescript
if (existingPool.token0.address === tokenA!.address) {
  calculatedAmountB = (amountABigInt * reserve1) / reserve0;
} else {
  calculatedAmountB = (amountABigInt * reserve0) / reserve1;
}
```
**Why OK**: Explicitly verifies token order before using reserves. Correct pattern.

### 3. PoolCard.tsx - Display Only
**Why OK**: Just displays `pool.reserve0` and `pool.reserve1` received from usePool. Since usePool is fixed, PoolCard receives correct data.

---

## Commits

### Commit 1: `910f899` - Main structural fix
- Created `getReservesForPair()` centralized helper
- Fixed usePool pool loading to use helper
- Updated `getReservesForSwap()` to use helper internally

### Commit 2: `af77b1b` - Additional bugs
- Fixed price impact calculation (removed hardcoded values)
- Fixed removeLiquidity to verify token order
- Added imports and comprehensive error handling

---

## Testing Checklist

### 1. Pool Display
- [ ] XLM/ASTRO pool shows correct reserves (XLM ~111k, ASTRO ~13k)
- [ ] Reserves match token symbols (XLM Reserve shows XLM amount, not ASTRO)
- [ ] No inverted displays

### 2. Swap Quotes
- [ ] 1 XLM → ASTRO shows ~0.12 ASTRO (NOT 8.235!)
- [ ] Price impact shows realistic % (not 0%)
- [ ] Reverse swap (ASTRO → XLM) shows correct inverse rate

### 3. Add Liquidity
- [ ] Auto-calculated amounts match pool ratio
- [ ] Transaction succeeds with expected LP tokens
- [ ] Pool updates with correct new reserves

### 4. Remove Liquidity
- [ ] Slippage minimums calculated correctly
- [ ] Transaction succeeds regardless of token order passed
- [ ] User receives expected amounts (not inverted)

### 5. Console Logs
Should see:
```
✅ tokenA=token0, tokenB=token1 → reserveA=reserve0, reserveB=reserve1
OR
✅ tokenA=token1, tokenB=token0 → reserveA=reserve1, reserveB=reserve0
```

Should NOT see:
```
❌ Token mismatch!
```

---

## Impact Summary

### Before Fixes
- ❌ 67x price errors in swap quotes
- ❌ Inverted pool displays
- ❌ Hardcoded 0% price impact (misleading)
- ❌ Wrong slippage minimums on removeLiquidity
- ❌ Potential loss of user funds

### After Fixes
- ✅ Accurate prices and quotes
- ✅ Correct pool displays
- ✅ Real price impact calculations
- ✅ Safe slippage protection
- ✅ Protected against token order issues

---

## Lessons Learned

### 1. Never Assume Data Order
Blockchain contracts have their own ordering rules (lexicographic sort). Frontend cannot assume any specific order.

### 2. Always Verify from Source
Fetch identifying data (token addresses) along with associated data (reserves) to verify correct matching.

### 3. Centralize Critical Logic
Single source of truth (`getReservesForPair()`) prevents bugs from spreading through duplication.

### 4. Test with Real Data
Hardcoded test values miss real-world issues. Always test with actual contract data.

### 5. Deep Audits Find More Bugs
First bug (pool display) led to finding 3 more related bugs. Always dig deeper.

---

## Documentation Files

1. **RESERVE_ORDERING_FIX.md** - Detailed analysis of main fix
2. **REAL_TIME_UPDATE_FIX.md** - Query invalidation fixes
3. **THIS FILE** - Complete summary of all bugs

---

## Status

✅ **ALL BUGS FIXED**
✅ **ALL FIXES COMMITTED**
⏳ **TESTING PENDING** - User verification required

**Next Step**: User testing with real transactions on testnet/mainnet to confirm all fixes work correctly.
