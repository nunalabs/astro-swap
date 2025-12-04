import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanServer, NETWORK_PASSPHRASE, server } from '../lib/stellar';
import { approveToken, CONTRACTS } from '../lib/contracts';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatErrorForToast } from '../lib/errors';

export type ApprovalStatus = 'unknown' | 'none' | 'pending' | 'approved' | 'error';

export interface TokenApprovalState {
  status: ApprovalStatus;
  allowance: string;
  isApproving: boolean;
  error: string | null;
}

/**
 * Get current allowance for a token
 */
async function getAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(tokenAddress);
    const ownerScVal = StellarSdk.nativeToScVal(ownerAddress, { type: 'address' });
    const spenderScVal = StellarSdk.nativeToScVal(spenderAddress, { type: 'address' });

    const sourceAccount = await server.loadAccount(ownerAddress);

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call('allowance', ownerScVal, spenderScVal))
      .setTimeout(30)
      .build();

    const result = await sorobanServer.simulateTransaction(transaction);

    if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result) && result.result?.retval) {
      const allowance = StellarSdk.scValToNative(result.result.retval);
      return allowance.toString();
    }

    return '0';
  } catch (error) {
    console.error('Error getting allowance:', error);
    return '0';
  }
}

/**
 * Hook for managing token approvals
 * Handles checking allowances, requesting approvals, and tracking status
 */
export function useTokenApproval(
  tokenAddress: string | null,
  spenderAddress: string,
  requiredAmount: string
) {
  const address = useWalletStore((state) => state.address);
  const addToast = useSettingsStore((state) => state.addToast);
  const queryClient = useQueryClient();

  // Query current allowance
  const {
    data: allowance,
    isLoading: isLoadingAllowance,
    refetch: refetchAllowance,
  } = useQuery({
    queryKey: ['allowance', tokenAddress, address, spenderAddress],
    queryFn: async () => {
      if (!tokenAddress || !address) return '0';
      return getAllowance(tokenAddress, address, spenderAddress);
    },
    enabled: !!tokenAddress && !!address && !!spenderAddress,
    staleTime: 10000, // 10 seconds
    // PERFORMANCE: Removed refetchInterval - allowance is invalidated after approval
    // via queryClient.invalidateQueries in onSuccess callback
    refetchOnWindowFocus: false, // Allowances rarely change without user action
  });

  // Determine approval status
  const getApprovalStatus = useCallback((): ApprovalStatus => {
    if (!tokenAddress || !address) return 'unknown';
    if (isLoadingAllowance) return 'unknown';
    if (!allowance) return 'none';

    try {
      const currentAllowance = BigInt(allowance);
      const required = BigInt(requiredAmount || '0');

      if (required === BigInt(0)) return 'approved'; // No approval needed if 0
      if (currentAllowance >= required) return 'approved';
      return 'none';
    } catch {
      return 'none';
    }
  }, [tokenAddress, address, isLoadingAllowance, allowance, requiredAmount]);

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async (amount: string) => {
      if (!tokenAddress || !address) {
        throw new Error('Token or wallet address not set');
      }

      return approveToken(tokenAddress, spenderAddress, amount, address);
    },
    onSuccess: () => {
      addToast({
        type: 'success',
        title: 'Approval Successful',
        description: 'Token spending approved. You can now proceed with the transaction.',
      });

      // Invalidate and refetch allowance
      queryClient.invalidateQueries({
        queryKey: ['allowance', tokenAddress, address, spenderAddress],
      });
    },
    onError: (error) => {
      const errorToast = formatErrorForToast(error);
      addToast(errorToast);
    },
  });

  // Approve function with optional custom amount
  const approve = useCallback(
    async (customAmount?: string) => {
      // Use a very large amount by default (max u128)
      const amount = customAmount || '340282366920938463463374607431768211455';
      return approveMutation.mutateAsync(amount);
    },
    [approveMutation]
  );

  // Approve exact amount (for users who prefer not to give unlimited approval)
  const approveExact = useCallback(
    async () => {
      return approveMutation.mutateAsync(requiredAmount);
    },
    [approveMutation, requiredAmount]
  );

  return {
    status: getApprovalStatus(),
    allowance: allowance || '0',
    isLoadingAllowance,
    isApproving: approveMutation.isPending,
    error: approveMutation.error?.message || null,
    approve,
    approveExact,
    refetchAllowance,
    needsApproval: getApprovalStatus() === 'none',
  };
}

/**
 * Hook for managing multiple token approvals (e.g., for add liquidity)
 */
export function useMultiTokenApproval(
  tokens: Array<{ address: string | null; amount: string }>,
  spenderAddress: string
) {
  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);

  const tokenApprovals = tokens.map((token) =>
    useTokenApproval(token.address, spenderAddress, token.amount)
  );

  const allApproved = tokenApprovals.every((approval) => approval.status === 'approved');
  const anyApproving = tokenApprovals.some((approval) => approval.isApproving);
  const tokensNeedingApproval = tokenApprovals
    .map((approval, index) => ({ ...approval, index, address: tokens[index].address }))
    .filter((approval) => approval.needsApproval);

  const approveNext = useCallback(async () => {
    const nextToken = tokensNeedingApproval[0];
    if (nextToken) {
      await nextToken.approve();
    }
  }, [tokensNeedingApproval]);

  return {
    tokenApprovals,
    allApproved,
    anyApproving,
    tokensNeedingApproval,
    approveNext,
    currentTokenIndex,
    setCurrentTokenIndex,
  };
}

/**
 * Pre-check if approval is needed for swap
 */
export function useSwapApproval(
  tokenInAddress: string | null,
  amountIn: string
) {
  return useTokenApproval(
    tokenInAddress,
    CONTRACTS.ROUTER,
    amountIn
  );
}

/**
 * Pre-check if approvals are needed for adding liquidity
 */
export function useLiquidityApproval(
  tokenAAddress: string | null,
  tokenBAddress: string | null,
  amountA: string,
  amountB: string
) {
  return useMultiTokenApproval(
    [
      { address: tokenAAddress, amount: amountA },
      { address: tokenBAddress, amount: amountB },
    ],
    CONTRACTS.ROUTER
  );
}
