/**
 * useSwapValidation Hook
 * Handles swap validation, simulation, and guards
 */

import { useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useSwapSimulation } from './useSimulation';
import { parseTokenAmount, formatTokenAmount, applySlippage } from '../lib/utils';
import { isReplayTransaction } from '../lib/tx-replay-guard';
import { MIN_TRADE_AMOUNT } from '../lib/constants/protocol';
import type { Token } from '../types';
import type { SwapQuoteData } from './useSwapQuote';

interface UseSwapValidationOptions {
  tokenIn: Token | null;
  tokenOut: Token | null;
  amountIn: string;
  amountOut: string;
  route: Token[];
  quoteData: SwapQuoteData | null;
  walletAddress: string | null;
}

const QUOTE_STALENESS_THRESHOLD = 15000; // 15 seconds

export function useSwapValidation({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  route,
  quoteData,
  walletAddress,
}: UseSwapValidationOptions) {
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  const deadline = useSettingsStore((state) => state.deadline);
  const addToast = useSettingsStore((state) => state.addToast);
  const { simulateSwap, isSimulating, error: simulationError, reset: resetSimulation } = useSwapSimulation();

  const validateInputs = useCallback((): { valid: boolean; error?: string } => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut) {
      return { valid: false, error: 'Please enter valid amounts' };
    }

    // Validate minimum trade amount
    try {
      const rawAmountIn = parseTokenAmount(amountIn, tokenIn.decimals);
      if (BigInt(rawAmountIn) < MIN_TRADE_AMOUNT) {
        return {
          valid: false,
          error: `Minimum trade amount is ${formatTokenAmount(MIN_TRADE_AMOUNT.toString(), 7, 4)} tokens`,
        };
      }
    } catch {
      return { valid: false, error: 'Could not parse trade amount' };
    }

    // Check quote staleness
    if (quoteData?.timestamp) {
      const age = Date.now() - quoteData.timestamp;
      if (age > QUOTE_STALENESS_THRESHOLD) {
        return { valid: false, error: 'Quote expired. Please refresh.' };
      }
    }

    // Check wallet connection
    if (!walletAddress) {
      return { valid: false, error: 'Please connect your wallet' };
    }

    return { valid: true };
  }, [tokenIn, tokenOut, amountIn, amountOut, quoteData, walletAddress]);

  const checkReplayGuard = useCallback((): boolean => {
    if (!tokenIn || !tokenOut || !walletAddress || !quoteData) return false;

    const pathAddresses = route.map((t) => t.address);
    const rawAmountIn = quoteData.rawAmountIn;
    const rawAmountOutMin = applySlippage(quoteData.rawAmountOut, slippageTolerance);

    return isReplayTransaction('swap', walletAddress, {
      tokenIn: tokenIn.address,
      tokenOut: tokenOut.address,
      amountIn: rawAmountIn,
      amountOutMin: rawAmountOutMin,
      path: pathAddresses,
    });
  }, [tokenIn, tokenOut, walletAddress, route, quoteData, slippageTolerance]);

  const simulateTransaction = useCallback(async (): Promise<boolean> => {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut || !walletAddress || !quoteData) {
      return false;
    }

    const pathAddresses = route.map((t) => t.address);
    const rawAmountIn = quoteData.rawAmountIn;
    const rawAmountOutMin = applySlippage(quoteData.rawAmountOut, slippageTolerance);
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
  }, [tokenIn, tokenOut, amountIn, amountOut, walletAddress, route, quoteData, slippageTolerance, deadline, simulateSwap, addToast]);

  const calculateMinimumReceived = useCallback((): string => {
    if (!tokenOut || !quoteData?.rawAmountOut) return '0';

    try {
      const rawMinimum = applySlippage(quoteData.rawAmountOut, slippageTolerance);
      return formatTokenAmount(rawMinimum, tokenOut.decimals, 6);
    } catch {
      return '0';
    }
  }, [tokenOut, quoteData, slippageTolerance]);

  return {
    validateInputs,
    checkReplayGuard,
    simulateTransaction,
    calculateMinimumReceived,
    isSimulating,
    simulationError,
    resetSimulation,
  };
}
