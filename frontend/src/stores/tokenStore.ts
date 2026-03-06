import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Token } from '../types';
import { indexTokensFromFactory, fetchTokenMetadata } from '../lib/token-indexer';
import {
  getWhitelistTokens,
  discoverTokens,
  fetchStellarExpertTokens,
} from '../lib/tokens';

// Native XLM wrapped address for Soroban (SAC)
const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Circle USDC on Stellar Testnet
// Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
const USDC_TESTNET_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

// Initialize base tokens from whitelist
const getBaseTokens = (): Token[] => {
  const whitelistTokens = getWhitelistTokens();
  const popularTokens = whitelistTokens.filter(t => t.popular);

  // Fallback if whitelist is empty
  if (popularTokens.length === 0) {
    return [
      {
        address: NATIVE_XLM_SAC,
        symbol: 'XLM',
        name: 'Stellar Lumens',
        decimals: 7,
        logoURI: 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
        verified: true,
        popular: true,
        source: 'whitelist',
      },
      {
        address: USDC_TESTNET_SAC,
        symbol: 'USDC',
        name: 'USD Coin (Testnet)',
        decimals: 7,
        logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
        verified: true,
        popular: true,
        source: 'whitelist',
      },
    ];
  }

  return popularTokens;
};

// Get all whitelist tokens for BASE_TOKENS
const BASE_TOKENS: Token[] = getBaseTokens();

interface TokenState {
  tokens: Token[];
  indexedTokens: Token[]; // Tokens discovered from factory
  discoveredTokens: Token[]; // Tokens from all discovery sources
  favoriteTokens: string[];
  customTokens: Token[];
  isLoading: boolean;
  isIndexing: boolean;
  isSearching: boolean;
  lastIndexTime: number | null;
  lastDiscoveryTime: number | null;
  addToken: (token: Token) => void;
  addCustomToken: (token: Token) => Promise<boolean>;
  removeToken: (address: string) => void;
  updateTokenBalance: (address: string, balance: string) => void;
  updateTokenPrice: (address: string, price: number) => void;
  toggleFavorite: (address: string) => void;
  getToken: (address: string) => Token | undefined;
  searchTokens: (query: string) => Token[];
  searchTokensAsync: (query: string) => Promise<Token[]>; // New: async search with APIs
  loadTokensFromNetwork: () => Promise<void>;
  discoverAllTokens: () => Promise<void>; // New: discover from all sources
  indexTokensFromChain: (walletAddress: string) => Promise<void>;
  fetchAndAddToken: (contractAddress: string) => Promise<Token | null>;
  getVerifiedTokens: () => Token[]; // New: get only verified tokens
  getPopularTokens: () => Token[]; // New: get popular tokens
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      tokens: BASE_TOKENS,
      indexedTokens: [],
      discoveredTokens: [],
      favoriteTokens: [NATIVE_XLM_SAC, USDC_TESTNET_SAC],
      customTokens: [],
      isLoading: false,
      isIndexing: false,
      isSearching: false,
      lastIndexTime: null,
      lastDiscoveryTime: null,

      addToken: (token: Token) => {
        set((state) => {
          const exists = state.tokens.find((t) => t.address === token.address);
          if (exists) return state;

          return {
            tokens: [...state.tokens, token],
          };
        });
      },

      addCustomToken: async (token: Token) => {
        const { tokens } = get();

        if (tokens.find(t => t.address === token.address)) {
          return false;
        }

        set((state) => ({
          tokens: [...state.tokens, token],
          customTokens: [...state.customTokens, token],
        }));

        return true;
      },

      removeToken: (address: string) => {
        // Don't allow removing base tokens
        if (BASE_TOKENS.find(t => t.address === address)) {
          return;
        }

        set((state) => ({
          tokens: state.tokens.filter((t) => t.address !== address),
          customTokens: state.customTokens.filter((t) => t.address !== address),
          indexedTokens: state.indexedTokens.filter((t) => t.address !== address),
          favoriteTokens: state.favoriteTokens.filter((a) => a !== address),
        }));
      },

