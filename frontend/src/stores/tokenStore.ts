import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Token } from '../types';
import { indexTokensFromFactory, fetchTokenMetadata } from '../lib/token-indexer';

// Native XLM wrapped address for Soroban (SAC)
const NATIVE_XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Circle USDC on Stellar Testnet
// Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
const USDC_TESTNET_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

// Base tokens that are always available (even without pairs)
const BASE_TOKENS: Token[] = [
  {
    address: NATIVE_XLM_SAC,
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    logoURI: 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
  },
  {
    address: USDC_TESTNET_SAC,
    symbol: 'USDC',
    name: 'USD Coin (Testnet)',
    decimals: 7,
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  },
];

interface TokenState {
  tokens: Token[];
  indexedTokens: Token[]; // Tokens discovered from factory
  favoriteTokens: string[];
  customTokens: Token[];
  isLoading: boolean;
  isIndexing: boolean;
  lastIndexTime: number | null;
  addToken: (token: Token) => void;
  addCustomToken: (token: Token) => Promise<boolean>;
  removeToken: (address: string) => void;
  updateTokenBalance: (address: string, balance: string) => void;
  updateTokenPrice: (address: string, price: number) => void;
  toggleFavorite: (address: string) => void;
  getToken: (address: string) => Token | undefined;
  searchTokens: (query: string) => Token[];
  loadTokensFromNetwork: () => Promise<void>;
  indexTokensFromChain: (walletAddress: string) => Promise<void>;
  fetchAndAddToken: (contractAddress: string) => Promise<Token | null>;
}

export const useTokenStore = create<TokenState>()(
  persist(
    (set, get) => ({
      tokens: BASE_TOKENS,
      indexedTokens: [],
      favoriteTokens: [NATIVE_XLM_SAC, USDC_TESTNET_SAC],
      customTokens: [],
      isLoading: false,
      isIndexing: false,
      lastIndexTime: null,

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
        lastIndexTime: state.lastIndexTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Merge all token sources on rehydration
          state.tokens = mergeTokenLists(
            BASE_TOKENS,
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
