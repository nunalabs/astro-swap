import { useState, useCallback, useEffect } from 'react';
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
 * FIXED: No longer violates Rules of Hooks by calling hooks in a loop
 */
export function useMultiTokenApproval(
  tokens: Array<{ address: string | null; amount: string }>,
  spenderAddress: string
) {
  const address = useWalletStore((state) => state.address);
  const addToast = useSettingsStore((state) => state.addToast);
  const queryClient = useQueryClient();

  // Single state object to track all token approvals
  const [approvalStates, setApprovalStates] = useState<
    Map<string, { allowance: string; isApproving: boolean; error: string | null }>
  >(new Map());

  const [currentTokenIndex, setCurrentTokenIndex] = useState(0);

  // Fetch all allowances in parallel using React Query
  const allowanceQueries = useQuery({
    queryKey: ['multi-allowances', tokens.map(t => t.address).join(','), address, spenderAddress],
    queryFn: async () => {
      if (!address || tokens.length === 0) return new Map();

      const results = await Promise.all(
        tokens.map(async (token) => {
          if (!token.address) return { address: null, allowance: '0' };
          try {
            const allowance = await getAllowance(token.address, address, spenderAddress);
            return { address: token.address, allowance };
          } catch {
            return { address: token.address, allowance: '0' };
          }
        })
      );

      const allowanceMap = new Map<string, { allowance: string; isApproving: boolean; error: string | null }>();
      results.forEach((result) => {
        if (result.address) {
          allowanceMap.set(result.address, {
            allowance: result.allowance,
            isApproving: false,
            error: null,
          });
        }
      });

      return allowanceMap;
    },
    enabled: !!address && tokens.length > 0 && tokens.some(t => t.address !== null),
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (allowanceQueries.data) {
      setApprovalStates(allowanceQueries.data);
    }
  }, [allowanceQueries.data]);

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: async ({ tokenAddress, amount }: { tokenAddress: string; amount: string }) => {
      if (!address) throw new Error('Wallet not connected');
      return approveToken(tokenAddress, spenderAddress, amount, address);
    },
    onMutate: ({ tokenAddress }) => {
      // Optimistically update state
      setApprovalStates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tokenAddress) || { allowance: '0', isApproving: false, error: null };
        newMap.set(tokenAddress, { ...existing, isApproving: true, error: null });
        return newMap;
      });
    },
    onSuccess: (_, { tokenAddress }) => {
      addToast({
        type: 'success',
        title: 'Approval Successful',
        description: 'Token spending approved.',
      });

      // Refetch all allowances
      queryClient.invalidateQueries({
        queryKey: ['multi-allowances', tokens.map(t => t.address).join(','), address, spenderAddress],
      });
    },
    onError: (error, { tokenAddress }) => {
      const errorToast = formatErrorForToast(error);
      addToast(errorToast);

      setApprovalStates((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(tokenAddress) || { allowance: '0', isApproving: false, error: null };
        newMap.set(tokenAddress, {
          ...existing,
          isApproving: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return newMap;
      });
    },
  });

  // Check approval status for each token
  const tokenApprovals = tokens.map((token, index) => {
    if (!token.address) {
      return {
        status: 'unknown' as ApprovalStatus,
        allowance: '0',
        isApproving: false,
        error: null,
        needsApproval: false,
        approve: async () => {},
        index,
        address: null,
      };
    }

    const state = approvalStates.get(token.address);
    const allowance = state?.allowance || '0';
    const isApproving = state?.isApproving || false;
    const error = state?.error || null;

    let status: ApprovalStatus = 'unknown';
    let needsApproval = false;

    if (!allowanceQueries.isLoading && state) {
      try {
        const currentAllowance = BigInt(allowance);
        const required = BigInt(token.amount || '0');

        if (required === BigInt(0)) {
          status = 'approved';
        } else if (currentAllowance >= required) {
          status = 'approved';
        } else {
          status = 'none';
          needsApproval = true;
        }
      } catch {
        status = 'none';
        needsApproval = true;
      }
    }

    return {
      status,
      allowance,
      isApproving,
      error,
      needsApproval,
      approve: async () => {
        // Use max u128 for unlimited approval
        await approveMutation.mutateAsync({
          tokenAddress: token.address!,
          amount: '340282366920938463463374607431768211455',
        });
      },
      index,
      address: token.address,
    };
  });

  const allApproved = tokenApprovals.every((approval) => approval.status === 'approved');
  const anyApproving = tokenApprovals.some((approval) => approval.isApproving);
  const tokensNeedingApproval = tokenApprovals.filter((approval) => approval.needsApproval);

  const approveNext = useCallback(async () => {
    const nextToken = tokensNeedingApproval[0];
    if (nextToken && nextToken.address) {
      await approveMutation.mutateAsync({
        tokenAddress: nextToken.address,
        amount: '340282366920938463463374607431768211455',
      });
    }
  }, [tokensNeedingApproval, approveMutation]);

  return {
    tokenApprovals,
    allApproved,
    anyApproving,
    tokensNeedingApproval,
    approveNext,
    currentTokenIndex,
    setCurrentTokenIndex,
    isLoading: allowanceQueries.isLoading,
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
