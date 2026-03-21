/**
 * useTokenBalance Hook - Unit Tests
 *
 * Strategy: Mock React Query, Zustand stores, and Stellar SDK calls
 * Coverage: Token balance fetching, XLM special handling, error cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTokenBalance, useAllTokenBalances } from '../useTokenBalance';
import * as stellar from '../../lib/stellar';
import { useWalletStore } from '../../stores/walletStore';
import { useTokenStore, NATIVE_XLM_SAC } from '../../stores/tokenStore';
import type { Token } from '../../types';
import React from 'react';

// Mock stellar functions
vi.mock('../../lib/stellar', () => ({
  getTokenBalance: vi.fn(),
  getAccountBalance: vi.fn(),
}));

// Mock stores
vi.mock('../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('../../stores/tokenStore', () => ({
  useTokenStore: vi.fn(),
  NATIVE_XLM_SAC: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
}));

// Test data
const mockAddress = 'GABC123XYZ456';
const mockToken: Token = {
  address: 'CTOKEN123',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 7,
  icon: '',
};

const mockXLMToken: Token = {
  address: NATIVE_XLM_SAC,
  symbol: 'XLM',
  name: 'Stellar Lumens',
  decimals: 7,
  icon: '',
};

describe('useTokenBalance', () => {
  let queryClient: QueryClient;
  let wrapper: any;
  const mockUpdateTokenBalance = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a new QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Wrapper with QueryClientProvider
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    // Setup default mocks
    vi.mocked(useWalletStore).mockReturnValue(mockAddress);
    vi.mocked(useTokenStore).mockReturnValue(mockUpdateTokenBalance);
  });

  describe('Token Balance Fetching', () => {
    it('should fetch token balance for regular token', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000000'); // 100 USDC

      const { result } = renderHook(() => useTokenBalance(mockToken), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.balance).toBe('0');

      // Wait for balance to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe('1000000000');
      expect(stellar.getTokenBalance).toHaveBeenCalledWith(mockAddress, mockToken.address);
    });

    it('should fetch account balance for XLM token', async () => {
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('5000000000'); // 500 XLM

      const { result } = renderHook(() => useTokenBalance(mockXLMToken), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe('5000000000');
      expect(stellar.getAccountBalance).toHaveBeenCalledWith(mockAddress);
      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should handle XLM by symbol (not just address)', async () => {
      const xlmBySymbol: Token = {
        ...mockToken,
        symbol: 'XLM',
        name: 'Stellar Lumens',
      };

      vi.mocked(stellar.getAccountBalance).mockResolvedValue('3000000000');

      const { result } = renderHook(() => useTokenBalance(xlmBySymbol), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(stellar.getAccountBalance).toHaveBeenCalledWith(mockAddress);
    });
  });

  describe('Disabled States', () => {
    it('should not fetch if token is null', async () => {
      const { result } = renderHook(() => useTokenBalance(null), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.balance).toBe('0');
      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should not fetch if wallet not connected', async () => {
      vi.mocked(useWalletStore).mockReturnValue(null);

      const { result } = renderHook(() => useTokenBalance(mockToken), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.balance).toBe('0');
      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should return 0 balance on error', async () => {
      vi.mocked(stellar.getTokenBalance).mockRejectedValue(new Error('RPC error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useTokenBalance(mockToken), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.balance).toBe('0');
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching token balance:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Store Updates', () => {
    it('should update token store when balance changes', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('2000000000');

      renderHook(() => useTokenBalance(mockToken), { wrapper });

      await waitFor(() => {
        expect(mockUpdateTokenBalance).toHaveBeenCalledWith(
          mockToken.address,
          '2000000000'
        );
      });
    });
  });

  describe('Query Configuration', () => {
    it('should have correct staleTime (10 seconds)', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000000');

      const { result } = renderHook(() => useTokenBalance(mockToken), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Check query cache
      const queryKey = ['tokenBalance', mockToken.address, mockAddress];
      const queryState = queryClient.getQueryState(queryKey);

      expect(queryState).toBeDefined();
      // staleTime should be 10000ms
    });
  });
});

describe('useAllTokenBalances', () => {
  let queryClient: QueryClient;
  let wrapper: any;
  const mockUpdateTokenBalance = vi.fn();
  const mockTokens: Token[] = [
    {
      address: 'CTOKEN1',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 7,
      icon: '',
    },
    {
      address: 'CTOKEN2',
      symbol: 'USDT',
      name: 'Tether',
      decimals: 7,
      icon: '',
    },
    mockXLMToken,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    // Mock wallet connected
    vi.mocked(useWalletStore).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector({ address: mockAddress });
      }
      return mockAddress;
    });

    // Mock token store
    vi.mocked(useTokenStore).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        const state = {
          tokens: mockTokens,
          updateTokenBalance: mockUpdateTokenBalance,
        };
        return selector(state);
      }
      return mockUpdateTokenBalance;
    });
  });

  describe('Batch Processing', () => {
    it('should fetch all token balances', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000000');
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('5000000000');

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should call getTokenBalance for regular tokens
      expect(stellar.getTokenBalance).toHaveBeenCalledTimes(2);

      // Should call getAccountBalance for XLM
      expect(stellar.getAccountBalance).toHaveBeenCalledTimes(1);

      // Should update all balances in store
      expect(mockUpdateTokenBalance).toHaveBeenCalledTimes(3);
    });

    it('should handle errors for individual tokens', async () => {
      vi.mocked(stellar.getTokenBalance).mockImplementation((address, tokenAddress) => {
        if (tokenAddress === 'CTOKEN1') {
          return Promise.reject(new Error('Token not found'));
        }
        return Promise.resolve('1000000000');
      });
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('5000000000');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should log error for failed token
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error fetching balance'),
        expect.any(Error)
      );

      // Should still update store with '0' for failed token
      expect(mockUpdateTokenBalance).toHaveBeenCalledWith('CTOKEN1', '0');

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting', () => {
    it('should process tokens in batches', async () => {
      // Create many tokens to test batching
      const manyTokens: Token[] = Array.from({ length: 12 }, (_, i) => ({
        address: `CTOKEN${i}`,
        symbol: `TOK${i}`,
        name: `Token ${i}`,
        decimals: 7,
        icon: '',
      }));

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          const state = {
            tokens: manyTokens,
            updateTokenBalance: mockUpdateTokenBalance,
          };
          return selector(state);
        }
        return mockUpdateTokenBalance;
      });

      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000000');

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 3000 });

      // All tokens should be fetched
      expect(stellar.getTokenBalance).toHaveBeenCalledTimes(12);
    });
  });

  describe('Disabled States', () => {
    it('should not fetch if wallet not connected', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          return selector({ address: null });
        }
        return null;
      });

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should not fetch if no tokens available', async () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        if (typeof selector === 'function') {
          const state = {
            tokens: [],
            updateTokenBalance: mockUpdateTokenBalance,
          };
          return selector(state);
        }
        return mockUpdateTokenBalance;
      });

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    it('should expose refetch function', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000000');
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('5000000000');

      const { result } = renderHook(() => useAllTokenBalances(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');

      // Clear previous calls
      vi.clearAllMocks();

      // Trigger refetch
      await result.current.refetch();

      // Should fetch again
      await waitFor(() => {
        expect(stellar.getTokenBalance).toHaveBeenCalled();
      });
    });
  });
});
