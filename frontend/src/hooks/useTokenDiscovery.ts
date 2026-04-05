/**
 * Token Discovery Hook
 *
 * Handles token discovery from multiple sources:
 * - Factory contract (on-chain)
 * - StellarExpert API
 * - Whitelist
 *
 * Extracted from tokenStore for better separation of concerns.
 */

import { useState, useCallback } from 'react';
import { indexTokensFromFactory, fetchTokenMetadata } from '../lib/token-indexer';
import { getWhitelistTokens, fetchStellarExpertTokens } from '../lib/tokens';
import { useTokenListStore, mergeTokenLists } from '../stores/tokenListStore';
import type { Token } from '../types';

export function useTokenDiscovery() {
  const [isIndexing, setIsIndexing] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [lastIndexTime, setLastIndexTime] = useState<number | null>(null);
  const [lastDiscoveryTime, setLastDiscoveryTime] = useState<number | null>(null);

  const { setTokens, addCustomToken } = useTokenListStore();

  /**
   * Index tokens from the factory contract
   * Discovers all tokens that have liquidity pools
   */
  const indexTokensFromChain = useCallback(async (walletAddress: string) => {
    // Rate limit to every 60 seconds
    if (isIndexing) return;
    if (lastIndexTime && Date.now() - lastIndexTime < 60000) {
      console.log('Token indexing skipped - rate limited');
      return;
    }

    setIsIndexing(true);

    try {
      console.log('Starting token indexing from factory...');

      const discoveredTokens = await indexTokensFromFactory(walletAddress);

      console.log(`Discovered ${discoveredTokens.length} tokens from factory`);

      // Merge with existing tokens
      const currentTokens = useTokenListStore.getState().tokens;
      const allTokens = mergeTokenLists(currentTokens, discoveredTokens);

      setTokens(allTokens);
      setLastIndexTime(Date.now());
    } catch (error) {
      console.error('Error indexing tokens:', error);
    } finally {
      setIsIndexing(false);
    }
  }, [isIndexing, lastIndexTime, setTokens]);

  /**
   * Discover tokens from all sources
   */
  const discoverAllTokens = useCallback(async () => {
    // Rate limit to every 2 minutes
    if (isDiscovering) return;
    if (lastDiscoveryTime && Date.now() - lastDiscoveryTime < 120000) {
      console.log('Token discovery skipped - rate limited');
      return;
    }

    setIsDiscovering(true);

    try {
      console.log('Starting comprehensive token discovery...');

      const [whitelistTokens, expertTokens] = await Promise.all([
        Promise.resolve(getWhitelistTokens()),
        fetchStellarExpertTokens({ limit: 50 }),
      ]);

      console.log(`Discovered: ${whitelistTokens.length} whitelist, ${expertTokens.length} expert tokens`);

      // Merge with existing tokens
      const currentTokens = useTokenListStore.getState().tokens;
      const allTokens = mergeTokenLists(
        whitelistTokens,
        expertTokens,
        currentTokens
      );

      setTokens(allTokens);
      setLastDiscoveryTime(Date.now());
    } catch (error) {
      console.error('Error discovering tokens:', error);
    } finally {
      setIsDiscovering(false);
    }
  }, [isDiscovering, lastDiscoveryTime, setTokens]);

  /**
   * Fetch a single token by contract address and add it
   */
  const fetchAndAddToken = useCallback(async (contractAddress: string): Promise<Token | null> => {
    try {
      const existingToken = useTokenListStore.getState().getToken(contractAddress);
      if (existingToken) {
        return existingToken;
      }

      const token = await fetchTokenMetadata(contractAddress);

      if (token) {
        await addCustomToken(token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error fetching token:', error);
      return null;
    }
  }, [addCustomToken]);

  return {
    isIndexing,
    isDiscovering,
    lastIndexTime,
    lastDiscoveryTime,
    indexTokensFromChain,
    discoverAllTokens,
    fetchAndAddToken,
  };
}
