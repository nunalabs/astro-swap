import { useQuery, useMutation, useQueryClient } from '@tantml:function_calls>import { useWalletStore } from '../stores/walletStore';
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
import { HORIZON_SYNC_DELAY } from '../lib/constants';
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

  // 🔥 OPTIMIZED: Fetch pools with smart refetch configuration
  const { data: pools = [], isLoading } = useQuery({
    queryKey: ['pools', address],
    queryFn: async () => {
      if (!address) return [];

      const pairAddresses = await getAllPairs(address);

      if (!pairAddresses || pairAddresses.length === 0) {
        console.log('No pairs found from factory');
        return [];
      }

      console.log(`🔍 Processing ${pairAddresses.length} pair addresses:`, pairAddresses);

      // Fetch details for each pair
      const poolPromises = pairAddresses.map(async (pairAddress) => {
        console.log(`📦 Fetching details for pair: ${pairAddress}`);
        try {
          // Get tokens from pair contract
          const pairTokens = await getPairTokens(pairAddress);
          if (!pairTokens) {
            console.error(`Failed to get tokens for pair ${pairAddress}`);
            return null;
          }

          // Fetch total supply (reserves will be fetched later with proper matching)
          const totalSupply = await getTotalSupply(pairAddress, address);

          // Get token metadata
          const [token0Meta, token1Meta] = await Promise.all([
            fetchTokenMetadata(pairTokens.token0, address),
            fetchTokenMetadata(pairTokens.token1, address),
          ]);

          if (!token0Meta || !token1Meta) {
            console.error(`Failed to fetch token metadata for pair ${pairAddress}`);
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

          // 🔥 STRUCTURAL FIX: Use getReservesForPair to ensure correct reserve ordering
          // This matches reserves to tokens by fetching both from the contract
          const matchedReserves = await getReservesForPair(
            pairAddress,
            pairTokens.token0,
            pairTokens.token1,
            address
          );

          if (!matchedReserves) {
            console.error(`Failed to fetch matched reserves for pair ${pairAddress}`);
            return null;
          }

          console.log('✅ Pool with matched reserves:', {
            address: pairAddress,
            token0: token0.symbol,
            token1: token1.symbol,
            reserve0: matchedReserves.reserveA,
            reserve1: matchedReserves.reserveB,
          });

          return {
            address: pairAddress,
            token0,
            token1,
            reserve0: matchedReserves.reserveA,
            reserve1: matchedReserves.reserveB,
            totalSupply,
            lpTokenAddress: pairAddress,
            fee: 30, // 0.30%
          } as Pool;
        } catch (error) {
          console.error(`Error fetching pool details for ${pairAddress}:`, error);
          return null;
        }
      });

      const poolsWithDetails = await Promise.all(poolPromises);
      const validPools = poolsWithDetails.filter((pool): pool is Pool => pool !== null);

      // Filter out empty pools in production (reserve0 OR reserve1 = 0)
      const nonEmptyPools = validPools.filter((pool) => {
        const reserve0 = BigInt(pool.reserve0);
        const reserve1 = BigInt(pool.reserve1);

        if (reserve0 === 0n || reserve1 === 0n) {
          console.warn(`⚠️ Empty pool found: ${pool.address} (${pool.token0.symbol}/${pool.token1.symbol}) - showing anyway for debugging`);
          // Keep empty pools for now to allow first liquidity
          return true;
        }

        return true;
      });

      console.log(`✅ Successfully loaded ${nonEmptyPools.length} pools out of ${validPools.length} pairs`);
      return nonEmptyPools;
    },
    enabled: !!address,
    // 🔥 NEW: Smart refetch configuration
    staleTime: 30000, // Consider data fresh for 30s
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch on component mount
  });

  // 🔥 OPTIMIZED: Add liquidity with optimistic updates
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

      console.log('🚀 Starting addLiquidity mutation...', { tokenA: tokenA.symbol, tokenB: tokenB.symbol, amountA, amountB, slippage });

      console.log('✅ Wallet connected:', address);

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

      console.log('💰 Raw amounts calculated:', { rawAmountA, rawAmountB });

      // 🔥 FIX: Check if this is first liquidity before calculating minimums
      console.log('🔍 VERSION CHECK: usePool.ts updated - checking for first liquidity...');
      let isFirstLiquidity = false;
      try {
        const pairAddress = await getPairAddress(tokenA.address, tokenB.address, address);

        if (pairAddress) {
          const reserves = await getReserves(pairAddress, address);

          if (reserves) {
            // W3-2: Validate reserve data freshness
            const stalenessError = validateReserveFreshness(reserves, 'liquidity check');
            if (stalenessError) {
              console.warn('⚠️ Reserve data is stale:', stalenessError);
              // Continue with operation but log warning
            }

            // Check if both reserves are zero (empty pool)
            const reserve0 = BigInt(reserves.reserve0);
            const reserve1 = BigInt(reserves.reserve1);

            if (reserve0 === 0n && reserve1 === 0n) {
              isFirstLiquidity = true;
              console.log('🆕 First liquidity detected - disabling slippage protection');
            } else {
              console.log('📊 Pool has liquidity:', {
                reserve0: reserve0.toString(),
                reserve1: reserve1.toString(),
              });
            }
          } else {
            // Could not fetch reserves - assume first liquidity to be safe
            isFirstLiquidity = true;
            console.log('🆕 Could not fetch reserves - assuming first liquidity');
          }
        } else {
          // Pool does not exist - definitely first liquidity
          isFirstLiquidity = true;
          console.log('🆕 Pool does not exist - first liquidity');
        }
      } catch (error) {
        console.warn('Could not check pool reserves, assuming first liquidity:', error);
        isFirstLiquidity = true;
      }

      // Calculate minimum amounts with slippage protection
      // ✅ FIX: Set amount_min = 0 for first liquidity to prevent Error #203
      const rawAmountAMin = isFirstLiquidity
        ? '0'
        : ((BigInt(rawAmountA) * BigInt(Math.floor((100 - slippage) * 100))) / 10000n).toString();

      const rawAmountBMin = isFirstLiquidity
        ? '0'
        : ((BigInt(rawAmountB) * BigInt(Math.floor((100 - slippage) * 100))) / 10000n).toString();

      const deadlineTimestamp = Math.floor(Date.now() / 1000) + deadline * 60;

      console.log('📊 Transaction parameters:', {
        tokenA: tokenA.address,
        tokenB: tokenB.address,
        rawAmountA,
        rawAmountB,
        rawAmountAMin,
        rawAmountBMin,
        deadline: deadlineTimestamp,
        isFirstLiquidity,
      });

      console.log('📤 Calling addLiquidity contract...');
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
        console.log('✅ addLiquidity success:', result);
        return { result, rawAmountA, rawAmountB, tokenA, tokenB };
      } catch (error) {
        console.error('❌ addLiquidity failed:', error);
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

      const rawLiquidity = parseTokenAmount(liquidity, 7);

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

          // 🔥 FIX: Determine which reserve corresponds to which token
          // pool.reserve0 corresponds to pool.token0, NOT necessarily to tokenA!
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
        } catch (error) {
          console.error('Error calculating minimums, using 0:', error);
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
