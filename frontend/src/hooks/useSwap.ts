/**
 * useSwap Hook - Main Swap Interface
 *
 * Composes useSwapQuote, useSwapTransaction, and useSwapValidation
 * for a complete swap experience.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSwapQuote } from './useSwapQuote';
import { useSwapTransaction } from './useSwapTransaction';
import { useSwapValidation } from './useSwapValidation';
import type { Token } from '../types';

export function useSwap(tokenIn: Token | null, tokenOut: Token | null) {
  const [amountIn, setAmountIn] = useState('');
  const [amountOut, setAmountOut] = useState('');
  const [priceImpact, setPriceImpact] = useState(0);
  const [route, setRoute] = useState<Token[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Atomic lock to prevent race conditions
  const isSubmittingRef = useRef(false);

  const walletAddress = useWalletStore((state) => state.address);
  const addToast = useSettingsStore((state) => state.addToast);

  // Quote hook
  const { quoteData, isLoadingQuote } = useSwapQuote({
    tokenIn,
    tokenOut,
    amountIn,
    walletAddress,
  });

  // Update output when quote changes
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

  // Transaction hook
  const { executeSwap, isSwapping: isMutating } = useSwapTransaction({
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    route,
    quoteData: quoteData ?? null,
    walletAddress,
    onSuccess: () => {
      setAmountIn('');
      setAmountOut('');
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    },
    onError: () => {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    },
  });

  // Validation hook
  const {
    validateInputs,
    checkReplayGuard,
    simulateTransaction,
    calculateMinimumReceived,
    isSimulating,
    simulationError,
    resetSimulation,
  } = useSwapValidation({
    tokenIn,
    tokenOut,
    amountIn,
    amountOut,
    route,
    quoteData: quoteData ?? null,
    walletAddress,
  });

  const handleAmountInChange = useCallback((value: string) => {
    setAmountIn(value);
  }, []);

  const swap = useCallback(async () => {
    // Atomic guard against concurrent submissions
    if (isSubmittingRef.current) {
      console.warn('Swap already in progress');
      return;
    }

    // Validate inputs
    const validation = validateInputs();
    if (!validation.valid) {
      addToast({
        type: 'warning',
        title: 'Invalid Input',
        description: validation.error || 'Please check your inputs',
      });
      return;
    }

    // Check replay guard
    if (checkReplayGuard()) {
      addToast({
        type: 'warning',
        title: 'Duplicate Transaction',
        description: 'This transaction was recently submitted. Please wait.',
      });
      return;
    }

    // Lock submission
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Pre-validate with simulation
      const isValid = await simulateTransaction();
      if (!isValid) {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      executeSwap();
    } catch (error) {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      throw error;
    }
  }, [validateInputs, checkReplayGuard, simulateTransaction, executeSwap, addToast]);

  const switchTokens = useCallback(() => {
    setAmountIn(amountOut);
    setAmountOut(amountIn);
  }, [amountIn, amountOut]);

  return {
    amountIn,
    amountOut,
    minimumReceived: calculateMinimumReceived(),
    priceImpact,
    route,
    isLoadingQuote,
    isSwapping: isMutating || isSubmitting,
    isSimulating,
    simulationError,
    setAmountIn: handleAmountInChange,
    setAmountOut,
    swap,
    validateSwap: simulateTransaction,
    switchTokens,
    resetSimulation,
  };
}
