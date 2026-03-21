import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStaking } from '../useStaking';
import * as contracts from '../../lib/contracts';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ReactNode } from 'react';

// Mock modules
vi.mock('../../lib/contracts', () => ({
  stake: vi.fn(),
  unstake: vi.fn(),
  claimRewards: vi.fn(),
  getUserStakeInfo: vi.fn(),
}));

vi.mock('../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

describe('useStaking', () => {
  const mockAddress = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const mockPoolId = 'CPOOL1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789ABCD';
  const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const mockAddToast = vi.fn();

  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

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

    vi.mocked(useSettingsStore).mockImplementation((selector: any) =>
      selector({ addToast: mockAddToast })
    );
  });

  describe('Initialization', () => {
    it('should return all expected properties', () => {
      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current).toHaveProperty('stakeInfo');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('stake');
      expect(result.current).toHaveProperty('unstake');
      expect(result.current).toHaveProperty('claimRewards');
      expect(result.current).toHaveProperty('isStaking');
      expect(result.current).toHaveProperty('isUnstaking');
      expect(result.current).toHaveProperty('isClaiming');
    });

    it('should have mutation functions', () => {
      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(typeof result.current.stake).toBe('function');
      expect(typeof result.current.unstake).toBe('function');
      expect(typeof result.current.claimRewards).toBe('function');
    });

    it('should initialize with pending states as false', () => {
      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current.isStaking).toBe(false);
      expect(result.current.isUnstaking).toBe(false);
      expect(result.current.isClaiming).toBe(false);
    });
  });

  describe('Fetching Stake Info', () => {
    it('should fetch stake info when poolId and address provided', async () => {
      const mockStakeInfo = {
        staked: '1000000',
        rewards: '50000',
        lastUpdated: Date.now(),
      };

      vi.mocked(contracts.getUserStakeInfo).mockResolvedValue(mockStakeInfo);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await waitFor(() => {
        expect(contracts.getUserStakeInfo).toHaveBeenCalledWith(
          mockPoolId,
          mockAddress,
          mockAddress
        );
      });

      await waitFor(() => {
        expect(result.current.stakeInfo).toEqual(mockStakeInfo);
      });
    });

    it('should not fetch when poolId is missing', async () => {
      renderHook(() => useStaking(undefined), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(contracts.getUserStakeInfo).not.toHaveBeenCalled();
    });

    it('should not fetch when address is missing', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      renderHook(() => useStaking(mockPoolId), { wrapper });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(contracts.getUserStakeInfo).not.toHaveBeenCalled();
    });

    it('should show loading state while fetching', () => {
      vi.mocked(contracts.getUserStakeInfo).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 100))
      );

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current.isLoading).toBe(true);
    });

    it('should return null when fetch returns null', async () => {
      vi.mocked(contracts.getUserStakeInfo).mockResolvedValue(null);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await waitFor(() => {
        expect(result.current.stakeInfo).toBeNull();
      });
    });
  });

  describe('Stake Mutation', () => {
    it('should call stake contract function', async () => {
      vi.mocked(contracts.stake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(contracts.stake).toHaveBeenCalledWith(
          mockPoolId,
          '1000000',
          mockAddress
        );
      });
    });

    it('should show success toast on successful stake', async () => {
      vi.mocked(contracts.stake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Staked Successfully',
          description: expect.stringContaining(mockTxHash.slice(0, 10)),
        });
      });
    });

    it('should show error toast on stake failure', async () => {
      vi.mocked(contracts.stake).mockRejectedValue(new Error('Insufficient balance'));

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Staking Failed',
          description: 'Insufficient balance',
        });
      });
    });

    it('should invalidate queries on successful stake', async () => {
      vi.mocked(contracts.stake).mockResolvedValue(mockTxHash);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stake-info'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tokenBalance'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['token-balances'] });
      });
    });

    it('should throw error when poolId is missing', async () => {
      const { result } = renderHook(() => useStaking(undefined), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Staking Failed',
          })
        );
      });
    });

    it('should track isStaking state', async () => {
      vi.mocked(contracts.stake).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTxHash), 100))
      );

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current.isStaking).toBe(false);

      act(() => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(result.current.isStaking).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isStaking).toBe(false);
      });
    });
  });

  describe('Unstake Mutation', () => {
    it('should call unstake contract function', async () => {
      vi.mocked(contracts.unstake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.unstake({ amount: '500000' });
      });

      await waitFor(() => {
        expect(contracts.unstake).toHaveBeenCalledWith(
          mockPoolId,
          '500000',
          mockAddress
        );
      });
    });

    it('should show success toast on successful unstake', async () => {
      vi.mocked(contracts.unstake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.unstake({ amount: '500000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Unstaked Successfully',
          description: expect.stringContaining(mockTxHash.slice(0, 10)),
        });
      });
    });

    it('should show error toast on unstake failure', async () => {
      vi.mocked(contracts.unstake).mockRejectedValue(new Error('Insufficient staked amount'));

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.unstake({ amount: '500000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Unstaking Failed',
          description: 'Insufficient staked amount',
        });
      });
    });

    it('should invalidate queries on successful unstake', async () => {
      vi.mocked(contracts.unstake).mockResolvedValue(mockTxHash);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.unstake({ amount: '500000' });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stake-info'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tokenBalance'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['token-balances'] });
      });
    });

    it('should track isUnstaking state', async () => {
      vi.mocked(contracts.unstake).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTxHash), 100))
      );

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current.isUnstaking).toBe(false);

      act(() => {
        result.current.unstake({ amount: '500000' });
      });

      await waitFor(() => {
        expect(result.current.isUnstaking).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isUnstaking).toBe(false);
      });
    });
  });

  describe('Claim Rewards Mutation', () => {
    it('should call claimRewards contract function', async () => {
      vi.mocked(contracts.claimRewards).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(contracts.claimRewards).toHaveBeenCalledWith(mockPoolId, mockAddress);
      });
    });

    it('should show success toast on successful claim', async () => {
      vi.mocked(contracts.claimRewards).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Rewards Claimed',
          description: expect.stringContaining(mockTxHash.slice(0, 10)),
        });
      });
    });

    it('should show error toast on claim failure', async () => {
      vi.mocked(contracts.claimRewards).mockRejectedValue(new Error('No rewards available'));

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Claim Failed',
          description: 'No rewards available',
        });
      });
    });

    it('should invalidate queries on successful claim', async () => {
      vi.mocked(contracts.claimRewards).mockResolvedValue(mockTxHash);

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stake-info'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tokenBalance'] });
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['token-balances'] });
      });
    });

    it('should track isClaiming state', async () => {
      vi.mocked(contracts.claimRewards).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockTxHash), 100))
      );

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      expect(result.current.isClaiming).toBe(false);

      act(() => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(result.current.isClaiming).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isClaiming).toBe(false);
      });
    });

    it('should handle non-Error thrown objects', async () => {
      vi.mocked(contracts.claimRewards).mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.claimRewards();
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Claim Failed',
          description: 'Unknown error occurred',
        });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing address during mutations', async () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) =>
        selector({ address: null })
      );

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '1000000' });
      });

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'error',
            title: 'Staking Failed',
          })
        );
      });
    });

    it('should handle zero amount stake', async () => {
      vi.mocked(contracts.stake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: '0' });
      });

      await waitFor(() => {
        expect(contracts.stake).toHaveBeenCalledWith(mockPoolId, '0', mockAddress);
      });
    });

    it('should handle very large amounts', async () => {
      const largeAmount = '999999999999999999';
      vi.mocked(contracts.stake).mockResolvedValue(mockTxHash);

      const { result } = renderHook(() => useStaking(mockPoolId), { wrapper });

      await act(async () => {
        result.current.stake({ amount: largeAmount });
      });

      await waitFor(() => {
        expect(contracts.stake).toHaveBeenCalledWith(
          mockPoolId,
          largeAmount,
          mockAddress
        );
      });
    });
  });
});
