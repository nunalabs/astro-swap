/**
 * usePoolGraph Hook
 * Loads ALL pairs from the factory for routing calculations.
 * Does NOT require a connected wallet - uses simulation address.
 * Provides the pool graph needed by the pathfinder.
 */

import { useQuery } from '@tanstack/react-query';
import { getAllPairs } from '../lib/contracts';
import { callContract } from '../lib/stellar';
import { DUMMY_SIMULATION_ADDRESS } from '../lib/constants';

export interface PoolNode {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  feeBps: number;
}

const POOL_GRAPH_STALE_TIME = 60_000; // 1 minute
const POOL_GRAPH_REFETCH_INTERVAL = 60_000;
const FETCH_BATCH_SIZE = 4;
const DEFAULT_FEE_BPS = 30;

/**
 * Fetch pair data: tokens, reserves, and fee in a single batch
 */
async function fetchPairData(pairAddress: string): Promise<PoolNode | null> {
  try {
    const [reserves, token0, token1, feeBps] = await Promise.all([
      callContract(pairAddress, 'get_reserves', [], DUMMY_SIMULATION_ADDRESS),
      callContract(pairAddress, 'token_0', [], DUMMY_SIMULATION_ADDRESS) as Promise<string>,
      callContract(pairAddress, 'token_1', [], DUMMY_SIMULATION_ADDRESS) as Promise<string>,
      callContract(pairAddress, 'fee_bps', [], DUMMY_SIMULATION_ADDRESS)
        .then((v) => Number(v))
        .catch(() => DEFAULT_FEE_BPS),
    ]);

    if (!Array.isArray(reserves) || reserves.length !== 2) return null;

    const r0 = BigInt(reserves[0]?.toString() || '0');
    const r1 = BigInt(reserves[1]?.toString() || '0');

    // Skip empty pools
    if (r0 === 0n || r1 === 0n) return null;

    return {
      pairAddress,
      token0: token0 as string,
      token1: token1 as string,
      reserve0: r0,
      reserve1: r1,
      feeBps: feeBps as number,
    };
  } catch {
    return null;
  }
}

/**
 * Hook that loads all DEX pools for pathfinding.
 * Globally cached - shared across all components.
 */
export function usePoolGraph() {
  return useQuery({
    queryKey: ['poolGraph'],
    queryFn: async (): Promise<PoolNode[]> => {
      const pairAddresses = await getAllPairs(DUMMY_SIMULATION_ADDRESS);
      if (!pairAddresses?.length) return [];

      const pools: PoolNode[] = [];

      // Fetch in batches to avoid overwhelming RPC
      for (let i = 0; i < pairAddresses.length; i += FETCH_BATCH_SIZE) {
        const batch = pairAddresses.slice(i, i + FETCH_BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchPairData));
        for (const result of results) {
          if (result) pools.push(result);
        }
      }

      return pools;
    },
    staleTime: POOL_GRAPH_STALE_TIME,
    refetchInterval: POOL_GRAPH_REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
  });
}
