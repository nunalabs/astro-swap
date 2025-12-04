import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useTokenStore, NATIVE_XLM_SAC } from '../stores/tokenStore';
import { getTokenBalance, getAccountBalance } from '../lib/stellar';
import type { Token } from '../types';

/**
 * Hook to fetch and update token balance for a specific token
 */
export function useTokenBalance(token: Token | null) {
  const address = useWalletStore((state) => state.address);
  const updateTokenBalance = useTokenStore((state) => state.updateTokenBalance);

  const { data: balance, isLoading } = useQuery({
    queryKey: ['tokenBalance', token?.address, address],
    queryFn: async () => {
      if (!token || !address) return '0';

      try {
        // For native XLM, use the account balance
        if (token.address === NATIVE_XLM_SAC || token.symbol === 'XLM') {
          const xlmBalance = await getAccountBalance(address);
          return xlmBalance;
        }

        // For other tokens, use the token contract balance
        const tokenBalance = await getTokenBalance(address, token.address);
        return tokenBalance;
      } catch (error) {
        console.error('Error fetching token balance:', error);
        return '0';
      }
    },
    enabled: !!token && !!address,
    staleTime: 10000, // 10 seconds
    // PERFORMANCE: Removed refetchInterval to reduce RPC calls
    // Balances are invalidated after transactions via queryClient.invalidateQueries
    refetchOnWindowFocus: true, // Refresh when user returns to tab
  });

  // Update the token store when balance changes
  useEffect(() => {
    if (token && balance) {
      updateTokenBalance(token.address, balance);
    }
  }, [token, balance, updateTokenBalance]);

  return {
    balance: balance || '0',
    isLoading,
  };
}

// PERFORMANCE: Rate-limited batch processing to avoid overwhelming RPC
const BATCH_SIZE = 5; // Process 5 tokens at a time
const BATCH_DELAY = 100; // 100ms between batches

async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = BATCH_SIZE,
  delayMs: number = BATCH_DELAY
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    // Add delay between batches (except for the last one)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Hook to fetch all token balances for connected wallet
 * Uses rate-limited batching to avoid overwhelming the RPC
 */
export function useAllTokenBalances() {
  const address = useWalletStore((state) => state.address);
  const tokens = useTokenStore((state) => state.tokens);
  const updateTokenBalance = useTokenStore((state) => state.updateTokenBalance);

  const { isLoading, refetch } = useQuery({
    queryKey: ['allTokenBalances', address, tokens.map(t => t.address).join(',')],
    queryFn: async () => {
      if (!address) return {};

      const balances: Record<string, string> = {};

      // PERFORMANCE: Process tokens in rate-limited batches
      await processBatch(tokens, async (token) => {
        try {
          if (token.address === NATIVE_XLM_SAC || token.symbol === 'XLM') {
            balances[token.address] = await getAccountBalance(address);
          } else {
            balances[token.address] = await getTokenBalance(address, token.address);
          }
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          balances[token.address] = '0';
        }
        return balances[token.address];
      });

      // Update all balances in the store
      Object.entries(balances).forEach(([tokenAddress, balance]) => {
        updateTokenBalance(tokenAddress, balance);
      });

      return balances;
    },
    enabled: !!address && tokens.length > 0,
    staleTime: 15000,
    // PERFORMANCE: Removed refetchInterval to reduce RPC calls
    // Call refetch() manually after transactions complete
    refetchOnWindowFocus: true,
  });

  return {
    isLoading,
    refetch,
  };
}
