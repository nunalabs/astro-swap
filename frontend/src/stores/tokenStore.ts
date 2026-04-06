/**
 * Token Store (Legacy Compatibility Wrapper)
 *
 * Maintains backward compatibility with existing code
 * while internally using useTokenListStore.
 */

import { create } from 'zustand';
import { useTokenListStore, BASE_TOKENS, NATIVE_XLM_SAC, USDC_TESTNET_SAC, mergeTokenLists } from './tokenListStore';
import { indexTokensFromFactory, fetchTokenMetadata } from '../lib/token-indexer';
import {
  getWhitelistTokens,
  discoverTokens,
  fetchStellarExpertTokens,
} from '../lib/tokens';
import type { Token } from '../types';

interface TokenState {
  // Legacy state - proxied from tokenListStore
  tokens: Token[];
  indexedTokens: Token[];
  discoveredTokens: Token[];
  favoriteTokens: string[];
  customTokens: Token[];
  isLoading: boolean;
  isIndexing: boolean;
  isSearching: boolean;
  lastIndexTime: number | null;
  lastDiscoveryTime: number | null;

  // Core operations - proxied to tokenListStore
  addToken: (token: Token) => void;
  addCustomToken: (token: Token) => Promise<boolean>;
  removeToken: (address: string) => void;
  updateTokenBalance: (address: string, balance: string) => void;
  updateTokenPrice: (address: string, price: number) => void;
  toggleFavorite: (address: string) => void;
  getToken: (address: string) => Token | undefined;

  // Search operations
  searchTokens: (query: string) => Token[];
  searchTokensAsync: (query: string) => Promise<Token[]>;

  // Discovery operations
  loadTokensFromNetwork: () => Promise<void>;
  discoverAllTokens: () => Promise<void>;
  indexTokensFromChain: (walletAddress: string) => Promise<void>;
  fetchAndAddToken: (contractAddress: string) => Promise<Token | null>;

  // Filters
  getVerifiedTokens: () => Token[];
  getPopularTokens: () => Token[];
}

