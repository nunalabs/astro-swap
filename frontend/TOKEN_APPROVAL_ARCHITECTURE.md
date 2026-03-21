# Token Approval Architecture - Production Solution

## Problem Analysis

### Root Cause
**Error #203 (MinimumNotMet)** occurs when:
1. User attempts `addLiquidity()`
2. Router calls `pair.deposit()`
3. Pair calls `token.transfer(&user, &pool, amount)`
4. **Token SAC rejects transfer** → No approval exists
5. Pair gets transfer error, throws MinimumNotMet

### Current Implementation Review

#### ✅ What Works:
1. **Hook Architecture** (useTokenApproval.ts):
   - `useTokenApproval()` - Single token approval
   - `useMultiTokenApproval()` - Multiple tokens
   - `useLiquidityApproval()` - Wrapper for add liquidity
   - Robust error handling, reentrancy protection

2. **UI Components** (Pool.tsx):
   - Approval status cards (lines 447-497)
   - "Approve [TOKEN]" button (lines 500-517)
   - "Add Liquidity" disabled when `!allApproved` (line 526)

#### ❌ Critical Gap - Race Condition:

**Line 444 of Pool.tsx**:
```tsx
{!allApproved && tokenA && tokenB && amountA && amountB && (
```

**Issue**: Approval UI only shows when `!allApproved`. This creates scenarios where:

1. **Scenario A - Cached Allowance**:
   - User approved tokens 2 minutes ago with amount X
   - React Query cache returns `allApproved = true` (stale data)
   - User increases amount to Y (Y > X)
   - Hook doesn't immediately detect insufficient allowance
   - "Add Liquidity" button enabled → Transaction fails

2. **Scenario B - Query Timing**:
   - `getAllowance()` takes 2-3 seconds (RPC call)
   - During this time: `isLoadingApprovals = true`
   - But button shows "Checking approvals..." (not disabled by loading state)
   - User can click → Transaction fails

3. **Scenario C - Amount Changes**:
   - Approvals checked for amounts A=100, B=50
   - User changes to A=200, B=100
   - useMemo updates `amountAForApproval`
   - But useQuery doesn't refetch (staleTime: 10s)
   - Button enabled with stale approval data → Transaction fails

---

## Production Architecture - Structural Solution

### Phase 1: Approval Flow State Machine

Create explicit state machine for approval flow:

```typescript
// lib/stellar/approval-flow.ts
export type ApprovalFlowState =
  | { type: 'IDLE' }
  | { type: 'CHECKING_ALLOWANCES' }
  | { type: 'NEEDS_APPROVALS'; tokensNeeding: string[] }
  | { type: 'APPROVING'; currentToken: string; progress: number; total: number }
  | { type: 'APPROVED'; canProceed: true }
  | { type: 'ERROR'; error: string };

export class ApprovalFlowManager {
  private state: ApprovalFlowState = { type: 'IDLE' };

  async checkApprovals(
    tokens: Array<{ address: string; requiredAmount: bigint }>,
    spenderAddress: string,
    ownerAddress: string
  ): Promise<ApprovalFlowState> {
    this.state = { type: 'CHECKING_ALLOWANCES' };

    const results = await Promise.all(
      tokens.map(async ({ address, requiredAmount }) => {
        const allowance = await this.getAllowance(address, ownerAddress, spenderAddress);
        return {
          address,
          needsApproval: BigInt(allowance) < requiredAmount,
          current: BigInt(allowance),
          required: requiredAmount,
        };
      })
    );

    const tokensNeeding = results
      .filter(r => r.needsApproval)
      .map(r => r.address);

    if (tokensNeeding.length > 0) {
      this.state = { type: 'NEEDS_APPROVALS', tokensNeeding };
    } else {
      this.state = { type: 'APPROVED', canProceed: true };
    }

    return this.state;
  }

  async approveNext(): Promise<void> {
    if (this.state.type !== 'NEEDS_APPROVALS') {
      throw new Error('Invalid state for approval');
    }

    const [currentToken, ...remaining] = this.state.tokensNeeding;
    const total = this.state.tokensNeeding.length;
    const progress = total - remaining.length;

    this.state = { type: 'APPROVING', currentToken, progress, total };

    try {
      await this.executeApproval(currentToken);

      if (remaining.length === 0) {
        this.state = { type: 'APPROVED', canProceed: true };
      } else {
        this.state = { type: 'NEEDS_APPROVALS', tokensNeeding: remaining };
      }
    } catch (error) {
      this.state = { type: 'ERROR', error: error.message };
      throw error;
    }
  }
}
```

