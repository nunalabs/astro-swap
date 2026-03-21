/**
 * useSwap Hook - Unit Tests
 *
 * Strategy: Test swap flow, quote fetching, validation, execution
 * Coverage: All swap operations, error handling, transaction tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSwap } from '../useSwap';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTransactionStore } from '../../stores/transactionStore';
import type { Token } from '../../types';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('../useSimulation', () => ({
  useSwapSimulation: vi.fn(() => ({
    simulateSwap: vi.fn(async () => ({ success: true })),
    isSimulating: false,
    error: null,
    reset: vi.fn(),
  })),
}));

vi.mock('../../lib/contracts', () => ({
  getAmountsOut: vi.fn(),
  swapExactTokensForTokens: vi.fn(),
  calculateOptimalPath: vi.fn(),
}));

vi.mock('../../lib/utils', () => ({
  calculatePriceImpact: vi.fn(() => 1.5),
  parseTokenAmount: vi.fn((amount: string) => (parseFloat(amount) * 10000000).toString()),
  formatTokenAmount: vi.fn((amount: string) => (parseFloat(amount) / 10000000).toFixed(2)),
  applySlippage: vi.fn((amount: string) => amount),
}));

vi.mock('../../lib/errors', () => ({
  formatErrorForToast: vi.fn((error: Error) => ({
    type: 'error',
    title: 'Error',
    description: error.message,
  })),
}));

describe('useSwap', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  const mockXLM: Token = {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    verified: true,
    popular: true,
    source: 'whitelist',
  };

  const mockUSDC: Token = {
    address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 7,
    verified: true,
    popular: true,
    source: 'whitelist',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    // Setup store states
    useWalletStore.setState({
      address: 'GABC123XYZ456',
      isConnected: true,
      balance: '10000000000',
    });

    useSettingsStore.setState({
      slippageTolerance: 0.5,
      deadline: 20,
      addToast: vi.fn(),
    });

    useTransactionStore.setState({
      transactions: [],
      addTransaction: vi.fn(),
      updateTransaction: vi.fn(),
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Initial State', () => {
    it('should initialize with empty amounts', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      expect(result.current.amountIn).toBe('');
      expect(result.current.amountOut).toBe('');
      expect(result.current.priceImpact).toBe(0);
      expect(result.current.route).toEqual([]);
    });

    it('should not be loading initially', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      expect(result.current.isLoadingQuote).toBe(false);
      expect(result.current.isSwapping).toBe(false);
      expect(result.current.isSimulating).toBe(false);
    });
  });

  describe('Quote Fetching', () => {
    it('should fetch quote when amount is entered', async () => {
      const { getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['10000000000', '20000000000']);

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      expect(calculateOptimalPath).toHaveBeenCalledWith(mockXLM, mockUSDC, []);
      expect(getAmountsOut).toHaveBeenCalled();
    });

    it('should update price impact when quote changes', async () => {
      const { getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');
      const { calculatePriceImpact } = await import('../../lib/utils');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['10000000000', '20000000000']);
      vi.mocked(calculatePriceImpact).mockReturnValue(2.5);

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.priceImpact).toBe(2.5);
      });
    });

    it('should not fetch quote without tokens', async () => {
      const { getAmountsOut } = await import('../../lib/contracts');

      renderHook(() => useSwap(null, null), { wrapper });

      expect(getAmountsOut).not.toHaveBeenCalled();
    });

    it('should not fetch quote with empty amount', async () => {
      const { getAmountsOut } = await import('../../lib/contracts');

      renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      expect(getAmountsOut).not.toHaveBeenCalled();
    });

    it('should use fallback address when wallet not connected', async () => {
      useWalletStore.setState({ address: null, isConnected: false });

      const { getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');
      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['10000000000', '20000000000']);

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(getAmountsOut).toHaveBeenCalled();
      });
    });
  });

  describe('Input Handlers', () => {
    it('should update amountIn when setAmountIn is called', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('50');
      });

      expect(result.current.amountIn).toBe('50');
    });

    it('should switch tokens and amounts', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
        result.current.setAmountOut('200');
      });

      act(() => {
        result.current.switchTokens();
      });

      expect(result.current.amountIn).toBe('200');
      expect(result.current.amountOut).toBe('100');
    });
  });

  describe('Swap Validation', () => {
    it('should validate swap before execution', async () => {
      const { useSwapSimulation } = await import('../useSimulation');
      const mockSimulate = vi.fn(async () => ({ success: true }));

      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: mockSimulate,
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');
      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      let isValid = false;
      await act(async () => {
        isValid = await result.current.validateSwap();
      });

      expect(isValid).toBe(true);
      expect(mockSimulate).toHaveBeenCalled();
    });

    it('should fail validation when simulation fails', async () => {
      const { useSwapSimulation } = await import('../useSimulation');
      const mockSimulate = vi.fn(async () => ({
        success: false,
        error: 'Insufficient liquidity',
      }));

      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: mockSimulate,
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');
      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      let isValid = true;
      await act(async () => {
        isValid = await result.current.validateSwap();
      });

      expect(isValid).toBe(false);
      expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
        type: 'error',
        title: 'Swap Will Fail',
        description: 'Insufficient liquidity',
      });
    });

    it('should return false when missing required parameters', async () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      let isValid = true;
      await act(async () => {
        isValid = await result.current.validateSwap();
      });

      expect(isValid).toBe(false);
    });
  });

  describe('Swap Execution', () => {
    it('should execute swap successfully', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH_SUCCESS');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(swapExactTokensForTokens).toHaveBeenCalled();
      });
    });

    it('should add pending transaction on swap start', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(useTransactionStore.getState().addTransaction).toHaveBeenCalled();
      });
    });

    it('should update transaction on swap success', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH_SUCCESS');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(useTransactionStore.getState().updateTransaction).toHaveBeenCalledWith(
          expect.stringContaining('pending-'),
          {
            hash: 'TX_HASH_SUCCESS',
            status: 'success',
          }
        );
      });
    });

    it('should show success toast on swap completion', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Swap Successful',
          description: expect.stringContaining('Swapped'),
        });
      });
    });

    it('should reset form after successful swap', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(result.current.amountIn).toBe('');
        expect(result.current.amountOut).toBe('');
      });
    });
  });

  describe('Error Handling', () => {
    it('should show warning toast for invalid input', async () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      await act(async () => {
        await result.current.swap();
      });

      expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
        type: 'warning',
        title: 'Invalid Input',
        description: 'Please enter valid amounts',
      });
    });

    it('should update transaction to failed on error', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockRejectedValue(new Error('Transaction failed'));

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(useTransactionStore.getState().updateTransaction).toHaveBeenCalledWith(
          expect.stringContaining('pending-'),
          {
            status: 'failed',
          }
        );
      });
    });

    it('should show error toast on swap failure', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockRejectedValue(new Error('Swap failed'));

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
          })
        );
      });
    });
  });

  describe('Query Invalidation', () => {
    it('should invalidate balance queries after successful swap', async () => {
      const { swapExactTokensForTokens, getAmountsOut, calculateOptimalPath } = await import('../../lib/contracts');

      vi.mocked(calculateOptimalPath).mockReturnValue([mockXLM, mockUSDC]);
      vi.mocked(getAmountsOut).mockResolvedValue(['1000000000', '2000000000']);
      vi.mocked(swapExactTokensForTokens).mockResolvedValue('TX_HASH');

      const { useSwapSimulation } = await import('../useSimulation');
      vi.mocked(useSwapSimulation).mockReturnValue({
        simulateSwap: vi.fn(async () => ({ success: true })),
        isSimulating: false,
        error: null,
        reset: vi.fn(),
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      act(() => {
        result.current.setAmountIn('100');
      });

      await waitFor(() => {
        expect(result.current.amountOut).toBeTruthy();
      });

      await act(async () => {
        await result.current.swap();
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tokenBalance'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['token-balances'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['allTokenBalances'] });
      });
    });
  });

  describe('Return Values', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      expect(result.current).toHaveProperty('amountIn');
      expect(result.current).toHaveProperty('amountOut');
      expect(result.current).toHaveProperty('priceImpact');
      expect(result.current).toHaveProperty('route');
      expect(result.current).toHaveProperty('isLoadingQuote');
      expect(result.current).toHaveProperty('isSwapping');
      expect(result.current).toHaveProperty('isSimulating');
      expect(result.current).toHaveProperty('simulationError');
      expect(result.current).toHaveProperty('setAmountIn');
      expect(result.current).toHaveProperty('setAmountOut');
      expect(result.current).toHaveProperty('swap');
      expect(result.current).toHaveProperty('validateSwap');
      expect(result.current).toHaveProperty('switchTokens');
      expect(result.current).toHaveProperty('resetSimulation');
    });

    it('should return correct function types', () => {
      const { result } = renderHook(() => useSwap(mockXLM, mockUSDC), { wrapper });

      expect(typeof result.current.setAmountIn).toBe('function');
      expect(typeof result.current.setAmountOut).toBe('function');
      expect(typeof result.current.swap).toBe('function');
      expect(typeof result.current.validateSwap).toBe('function');
      expect(typeof result.current.switchTokens).toBe('function');
      expect(typeof result.current.resetSimulation).toBe('function');
    });
  });
});
