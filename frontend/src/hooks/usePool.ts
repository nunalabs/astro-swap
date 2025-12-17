import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTokenStore } from '../stores/tokenStore';
import {
  getAllPairs,
  getReserves,
  getTotalSupply,
  addLiquidity,
  removeLiquidity,
} from '../lib/contracts';
import { getPairTokens, fetchTokenMetadata } from '../lib/token-indexer';
import type { Pool, Token } from '../types';

export function usePool() {
  const address = useWalletStore((state) => state.address);
  const deadline = useSettingsStore((state) => state.deadline);
  const addToast = useSettingsStore((state) => state.addToast);
  const queryClient = useQueryClient();
  const getToken = useTokenStore((state) => state.getToken);

  // Fetch all pools with real token data
  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['pools', address],
    queryFn: async () => {
      if (!address) return [];

      const pairAddresses = await getAllPairs(address);

      if (!pairAddresses || pairAddresses.length === 0) {
        console.log('No pairs found from factory');
        return [];
      }

      // Fetch details for each pair
      const poolPromises = pairAddresses.map(async (pairAddress) => {
        try {
          // Get tokens from pair contract
          const pairTokens = await getPairTokens(pairAddress);
          if (!pairTokens) {
            console.error(`Failed to get tokens for pair ${pairAddress}`);
            return null;
          }

          // Get reserves and total supply in parallel
          const [reserves, totalSupply] = await Promise.all([
            getReserves(pairAddress, address),
            getTotalSupply(pairAddress, address),
          ]);

          // Get token metadata (check cache first)
          let token0: Token | null = getToken(pairTokens.token0) || null;
          let token1: Token | null = getToken(pairTokens.token1) || null;

          // Fetch metadata if not in store
          if (!token0) {
            token0 = await fetchTokenMetadata(pairTokens.token0);
          }
          if (!token1) {
            token1 = await fetchTokenMetadata(pairTokens.token1);
          }

          // Fallback if metadata fetch fails
          if (!token0) {
            token0 = {
              address: pairTokens.token0,
              symbol: pairTokens.token0.slice(0, 6),
              name: 'Unknown Token',
              decimals: 7,
            };
          }
          if (!token1) {
            token1 = {
              address: pairTokens.token1,
              symbol: pairTokens.token1.slice(0, 6),
              name: 'Unknown Token',
              decimals: 7,
            };
          }

          return {
            address: pairAddress,
            token0,
            token1,
            reserve0: reserves?.reserve0 || '0',
            reserve1: reserves?.reserve1 || '0',
            totalSupply,
            lpTokenAddress: pairAddress,
            fee: 30, // 0.30%
          } as Pool;
        } catch (error) {
          console.error(`Error fetching pool data for ${pairAddress}:`, error);
          return null;
        }
      });

      const results = await Promise.all(poolPromises);
      return results.filter((pool): pool is Pool => pool !== null);
    },
    enabled: !!address,
    staleTime: 30000,
  });

  // Add liquidity mutation
  const addLiquidityMutation = useMutation({
    mutationFn: async ({
      tokenA,
      tokenB,
      amountA,
      amountB,
      slippage,
    }: {
      tokenA: Token;
      tokenB: Token;
      amountA: string;
      amountB: string;
      slippage: number;
    }) => {
      if (!address) throw new Error('Wallet not connected');

      const amountAMin = (parseFloat(amountA) * (1 - slippage / 100)).toString();
      const amountBMin = (parseFloat(amountB) * (1 - slippage / 100)).toString();
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      return addLiquidity(
        tokenA.address,
        tokenB.address,
        amountA,
        amountB,
        amountAMin,
        amountBMin,
        address,
        deadlineTimestamp,
        address
      );
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Liquidity Added',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Refresh pools and balances
      queryClient.invalidateQueries({ queryKey: ['pools'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['token-balances'] });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Failed to Add Liquidity',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  // Remove liquidity mutation
  const removeLiquidityMutation = useMutation({
    mutationFn: async ({
      tokenA,
      tokenB,
      liquidity,
    }: {
      tokenA: Token;
      tokenB: Token;
      liquidity: string;
    }) => {
      if (!address) throw new Error('Wallet not connected');

      // Calculate minimum amounts based on current reserves
      const amountAMin = '0'; // Calculate based on reserves and slippage
      const amountBMin = '0'; // Calculate based on reserves and slippage
      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      return removeLiquidity(
        tokenA.address,
        tokenB.address,
        liquidity,
        amountAMin,
        amountBMin,
        address,
        deadlineTimestamp,
        address
      );
    },
    onSuccess: (txHash) => {
      addToast({
        type: 'success',
        title: 'Liquidity Removed',
        description: `Transaction hash: ${txHash.slice(0, 10)}...`,
      });

      // Refresh pools and balances
      queryClient.invalidateQueries({ queryKey: ['pools'] });
      queryClient.invalidateQueries({ queryKey: ['tokenBalance'] });
      queryClient.invalidateQueries({ queryKey: ['token-balances'] });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Failed to Remove Liquidity',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
  });

  return {
    pools,
    isLoading,
    addLiquidity: addLiquidityMutation.mutate,
    removeLiquidity: removeLiquidityMutation.mutate,
    isAddingLiquidity: addLiquidityMutation.isPending,
    isRemovingLiquidity: removeLiquidityMutation.isPending,
  };
}
