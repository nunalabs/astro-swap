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
    refetchInterval: 30000, // Refresh every 30 seconds
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

/**
 * Hook to fetch all token balances for connected wallet
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

      await Promise.all(
        tokens.map(async (token) => {
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
        })
      );

      // Update all balances in the store
      Object.entries(balances).forEach(([tokenAddress, balance]) => {
        updateTokenBalance(tokenAddress, balance);
      });

      return balances;
    },
    enabled: !!address && tokens.length > 0,
    staleTime: 15000,
    refetchInterval: 60000,
  });

  return {
    isLoading,
    refetch,
  };
}
