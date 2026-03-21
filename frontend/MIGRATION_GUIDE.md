# Frontend Migration Guide - API Changes

## Overview

Security fixes applied to the smart contracts have introduced breaking changes to the API. This guide helps you update the frontend to use the new API.

**Date**: 2026-03-11
**Affected Contracts**: Pair, Staking

---

## 1. Pair Contract - deposit() and withdraw()

### New Parameters

Both `deposit()` and `withdraw()` now require a `deadline` parameter for MEV protection.

### Before:

```typescript
// ❌ OLD API - No longer works
await pairClient.deposit(
  userAddress,
  amount0Desired,
  amount1Desired,
  amount0Min,
  amount1Min
);

await pairClient.withdraw(
  userAddress,
  shares,
  amount0Min,
  amount1Min
);
```

### After:

```typescript
// ✅ NEW API - With deadline
const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes from now

await pairClient.deposit(
  userAddress,
  amount0Desired,
  amount1Desired,
  amount0Min,
  amount1Min,
  deadline  // NEW
);

await pairClient.withdraw(
  userAddress,
  shares,
  amount0Min,
  amount1Min,
  deadline  // NEW
);
```

### Implementation Example:

```typescript
// hooks/useLiquidity.ts
import { useCallback } from 'react';
import { usePairClient } from './usePairClient';

export function useLiquidity() {
  const pairClient = usePairClient();

  const addLiquidity = useCallback(async (
    amount0: bigint,
    amount1: bigint,
    slippageBps: number = 50  // 0.5% default
  ) => {
    // Calculate minimum amounts (slippage protection)
    const amount0Min = (amount0 * BigInt(10000 - slippageBps)) / 10000n;
    const amount1Min = (amount1 * BigInt(10000 - slippageBps)) / 10000n;

    // Calculate deadline (5 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 300;

    return await pairClient.deposit(
      userAddress,
      amount0,
      amount1,
      amount0Min,
      amount1Min,
      deadline
    );
  }, [pairClient, userAddress]);

  const removeLiquidity = useCallback(async (
    shares: bigint,
    slippageBps: number = 50
  ) => {
    // Get expected amounts
    const { amount0, amount1 } = await pairClient.calculateWithdrawalAmounts(shares);

    // Apply slippage
    const amount0Min = (amount0 * BigInt(10000 - slippageBps)) / 10000n;
    const amount1Min = (amount1 * BigInt(10000 - slippageBps)) / 10000n;

    // Calculate deadline
    const deadline = Math.floor(Date.now() / 1000) + 300;

    return await pairClient.withdraw(
      userAddress,
      shares,
      amount0Min,
      amount1Min,
      deadline
    );
  }, [pairClient, userAddress]);

  return { addLiquidity, removeLiquidity };
}
```

---

## 2. Staking Contract - fundRewards()

### New Access Control

The `fundRewards()` function now requires admin authentication. Only the contract admin can fund rewards.

### Before:

```typescript
// ❌ OLD API - Anyone could call
await stakingClient.fundRewards(
  funderAddress,  // Could be any address
  amount
);
```

### After:

```typescript
// ✅ NEW API - Admin only
await stakingClient.fundRewards(
  adminAddress,   // MUST be contract admin
  amount
);
```

### UI Implementation:

```typescript
// components/Staking/AdminPanel.tsx
import { useWallet } from '@/hooks/useWallet';
import { useStakingAdmin } from '@/hooks/useStakingAdmin';
import { Button } from '@/components/common/Button';

export function StakingAdminPanel() {
  const { address } = useWallet();
  const { isAdmin, fundRewards } = useStakingAdmin();

  const handleFundRewards = async (amount: bigint) => {
    if (!isAdmin) {
      throw new Error('Only admin can fund rewards');
    }

    try {
      await fundRewards(address, amount);
      // Success notification
    } catch (error) {
      // Error handling
    }
  };

  // Only show to admin
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="admin-panel">
      <h3>Fund Rewards (Admin Only)</h3>
      {/* Fund rewards form */}
    </div>
  );
}
```

### Hook Example:

