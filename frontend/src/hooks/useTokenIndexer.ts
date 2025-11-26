import { useEffect } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useTokenStore } from '../stores/tokenStore';

/**
 * Hook that automatically indexes tokens when wallet connects
 * This discovers all tokens with liquidity pools from the factory contract
 */
export function useTokenIndexer() {
  const address = useWalletStore((state) => state.address);
  const isConnected = useWalletStore((state) => state.isConnected);
  const indexTokensFromChain = useTokenStore((state) => state.indexTokensFromChain);
  const isIndexing = useTokenStore((state) => state.isIndexing);
  const indexedTokens = useTokenStore((state) => state.indexedTokens);

  // Index tokens when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      indexTokensFromChain(address);
    }
  }, [isConnected, address, indexTokensFromChain]);

  // Re-index periodically (every 5 minutes)
  useEffect(() => {
    if (!isConnected || !address) return;

    const interval = setInterval(() => {
      indexTokensFromChain(address);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isConnected, address, indexTokensFromChain]);

  return {
    isIndexing,
    indexedTokenCount: indexedTokens.length,
    reindex: () => address && indexTokensFromChain(address),
  };
}