export const useTokenStore = create<TokenState>((set, get) => ({
  // Initial state
  tokens: BASE_TOKENS,
  indexedTokens: [],
  discoveredTokens: [],
  favoriteTokens: useTokenListStore.getState().favoriteTokens,
  customTokens: useTokenListStore.getState().customTokens,
  isLoading: false,
  isIndexing: false,
  isSearching: false,
  lastIndexTime: null,
  lastDiscoveryTime: null,

  // Core operations - proxy to tokenListStore
  addToken: (token: Token) => {
    useTokenListStore.getState().addToken(token);
    syncFromTokenListStore(set);
  },

  addCustomToken: async (token: Token) => {
    const result = await useTokenListStore.getState().addCustomToken(token);
    syncFromTokenListStore(set);
    return result;
  },

  removeToken: (address: string) => {
    useTokenListStore.getState().removeToken(address);
    syncFromTokenListStore(set);
  },

  updateTokenBalance: (address: string, balance: string) => {
    useTokenListStore.getState().updateTokenBalance(address, balance);
    syncFromTokenListStore(set);
  },

  updateTokenPrice: (address: string, price: number) => {
    useTokenListStore.getState().updateTokenPrice(address, price);
    syncFromTokenListStore(set);
  },

  toggleFavorite: (address: string) => {
    useTokenListStore.getState().toggleFavorite(address);
    syncFromTokenListStore(set);
  },

  getToken: (address: string) => {
    return useTokenListStore.getState().getToken(address);
  },

  // Search operations
  searchTokens: (query: string) => {
    const tokens = useTokenListStore.getState().tokens;
    const lowerQuery = query.toLowerCase();

    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(lowerQuery) ||
        token.name.toLowerCase().includes(lowerQuery) ||
        token.address.toLowerCase().includes(lowerQuery)
    );
  },

  searchTokensAsync: async (query: string) => {
    if (!query || query.length < 2) {
      return useTokenListStore.getState().tokens;
    }

    set({ isSearching: true });

    try {
      // Search local
      const localResults = get().searchTokens(query);

      // Search external
      const discoveredResults = await discoverTokens(query);

      // Merge
      const mergedMap = new Map<string, Token>();

      for (const token of localResults) {
        mergedMap.set(token.address, token);
      }

      for (const token of discoveredResults) {
        if (!mergedMap.has(token.address)) {
          mergedMap.set(token.address, token);
        }
      }

      const results = Array.from(mergedMap.values());

      set({ isSearching: false });
      return results;
    } catch {
      set({ isSearching: false });
      return get().searchTokens(query);
    }
  },

  // Filters
  getVerifiedTokens: () => {
    return useTokenListStore.getState().getVerifiedTokens();
  },

  getPopularTokens: () => {
    return useTokenListStore.getState().getPopularTokens();
  },

  // Discovery operations
  discoverAllTokens: async () => {
    const { isLoading, lastDiscoveryTime } = get();

    // Rate limit
    if (isLoading) return;
    if (lastDiscoveryTime && Date.now() - lastDiscoveryTime < 120000) return;

    set({ isLoading: true });

    try {
      const [whitelistTokens, expertTokens] = await Promise.all([
        Promise.resolve(getWhitelistTokens()),
        fetchStellarExpertTokens({ limit: 50 }),
      ]);

      const { customTokens, indexedTokens } = get();

      const allTokens = mergeTokenLists(
        whitelistTokens,
        expertTokens,
        indexedTokens,
        customTokens
      );

      useTokenListStore.getState().setTokens(allTokens);

      set({
        tokens: allTokens,
        discoveredTokens: [...whitelistTokens, ...expertTokens],
        isLoading: false,
        lastDiscoveryTime: Date.now(),
      });
    } catch {
      set({ isLoading: false });
    }
  },

  loadTokensFromNetwork: async () => {
    set({ isLoading: true });

    try {
      const { customTokens, indexedTokens } = get();
      const allTokens = mergeTokenLists(BASE_TOKENS, indexedTokens, customTokens);

      useTokenListStore.getState().setTokens(allTokens);

      set({
        tokens: allTokens,
        isLoading: false
      });
    } catch {
      set({ isLoading: false });
    }
  },

  indexTokensFromChain: async (walletAddress: string) => {
    const { isIndexing, lastIndexTime } = get();

    // Rate limit
    if (isIndexing) return;
    if (lastIndexTime && Date.now() - lastIndexTime < 60000) return;

    set({ isIndexing: true });

    try {
      const discoveredTokens = await indexTokensFromFactory(walletAddress);
      const { customTokens } = get();
      const allTokens = mergeTokenLists(BASE_TOKENS, discoveredTokens, customTokens);

      useTokenListStore.getState().setTokens(allTokens);

      set({
        tokens: allTokens,
        indexedTokens: discoveredTokens,
        isIndexing: false,
        lastIndexTime: Date.now(),
      });
    } catch {
      set({ isIndexing: false });
    }
  },

  fetchAndAddToken: async (contractAddress: string) => {
    try {
      const existingToken = get().tokens.find(t => t.address === contractAddress);
      if (existingToken) {
        return existingToken;
      }

      const token = await fetchTokenMetadata(contractAddress);

      if (token) {
        await get().addCustomToken(token);
        return token;
      }

      return null;
    } catch {
      return null;
    }
  },
}));

/**
 * Sync state from tokenListStore to legacy tokenStore
 */
function syncFromTokenListStore(set: (state: Partial<TokenState>) => void) {
  const listStore = useTokenListStore.getState();
  set({
    tokens: listStore.tokens,
    favoriteTokens: listStore.favoriteTokens,
    customTokens: listStore.customTokens,
  });
}

// Subscribe to tokenListStore changes
useTokenListStore.subscribe((state) => {
  useTokenStore.setState({
    tokens: state.tokens,
    favoriteTokens: state.favoriteTokens,
    customTokens: state.customTokens,
  });
});

// Export for compatibility
export { NATIVE_XLM_SAC, USDC_TESTNET_SAC, BASE_TOKENS };
