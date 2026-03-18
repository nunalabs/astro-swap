/**
 * Token List Store (Core)
 *
 * Manages the core token list, balance updates, and basic operations.
 * Extracted from tokenStore.ts for better separation of concerns.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Token } from '../types';
import { getWhitelistTokens } from '../lib/tokens';
import { NATIVE_XLM_SAC, USDC_TESTNET_SAC, DEFAULT_FAVORITES } from '../lib/constants';

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

const BASE_TOKENS: Token[] = getBaseTokens();

/**
 * Validate if a token address is valid
 */
function isValidTokenAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.includes(':undefined') || address.includes(':null')) return false;

  address = address.trim();
  if (address.length === 0) return false;

  // For proper SAC addresses (56 chars, all caps alphanumeric)
  if (address.length === 56 && /^[A-Z0-9]+$/.test(address)) return true;

  return false;
}

/**
 * Merge multiple token lists, removing duplicates by address
 */
export function mergeTokenLists(...lists: Token[][]): Token[] {
  const tokenMap = new Map<string, Token>();

  for (const list of lists) {
    for (const token of list) {
      if (!isValidTokenAddress(token.address)) {
        console.debug(`Skipping invalid token: ${token.symbol}`);
        continue;
      }

      if (!tokenMap.has(token.address)) {
        tokenMap.set(token.address, token);
      }
    }
  }

  return Array.from(tokenMap.values());
}

interface TokenListState {
  // State
  tokens: Token[];
  favoriteTokens: string[];
  customTokens: Token[];

  // Core operations
  addToken: (token: Token) => void;
  addCustomToken: (token: Token) => Promise<boolean>;
  removeToken: (address: string) => void;
  updateTokenBalance: (address: string, balance: string) => void;
  updateTokenPrice: (address: string, price: number) => void;
  getToken: (address: string) => Token | undefined;

  // Favorites
  toggleFavorite: (address: string) => void;
  isFavorite: (address: string) => boolean;

  // Filters
  getVerifiedTokens: () => Token[];
  getPopularTokens: () => Token[];
  getFavoriteTokens: () => Token[];

  // Bulk operations
  setTokens: (tokens: Token[]) => void;
  mergeTokens: (newTokens: Token[]) => void;
}

export const useTokenListStore = create<TokenListState>()(
  persist(
    (set, get) => ({
      // Initial state
      tokens: BASE_TOKENS,
      favoriteTokens: [...DEFAULT_FAVORITES],
      customTokens: [],

      // Core operations
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

      getToken: (address: string) => {
        return get().tokens.find((t) => t.address === address);
      },

      // Favorites
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

      isFavorite: (address: string) => {
        return get().favoriteTokens.includes(address);
      },

      // Filters
      getVerifiedTokens: () => {
        return get().tokens.filter(t => t.verified);
      },

      getPopularTokens: () => {
        return get().tokens.filter(t => t.popular);
      },

      getFavoriteTokens: () => {
        const { tokens, favoriteTokens } = get();
        return tokens.filter(t => favoriteTokens.includes(t.address));
      },

      // Bulk operations
      setTokens: (tokens: Token[]) => {
        set({ tokens });
      },

      mergeTokens: (newTokens: Token[]) => {
        set((state) => ({
          tokens: mergeTokenLists([state.tokens], [newTokens]),
        }));
      },
    }),
    {
      name: 'astroswap-token-list',
      partialize: (state) => ({
        favoriteTokens: state.favoriteTokens,
        customTokens: state.customTokens,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Clean up invalid tokens
          const cleanTokens = (tokens: Token[]) =>
            tokens.filter(t => isValidTokenAddress(t.address));

          state.customTokens = cleanTokens(state.customTokens || []);

          // Merge with fresh whitelist
          const whitelistTokens = getWhitelistTokens();
          state.tokens = mergeTokenLists([whitelistTokens], [state.customTokens]);

          console.log(`Token list rehydrated: ${state.tokens.length} tokens`);
        }
      },
    }
  )
);

export { BASE_TOKENS, NATIVE_XLM_SAC, USDC_TESTNET_SAC };
