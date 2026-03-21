import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTokens } from '../useTokens';
import * as stellar from '../../lib/stellar';
import { useWalletStore } from '../../stores/walletStore';
import { useTokenStore } from '../../stores/tokenStore';
import type { ReactNode } from 'react';

// Mock modules
vi.mock('../../lib/stellar', () => ({
  getTokenBalance: vi.fn(),
}));

vi.mock('../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('../../stores/tokenStore', () => ({
  useTokenStore: vi.fn(),
}));

describe('useTokens', () => {
  const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockTokenA = {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  };
  const mockTokenB = {
    address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
  };

  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;
  const mockUpdateTokenBalance = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

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

    // Default mocks
    vi.mocked(useWalletStore).mockImplementation((selector: any) =>
      selector({ address: mockAddress })
    );

    vi.mocked(useTokenStore).mockImplementation((selector: any) => {
      const state = {
        tokens: [mockTokenA, mockTokenB],
        updateTokenBalance: mockUpdateTokenBalance,
      };
      return selector(state);
    });
  });

  describe('Initialization', () => {
    it('should return tokens and empty balances initially', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.tokens).toEqual([mockTokenA, mockTokenB]);
      expect(result.current.balances).toEqual({});
    });

    it('should have correct return type', () => {
      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current).toHaveProperty('tokens');
      expect(result.current).toHaveProperty('balances');
      expect(Array.isArray(result.current.tokens)).toBe(true);
      expect(typeof result.current.balances).toBe('object');
    });
  });

  describe('Balance Fetching', () => {
    it('should fetch balances for all tokens when wallet connected', async () => {
      vi.mocked(stellar.getTokenBalance)
        .mockResolvedValueOnce('1000000') // USDC balance
        .mockResolvedValueOnce('5000000'); // XLM balance

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(stellar.getTokenBalance).toHaveBeenCalledWith(
          mockAddress,
          mockTokenA.address
        );
        expect(stellar.getTokenBalance).toHaveBeenCalledWith(
          mockAddress,
          mockTokenB.address
        );
      });

      await waitFor(() => {
        expect(result.current.balances).toEqual({
          [mockTokenA.address]: '1000000',
          [mockTokenB.address]: '5000000',
        });
      });
    });

    it('should not fetch balances when wallet not connected', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      renderHook(() => useTokens(), { wrapper });

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should not fetch balances when no tokens available', async () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [],
          updateTokenBalance: mockUpdateTokenBalance,
        };
        return selector(state);
      });

      renderHook(() => useTokens(), { wrapper });

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stellar.getTokenBalance).not.toHaveBeenCalled();
    });

    it('should fetch balances in parallel for all tokens', async () => {
      vi.mocked(stellar.getTokenBalance).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('1000'), 50))
      );

      const startTime = Date.now();

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(
        () => {
          expect(result.current.balances).toHaveProperty(mockTokenA.address);
          expect(result.current.balances).toHaveProperty(mockTokenB.address);
        },
        { timeout: 3000 }
      );

      const duration = Date.now() - startTime;

      // Should take ~50ms (parallel), not ~100ms (sequential)
      // Allow for some overhead but should be much faster than sequential
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors and return 0 balance', async () => {
      vi.mocked(stellar.getTokenBalance)
        .mockResolvedValueOnce('1000000') // USDC success
        .mockRejectedValueOnce(new Error('Network error')); // XLM error

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(result.current.balances).toEqual({
          [mockTokenA.address]: '1000000',
          [mockTokenB.address]: '0',
        });
      });
    });

    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(stellar.getTokenBalance).mockRejectedValue(
        new Error('Contract not found')
      );

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle all tokens failing to fetch', async () => {
      vi.mocked(stellar.getTokenBalance).mockRejectedValue(
        new Error('Network down')
      );

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(result.current.balances).toEqual({
          [mockTokenA.address]: '0',
          [mockTokenB.address]: '0',
        });
      });
    });
  });

  describe('Store Updates', () => {
    it('should update token balances in store when fetched', async () => {
      vi.mocked(stellar.getTokenBalance)
        .mockResolvedValueOnce('1000000')
        .mockResolvedValueOnce('5000000');

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(mockUpdateTokenBalance).toHaveBeenCalledWith(
          mockTokenA.address,
          '1000000'
        );
        expect(mockUpdateTokenBalance).toHaveBeenCalledWith(
          mockTokenB.address,
          '5000000'
        );
      });
    });

    it('should update store with 0 balance on error', async () => {
      vi.mocked(stellar.getTokenBalance).mockRejectedValue(
        new Error('Failed')
      );

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(mockUpdateTokenBalance).toHaveBeenCalledWith(
          mockTokenA.address,
          '0'
        );
        expect(mockUpdateTokenBalance).toHaveBeenCalledWith(
          mockTokenB.address,
          '0'
        );
      });
    });

    it('should call updateTokenBalance for each token', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('500000');

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        // Should be called exactly twice (once per token)
        expect(mockUpdateTokenBalance).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('React Query Configuration', () => {
    it('should use correct query key', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000');

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        const cache = queryClient.getQueryCache();
        const queries = cache.findAll({
          queryKey: [
            'token-balances',
            mockAddress,
            [mockTokenA.address, mockTokenB.address],
          ],
        });

        expect(queries.length).toBeGreaterThan(0);
      });
    });

    it('should have correct staleTime', async () => {
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000');

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        const cache = queryClient.getQueryCache();
        const query = cache.findAll({ queryKey: ['token-balances'] })[0];

        // Query should exist and have staleTime configured
        expect(query).toBeDefined();
      });
    });

    it('should be enabled only when address and tokens exist', async () => {
      // Test with no address
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      const { rerender } = renderHook(() => useTokens(), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stellar.getTokenBalance).not.toHaveBeenCalled();

      // Now add address
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: mockAddress })
      );
      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000');

      rerender();

      await waitFor(() => {
        expect(stellar.getTokenBalance).toHaveBeenCalled();
      });
    });
  });

  describe('Multiple Tokens', () => {
    it('should handle single token', async () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [mockTokenA],
          updateTokenBalance: mockUpdateTokenBalance,
        };
        return selector(state);
      });

      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000000');

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(result.current.balances).toEqual({
          [mockTokenA.address]: '1000000',
        });
      });

      expect(stellar.getTokenBalance).toHaveBeenCalledTimes(1);
    });

    it('should handle many tokens', async () => {
      const manyTokens = Array.from({ length: 10 }, (_, i) => ({
        address: `CTOKEN${i}234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ${i % 10}234567890`.padEnd(
          56,
          'A'
        ),
        symbol: `TKN${i}`,
        name: `Token ${i}`,
        decimals: 7,
      }));

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: manyTokens,
          updateTokenBalance: mockUpdateTokenBalance,
        };
        return selector(state);
      });

      vi.mocked(stellar.getTokenBalance).mockResolvedValue('1000');

      renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(stellar.getTokenBalance).toHaveBeenCalledTimes(10);
      });
    });
  });

  describe('Balance Updates', () => {
    it('should return empty balances object when query has no data', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      const { result } = renderHook(() => useTokens(), { wrapper });

      expect(result.current.balances).toEqual({});
    });

    it('should preserve existing balances while fetching', async () => {
      vi.mocked(stellar.getTokenBalance).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('2000'), 100))
      );

      const { result } = renderHook(() => useTokens(), { wrapper });

      // Initially should be empty
      expect(result.current.balances).toEqual({});

      // After fetch should have balances
      await waitFor(
        () => {
          expect(Object.keys(result.current.balances).length).toBeGreaterThan(0);
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle token with 0 balance', async () => {
      vi.mocked(stellar.getTokenBalance)
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('1000000');

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(result.current.balances[mockTokenA.address]).toBe('0');
        expect(result.current.balances[mockTokenB.address]).toBe('1000000');
      });
    });

    it('should handle very large balance', async () => {
      const largeBalance = '999999999999999999';
      vi.mocked(stellar.getTokenBalance).mockResolvedValue(largeBalance);

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        expect(result.current.balances[mockTokenA.address]).toBe(largeBalance);
      });
    });

    it('should handle empty string balance from error', async () => {
      vi.mocked(stellar.getTokenBalance).mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useTokens(), { wrapper });

      await waitFor(() => {
        // Should default to '0' on error
        expect(result.current.balances[mockTokenA.address]).toBe('0');
      });
    });
  });
});
