/**
 * useSwapTransaction Hook
 * Handles swap mutation and transaction tracking
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../stores/settingsStore';
import { useTransactionStore } from '../stores/transactionStore';
import { swapExactTokensForTokens } from '../lib/contracts';
import { applySlippage } from '../lib/utils';
import { formatErrorForToast } from '../lib/errors';
import { HORIZON_SYNC_DELAY } from '../lib/constants';
import type { Token } from '../types';
import type { SwapQuoteData } from './useSwapQuote';

interface UseSwapTransactionOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  route: Token[];
  quoteData: SwapQuoteData | null;
  walletAddress: string | null;
  onSuccess?: () => void;
  onError?: () => void;
}

export function useSwapTransaction({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  route,
  quoteData,
  walletAddress,
  onSuccess,
  onError,
}: UseSwapTransactionOptions) {
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  const deadline = useSettingsStore((state) => state.deadline);
  const addToast = useSettingsStore((state) => state.addToast);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransaction = useTransactionStore((state) => state.updateTransaction);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tokenIn || !tokenOut || !walletAddress || !quoteData) {
        throw new Error('Missing required parameters');
      }

      const pathAddresses = route.map((t) => t.address);
      const rawAmountIn = quoteData.rawAmountIn;
      const rawAmountOutMin = applySlippage(quoteData.rawAmountOut, slippageTolerance);
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      console.log('Executing swap:', {
        rawAmountIn,
        rawAmountOutMin,
        path: pathAddresses,
        deadline: deadlineTimestamp,
      });

      return swapExactTokensForTokens(
        rawAmountIn,
        rawAmountOutMin,
        pathAddresses,
        walletAddress,
        deadlineTimestamp,
        walletAddress
      );
    },
    onMutate: () => {
      if (tokenIn && tokenOut) {
        const pendingHash = `pending-${Date.now()}`;
        addTransaction({
          hash: pendingHash,
          status: 'pending',
          details: {
            type: 'swap',
            tokenIn: tokenIn.symbol,
            tokenOut: tokenOut.symbol,
            amountIn,
            amountOut,
          },
        });
        return { pendingHash };
      }
    },
    onSuccess: async (txHash, _variables, context) => {
      if (context?.pendingHash) {
        updateTransaction(context.pendingHash, {
          hash: txHash,
          status: 'success',
        });
      }

      addToast({
        type: 'success',
        title: 'Swap Successful',
        description: `Swapped ${amountIn} ${tokenIn?.symbol} for ${tokenOut?.symbol}`,
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
        queryClient.invalidateQueries({ queryKey: ['allTokenBalances'] });
        queryClient.invalidateQueries({ queryKey: ['pools', walletAddress] });
        queryClient.invalidateQueries({ queryKey: ['swap-quote'] });
      }, HORIZON_SYNC_DELAY);

      onSuccess?.();
    },
    onError: (error, _variables, context) => {
      if (context?.pendingHash) {
        updateTransaction(context.pendingHash, {
          status: 'failed',
        });
      }

      const errorToast = formatErrorForToast(error);
      addToast(errorToast);

      onError?.();
    },
  });

  return {
    executeSwap: mutation.mutate,
    isSwapping: mutation.isPending,
    swapError: mutation.error,
    resetSwap: mutation.reset,
  };
}
