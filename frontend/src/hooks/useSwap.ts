import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTransactionStore } from '../stores/transactionStore';
import { getAmountsOut, swapExactTokensForTokens, calculateOptimalPath } from '../lib/contracts';
import { calculatePriceImpact, parseTokenAmount, formatTokenAmount } from '../lib/utils';
import { formatErrorForToast } from '../lib/errors';
import { useSwapSimulation } from './useSimulation';
import type { Token } from '../types';

export function useSwap(tokenIn: Token | null, tokenOut: Token | null) {
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [priceImpact, setPriceImpact] = useState(0);
  const [route, setRoute] = useState<Token[]>([]);

  const walletAddress = useWalletStore((state) => state.address);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);

  // Use a fallback address for quotes when wallet is not connected
  // This allows users to see rates before connecting
  // Using a valid funded testnet address for simulation
  const QUOTE_FALLBACK_ADDRESS = 'GAYES36VZUWL437CC2IIJ7OUCWYWESEOJ6GITMTCHEF6OOYWIUNBKVXI';
  const address = walletAddress || QUOTE_FALLBACK_ADDRESS;
  const deadline = useSettingsStore((state) => state.deadline);
  const addToast = useSettingsStore((state) => state.addToast);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const updateTransaction = useTransactionStore((state) => state.updateTransaction);
  const queryClient = useQueryClient();

  // Simulation hook for pre-validating transactions
  const { simulateSwap, isSimulating, error: simulationError, reset: resetSimulation } = useSwapSimulation();

  // Fetch quote when input amount changes
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['swap-quote', tokenIn?.address, tokenOut?.address, amountIn],
    queryFn: async () => {
      if (!tokenIn || !tokenOut || !amountIn || !address) return null;

      // Convert human-readable input to raw units
      const rawAmountIn = parseTokenAmount(amountIn, tokenIn.decimals);

      // Calculate optimal path
      const path = calculateOptimalPath(tokenIn, tokenOut, []); // Pass actual pools
      const pathAddresses = path.map((t) => t.address);

      // Get amounts out using raw units
      const amounts = await getAmountsOut(rawAmountIn, pathAddresses, address);

      if (!amounts || amounts.length === 0) return null;

      // Output is in raw units, convert back to human-readable for display
      const rawOutputAmount = amounts[amounts.length - 1];
      const outputAmount = formatTokenAmount(rawOutputAmount, tokenOut.decimals, 7);

      // Calculate price impact (simplified)
      const impact = calculatePriceImpact('1000000', '1000000', rawAmountIn);

      return {
        amountOut: outputAmount,
        rawAmountIn,
        rawAmountOut: rawOutputAmount,
        priceImpact: impact,
        path: path,
      };
    },
    enabled: !!tokenIn && !!tokenOut && !!amountIn && parseFloat(amountIn) > 0 && !!address,
    staleTime: 10000, // 10 seconds
  });

  // Update output amount when quote changes
  useEffect(() => {
    if (quoteData) {
      setAmountOut(quoteData.amountOut);
      setPriceImpact(quoteData.priceImpact);
      setRoute(quoteData.path);
    } else {
      setAmountOut('');
      setPriceImpact(0);
      setRoute([]);
    }
  }, [quoteData]);

  // Swap mutation
  const swapMutation = useMutation({
    mutationFn: async () => {
      if (!tokenIn || !tokenOut || !walletAddress || !quoteData) {
        throw new Error('Missing required parameters');
      }

      const pathAddresses = route.map((t) => t.address);
      // Use raw amounts for the swap, calculate minimum with slippage
      const rawAmountIn = quoteData.rawAmountIn;
      // Calculate slippage: multiply by (100 - slippage) / 100
      // Use integer math: multiply by (10000 - slippage*100) / 10000
      const slippageBps = Math.floor(slippageTolerance * 100);
      const rawAmountOutMin = (
        BigInt(quoteData.rawAmountOut) * BigInt(10000 - slippageBps) / 10000n
      ).toString();
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
      // Add pending transaction to tracker
      if (tokenIn && tokenOut) {
        const pendingHash = `pending-${Date.now()}`;
        addTransaction({
          hash: pendingHash,
          type: 'swap',
          status: 'pending',
          details: {
            tokenIn: tokenIn.symbol,
            tokenOut: tokenOut.symbol,
            amountIn,
            amountOut,
          },
        });
        return { pendingHash };
      }
    },
    onSuccess: (txHash, _variables, context) => {
      // Update transaction with real hash and success status
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

      // PERFORMANCE: Invalidate balance queries instead of polling
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['token-balances'] });
      queryClient.invalidateQueries({ queryKey: ['allTokenBalances'] });

      // Reset form
      setAmountIn('');
      setAmountOut('');
    },
    onError: (error, _variables, context) => {
      // Update transaction to failed status
      if (context?.pendingHash) {
        updateTransaction(context.pendingHash, {
          status: 'failed',
        });
      }

      const errorToast = formatErrorForToast(error);
      addToast(errorToast);
    },
  });

  // Direct input handler - no debounce needed, useQuery handles caching
  const handleAmountInChange = useCallback((value: string) => {
    setAmountIn(value);
  }, []);

  // Pre-validate swap with simulation before confirming
  const validateSwap = useCallback(async (): Promise<boolean> => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !walletAddress || !quoteData) {
      return false;
    }

    const pathAddresses = route.map((t) => t.address);
    // Use raw amounts for validation
    const rawAmountIn = quoteData.rawAmountIn;
    // Calculate slippage: multiply by (100 - slippage) / 100
    // Use integer math: multiply by (10000 - slippage*100) / 10000
    const slippageBps = Math.floor(slippageTolerance * 100);
    const rawAmountOutMin = (
      BigInt(quoteData.rawAmountOut) * BigInt(10000 - slippageBps) / 10000n
    ).toString();
    const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

    const result = await simulateSwap({
      amountIn: rawAmountIn,
      amountOutMin: rawAmountOutMin,
      path: pathAddresses,
      to: walletAddress,
      deadline: deadlineTimestamp,
    });

    if (!result.success && result.error) {
      addToast({
        type: 'error',
        title: 'Swap Will Fail',
        description: result.error,
      });
      return false;
    }

    return true;
  }, [tokenIn, tokenOut, amountIn, amountOut, walletAddress, route, slippageTolerance, deadline, simulateSwap, addToast, quoteData]);

  const swap = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut) {
      addToast({
        type: 'warning',
        title: 'Invalid Input',
        description: 'Please enter valid amounts',
      });
      return;
    }

    // Pre-validate with simulation
    const isValid = await validateSwap();
    if (!isValid) {
      return;
    }

    swapMutation.mutate();
  }, [tokenIn, tokenOut, amountIn, amountOut, swapMutation, addToast, validateSwap]);

  const switchTokens = useCallback(() => {
    setAmountIn(amountOut);
    setAmountOut(amountIn);
  }, [amountIn, amountOut]);

  return {
    amountIn,
    amountOut,
    priceImpact,
    route,
    isLoadingQuote,
    isSwapping: swapMutation.isPending,
    isSimulating,
    simulationError,
    setAmountIn: handleAmountInChange,
    setAmountOut,
    swap,
    validateSwap,
    switchTokens,
    resetSimulation,
  };
}