### Phase 2: Approval Guard Hook

Wrapper hook that enforces approval flow:

```typescript
// hooks/useApprovalGuard.ts
import { useCallback, useEffect, useState } from 'react';
import { ApprovalFlowManager, ApprovalFlowState } from '../lib/stellar/approval-flow';

export function useApprovalGuard(
  tokens: Array<{ address: string; amount: string; decimals: number }>,
  spenderAddress: string
) {
  const [flowState, setFlowState] = useState<ApprovalFlowState>({ type: 'IDLE' });
  const [manager] = useState(() => new ApprovalFlowManager());
  const address = useWalletStore(state => state.address);

  // Check approvals whenever tokens or amounts change
  useEffect(() => {
    if (!address || tokens.length === 0) return;

    const check = async () => {
      const tokenAmounts = tokens.map(t => ({
        address: t.address,
        requiredAmount: BigInt(parseTokenAmount(t.amount, t.decimals)),
      }));

      const state = await manager.checkApprovals(tokenAmounts, spenderAddress, address);
      setFlowState(state);
    };

    check();
  }, [tokens, spenderAddress, address, manager]);

  const approveNext = useCallback(async () => {
    await manager.approveNext();
    const newState = manager.getState();
    setFlowState(newState);
  }, [manager]);

  const canProceed = flowState.type === 'APPROVED' && flowState.canProceed;
  const isApproving = flowState.type === 'APPROVING';
  const needsApproval = flowState.type === 'NEEDS_APPROVALS';

  return {
    flowState,
    canProceed,
    isApproving,
    needsApproval,
    approveNext,
  };
}
```

### Phase 3: Integration with Enterprise Architecture

Integrate with existing retry/cache/metrics:

```typescript
// lib/stellar/approval-flow.ts (enhanced)
import { withRetry } from './retry';
import { rpcCircuitBreaker } from './circuit-breaker';
import { metrics, measureTiming } from './metrics';
import { contractCallCache } from './cache';

export class ApprovalFlowManager {
  private async getAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<string> {
    // Check cache first
    const cached = contractCallCache.get(tokenAddress, 'allowance', [ownerAddress, spenderAddress]);
    if (cached !== undefined) {
      metrics.increment('approval.cache.hit', { token: tokenAddress });
      return cached;
    }

    // Call with retry + circuit breaker + metrics
    const allowance = await measureTiming(
      'approval.getAllowance',
      () => withRetry(
        () => rpcCircuitBreaker.execute(() =>
          callContract(tokenAddress, 'allowance', [
            nativeToScVal(ownerAddress, { type: 'address' }),
            nativeToScVal(spenderAddress, { type: 'address' }),
          ], ownerAddress)
        ),
        { maxAttempts: 3 }
      ),
      { token: tokenAddress }
    );

    // Cache for 30 seconds (allowances rarely change)
    contractCallCache.set(tokenAddress, 'allowance', [ownerAddress, spenderAddress], allowance.toString());

    return allowance.toString();
  }

  private async executeApproval(tokenAddress: string): Promise<void> {
    metrics.increment('approval.started', { token: tokenAddress });

    try {
      const result = await measureTiming(
        'approval.execute',
        () => buildAndSubmitTransaction({
          sourceAddress: this.ownerAddress,
          operations: [/* approve operation */],
          signer: this.signer,
        }),
        { token: tokenAddress }
      );

      if (result.confirmation.status === 'SUCCESS') {
        metrics.increment('approval.success', { token: tokenAddress });
        // Invalidate cache
        contractCallCache.invalidate(tokenAddress);
      } else {
        throw new Error(`Approval failed: ${result.confirmation.error}`);
      }
    } catch (error) {
      metrics.increment('approval.failed', { token: tokenAddress });
      throw error;
    }
  }
}
```

### Phase 4: UI Integration

Update Pool.tsx with approval guard:

