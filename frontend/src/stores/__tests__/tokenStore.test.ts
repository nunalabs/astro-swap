/**
 * Token Store - Unit Tests
 *
 * Strategy: Test all token management operations, persistence, search, discovery
 * Coverage: Token CRUD, favorites, search (sync/async), discovery, validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTokenStore, NATIVE_XLM_SAC, USDC_TESTNET_SAC, BASE_TOKENS } from '../tokenStore';
import type { Token } from '../../types';

// Mock tokens module with default implementations
vi.mock('../../lib/tokens', () => ({
  getWhitelistTokens: vi.fn(() => [
    {
      address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      symbol: 'XLM',
      name: 'Stellar Lumens',
      decimals: 7,
      verified: true,
      popular: true,
      source: 'whitelist',
    },
    {
      address: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
      symbol: 'USDC',
      name: 'USD Coin (Testnet)',
      decimals: 7,
      verified: true,
      popular: true,
      source: 'whitelist',
    },
  ]),
  discoverTokens: vi.fn(() => Promise.resolve([])),
  fetchStellarExpertTokens: vi.fn(() => Promise.resolve([])),
}));

// Mock token-indexer module
vi.mock('../../lib/token-indexer', () => ({
  indexTokensFromFactory: vi.fn(() => Promise.resolve([])),
  fetchTokenMetadata: vi.fn(),
}));

describe('TokenStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial state
    useTokenStore.setState({
      tokens: [...BASE_TOKENS],
      indexedTokens: [],
      discoveredTokens: [],
      favoriteTokens: [NATIVE_XLM_SAC, USDC_TESTNET_SAC],
      customTokens: [],
      isLoading: false,
      isIndexing: false,
      isSearching: false,
      lastIndexTime: null,
      lastDiscoveryTime: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with base tokens (XLM and USDC)', () => {
      const { tokens } = useTokenStore.getState();

      expect(tokens.length).toBeGreaterThanOrEqual(2);
      expect(tokens.some(t => t.address === NATIVE_XLM_SAC)).toBe(true);
      expect(tokens.some(t => t.address === USDC_TESTNET_SAC)).toBe(true);
    });

    it('should have XLM and USDC as default favorites', () => {
      const { favoriteTokens } = useTokenStore.getState();

      expect(favoriteTokens).toContain(NATIVE_XLM_SAC);
      expect(favoriteTokens).toContain(USDC_TESTNET_SAC);
    });

    it('should initialize with empty custom and indexed tokens', () => {
      const { customTokens, indexedTokens, discoveredTokens } = useTokenStore.getState();

      expect(customTokens).toEqual([]);
      expect(indexedTokens).toEqual([]);
      expect(discoveredTokens).toEqual([]);
    });

    it('should initialize with no loading states', () => {
      const { isLoading, isIndexing, isSearching } = useTokenStore.getState();

      expect(isLoading).toBe(false);
      expect(isIndexing).toBe(false);
      expect(isSearching).toBe(false);
    });
  });

  describe('addToken', () => {
    it('should add a new token', () => {
      const newToken: Token = {
        address: 'CNEWTOKEN123456789',
        symbol: 'NEW',
        name: 'New Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addToken } = useTokenStore.getState();
      addToken(newToken);

      const { tokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === newToken.address)).toEqual(newToken);
    });

    it('should not add duplicate token (same address)', () => {
      const initialLength = useTokenStore.getState().tokens.length;

      const { addToken } = useTokenStore.getState();
      addToken(BASE_TOKENS[0]);

      const { tokens } = useTokenStore.getState();
      expect(tokens.length).toBe(initialLength);
    });
  });

  describe('addCustomToken', () => {
    it('should add custom token and return true', async () => {
      const customToken: Token = {
        address: 'CCUSTOM123456789',
        symbol: 'CUSTOM',
        name: 'Custom Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addCustomToken } = useTokenStore.getState();
      const result = await addCustomToken(customToken);

      expect(result).toBe(true);
      const { tokens, customTokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === customToken.address)).toEqual(customToken);
      expect(customTokens.find(t => t.address === customToken.address)).toEqual(customToken);
    });

    it('should return false if token already exists', async () => {
      const { addCustomToken } = useTokenStore.getState();
      const result = await addCustomToken(BASE_TOKENS[0]);

      expect(result).toBe(false);
    });
  });

  describe('removeToken', () => {
    it('should remove custom token', () => {
      const customToken: Token = {
        address: 'CREMOVABLE123456789',
        symbol: 'RMV',
        name: 'Removable Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addToken, removeToken } = useTokenStore.getState();
      addToken(customToken);

      expect(useTokenStore.getState().tokens.find(t => t.address === customToken.address)).toBeDefined();

      removeToken(customToken.address);

      expect(useTokenStore.getState().tokens.find(t => t.address === customToken.address)).toBeUndefined();
    });

    it('should not remove base tokens (XLM)', () => {
      const initialLength = useTokenStore.getState().tokens.length;

      const { removeToken } = useTokenStore.getState();
      removeToken(NATIVE_XLM_SAC);

      const { tokens } = useTokenStore.getState();
      expect(tokens.length).toBe(initialLength);
      expect(tokens.find(t => t.address === NATIVE_XLM_SAC)).toBeDefined();
    });

    it('should remove token from favorites when removed', () => {
      const customToken: Token = {
        address: 'CFAVORITE123456789',
        symbol: 'FAV',
        name: 'Favorite Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addToken, toggleFavorite, removeToken } = useTokenStore.getState();
      addToken(customToken);
      toggleFavorite(customToken.address);

      expect(useTokenStore.getState().favoriteTokens).toContain(customToken.address);

      removeToken(customToken.address);

      expect(useTokenStore.getState().favoriteTokens).not.toContain(customToken.address);
    });

    it('should remove token from all lists (tokens, customTokens, indexedTokens)', () => {
      const customToken: Token = {
        address: 'CMULTILIST123456789',
        symbol: 'MLT',
        name: 'Multi List Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      useTokenStore.setState({
        tokens: [...useTokenStore.getState().tokens, customToken],
        customTokens: [customToken],
        indexedTokens: [customToken],
      });

      const { removeToken } = useTokenStore.getState();
      removeToken(customToken.address);

      const { tokens, customTokens, indexedTokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === customToken.address)).toBeUndefined();
      expect(customTokens.find(t => t.address === customToken.address)).toBeUndefined();
      expect(indexedTokens.find(t => t.address === customToken.address)).toBeUndefined();
    });
  });

  describe('updateTokenBalance', () => {
    it('should update token balance', () => {
      const { updateTokenBalance } = useTokenStore.getState();
      const newBalance = '5000000000';

      updateTokenBalance(NATIVE_XLM_SAC, newBalance);

      const { tokens } = useTokenStore.getState();
      const xlm = tokens.find(t => t.address === NATIVE_XLM_SAC);
      expect(xlm?.balance).toBe(newBalance);
    });

    it('should not affect other tokens when updating balance', () => {
      const { updateTokenBalance } = useTokenStore.getState();
      const usdcBefore = useTokenStore.getState().tokens.find(t => t.address === USDC_TESTNET_SAC);

      updateTokenBalance(NATIVE_XLM_SAC, '1000000000');

      const usdcAfter = useTokenStore.getState().tokens.find(t => t.address === USDC_TESTNET_SAC);
      expect(usdcAfter).toEqual(usdcBefore);
    });
  });

  describe('updateTokenPrice', () => {
    it('should update token price', () => {
      const { updateTokenPrice } = useTokenStore.getState();
      const newPrice = 0.12;

      updateTokenPrice(NATIVE_XLM_SAC, newPrice);

      const { tokens } = useTokenStore.getState();
      const xlm = tokens.find(t => t.address === NATIVE_XLM_SAC);
      expect(xlm?.price).toBe(newPrice);
    });

    it('should handle price update for non-existent token gracefully', () => {
      const { updateTokenPrice } = useTokenStore.getState();

      expect(() => updateTokenPrice('CNONEXISTENT', 1.0)).not.toThrow();
    });
  });

  describe('toggleFavorite', () => {
    it('should add token to favorites', () => {
      const customToken: Token = {
        address: 'CNEWFAVORITE123456789',
        symbol: 'NFAV',
        name: 'New Favorite',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addToken, toggleFavorite } = useTokenStore.getState();
      addToken(customToken);

      expect(useTokenStore.getState().favoriteTokens).not.toContain(customToken.address);

      toggleFavorite(customToken.address);

      expect(useTokenStore.getState().favoriteTokens).toContain(customToken.address);
    });

    it('should remove token from favorites', () => {
      const { toggleFavorite } = useTokenStore.getState();

      expect(useTokenStore.getState().favoriteTokens).toContain(NATIVE_XLM_SAC);

      toggleFavorite(NATIVE_XLM_SAC);

      expect(useTokenStore.getState().favoriteTokens).not.toContain(NATIVE_XLM_SAC);
    });

    it('should toggle favorite multiple times', () => {
      const { toggleFavorite, favoriteTokens } = useTokenStore.getState();
      const initialCount = favoriteTokens.length;

      toggleFavorite(NATIVE_XLM_SAC);
      expect(useTokenStore.getState().favoriteTokens.length).toBe(initialCount - 1);

      toggleFavorite(NATIVE_XLM_SAC);
      expect(useTokenStore.getState().favoriteTokens.length).toBe(initialCount);
    });
  });

  describe('getToken', () => {
    it('should find token by address', () => {
      const { getToken } = useTokenStore.getState();
      const xlm = getToken(NATIVE_XLM_SAC);

      expect(xlm).toBeDefined();
      expect(xlm?.symbol).toBe('XLM');
    });

    it('should return undefined for non-existent token', () => {
      const { getToken } = useTokenStore.getState();
      const result = getToken('CNONEXISTENT');

      expect(result).toBeUndefined();
    });
  });

  describe('searchTokens', () => {
    it('should find tokens by symbol (case-insensitive)', () => {
      const { searchTokens } = useTokenStore.getState();
      const results = searchTokens('xlm');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.symbol === 'XLM')).toBe(true);
    });

    it('should find tokens by name (case-insensitive)', () => {
      const { searchTokens } = useTokenStore.getState();
      const results = searchTokens('stellar');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.name.toLowerCase().includes('stellar'))).toBe(true);
    });

    it('should find tokens by address (partial match)', () => {
      const { searchTokens } = useTokenStore.getState();
      const results = searchTokens(NATIVE_XLM_SAC.substring(0, 10));

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.address === NATIVE_XLM_SAC)).toBe(true);
    });

    it('should return empty array if no matches', () => {
      const { searchTokens } = useTokenStore.getState();
      const results = searchTokens('NONEXISTENTTOKEN123');

      expect(results).toEqual([]);
    });
  });

  describe('searchTokensAsync', () => {
    it('should return local tokens for short query (< 2 chars)', async () => {
      const { searchTokensAsync, tokens } = useTokenStore.getState();
      const results = await searchTokensAsync('x');

      expect(results).toEqual(tokens);
    });

    it('should search local tokens first', async () => {
      const { discoverTokens } = await import('../../lib/tokens');
      vi.mocked(discoverTokens).mockResolvedValue([]);

      const { searchTokensAsync } = useTokenStore.getState();
      const results = await searchTokensAsync('xlm');

      expect(results.some(t => t.symbol === 'XLM')).toBe(true);
    });

    it('should merge local and discovered tokens', async () => {
      const { discoverTokens } = await import('../../lib/tokens');
      const discoveredToken: Token = {
        address: 'CDISCOVERED123456789',
        symbol: 'DISC',
        name: 'Discovered Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'stellarexpert',
      };
      vi.mocked(discoverTokens).mockResolvedValue([discoveredToken]);

      const { searchTokensAsync } = useTokenStore.getState();
      const results = await searchTokensAsync('disc');

      expect(results.find(t => t.address === discoveredToken.address)).toEqual(discoveredToken);
    });

    it('should prioritize local tokens over discovered', async () => {
      const { discoverTokens } = await import('../../lib/tokens');
      const localXLM = BASE_TOKENS.find(t => t.symbol === 'XLM')!;
      const discoveredXLM: Token = {
        ...localXLM,
        name: 'Different XLM Name',
      };
      vi.mocked(discoverTokens).mockResolvedValue([discoveredXLM]);

      const { searchTokensAsync } = useTokenStore.getState();
      const results = await searchTokensAsync('xlm');

      const xlmResult = results.find(t => t.address === NATIVE_XLM_SAC);
      expect(xlmResult?.name).toBe(localXLM.name);
    });

    it('should handle discovery errors gracefully', async () => {
      const { discoverTokens } = await import('../../lib/tokens');
      vi.mocked(discoverTokens).mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { searchTokensAsync } = useTokenStore.getState();
      const results = await searchTokensAsync('xlm');

      expect(results.some(t => t.symbol === 'XLM')).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error in async token search:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should set isSearching state during async search', async () => {
      const { discoverTokens } = await import('../../lib/tokens');
      vi.mocked(discoverTokens).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const { searchTokensAsync } = useTokenStore.getState();
      const searchPromise = searchTokensAsync('test');

      expect(useTokenStore.getState().isSearching).toBe(true);

      await searchPromise;

      expect(useTokenStore.getState().isSearching).toBe(false);
    });
  });

  describe('getVerifiedTokens', () => {
    it('should return only verified tokens', () => {
      const { getVerifiedTokens } = useTokenStore.getState();
      const verified = getVerifiedTokens();

      expect(verified.every(t => t.verified === true)).toBe(true);
    });

    it('should include base tokens (XLM, USDC) which are verified', () => {
      const { getVerifiedTokens } = useTokenStore.getState();
      const verified = getVerifiedTokens();

      expect(verified.some(t => t.address === NATIVE_XLM_SAC)).toBe(true);
      expect(verified.some(t => t.address === USDC_TESTNET_SAC)).toBe(true);
    });
  });

  describe('getPopularTokens', () => {
    it('should return only popular tokens', () => {
      const { getPopularTokens } = useTokenStore.getState();
      const popular = getPopularTokens();

      expect(popular.every(t => t.popular === true)).toBe(true);
    });

    it('should include base tokens which are popular', () => {
      const { getPopularTokens } = useTokenStore.getState();
      const popular = getPopularTokens();

      expect(popular.some(t => t.address === NATIVE_XLM_SAC)).toBe(true);
    });
  });

  describe('loadTokensFromNetwork', () => {
    it('should merge base, indexed, and custom tokens', async () => {
      const indexedToken: Token = {
        address: 'CINDEXED1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890AB',
        symbol: 'IDX',
        name: 'Indexed Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'factory',
      };

      useTokenStore.setState({
        indexedTokens: [indexedToken],
      });

      const { loadTokensFromNetwork } = useTokenStore.getState();
      await loadTokensFromNetwork();

      const { tokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === indexedToken.address)).toEqual(indexedToken);
      expect(tokens.find(t => t.address === NATIVE_XLM_SAC)).toBeDefined();
    });

    it('should set loading state correctly', async () => {
      const { loadTokensFromNetwork } = useTokenStore.getState();

      // loadTokensFromNetwork completes synchronously (no await points)
      // so we can only verify final state
      await loadTokensFromNetwork();

      expect(useTokenStore.getState().isLoading).toBe(false);
    });

    it('should handle errors and reset loading state', async () => {
      // Force an error by setting invalid state
      useTokenStore.setState({
        indexedTokens: null as any,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { loadTokensFromNetwork } = useTokenStore.getState();
      await loadTokensFromNetwork();

      expect(useTokenStore.getState().isLoading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('discoverAllTokens', () => {
    it('should discover tokens from all sources', async () => {
      const { getWhitelistTokens, fetchStellarExpertTokens } = await import('../../lib/tokens');

      const whitelistToken: Token = {
        address: 'CWHITELIST34567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678ABCD',
        symbol: 'WL',
        name: 'Whitelist Token',
        decimals: 7,
        verified: true,
        popular: true,
        source: 'whitelist',
      };

      const expertToken: Token = {
        address: 'CEXPERT1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678ABCDE',
        symbol: 'EXP',
        name: 'Expert Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'stellarexpert',
      };

      vi.mocked(getWhitelistTokens).mockReturnValue([whitelistToken]);
      vi.mocked(fetchStellarExpertTokens).mockResolvedValue([expertToken]);

      const { discoverAllTokens } = useTokenStore.getState();
      await discoverAllTokens();

      const { tokens, discoveredTokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === whitelistToken.address)).toBeDefined();
      expect(tokens.find(t => t.address === expertToken.address)).toBeDefined();
      expect(discoveredTokens.length).toBeGreaterThan(0);
    });

    it('should rate limit discovery to every 2 minutes', async () => {
      const now = Date.now();
      useTokenStore.setState({
        lastDiscoveryTime: now,
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { discoverAllTokens } = useTokenStore.getState();
      await discoverAllTokens();

      expect(consoleSpy).toHaveBeenCalledWith('Token discovery skipped - rate limited');

      consoleSpy.mockRestore();
    });

    it('should allow discovery after 2 minutes', async () => {
      const twoMinutesAgo = Date.now() - (120000 + 1000);
      useTokenStore.setState({
        lastDiscoveryTime: twoMinutesAgo,
      });

      const { getWhitelistTokens, fetchStellarExpertTokens } = await import('../../lib/tokens');
      vi.mocked(getWhitelistTokens).mockReturnValue([]);
      vi.mocked(fetchStellarExpertTokens).mockResolvedValue([]);

      const { discoverAllTokens } = useTokenStore.getState();
      await discoverAllTokens();

      expect(useTokenStore.getState().lastDiscoveryTime).toBeGreaterThan(twoMinutesAgo);
    });

    it('should not run if already loading', async () => {
      useTokenStore.setState({
        isLoading: true,
      });

      const { getWhitelistTokens } = await import('../../lib/tokens');
      const mockGetWhitelist = vi.mocked(getWhitelistTokens);

      const { discoverAllTokens } = useTokenStore.getState();
      await discoverAllTokens();

      expect(mockGetWhitelist).not.toHaveBeenCalled();
    });

    it('should handle errors and reset loading state', async () => {
      const { fetchStellarExpertTokens } = await import('../../lib/tokens');
      vi.mocked(fetchStellarExpertTokens).mockRejectedValue(new Error('API error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { discoverAllTokens } = useTokenStore.getState();
      await discoverAllTokens();

      expect(useTokenStore.getState().isLoading).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('indexTokensFromChain', () => {
    it('should index tokens from factory', async () => {
      const { indexTokensFromFactory } = await import('../../lib/token-indexer');

      const factoryToken: Token = {
        address: 'CFACTORY234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678ABCDE',
        symbol: 'FCT',
        name: 'Factory Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'factory',
      };

      vi.mocked(indexTokensFromFactory).mockResolvedValue([factoryToken]);

      const { indexTokensFromChain } = useTokenStore.getState();
      await indexTokensFromChain('GWALLET123');

      const { tokens, indexedTokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === factoryToken.address)).toBeDefined();
      expect(indexedTokens.find(t => t.address === factoryToken.address)).toEqual(factoryToken);
    });

    it('should rate limit indexing to every 60 seconds', async () => {
      const now = Date.now();
      useTokenStore.setState({
        lastIndexTime: now,
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { indexTokensFromChain } = useTokenStore.getState();
      await indexTokensFromChain('GWALLET123');

      expect(consoleSpy).toHaveBeenCalledWith('Token indexing skipped - rate limited');

      consoleSpy.mockRestore();
    });

    it('should prevent concurrent indexing', async () => {
      useTokenStore.setState({
        isIndexing: true,
      });

      const { indexTokensFromFactory } = await import('../../lib/token-indexer');
      const mockIndexer = vi.mocked(indexTokensFromFactory);

      const { indexTokensFromChain } = useTokenStore.getState();
      await indexTokensFromChain('GWALLET123');

      expect(mockIndexer).not.toHaveBeenCalled();
    });

    it('should set indexing state correctly', async () => {
      const { indexTokensFromFactory } = await import('../../lib/token-indexer');
      vi.mocked(indexTokensFromFactory).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      const { indexTokensFromChain } = useTokenStore.getState();
      const indexPromise = indexTokensFromChain('GWALLET123');

      expect(useTokenStore.getState().isIndexing).toBe(true);

      await indexPromise;

      expect(useTokenStore.getState().isIndexing).toBe(false);
    });

    it('should handle indexing errors', async () => {
      const { indexTokensFromFactory } = await import('../../lib/token-indexer');
      vi.mocked(indexTokensFromFactory).mockRejectedValue(new Error('Indexing failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { indexTokensFromChain } = useTokenStore.getState();
      await indexTokensFromChain('GWALLET123');

      expect(useTokenStore.getState().isIndexing).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('fetchAndAddToken', () => {
    it('should fetch and add new token', async () => {
      const { fetchTokenMetadata } = await import('../../lib/token-indexer');

      const newToken: Token = {
        address: 'CFETCHED123456789',
        symbol: 'FTH',
        name: 'Fetched Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      vi.mocked(fetchTokenMetadata).mockResolvedValue(newToken);

      const { fetchAndAddToken } = useTokenStore.getState();
      const result = await fetchAndAddToken(newToken.address);

      expect(result).toEqual(newToken);
      const { tokens, customTokens } = useTokenStore.getState();
      expect(tokens.find(t => t.address === newToken.address)).toEqual(newToken);
      expect(customTokens.find(t => t.address === newToken.address)).toEqual(newToken);
    });

    it('should return existing token if already in store', async () => {
      const { fetchTokenMetadata } = await import('../../lib/token-indexer');
      const mockFetch = vi.mocked(fetchTokenMetadata);

      const { fetchAndAddToken } = useTokenStore.getState();
      const result = await fetchAndAddToken(NATIVE_XLM_SAC);

      expect(result?.address).toBe(NATIVE_XLM_SAC);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null if fetching fails', async () => {
      const { fetchTokenMetadata } = await import('../../lib/token-indexer');
      vi.mocked(fetchTokenMetadata).mockResolvedValue(null);

      const { fetchAndAddToken } = useTokenStore.getState();
      const result = await fetchAndAddToken('CINVALID');

      expect(result).toBeNull();
    });

    it('should handle fetch errors gracefully', async () => {
      const { fetchTokenMetadata } = await import('../../lib/token-indexer');
      vi.mocked(fetchTokenMetadata).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { fetchAndAddToken } = useTokenStore.getState();
      const result = await fetchAndAddToken('CERROR');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Persistence', () => {
    it('should persist favorites to localStorage', () => {
      const customToken: Token = {
        address: 'CPERSIST123456789',
        symbol: 'PER',
        name: 'Persist Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addToken, toggleFavorite } = useTokenStore.getState();
      addToken(customToken);
      toggleFavorite(customToken.address);

      const stored = localStorage.getItem('astroswap-tokens');
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.state.favoriteTokens).toContain(customToken.address);
    });

    it('should persist custom tokens to localStorage', async () => {
      const customToken: Token = {
        address: 'CCUSTOMPERSIST123456789',
        symbol: 'CPR',
        name: 'Custom Persist Token',
        decimals: 7,
        verified: false,
        popular: false,
        source: 'custom',
      };

      const { addCustomToken } = useTokenStore.getState();
      await addCustomToken(customToken);

      const stored = localStorage.getItem('astroswap-tokens');
      const parsed = JSON.parse(stored!);

      expect(parsed.state.customTokens.some((t: Token) => t.address === customToken.address)).toBe(true);
    });
  });

  describe('Constants', () => {
    it('should export NATIVE_XLM_SAC constant', () => {
      expect(NATIVE_XLM_SAC).toBeDefined();
      expect(NATIVE_XLM_SAC.length).toBe(56);
    });

    it('should export USDC_TESTNET_SAC constant', () => {
      expect(USDC_TESTNET_SAC).toBeDefined();
      expect(USDC_TESTNET_SAC.length).toBe(56);
    });

    it('should export BASE_TOKENS with at least XLM and USDC', () => {
      expect(BASE_TOKENS.length).toBeGreaterThanOrEqual(2);
      expect(BASE_TOKENS.some(t => t.symbol === 'XLM')).toBe(true);
      expect(BASE_TOKENS.some(t => t.symbol === 'USDC')).toBe(true);
    });
  });
});