      updateTokenBalance: (address: string, balance: string) => {
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.address === address ? { ...token, balance } : token
          ),
        }));
      },

      updateTokenPrice: (address: string, price: number) => {
        set((state) => ({
          tokens: state.tokens.map((token) =>
            token.address === address ? { ...token, price } : token
          ),
        }));
      },

      toggleFavorite: (address: string) => {
        set((state) => {
          const isFavorite = state.favoriteTokens.includes(address);

          return {
            favoriteTokens: isFavorite
              ? state.favoriteTokens.filter((a) => a !== address)
              : [...state.favoriteTokens, address],
          };
        });
      },

      getToken: (address: string) => {
        return get().tokens.find((t) => t.address === address);
      },

      searchTokens: (query: string) => {
        const { tokens } = get();
        const lowerQuery = query.toLowerCase();

        return tokens.filter(
          (token) =>
            token.symbol.toLowerCase().includes(lowerQuery) ||
            token.name.toLowerCase().includes(lowerQuery) ||
            token.address.toLowerCase().includes(lowerQuery)
        );
      },

      /**
       * Async search that queries all token sources
       * Use this for the search input to find tokens not yet in local state
       */
      searchTokensAsync: async (query: string) => {
        if (!query || query.length < 2) {
          return get().tokens;
        }

        set({ isSearching: true });

        try {
          // First, search local tokens
          const localResults = get().searchTokens(query);

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

          set({ isSearching: false });
          return results;
        } catch (error) {
          console.error('Error in async token search:', error);
          set({ isSearching: false });
          return get().searchTokens(query);
        }
      },

      /**
       * Get only verified tokens (from whitelist or high-rated)
       */
      getVerifiedTokens: () => {
        return get().tokens.filter(t => t.verified);
      },

      /**
       * Get popular/featured tokens
       */
      getPopularTokens: () => {
        return get().tokens.filter(t => t.popular);
      },

      /**
       * Discover tokens from all sources (whitelist, StellarExpert, etc.)
       */
      discoverAllTokens: async () => {
        const { isLoading, lastDiscoveryTime } = get();

        // Rate limit discovery to every 2 minutes
        if (isLoading) return;
        if (lastDiscoveryTime && Date.now() - lastDiscoveryTime < 120000) {
          console.log('Token discovery skipped - rate limited');
          return;
        }

        set({ isLoading: true });

        try {
          console.log('Starting comprehensive token discovery...');

          // Fetch from all sources
          const [whitelistTokens, expertTokens] = await Promise.all([
            Promise.resolve(getWhitelistTokens()),
            fetchStellarExpertTokens({ limit: 50 }),
          ]);

          console.log(`Discovered: ${whitelistTokens.length} whitelist, ${expertTokens.length} expert tokens`);

          const { customTokens, indexedTokens } = get();

          // Merge all sources with priority
          const allTokens = mergeTokenLists(
            whitelistTokens,      // Highest priority
            expertTokens,         // Second priority
            indexedTokens,        // Third: on-chain discovered
            customTokens          // Lowest: user-added
          );

          set({
            tokens: allTokens,
            discoveredTokens: [...whitelistTokens, ...expertTokens],
            isLoading: false,
            lastDiscoveryTime: Date.now(),
          });
        } catch (error) {
          console.error('Error discovering tokens:', error);
          set({ isLoading: false });
        }
      },

      loadTokensFromNetwork: async () => {
        set({ isLoading: true });

        try {
          const { customTokens, indexedTokens } = get();

          // Merge all token sources, removing duplicates
          const allTokens = mergeTokenLists(BASE_TOKENS, indexedTokens, customTokens);

          set({
            tokens: allTokens,
            isLoading: false
          });
        } catch (error) {
          console.error('Error loading tokens:', error);
          set({ isLoading: false });
        }
      },

      /**
       * Index tokens from the factory contract
       * This discovers all tokens that have liquidity pools
       */
      indexTokensFromChain: async (walletAddress: string) => {
        const { isIndexing, lastIndexTime } = get();

        // Prevent concurrent indexing and rate limit to every 60 seconds
        if (isIndexing) return;
        if (lastIndexTime && Date.now() - lastIndexTime < 60000) {
          console.log('Token indexing skipped - rate limited');
          return;
        }

        set({ isIndexing: true });

        try {
          console.log('Starting token indexing from factory...');

          // Fetch all tokens from factory pairs
          const discoveredTokens = await indexTokensFromFactory(walletAddress);

          console.log(`Discovered ${discoveredTokens.length} tokens from factory`);

          const { customTokens } = get();

          // Merge all token sources
          const allTokens = mergeTokenLists(BASE_TOKENS, discoveredTokens, customTokens);

          set({
            tokens: allTokens,
            indexedTokens: discoveredTokens,
            isIndexing: false,
            lastIndexTime: Date.now(),
          });
        } catch (error) {
          console.error('Error indexing tokens:', error);
          set({ isIndexing: false });
        }
      },

      /**
       * Fetch a single token by contract address and add it
       */
      fetchAndAddToken: async (contractAddress: string) => {
        try {
          const existingToken = get().tokens.find(t => t.address === contractAddress);
          if (existingToken) {
            return existingToken;
          }

          const token = await fetchTokenMetadata(contractAddress);

          if (token) {
            set((state) => ({
              tokens: [...state.tokens, token],
              customTokens: [...state.customTokens, token],
            }));
            return token;
          }

          return null;
        } catch (error) {
          console.error('Error fetching token:', error);
          return null;
        }
      },
    }),
    {
      name: 'astroswap-tokens',
      partialize: (state) => ({
        favoriteTokens: state.favoriteTokens,
        customTokens: state.customTokens,
        indexedTokens: state.indexedTokens,
        discoveredTokens: state.discoveredTokens,
        lastIndexTime: state.lastIndexTime,
        lastDiscoveryTime: state.lastDiscoveryTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Get fresh whitelist tokens
          const whitelistTokens = getWhitelistTokens();

          // Merge all token sources on rehydration with priority
          state.tokens = mergeTokenLists(
            whitelistTokens,           // Whitelist always first
            state.discoveredTokens || [],
            state.indexedTokens || [],
            state.customTokens || []
          );
        }
      },
    }
  )
);

/**
 * Merge multiple token lists, removing duplicates by address
 */
function mergeTokenLists(...lists: Token[][]): Token[] {
  const tokenMap = new Map<string, Token>();

  for (const list of lists) {
    for (const token of list) {
      // Keep the first occurrence (priority: BASE_TOKENS > indexed > custom)
      if (!tokenMap.has(token.address)) {
        tokenMap.set(token.address, token);
      }
    }
  }

  return Array.from(tokenMap.values());
}

// Export constants for use in other files
export { NATIVE_XLM_SAC, USDC_TESTNET_SAC, BASE_TOKENS };