```tsx
// pages/Pool.tsx
export function Pool() {
  // ... existing state ...

  // NEW: Use approval guard instead of direct useLiquidityApproval
  const {
    flowState,
    canProceed: canAddLiquidity,
    isApproving,
    needsApproval,
    approveNext,
  } = useApprovalGuard(
    [
      { address: tokenA?.address || '', amount: amountA, decimals: tokenA?.decimals || 7 },
      { address: tokenB?.address || '', amount: amountB, decimals: tokenB?.decimals || 7 },
    ],
    CONTRACTS.ROUTER
  );

  const handleAddLiquidity = useCallback(() => {
    // GUARD: Only proceed if approvals are confirmed
    if (!canAddLiquidity) {
      console.error('Cannot add liquidity: Approvals not confirmed');
      addToast({
        type: 'error',
        title: 'Approval Required',
        description: 'Please approve both tokens before adding liquidity.',
      });
      return;
    }

    if (tokenA && tokenB && amountA && amountB) {
      addLiquidity(
        { tokenA, tokenB, amountA, amountB, slippage: slippageTolerance },
        {
          onSuccess: () => {
            setShowAddModal(false);
            setAmountA('');
            setAmountB('');
          },
        }
      );
    }
  }, [canAddLiquidity, tokenA, tokenB, amountA, amountB, addLiquidity, slippageTolerance, addToast]);

  return (
    // ... modal ...
    <Modal isOpen={showAddModal} onClose={closeAddModal} title="Add Liquidity">
      {/* Approval Flow UI */}
      {flowState.type === 'CHECKING_ALLOWANCES' && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Checking token approvals...</span>
          </div>
        </div>
      )}

      {flowState.type === 'NEEDS_APPROVALS' && (
        <div className="space-y-3">
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-sm">Token approvals required before adding liquidity.</p>
          </div>

          <Button onClick={approveNext} fullWidth variant="secondary">
            Approve Next Token
          </Button>
        </div>
      )}

      {flowState.type === 'APPROVING' && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Approving token {flowState.progress}/{flowState.total}... Please confirm in wallet.</span>
          </div>
        </div>
      )}

      {flowState.type === 'ERROR' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">{flowState.error}</p>
          <Button onClick={approveNext} className="mt-3" variant="secondary">
            Retry
          </Button>
        </div>
      )}

      {/* Add Liquidity Button */}
      <Button
        onClick={handleAddLiquidity}
        fullWidth
        isLoading={isAddingLiquidity}
        disabled={!canAddLiquidity || isApproving}
      >
        {flowState.type === 'CHECKING_ALLOWANCES'
          ? 'Checking approvals...'
          : flowState.type === 'NEEDS_APPROVALS'
          ? 'Approve tokens first'
          : 'Add Liquidity'}
      </Button>
    </Modal>
  );
}
```

---

## Production Checklist

### ✅ Phase 1: Foundation (2-3 hours)
1. Create `lib/stellar/approval-flow.ts` - State machine
2. Add unit tests for state transitions
3. Integrate with retry/cache/circuit-breaker

### ✅ Phase 2: Hook Implementation (1-2 hours)
4. Create `hooks/useApprovalGuard.ts`
5. Add E2E tests for approval scenarios
6. Document API with JSDoc

### ✅ Phase 3: UI Integration (2-3 hours)
7. Update Pool.tsx to use useApprovalGuard
8. Add approval flow UI components
9. Test all scenarios (first liquidity, existing pool, amount changes)

### ✅ Phase 4: Edge Cases (1-2 hours)
10. Handle allowance expiration
11. Handle concurrent approvals (reentrancy)
12. Handle network failures during approval

### ✅ Phase 5: Production Validation (1-2 hours)
13. Test on testnet with real wallet
14. Monitor metrics dashboard
15. Verify no Error #203 occurs

**Total Effort**: ~8-12 hours for complete production solution

---

## Key Improvements Over Current Implementation

| Issue | Current | Production Solution |
|-------|---------|---------------------|
| Race conditions | ✗ Possible with stale cache | ✓ Explicit state machine |
| Amount changes | ✗ May not trigger re-check | ✓ useEffect watches amounts |
| Loading state | ✗ Button can be clicked during check | ✓ Guard prevents premature click |
| Error recovery | ✗ No retry for failed approvals | ✓ Integrated with retry logic |
| Observability | ✗ No metrics | ✓ Full metrics/monitoring |
| Cache invalidation | ✗ Manual invalidation | ✓ Automatic on approval success |

---

## Next Steps

1. **Implement Phase 1** (approval-flow.ts state machine)
2. **Test Phase 1** with unit tests
3. **Implement Phase 2** (useApprovalGuard hook)
4. **Integrate Phase 3** (Pool.tsx UI)
5. **Validate end-to-end** on testnet

This is a **complete structural solution** for production, not a patch.
