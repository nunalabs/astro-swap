import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { stake, unstake, claimRewards, getUserStakeInfo, approveToken, CONTRACTS } from '../lib/contracts';
import { HORIZON_SYNC_DELAY } from '../lib/constants';

export function useStaking(poolId?: string) {
  const address = useWalletStore((state) => state.address);
  const addToast = useSettingsStore((state) => state.addToast);
  const queryClient = useQueryClient();

  // Fetch user stake info
  const { data: stakeInfo, isLoading } = useQuery({
    queryKey: ['stake-info', poolId, address],
    queryFn: async () => {
      if (!poolId || !address) return null;

      return getUserStakeInfo(poolId, address, address);
    },
    enabled: !!poolId && !!address,
    staleTime: 10000, // 10 seconds
  });

  // Stake mutation
  const stakeMutation = useMutation({
    mutationFn: async ({ amount, lpTokenAddress }: { amount: string; lpTokenAddress: string }) => {
      if (!poolId || !address) throw new Error('Missing required parameters');

      console.log('🔓 Approving LP token for staking...', { lpTokenAddress, amount });

      // First approve LP token spending by staking contract
      await approveToken(lpTokenAddress, CONTRACTS.STAKING, amount, address);

      console.log('✅ LP token approved, executing stake...');

      return stake(poolId, amount, address);
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Staked Successfully',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Refresh stake info and balances after Horizon syncs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        queryClient.invalidateQueries({ queryKey: ['staking-pools'] });
        queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      }, HORIZON_SYNC_DELAY);
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Staking Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  // Unstake mutation
  const unstakeMutation = useMutation({
    mutationFn: async ({ amount }: { amount: string }) => {
      if (!poolId || !address) throw new Error('Missing required parameters');

      return unstake(poolId, amount, address);
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Unstaked Successfully',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Refresh stake info and balances after Horizon syncs
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        queryClient.invalidateQueries({ queryKey: ['staking-pools'] });
        queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      }, HORIZON_SYNC_DELAY);
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Unstaking Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  // Claim rewards mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!poolId || !address) throw new Error('Missing required parameters');

      return claimRewards(poolId, address);
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Rewards Claimed',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Refresh stake info and balances after Horizon syncs (rewards are tokens)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['stake-info'] });
        queryClient.invalidateQueries({ queryKey: ['staking-pools'] });
        queryClient.invalidateQueries({ queryKey: ['token-balance'] });
      }, HORIZON_SYNC_DELAY);
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  return {
    stakeInfo,
    isLoading,
    stake: stakeMutation.mutate,
    unstake: unstakeMutation.mutate,
    claimRewards: claimMutation.mutate,
    isStaking: stakeMutation.isPending,
    isUnstaking: unstakeMutation.isPending,
    isClaiming: claimMutation.isPending,
  };
}
