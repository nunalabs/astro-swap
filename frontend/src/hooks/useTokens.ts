import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useWalletStore } from '../stores/walletStore';
import { useTokenStore } from '../stores/tokenStore';
import { getTokenBalance } from '../lib/stellar';

export function useTokens() {
  const address = useWalletStore((state) => state.address);
  const tokens = useTokenStore((state) => state.tokens);
  const updateTokenBalance = useTokenStore((state) => state.updateTokenBalance);

  // Fetch balances for all tokens
  const { data: balances } = useQuery({
    queryKey: ['token-balances', address, tokens.map((t) => t.address)],
    queryFn: async () => {
      if (!address) return {};

      const balancePromises = tokens.map(async (token) => {
        try {
          const balance = await getTokenBalance(address, token.address);
          return { address: token.address, balance };
        } catch (error) {
          console.error(`Error fetching balance for ${token.symbol}:`, error);
          return { address: token.address, balance: '0' };
        }
      });

      const results = await Promise.all(balancePromises);

      return results.reduce(
        (acc, { address, balance }) => {
          acc[address] = balance;
          return acc;
        },
        {} as Record<string, string>
      );
    },
    enabled: !!address && tokens.length > 0,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Update token balances in store when data changes
  useEffect(() => {
    if (balances) {
      Object.entries(balances).forEach(([address, balance]) => {
        updateTokenBalance(address, balance);
      });
    }
  }, [balances, updateTokenBalance]);

  return {
    tokens,
    balances: balances || {},
  };
}
