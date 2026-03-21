import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenIndexer } from '../useTokenIndexer';
import { useWalletStore } from '../../stores/walletStore';
import { useTokenStore } from '../../stores/tokenStore';

// Mock modules
vi.mock('../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('../../stores/tokenStore', () => ({
  useTokenStore: vi.fn(),
}));

describe('useTokenIndexer', () => {
  const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockIndexTokensFromChain = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Default mocks
    vi.mocked(useWalletStore).mockImplementation((selector: any) => {
      const state = {
        address: mockAddress,
        isConnected: true,
      };
      return selector(state);
    });

    vi.mocked(useTokenStore).mockImplementation((selector: any) => {
      const state = {
        indexTokensFromChain: mockIndexTokensFromChain,
        isIndexing: false,
        indexedTokens: [],
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should return correct initial state', () => {
      const { result } = renderHook(() => useTokenIndexer());

      expect(result.current).toHaveProperty('isIndexing');
      expect(result.current).toHaveProperty('indexedTokenCount');
      expect(result.current).toHaveProperty('reindex');
      expect(typeof result.current.reindex).toBe('function');
    });

    it('should return isIndexing from store', () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: true,
          indexedTokens: [],
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      expect(result.current.isIndexing).toBe(true);
    });

    it('should return indexed token count', () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: [{ address: 'token1' }, { address: 'token2' }],
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      expect(result.current.indexedTokenCount).toBe(2);
    });
  });

  describe('Auto-indexing on wallet connect', () => {
    it('should index tokens when wallet is connected', () => {
      renderHook(() => useTokenIndexer());

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(mockAddress);
      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(1);
    });

    it('should not index when wallet is not connected', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      renderHook(() => useTokenIndexer());

      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should not index when address is null even if isConnected is true', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: true,
        };
        return selector(state);
      });

      renderHook(() => useTokenIndexer());

      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should index when wallet connects later', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      const { rerender } = renderHook(() => useTokenIndexer());

      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();

      // Now connect wallet
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: mockAddress,
          isConnected: true,
        };
        return selector(state);
      });

      rerender();

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(mockAddress);
    });
  });

  describe('Periodic re-indexing', () => {
    it('should re-index every 5 minutes', () => {
      renderHook(() => useTokenIndexer());

      // Initial call on mount
      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(1);

      // Fast forward 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(2);

      // Fast forward another 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(3);
    });

    it('should not set interval when wallet not connected', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      renderHook(() => useTokenIndexer());

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(10 * 60 * 1000);
      });

      // Should not have been called
      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should clear interval on unmount', () => {
      const { unmount } = renderHook(() => useTokenIndexer());

      // Clear the initial call
      mockIndexTokensFromChain.mockClear();

      // Unmount before timer fires
      unmount();

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should not have been called because interval was cleared
      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should re-create interval when wallet reconnects', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      const { rerender } = renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      // Connect wallet
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: mockAddress,
          isConnected: true,
        };
        return selector(state);
      });

      rerender();

      // Should index on connect
      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(1);

      // Fast forward 5 minutes
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should have re-indexed
      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(2);
    });

    it('should not re-index more frequently than 5 minutes', () => {
      renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      // Fast forward 4 minutes (not enough)
      act(() => {
        vi.advanceTimersByTime(4 * 60 * 1000);
      });

      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();

      // Fast forward 1 more minute (total 5)
      act(() => {
        vi.advanceTimersByTime(1 * 60 * 1000);
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(1);
    });
  });

  describe('Manual reindex', () => {
    it('should reindex when reindex function is called', () => {
      const { result } = renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      act(() => {
        result.current.reindex();
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(mockAddress);
    });

    it('should not reindex when address is null', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      act(() => {
        result.current.reindex();
      });

      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should be callable multiple times', () => {
      const { result } = renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      act(() => {
        result.current.reindex();
        result.current.reindex();
        result.current.reindex();
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledTimes(3);
    });

    it('should pass correct address to indexTokensFromChain', () => {
      const customAddress = 'GCUSTOM1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789AB';

      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: customAddress,
          isConnected: true,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      act(() => {
        result.current.reindex();
      });

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(customAddress);
    });
  });

  describe('Indexed token count', () => {
    it('should return 0 when no tokens indexed', () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: [],
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      expect(result.current.indexedTokenCount).toBe(0);
    });

    it('should return correct count for multiple tokens', () => {
      const mockTokens = [
        { address: 'token1' },
        { address: 'token2' },
        { address: 'token3' },
        { address: 'token4' },
        { address: 'token5' },
      ];

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: mockTokens,
        };
        return selector(state);
      });

      const { result } = renderHook(() => useTokenIndexer());

      expect(result.current.indexedTokenCount).toBe(5);
    });

    it('should update count when tokens change', () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: [{ address: 'token1' }],
        };
        return selector(state);
      });

      const { result, rerender } = renderHook(() => useTokenIndexer());

      expect(result.current.indexedTokenCount).toBe(1);

      // Simulate tokens being added
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: [{ address: 'token1' }, { address: 'token2' }],
        };
        return selector(state);
      });

      rerender();

      expect(result.current.indexedTokenCount).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle wallet address change', () => {
      const address1 = 'GABC123XYZ456DEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEF1234';
      const address2 = 'GXYZ789ABC123DEFGHIJKLMNOPQRSTUVWXYZ123456789ABCDEF5678';

      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: address1,
          isConnected: true,
        };
        return selector(state);
      });

      const { rerender } = renderHook(() => useTokenIndexer());

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(address1);

      mockIndexTokensFromChain.mockClear();

      // Change address
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: address2,
          isConnected: true,
        };
        return selector(state);
      });

      rerender();

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith(address2);
    });

    it('should handle wallet disconnect', () => {
      const { rerender } = renderHook(() => useTokenIndexer());

      mockIndexTokensFromChain.mockClear();

      // Disconnect wallet
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          address: null,
          isConnected: false,
        };
        return selector(state);
      });

      rerender();

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should not index after disconnect
      expect(mockIndexTokensFromChain).not.toHaveBeenCalled();
    });

    it('should handle indexing state changes', () => {
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: false,
          indexedTokens: [],
        };
        return selector(state);
      });

      const { result, rerender } = renderHook(() => useTokenIndexer());

      expect(result.current.isIndexing).toBe(false);

      // Simulate indexing starting
      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          indexTokensFromChain: mockIndexTokensFromChain,
          isIndexing: true,
          indexedTokens: [],
        };
        return selector(state);
      });

      rerender();

      expect(result.current.isIndexing).toBe(true);
    });
  });
});
