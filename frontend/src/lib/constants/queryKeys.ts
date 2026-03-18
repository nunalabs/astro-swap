/**
 * Query Keys Factory
 * Centralized query keys for React Query
 *
 * Benefits:
 * - Type-safe query keys
 * - Consistent naming across the app
 * - Easy to invalidate related queries
 * - Prevents typos and bugs
 *
 * Usage:
 * ```typescript
 * import { QUERY_KEYS } from '@/lib/constants/queryKeys';
 *
 * useQuery({
 *   queryKey: QUERY_KEYS.pools(address),
 *   queryFn: fetchPools,
 * });
 *
 * // Invalidate
 * queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pools(address) });
 * ```
 */

export const QUERY_KEYS = {
  /**
   * Pools query keys
   */
  pools: (address?: string) => ['pools', address] as const,

  /**
   * Single pool by address
   */
  pool: (poolAddress: string, walletAddress?: string) =>
    ['pool', poolAddress, walletAddress] as const,

  /**
   * Single token balance
   */
  tokenBalance: (tokenAddress: string, walletAddress: string) =>
    ['tokenBalance', tokenAddress, walletAddress] as const,

  /**
   * All token balances for a wallet
   */
  allTokenBalances: (walletAddress: string) =>
    ['allTokenBalances', walletAddress] as const,

  /**
   * Token balances (legacy key for compatibility)
   */
  tokenBalances: (walletAddress: string) =>
    ['tokenBalances', walletAddress] as const,

  /**
   * Swap quote
   */
  swapQuote: (tokenIn?: string, tokenOut?: string, amountIn?: string) =>
    ['swap-quote', tokenIn, tokenOut, amountIn] as const,

  /**
   * Token metadata
   */
  tokenMetadata: (tokenAddress: string) =>
    ['token-metadata', tokenAddress] as const,

  /**
   * Token list from various sources
   */
  tokens: {
    all: ['tokens'] as const,
    whitelist: ['tokens', 'whitelist'] as const,
    indexed: (address?: string) => ['tokens', 'indexed', address] as const,
    discovered: ['tokens', 'discovered'] as const,
  },

  /**
   * Staking pool info
   */
  stakingPool: (poolAddress: string, walletAddress?: string) =>
    ['staking-pool', poolAddress, walletAddress] as const,

  /**
   * User staking info
   */
  stakingInfo: (poolAddress: string, walletAddress: string) =>
    ['staking-info', poolAddress, walletAddress] as const,

  /**
   * Bridge-related queries
   */
  bridge: {
    status: (txHash: string) => ['bridge-status', txHash] as const,
    quote: (fromChain: string, toChain: string, amount: string) =>
      ['bridge-quote', fromChain, toChain, amount] as const,
  },
} as const;
