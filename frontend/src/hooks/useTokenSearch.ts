/**
 * Token Search Hook
 *
 * Handles token search across multiple sources:
 * - Local tokens (instant)
 * - External APIs (async)
 *
 * Extracted from tokenStore for better separation of concerns.
 */

import { useState, useCallback } from 'react';
import { discoverTokens } from '../lib/tokens';
import { useTokenListStore } from '../stores/tokenListStore';
import type { Token } from '../types';

export function useTokenSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Token[]>([]);

  const { tokens } = useTokenListStore();

  /**
   * Search local tokens (instant)
   */
  const searchLocal = useCallback((query: string): Token[] => {
    if (!query || query.length < 2) {
      return tokens;
    }

    const lowerQuery = query.toLowerCase();

    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.name.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
    );
  }, [tokens]);

  /**
   * Search all sources (async)
   * Queries both local tokens and external APIs
   */
  const searchAsync = useCallback(async (query: string): Promise<Token[]> => {
    if (!query || query.length < 2) {
      const results = tokens;
      setSearchResults(results);
      return results;
    }

    setIsSearching(true);

    try {
      // First, search local tokens
      const localResults = searchLocal(query);

      // Then, search external sources
      const discoveredResults = await discoverTokens(query);

      // Merge results (local first, then discovered)
      const mergedMap = new Map<string, Token>();

      // Local results have priority
      for (const token of localResults) {
        mergedMap.set(token.address, token);
      }

      // Add discovered tokens that aren't already in local
      for (const token of discoveredResults) {
        if (!mergedMap.has(token.address)) {
          mergedMap.set(token.address, token);
        }
      }

      const results = Array.from(mergedMap.values());

      setSearchResults(results);
      setIsSearching(false);
      return results;
    } catch (error) {
      console.error('Error in async token search:', error);
      const fallbackResults = searchLocal(query);
      setSearchResults(fallbackResults);
      setIsSearching(false);
      return fallbackResults;
    }
  }, [tokens, searchLocal]);

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setIsSearching(false);
  }, []);

  return {
    isSearching,
    searchResults,
    searchLocal,
    searchAsync,
    clearSearch,
  };
}