```typescript
// hooks/useStakingAdmin.ts
import { useState, useEffect } from 'react';
import { useStakingClient } from './useStakingClient';
import { useWallet } from './useWallet';

export function useStakingAdmin() {
  const stakingClient = useStakingClient();
  const { address } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (!address) {
        setIsAdmin(false);
        return;
      }

      try {
        const adminAddress = await stakingClient.call('admin');
        setIsAdmin(address.toLowerCase() === adminAddress.toLowerCase());
      } catch {
        setIsAdmin(false);
      }
    }

    checkAdmin();
  }, [address, stakingClient]);

  const fundRewards = async (adminAddr: string, amount: bigint) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admin can fund rewards');
    }

    return await stakingClient.fundRewards(adminAddr, amount);
  };

  return { isAdmin, fundRewards };
}
```

---

## 3. Deadline Utilities

Create a utility file for deadline calculation:

```typescript
// lib/deadlines.ts

/**
 * Default deadline: 5 minutes from now
 */
export const DEFAULT_DEADLINE_SECONDS = 300;

/**
 * Calculate deadline timestamp
 *
 * @param secondsFromNow - Seconds from now (default: 5 minutes)
 * @returns Unix timestamp
 */
export function calculateDeadline(secondsFromNow: number = DEFAULT_DEADLINE_SECONDS): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

/**
 * Check if deadline has expired
 *
 * @param deadline - Unix timestamp
 * @returns true if expired
 */
export function isDeadlineExpired(deadline: number): boolean {
  return Math.floor(Date.now() / 1000) > deadline;
}

/**
 * Format deadline for display
 *
 * @param deadline - Unix timestamp
 * @returns Human readable string
 */
export function formatDeadline(deadline: number): string {
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = deadline - now;

  if (secondsLeft <= 0) {
    return 'Expired';
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
```

---

## 4. Error Handling

### New Error Codes

```typescript
// lib/errors.ts

export enum AstroSwapError {
  // Existing errors...
  DeadlineExpired = 301,
  KInvariantViolation = 307,  // NEW
  // ... other errors
}

export function handleContractError(error: any): string {
  // Extract error code from Soroban error
  const errorCode = extractErrorCode(error);

  switch (errorCode) {
    case AstroSwapError.DeadlineExpired:
      return 'Transaction deadline expired. Please try again.';

    case AstroSwapError.KInvariantViolation:
      return 'Invalid swap: AMM invariant violated. This should not happen - contact support.';

    // ... other error codes

    default:
      return 'Transaction failed. Please try again.';
  }
}
```

---

## 5. Testing Checklist

Before deploying to production:

- [ ] Test deposit with deadline parameter
- [ ] Test withdraw with deadline parameter
- [ ] Verify deadline expiry shows correct error
- [ ] Test fundRewards with admin account (should work)
- [ ] Test fundRewards with non-admin account (should fail)
- [ ] Verify admin panel only shows for admin users
- [ ] Test deadline utilities (calculate, format, check expiry)
- [ ] Verify error messages are user-friendly

---

## 6. Migration Timeline

1. **Immediate**: Update SDK (already done)
2. **Week 1**: Update frontend hooks and utilities
3. **Week 1**: Add deadline UI components
4. **Week 1**: Implement admin checks for staking
5. **Week 2**: Testing on testnet
6. **Week 2**: Deploy to production

---

## 7. Backward Compatibility

**Important**: There is NO backward compatibility. The old API will not work after the contracts are upgraded.

**Migration Strategy**:
1. Deploy new contracts to testnet
2. Update frontend for testnet
3. Test thoroughly on testnet
4. Schedule maintenance window for mainnet
5. Deploy contracts and frontend to mainnet simultaneously

---

## 8. User Communication

Inform users about:
- Brief downtime during contract upgrade
- New MEV protection on liquidity operations
- Enhanced security on staking rewards

**Example notification**:
```
🔒 Security Upgrade Complete

We've enhanced security for liquidity operations:
- MEV protection on deposits/withdrawals
- Admin-only reward funding

Your funds are safe. No action required.
```

---

## Questions?

Contact the development team or refer to:
- Security fixes: `SECURITY_FIXES_2026-03-11.md`
- Full audit: `SECURITY_AUDIT_COMPLETE_2026-03-11.md`
