import { useEffect, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useTokenStore } from '../stores/tokenStore';
import { getTokenBalance } from '../lib/stellar';
import { QUERY_KEYS, STALE_TIME } from '../lib/constants';

/**
 * Hook to fetch and manage token balances
 *
 * OPTIMIZATION: Uses individual queries per token to avoid N+1 pattern issues:
 * - Each token has independent cache entry
 * - Only changed tokens trigger refetches
 * - Stale balances show instantly while fresh data loads
 * - Rate limiter prevents overwhelming RPC
 */
export function useTokens() {
  const address = useWalletStore((state) => state.address);
  const tokens = useTokenStore((state) => state.tokens);
  const updateTokenBalance = useTokenStore((state) => state.updateTokenBalance);

  // Create individual queries for each token balance
  // This allows React Query to cache and invalidate each token independently
  const balanceQueries = useQueries({
    queries: tokens.map((token) => ({
      queryKey: QUERY_KEYS.tokenBalance(token.address, address || ''),
      queryFn: async () => {
        if (!address) return '0';

        try {
          return await getTokenBalance(address, token.address);
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          return '0';
        }
      },
      enabled: !!address,
      staleTime: STALE_TIME.BALANCES,
      refetchOnWindowFocus: true,
      // Keep stale data while refetching for better UX
      placeholderData: (previousData: string | undefined) => previousData,
    })),
  });

  // Aggregate balances from individual queries
  const balances = useMemo(() => {
    return tokens.reduce(
      (acc, token, index) => {
        const queryResult = balanceQueries[index];
        if (queryResult?.data) {
          acc[token.address] = queryResult.data;
        }
        return acc;
      },
      {} as Record<string, string>
    );
  }, [tokens, balanceQueries]);

  // Update token balances in store when data changes
  // 🔥 FIX: Don't include updateTokenBalance in deps (it's stable from Zustand)
  // Only update if balance actually changed to prevent infinite loop
  useEffect(() => {
    Object.entries(balances).forEach(([address, balance]) => {
      const currentToken = tokens.find(t => t.address === address);
      // Only update if balance changed
      if (currentToken?.balance !== balance) {
        updateTokenBalance(address, balance);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balances]); // Only depend on balances, not updateTokenBalance

  return {
    tokens,
    balances,
  };
}
