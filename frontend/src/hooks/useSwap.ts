import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getAmountsOut, swapExactTokensForTokens, calculateOptimalPath } from '../lib/contracts';
import { calculatePriceImpact, calculateMinimumReceived, debounce } from '../lib/utils';
import type { Token } from '../types';

export function useSwap(tokenIn: Token | null, tokenOut: Token | null) {
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [priceImpact, setPriceImpact] = useState(0);
  const [route, setRoute] = useState<Token[]>([]);

  const address = useWalletStore((state) => state.address);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  const deadline = useSettingsStore((state) => state.deadline);
  const addToast = useSettingsStore((state) => state.addToast);

  // Fetch quote when input amount changes
  const { data: quoteData, isLoading: isLoadingQuote } = useQuery({
    queryKey: ['swap-quote', tokenIn?.address, tokenOut?.address, amountIn],
    queryFn: async () => {
      if (!tokenIn || !tokenOut || !amountIn || !address) return null;

      // Calculate optimal path
      const path = calculateOptimalPath(tokenIn, tokenOut, []); // Pass actual pools
      const pathAddresses = path.map((t) => t.address);

      // Get amounts out
      const amounts = await getAmountsOut(amountIn, pathAddresses, address);

      if (!amounts || amounts.length === 0) return null;

      const outputAmount = amounts[amounts.length - 1];

      // Calculate price impact (simplified)
      const impact = calculatePriceImpact('1000000', '1000000', amountIn);

      return {
        amountOut: outputAmount,
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
      if (!tokenIn || !tokenOut || !address) {
        throw new Error('Missing required parameters');
      }

      const pathAddresses = route.map((t) => t.address);
      const minimumReceived = calculateMinimumReceived(amountOut, slippageTolerance);
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      return swapExactTokensForTokens(
        amountIn,
        minimumReceived,
        pathAddresses,
        address,
        deadlineTimestamp,
        address
      );
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Swap Successful',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Reset form
      setAmountIn('');
      setAmountOut('');
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Swap Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  // Debounced input handler
  const handleAmountInChange = useCallback(
    debounce((value: unknown) => {
      setAmountIn(String(value));
    }, 500),
    []
  );

  const swap = useCallback(() => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut) {
      addToast({
        type: 'warning',
        title: 'Invalid Input',
        description: 'Please enter valid amounts',
      });
      return;
    }

    swapMutation.mutate();
  }, [tokenIn, tokenOut, amountIn, amountOut, swapMutation, addToast]);

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
    setAmountIn: handleAmountInChange,
    setAmountOut,
    swap,
    switchTokens,
  };
}
