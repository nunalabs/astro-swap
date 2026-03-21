/**
 * usePool Hook - Unit Tests
 *
 * Strategy: Test pool fetching, liquidity operations, slippage protection
 * Coverage: Pool queries, add/remove liquidity, first liquidity detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePool } from '../usePool';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTokenStore } from '../../stores/tokenStore';
import type { Token, Pool } from '../../types';
import type { ReactNode } from 'react';

// Mock dependencies
vi.mock('../../lib/contracts', () => ({
  getAllPairs: vi.fn(),
  getReserves: vi.fn(),
  getTotalSupply: vi.fn(),
  addLiquidity: vi.fn(),
  removeLiquidity: vi.fn(),
  getPairAddress: vi.fn(),
}));

vi.mock('../../lib/token-indexer', () => ({
  getPairTokens: vi.fn(),
  fetchTokenMetadata: vi.fn(),
}));

vi.mock('../../lib/utils', () => ({
  parseTokenAmount: vi.fn((amount: string, decimals: number) => {
    return (parseFloat(amount) * Math.pow(10, decimals)).toString();
  }),
}));

describe('usePool', () => {
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

  const mockPool: Pool = {
    address: 'CPAIR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCD',
    token0: mockXLM,
    token1: mockUSDC,
    reserve0: '100000000000',
    reserve1: '200000000000',
    totalSupply: '141421356',
    lpTokenAddress: 'CPAIR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCD',
    fee: 30,
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

    useTokenStore.setState({
      tokens: [mockXLM, mockUSDC],
      getToken: vi.fn((address: string) => {
        if (address === mockXLM.address) return mockXLM;
        if (address === mockUSDC.address) return mockUSDC;
        return undefined;
      }),
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Pool Fetching', () => {
    it('should fetch pools successfully', async () => {
      const { getAllPairs, getReserves, getTotalSupply } = await import('../../lib/contracts');
      const { getPairTokens } = await import('../../lib/token-indexer');

      vi.mocked(getAllPairs).mockResolvedValue([mockPool.address]);
      vi.mocked(getPairTokens).mockResolvedValue({
        token0: mockXLM.address,
        token1: mockUSDC.address,
      });
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: mockPool.reserve0,
        reserve1: mockPool.reserve1,
      });
      vi.mocked(getTotalSupply).mockResolvedValue(mockPool.totalSupply);

      const { result } = renderHook(() => usePool(), { wrapper });

      await waitFor(() => {
        expect(result.current.pools.length).toBeGreaterThan(0);
      });

      expect(result.current.pools[0].token0.symbol).toBe('XLM');
      expect(result.current.pools[0].token1.symbol).toBe('USDC');
    });

    it('should return empty array when no wallet connected', async () => {
      useWalletStore.setState({ address: null, isConnected: false });

      const { result } = renderHook(() => usePool(), { wrapper });

      expect(result.current.pools).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it('should filter out empty pools', async () => {
      const { getAllPairs, getReserves, getTotalSupply } = await import('../../lib/contracts');
      const { getPairTokens } = await import('../../lib/token-indexer');

      vi.mocked(getAllPairs).mockResolvedValue(['PAIR1', 'PAIR2']);
      vi.mocked(getPairTokens).mockResolvedValue({
        token0: mockXLM.address,
        token1: mockUSDC.address,
      });

      // First pool: has liquidity
      // Second pool: empty (zero reserves)
      vi.mocked(getReserves)
        .mockResolvedValueOnce({ reserve0: '1000000', reserve1: '2000000' })
        .mockResolvedValueOnce({ reserve0: '0', reserve1: '0' });

      vi.mocked(getTotalSupply).mockResolvedValue('100000');

      const { result } = renderHook(() => usePool(), { wrapper });

      await waitFor(() => {
        expect(result.current.pools.length).toBe(1);
      });
    });

    it('should handle pool fetch errors gracefully', async () => {
      const { getAllPairs } = await import('../../lib/contracts');

      vi.mocked(getAllPairs).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => usePool(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should use fallback metadata when token fetch fails', async () => {
      const { getAllPairs, getReserves, getTotalSupply } = await import('../../lib/contracts');
      const { getPairTokens, fetchTokenMetadata } = await import('../../lib/token-indexer');

      vi.mocked(getAllPairs).mockResolvedValue([mockPool.address]);
      vi.mocked(getPairTokens).mockResolvedValue({
        token0: 'CUNKNOWN123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB',
        token1: mockUSDC.address,
      });
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '1000000',
        reserve1: '2000000',
      });
      vi.mocked(getTotalSupply).mockResolvedValue('100000');
      vi.mocked(fetchTokenMetadata).mockResolvedValue(null);

      // Mock getToken to return undefined for unknown token
      useTokenStore.setState({
        getToken: vi.fn((address: string) => {
          if (address === mockUSDC.address) return mockUSDC;
          return undefined;
        }),
      });

      const { result } = renderHook(() => usePool(), { wrapper });

      await waitFor(() => {
        expect(result.current.pools.length).toBeGreaterThan(0);
      });

      expect(result.current.pools[0].token0.name).toBe('Unknown Token');
    });
  });

  describe('Add Liquidity', () => {
    it('should add liquidity successfully', async () => {
      const { addLiquidity, getPairAddress, getReserves } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(mockPool.address);
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '1000000000',
        reserve1: '2000000000',
      });
      vi.mocked(addLiquidity).mockResolvedValue('TX_HASH_ADD');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(addLiquidity).toHaveBeenCalled();
      });
    });

    it('should detect first liquidity and use zero minimums', async () => {
      const { addLiquidity, getPairAddress, getReserves } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(mockPool.address);
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '0',
        reserve1: '0',
      });
      vi.mocked(addLiquidity).mockResolvedValue('TX_HASH_FIRST');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(addLiquidity).toHaveBeenCalledWith(
          mockXLM.address,
          mockUSDC.address,
          expect.any(String),
          expect.any(String),
          '0', // amountAMin = 0 for first liquidity
          '0', // amountBMin = 0 for first liquidity
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
      });
    });

    it('should handle pool not existing (first liquidity)', async () => {
      const { addLiquidity, getPairAddress } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(null);
      vi.mocked(addLiquidity).mockResolvedValue('TX_HASH');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(addLiquidity).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          '0',
          '0',
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
      });
    });

    it('should show success toast after adding liquidity', async () => {
      const { addLiquidity, getPairAddress, getReserves } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(mockPool.address);
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '1000000000',
        reserve1: '2000000000',
      });
      vi.mocked(addLiquidity).mockResolvedValue('TX_HASH_SUCCESS');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Liquidity Added',
          description: expect.stringContaining('TX_HASH'),
        });
      });
    });

    it('should invalidate queries after adding liquidity', async () => {
      const { addLiquidity, getPairAddress, getReserves } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(mockPool.address);
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '1000000000',
        reserve1: '2000000000',
      });
      vi.mocked(addLiquidity).mockResolvedValue('TX_HASH');

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['pools'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tokenBalance'] });
      });
    });

    it('should show error toast when adding liquidity fails', async () => {
      const { addLiquidity, getPairAddress, getReserves } = await import('../../lib/contracts');

      vi.mocked(getPairAddress).mockResolvedValue(mockPool.address);
      vi.mocked(getReserves).mockResolvedValue({
        reserve0: '1000000000',
        reserve1: '2000000000',
      });
      vi.mocked(addLiquidity).mockRejectedValue(new Error('Insufficient balance'));

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to Add Liquidity',
          description: 'Insufficient balance',
        });
      });
    });

    it('should throw error when wallet not connected', async () => {
      useWalletStore.setState({ address: null, isConnected: false });

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.addLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          amountA: '100',
          amountB: '200',
          slippage: 0.5,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to Add Liquidity',
          description: 'Wallet not connected',
        });
      });
    });
  });

  describe('Remove Liquidity', () => {
    it('should remove liquidity successfully', async () => {
      const { removeLiquidity } = await import('../../lib/contracts');

      vi.mocked(removeLiquidity).mockResolvedValue('TX_HASH_REMOVE');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
          pool: mockPool,
        });
      });

      await waitFor(() => {
        expect(removeLiquidity).toHaveBeenCalled();
      });
    });

    it('should calculate minimum amounts with slippage protection', async () => {
      const { removeLiquidity } = await import('../../lib/contracts');

      vi.mocked(removeLiquidity).mockResolvedValue('TX_HASH');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
          pool: mockPool,
        });
      });

      await waitFor(() => {
        expect(removeLiquidity).toHaveBeenCalledWith(
          mockXLM.address,
          mockUSDC.address,
          expect.any(String),
          expect.not.stringMatching(/^0$/), // amountAMin should not be '0'
          expect.not.stringMatching(/^0$/), // amountBMin should not be '0'
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
      });
    });

    it('should handle remove without pool data (no slippage protection)', async () => {
      const { removeLiquidity } = await import('../../lib/contracts');

      vi.mocked(removeLiquidity).mockResolvedValue('TX_HASH');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
        });
      });

      await waitFor(() => {
        expect(removeLiquidity).toHaveBeenCalledWith(
          mockXLM.address,
          mockUSDC.address,
          expect.any(String),
          '0',
          '0',
          expect.any(String),
          expect.any(Number),
          expect.any(String)
        );
      });
    });

    it('should show success toast after removing liquidity', async () => {
      const { removeLiquidity } = await import('../../lib/contracts');

      vi.mocked(removeLiquidity).mockResolvedValue('TX_HASH_SUCCESS');

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
          pool: mockPool,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Liquidity Removed',
          description: expect.stringContaining('TX_HASH'),
        });
      });
    });

    it('should show error toast when removing liquidity fails', async () => {
      const { removeLiquidity } = await import('../../lib/contracts');

      vi.mocked(removeLiquidity).mockRejectedValue(new Error('Insufficient LP tokens'));

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
          pool: mockPool,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to Remove Liquidity',
          description: 'Insufficient LP tokens',
        });
      });
    });

    it('should throw error when wallet not connected during remove', async () => {
      useWalletStore.setState({ address: null, isConnected: false });

      const { result } = renderHook(() => usePool(), { wrapper });

      await act(async () => {
        result.current.removeLiquidity({
          tokenA: mockXLM,
          tokenB: mockUSDC,
          liquidity: '50',
          pool: mockPool,
        });
      });

      await waitFor(() => {
        expect(useSettingsStore.getState().addToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to Remove Liquidity',
          description: 'Wallet not connected',
        });
      });
    });
  });

  describe('Return Values', () => {
    it('should return all required properties', () => {
      const { result } = renderHook(() => usePool(), { wrapper });

      expect(result.current).toHaveProperty('pools');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('addLiquidity');
      expect(result.current).toHaveProperty('removeLiquidity');
      expect(result.current).toHaveProperty('isAddingLiquidity');
      expect(result.current).toHaveProperty('isRemovingLiquidity');
    });

    it('should return correct types', () => {
      const { result } = renderHook(() => usePool(), { wrapper });

      expect(Array.isArray(result.current.pools)).toBe(true);
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.addLiquidity).toBe('function');
      expect(typeof result.current.removeLiquidity).toBe('function');
      expect(typeof result.current.isAddingLiquidity).toBe('boolean');
      expect(typeof result.current.isRemovingLiquidity).toBe('boolean');
    });
  });
});
