import { useState, useCallback } from 'react';
import * as StellarSdk from '@stellar/stellar-sdk';
import { simulateTransaction, type SimulationResult } from '../lib/stellar';
import { CONTRACTS } from '../lib/contracts';
import { useWalletStore } from '../stores/walletStore';

export interface SwapSimulationParams {
  amountIn: string;
  amountOutMin: string;
  path: string[];
  to: string;
  deadline: number;
}

export interface SimulationState {
  isSimulating: boolean;
  result: SimulationResult | null;
  error: string | null;
}

/**
 * Hook for simulating swap transactions before submission
 * Validates that the swap will succeed before asking user to sign
 */
export function useSwapSimulation() {
  const [state, setState] = useState<SimulationState>({
    isSimulating: false,
    result: null,
    error: null,
  });

  const address = useWalletStore((state) => state.address);

  const simulateSwap = useCallback(async (params: SwapSimulationParams): Promise<SimulationResult> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    setState({ isSimulating: true, result: null, error: null });

    try {
      const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

      const amountInScVal = StellarSdk.nativeToScVal(params.amountIn, { type: 'u128' });
      const amountOutMinScVal = StellarSdk.nativeToScVal(params.amountOutMin, { type: 'u128' });
      const pathScVal = StellarSdk.nativeToScVal(
        params.path.map(addr => ({ type: 'address', value: addr })),
        { type: 'vec' }
      );
      const toScVal = StellarSdk.nativeToScVal(params.to, { type: 'address' });
      const deadlineScVal = StellarSdk.nativeToScVal(params.deadline, { type: 'u64' });

      const operation = contract.call(
        'swap_exact_tokens_for_tokens',
        amountInScVal,
        amountOutMinScVal,
        pathScVal,
        toScVal,
        deadlineScVal
      );

      const result = await simulateTransaction(address, [operation]);

      setState({ isSimulating: false, result, error: result.success ? null : result.error || null });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Simulation failed';
      setState({ isSimulating: false, result: null, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [address]);

  const reset = useCallback(() => {
    setState({ isSimulating: false, result: null, error: null });
  }, []);

  return {
    ...state,
    simulateSwap,
    reset,
  };
}

/**
 * Hook for simulating add liquidity transactions
 */
export function useAddLiquiditySimulation() {
  const [state, setState] = useState<SimulationState>({
    isSimulating: false,
    result: null,
    error: null,
  });

  const address = useWalletStore((state) => state.address);

  const simulateAddLiquidity = useCallback(async (params: {
    tokenA: string;
    tokenB: string;
    amountADesired: string;
    amountBDesired: string;
    amountAMin: string;
    amountBMin: string;
    to: string;
    deadline: number;
  }): Promise<SimulationResult> => {
    if (!address) {
      return { success: false, error: 'Wallet not connected' };
    }

    setState({ isSimulating: true, result: null, error: null });

    try {
      const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

      const operation = contract.call(
        'add_liquidity',
        StellarSdk.nativeToScVal(params.tokenA, { type: 'address' }),
        StellarSdk.nativeToScVal(params.tokenB, { type: 'address' }),
        StellarSdk.nativeToScVal(params.amountADesired, { type: 'u128' }),
        StellarSdk.nativeToScVal(params.amountBDesired, { type: 'u128' }),
        StellarSdk.nativeToScVal(params.amountAMin, { type: 'u128' }),
        StellarSdk.nativeToScVal(params.amountBMin, { type: 'u128' }),
        StellarSdk.nativeToScVal(params.to, { type: 'address' }),
        StellarSdk.nativeToScVal(params.deadline, { type: 'u64' })
      );

      const result = await simulateTransaction(address, [operation]);

      setState({ isSimulating: false, result, error: result.success ? null : result.error || null });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Simulation failed';
      setState({ isSimulating: false, result: null, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [address]);

  const reset = useCallback(() => {
    setState({ isSimulating: false, result: null, error: null });
  }, []);

  return {
    ...state,
    simulateAddLiquidity,
    reset,
  };
}
