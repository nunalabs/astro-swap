import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useTokenStore } from '../stores/tokenStore';
import {
  getStakingPoolCount,
  getStakingPoolInfo,
  getPendingRewards,
  getUserStakeInfo,
} from '../lib/contracts';
import { fetchTokenMetadata } from '../lib/token-indexer';
import { HORIZON_SYNC_DELAY } from '../lib/constants';
import type { StakingPool, Token } from '../types';

/**
 * Calculate APR from reward rate and total staked
 * Formula: APR = (rewardPerSecond * 31536000 / totalStaked) * 100
 * where 31536000 = seconds in a year
 */
function calculateStakingAPR(
  rewardPerSecond: string,
  totalStaked: string,
  rewardDecimals: number,
  stakedDecimals: number
): number {
  const rewardRate = BigInt(rewardPerSecond);
  const staked = BigInt(totalStaked);

  if (staked === 0n) return 0;

  // Yearly rewards (seconds in year = 31536000)
  const yearlyRewards = rewardRate * 31536000n;

  // Adjust for decimal differences and calculate percentage
  // APR = (yearlyRewards / totalStaked) * 100
  const decimalsAdjust = 10n ** BigInt(Math.abs(rewardDecimals - stakedDecimals));

  // Scale up for precision, then divide
  const scaledAPR = (yearlyRewards * 10000n * decimalsAdjust) / staked;

  return Number(scaledAPR) / 100; // Convert to percentage
}

/**
 * Transform contract StakingPool data to frontend format
 */
async function transformStakingPool(
  contractPool: any,
  userAddress: string | null,
  getToken: (address: string) => Token | undefined
): Promise<StakingPool | null> {
  try {
    // Fetch token metadata in parallel
    const [lpTokenMeta, rewardTokenMeta] = await Promise.all([
      fetchTokenMetadata(contractPool.lp_token, userAddress || undefined),
      fetchTokenMetadata(contractPool.reward_token, userAddress || undefined),
    ]);

    if (!lpTokenMeta || !rewardTokenMeta) {
      console.error('Failed to fetch token metadata for pool', contractPool.pool_id);
      return null;
    }

    // Build Token objects (check token store first)
    const lpToken: Token = getToken(contractPool.lp_token) || {
      address: contractPool.lp_token,
      symbol: lpTokenMeta.symbol,
      name: lpTokenMeta.name,
      decimals: lpTokenMeta.decimals,
      logoURI: lpTokenMeta.logoURI,
    };

    const rewardToken: Token = getToken(contractPool.reward_token) || {
      address: contractPool.reward_token,
      symbol: rewardTokenMeta.symbol,
      name: rewardTokenMeta.name,
      decimals: rewardTokenMeta.decimals,
      logoURI: rewardTokenMeta.logoURI,
    };

    // Format bigint values to strings
    const totalStaked = String(contractPool.total_staked);
    const rewardRate = String(contractPool.reward_per_second);

    // Calculate APR (simplified - assumes 1:1 price ratio)
    const apr = calculateStakingAPR(
      rewardRate,
      totalStaked,
      rewardToken.decimals,
      lpToken.decimals
    );

    // Get user-specific data if connected
    let userStaked: string | undefined;
    let userRewards: string | undefined;

    if (userAddress) {
      try {
        const [stakeInfo, pendingRewards] = await Promise.all([
          getUserStakeInfo(String(contractPool.pool_id), userAddress, userAddress),
          getPendingRewards(contractPool.pool_id, userAddress, userAddress),
        ]);

        if (stakeInfo) {
          userStaked = stakeInfo.staked;
        }
        userRewards = pendingRewards;
      } catch (error) {
        // User has no stake - this is expected for new users
        console.debug(`No stake info for user in pool ${contractPool.pool_id}`);
      }
    }

    return {
      address: String(contractPool.pool_id), // pool_id as string for frontend
      lpToken,
      rewardToken,
      totalStaked,
      rewardRate,
      apr,
      userStaked,
      userRewards,
      startTime: Number(contractPool.start_time),
      endTime: Number(contractPool.end_time),
    };
  } catch (error) {
    console.error('Error transforming staking pool:', error);
    return null;
  }
}

export function useStakingPools() {
  const address = useWalletStore((state) => state.address);
  const queryClient = useQueryClient();
  const getToken = useTokenStore((state) => state.getToken);

  const {
    data: pools = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['staking-pools', address],
    queryFn: async () => {
      // Use dummy address for fetching pool data when not connected
      const dummyAddress = address || 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

      console.log('🔍 Fetching staking pools...');

      // Step 1: Get total pool count
      const poolCount = await getStakingPoolCount(dummyAddress);

      if (poolCount === 0) {
        console.log('No staking pools found');
        return [];
      }

      console.log(`📊 Found ${poolCount} staking pools`);

      // Step 2: Fetch all pool info in parallel
      const poolPromises: Promise<StakingPool | null>[] = [];

      for (let i = 1; i <= poolCount; i++) {
        // pool_id starts at 1
        poolPromises.push(
          (async () => {
            try {
              const contractPool = await getStakingPoolInfo(i, dummyAddress);
              if (!contractPool) {
                console.warn(`Failed to fetch pool ${i}`);
                return null;
              }

              return transformStakingPool(contractPool, address, getToken);
            } catch (error) {
              console.error(`Error fetching pool ${i}:`, error);
              return null;
            }
          })()
        );
      }

      const results = await Promise.all(poolPromises);

      // Filter out failed pools and check pool status
      const now = Math.floor(Date.now() / 1000);
      const validPools = results
        .filter((pool): pool is StakingPool => pool !== null)
        .filter((pool) => {
          // Filter out pools that have ended, unless user has stake in them
          if (pool.endTime < now && !pool.userStaked) {
            console.log(`Pool ${pool.address} ended, skipping`);
            return false;
          }

          // Filter out pools that haven't started yet (optional)
          // Uncomment if you want to hide future pools
          // if (pool.startTime > now) {
          //   console.log(`Pool ${pool.address} not started yet, skipping`);
          //   return false;
          // }

          return true;
        });

      console.log(`✅ Loaded ${validPools.length} active staking pools`);
      return validPools;
    },
    enabled: true, // Fetch even without wallet
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Invalidation helper for use after transactions
  const invalidateStakingPools = () => {
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['staking-pools'] });
      queryClient.invalidateQueries({ queryKey: ['stake-info'] });
      queryClient.invalidateQueries({ queryKey: ['token-balance'] });
    }, HORIZON_SYNC_DELAY);
  };

  return {
    pools,
    isLoading,
    error,
    refetch,
    invalidateStakingPools,
  };
}
