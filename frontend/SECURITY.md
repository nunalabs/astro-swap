# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities to the development team privately before public disclosure.

## Security Fixes (2026-03-19)

This release addresses **13 security vulnerabilities** across high, medium, and low severity levels.

### Critical Vulnerabilities Fixed

#### H-1: Race Condition in Swap Submission (TOCTOU)
**Severity**: High  
**Impact**: Duplicate transaction submissions, potential fund loss  
**Fix**: Atomic ref lock + async state for UI  
**File**: `src/hooks/useSwap.ts:256-260`

```typescript
const isSubmittingRef = useRef(false); // Atomic lock

if (isSubmittingRef.current) {
  console.warn('Swap already in progress');
  return;
}
```

#### H-2: Stale Quote TOCTOU Attack
**Severity**: High  
**Impact**: Users could execute swaps with outdated pricing  
**Fix**: 15-second timestamp validation before execution  
**File**: `src/hooks/useSwap.ts:293-303`

```typescript
const QUOTE_STALENESS_THRESHOLD = 15000; // 15 seconds
if (quoteData && quoteData.timestamp) {
  const age = Date.now() - quoteData.timestamp;
  if (age > QUOTE_STALENESS_THRESHOLD) {
    addToast({ type: 'warning', title: 'Quote Expired' });
    return;
  }
}
```

#### H-3: BigInt Overflow DoS
**Severity**: High  
**Impact**: Browser crash via memory exhaustion  
**Fix**: Input length validation (78 char max)  
**File**: `src/lib/utils.ts:93-96, 335-339`

```typescript
// H-3: Validate length to prevent BigInt DoS attacks
if (amountStr.length > 78) {
  throw new Error('Amount too large');
}
```

#### H-4: APR Calculation Precision Loss
**Severity**: High  
**Impact**: Incorrect APR displayed to users  
**Fix**: BigInt arithmetic instead of parseFloat  
**File**: `src/lib/utils.ts:387-417`

```typescript
const rewardRateBig = BigInt(rewardRate);
const totalStakedBig = BigInt(totalStaked);
const yearlyRewards = rewardRateBig * 31536000n;
```

### Medium Severity Vulnerabilities Fixed

#### M-3: Unsafe Settings Validation
**Severity**: Medium  
**Impact**: Invalid settings persisted, potential transaction failures  
**Fix**: Min/max validation for slippage (0-50%) and deadline (1-180min)  
**File**: `src/stores/settingsStore.ts:21-56`

#### M-4: Token Logo URI Injection
**Severity**: Medium  
**Impact**: XSS via malicious token logos (data:, javascript: URIs)  
**Fix**: HTTPS-only validation, reject dangerous schemes  
**File**: `src/lib/utils.ts:26-47`

```typescript
export function isValidLogoURI(uri: string | undefined): boolean {
  if (\!uri) return false;
  try {
    const url = new URL(uri);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
```

#### M-5: XSS via Token Metadata
**Severity**: Medium  
**Impact**: Malicious tokens could inject HTML/JavaScript  
**Fix**: HTML entity escaping for token symbols/names  
**File**: `src/lib/utils.ts:14-20`, `src/components/common/TokenSelector.tsx:195-202`

```typescript
export function sanitizeText(text: string): string {
  if (\!text) return '';
  const element = document.createElement('div');
  element.textContent = text;
  return element.innerHTML;
}
```

#### M-6: localStorage Corruption Crash
**Severity**: Medium  
**Impact**: App crash on corrupted user data  
**Fix**: Complete recovery (clear + reset + save)  
**File**: `src/stores/settingsStore.ts:134-146`

#### M-7: Unbounded Cache Growth
**Severity**: Medium  
**Impact**: Memory exhaustion via cache poisoning  
**Fix**: LRU cache with 1000 token limit  
**File**: `src/lib/lru-cache.ts`, `src/lib/token-indexer.ts:15-16`

### Low Severity Vulnerabilities Fixed

#### W3-1: Transaction Replay Attack
**Severity**: Low  
**Impact**: Duplicate transactions from double-clicks  
**Fix**: 5-minute replay window with signature tracking  
**File**: `src/lib/tx-replay-guard.ts`

#### W3-2: Stale Reserve Data
**Severity**: Low  
**Impact**: Incorrect price impact calculations  
**Fix**: 30-second staleness validation  
**File**: `src/lib/reserve-staleness.ts`

#### W3-3: Display/Contract Slippage Mismatch
**Severity**: Low  
**Impact**: User confusion about actual slippage enforcement  
**Fix**: Same BigInt calculation for display and contract  
**File**: `src/hooks/useSwap.ts:375-385`

## Security Best Practices

### Input Validation
- ✅ All user inputs validated before BigInt conversion
- ✅ Token addresses validated (56 chars, alphanumeric)
- ✅ Settings constrained to safe ranges

### XSS Protection
- ✅ Token metadata sanitized (HTML entities)
- ✅ Logo URIs validated (HTTPS-only)
- ✅ No dangerous innerHTML usage

### Race Condition Prevention
- ✅ Atomic locks for transaction submissions
- ✅ Timestamp validation for quotes and reserves
- ✅ Replay protection for all transaction types

### Memory Safety
- ✅ LRU caches prevent unbounded growth
- ✅ Input length validation prevents DoS
- ✅ Proper error recovery for corrupted data

## Security Recommendations

### For Users
1. **Always review transaction details** before confirming
2. **Check token addresses** for unknown tokens
3. **Use moderate slippage** (0.5-2%) to prevent frontrunning
4. **Monitor wallet activity** for unauthorized transactions

### For Developers
1. **Review all user inputs** before processing
2. **Use BigInt arithmetic** for all financial calculations
3. **Validate timestamps** for time-sensitive operations
4. **Test edge cases** (empty pools, zero amounts, max values)

## Audit History

- **2026-03-19**: Internal security review (13 vulnerabilities fixed)
- **2026-03-18**: Code quality audit (10 issues resolved)

## Security Tools

- TypeScript strict mode
- ESLint security plugins
- Manual code review
- Automated build verification

---

**Last Updated**: 2026-03-19  
**Security Contact**: [Report vulnerabilities privately]
