import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTokenStore } from '../stores/tokenStore';
import {
  getAllPairs,
  getReserves,
  getReservesForPair,
  getTotalSupply,
  addLiquidity,
  removeLiquidity,
  getPairAddress,
} from '../lib/contracts';
import { getPairTokens, fetchTokenMetadata } from '../lib/token-indexer';
import { parseTokenAmount, applySlippage } from '../lib/utils';
import { HORIZON_SYNC_DELAY, STALE_TIME, LP_DECIMALS } from '../lib/constants';
import { isReplayTransaction } from '../lib/tx-replay-guard';
import { validateReserveFreshness } from '../lib/reserve-staleness';
import type { Pool, Token } from '../types';

export function usePool() {
  const address = useWalletStore((state) => state.address);
  const deadline = useSettingsStore((state) => state.deadline);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);
  const addToast = useSettingsStore((state) => state.addToast);
  const queryClient = useQueryClient();
  const getToken = useTokenStore((state) => state.getToken);

  // Fetch pools with smart refetch configuration
  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['pools', address],
    queryFn: async () => {
      if (!address) return [];

      const pairAddresses = await getAllPairs(address);

      if (!pairAddresses || pairAddresses.length === 0) {
        return [];
      }

      // Fetch details for each pair
      const poolPromises = pairAddresses.map(async (pairAddress) => {
        try {
          // Get tokens from pair contract
          const pairTokens = await getPairTokens(pairAddress);
          if (!pairTokens) {
            return null;
          }

          // Fetch total supply (reserves will be fetched later with proper matching)
          const totalSupply = await getTotalSupply(pairAddress, address);

          // Get token metadata
          const [token0Meta, token1Meta] = await Promise.all([
            fetchTokenMetadata(pairTokens.token0),
            fetchTokenMetadata(pairTokens.token1),
          ]);

          if (!token0Meta || !token1Meta) {
            return null;
          }

          const token0: Token = getToken(pairTokens.token0) || {
            address: pairTokens.token0,
            symbol: token0Meta.symbol,
            name: token0Meta.name,
            decimals: token0Meta.decimals,
            logoURI: token0Meta.logoURI,
          };

          const token1: Token = getToken(pairTokens.token1) || {
            address: pairTokens.token1,
            symbol: token1Meta.symbol,
            name: token1Meta.name,
            decimals: token1Meta.decimals,
            logoURI: token1Meta.logoURI,
          };

          // Use getReservesForPair to ensure correct reserve ordering
          // This matches reserves to tokens by fetching both from the contract
          const matchedReserves = await getReservesForPair(
            pairAddress,
            pairTokens.token0,
            pairTokens.token1,
            address
          );

          if (!matchedReserves) {
            return null;
          }

          return {
            address: pairAddress,
            token0,
            token1,
            reserve0: matchedReserves.reserveA,
            reserve1: matchedReserves.reserveB,
            totalSupply,
            lpTokenAddress: pairAddress,
            fee: 30,
          } as Pool;
        } catch (error) {
          return null;
        }
      });

      const poolsWithDetails = await Promise.all(poolPromises);
      const validPools = poolsWithDetails.filter((pool): pool is Pool => pool !== null);

      return validPools;
    },
    enabled: !!address,
    staleTime: STALE_TIME.POOLS,
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch on component mount
  });

  // Add liquidity with optimistic updates
  const addLiquidityMutation = useMutation({
    mutationFn: async ({
      tokenA,
      tokenB,
      amountA,
      amountB,
      slippage = slippageTolerance,
    }: {
      tokenA: Token;
      tokenB: Token;
      amountA: string;
      amountB: string;
      slippage?: number;
    }) => {
      if (!address) throw new Error('Wallet not connected');

      // Parse amounts to raw values
      const rawAmountA = parseTokenAmount(amountA, tokenA.decimals);
      const rawAmountB = parseTokenAmount(amountB, tokenB.decimals);

      // W3-1: Check for replay transaction
      if (isReplayTransaction('addLiquidity', address, {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        amountA: rawAmountA,
        amountB: rawAmountB,
      })) {
        throw new Error('Duplicate transaction detected. Please wait before retrying.');
      }

      // Check if this is first liquidity before calculating minimums
      let isFirstLiquidity = false;
      try {
        const pairAddress = await getPairAddress(tokenA.address, tokenB.address, address);

        if (pairAddress) {
          const reserves = await getReserves(pairAddress, address);

          if (reserves) {
            // W3-2: Validate reserve data freshness
            const stalenessError = validateReserveFreshness(reserves, 'liquidity check');
            if (stalenessError) {
              // Continue with operation despite stale data
            }

            // Check if both reserves are zero (empty pool)
            const reserve0 = BigInt(reserves.reserve0);
            const reserve1 = BigInt(reserves.reserve1);

            if (reserve0 === 0n && reserve1 === 0n) {
              isFirstLiquidity = true;
            }
          } else {
            // Could not fetch reserves - assume first liquidity to be safe
            isFirstLiquidity = true;
          }
        } else {
          // Pool does not exist - definitely first liquidity
          isFirstLiquidity = true;
        }
      } catch (error) {
        isFirstLiquidity = true;
      }

      // Calculate minimum amounts with slippage protection
      // Set amount_min = 0 for first liquidity to prevent Error #203
      const rawAmountAMin = isFirstLiquidity
        ? '0'
        : ((BigInt(rawAmountA) * BigInt(Math.floor((100 - slippage) * 100))) / 10000n).toString();

      const rawAmountBMin = isFirstLiquidity
        ? '0'
        : ((BigInt(rawAmountB) * BigInt(Math.floor((100 - slippage) * 100))) / 10000n).toString();

      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      try {
        const result = await addLiquidity(
          tokenA.address,
          tokenB.address,
          rawAmountA,
          rawAmountB,
          rawAmountAMin,
          rawAmountBMin,
          address,           // to parameter
          deadlineTimestamp,
          address            // sourceAddress
        );
        return { result, rawAmountA, rawAmountB, tokenA, tokenB };
      } catch (error) {
        throw error;
      }
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Failed to Add Liquidity',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
    onSuccess: async (data) => {
      addToast({
        type: 'success',
        title: 'Liquidity Added',
        description: `Transaction hash: ${data.result.slice(0, 10)}...`,
      });

      // Simple refetch with delay - use invalidateQueries to force new object references
      setTimeout(() => {
        // Invalidate with partial keys to catch all variants
        queryClient.invalidateQueries({ queryKey: ['pools', address] }); // Pools for this wallet
        queryClient.invalidateQueries({ queryKey: ['tokenBalance'] }); // Partial match: all individual balances
        queryClient.invalidateQueries({ queryKey: ['allTokenBalances'] }); // All token balances
      }, HORIZON_SYNC_DELAY); // Wait for Horizon to sync
    },
  });

  // Remove liquidity mutation with simple refresh
  const removeLiquidityMutation = useMutation({
    mutationFn: async ({
      tokenA,
      tokenB,
      liquidity,
      pool,
    }: {
      tokenA: Token;
      tokenB: Token;
      liquidity: string;
      pool?: Pool;
    }) => {
      if (!address) throw new Error('Wallet not connected');

      const rawLiquidity = parseTokenAmount(liquidity, LP_DECIMALS);

      // W3-1: Check for replay transaction
      if (isReplayTransaction('removeLiquidity', address, {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        liquidity: rawLiquidity,
      })) {
        throw new Error('Duplicate transaction detected. Please wait before retrying.');
      }

      let amountAMin = '0';
      let amountBMin = '0';

      if (pool && pool.totalSupply) {
        try {
          const liquidityBigInt = BigInt(rawLiquidity);
          const totalSupplyBigInt = BigInt(pool.totalSupply);
          const reserve0BigInt = BigInt(pool.reserve0);
          const reserve1BigInt = BigInt(pool.reserve1);

          // Determine which reserve corresponds to which token
          // pool.reserve0 corresponds to pool.token0, NOT necessarily to tokenA
          let reserveA: bigint;
          let reserveB: bigint;

          if (tokenA.address === pool.token0.address) {
            // tokenA is pool.token0, tokenB is pool.token1
            reserveA = reserve0BigInt;
            reserveB = reserve1BigInt;
          } else {
            // tokenA is pool.token1, tokenB is pool.token0
            reserveA = reserve1BigInt;
            reserveB = reserve0BigInt;
          }

          const expectedAmountA = (liquidityBigInt * reserveA) / totalSupplyBigInt;
          const expectedAmountB = (liquidityBigInt * reserveB) / totalSupplyBigInt;

          // FIXED: Use centralized applySlippage() instead of inline calculation
          amountAMin = applySlippage(expectedAmountA.toString(), slippageTolerance);
          amountBMin = applySlippage(expectedAmountB.toString(), slippageTolerance);
        } catch {
          // Keep defaults (amountAMin = '0', amountBMin = '0')
        }
      }

      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      const result = await removeLiquidity(
        tokenA.address,
        tokenB.address,
        rawLiquidity,
        amountAMin,
        amountBMin,
        address,           // to parameter
        deadlineTimestamp,
        address            // sourceAddress
      );

      return { result, amountAMin, amountBMin, tokenA, tokenB };
    },
    onError: (error) => {
      addToast({
        type: 'error',
        title: 'Failed to Remove Liquidity',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    },
    onSuccess: async (data) => {
      addToast({
        type: 'success',
        title: 'Liquidity Removed',
        description: `Transaction hash: ${data.result.slice(0, 10)}...`,
      });

      // Simple refetch with delay - use invalidateQueries to force new object references
      setTimeout(() => {
        // Invalidate with partial keys to catch all variants
        queryClient.invalidateQueries({ queryKey: ['pools', address] }); // Pools for this wallet
        queryClient.invalidateQueries({ queryKey: ['tokenBalance'] }); // Partial match: all individual balances
        queryClient.invalidateQueries({ queryKey: ['allTokenBalances'] }); // All token balances
      }, HORIZON_SYNC_DELAY); // Wait for Horizon to sync
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
