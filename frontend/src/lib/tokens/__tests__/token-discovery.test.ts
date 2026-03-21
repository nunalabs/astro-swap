import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isValidTokenAddress,
  clearTokenDiscoveryCache,
  truncateIssuer,
  getTokenDisplayInfo,
  getWhitelistTokens,
  getPopularTokens,
  getTokenByAddress,
  discoverTokens,
  fetchStellarExpertTokens,
  searchHorizonTokens,
} from '../token-discovery';
import type { Token } from '../../../types';

describe('token-discovery', () => {
  describe('isValidTokenAddress', () => {
    it('should return true for "native" address', () => {
      expect(isValidTokenAddress('native')).toBe(true);
    });

    it('should return true for valid SAC format (C + 55 chars)', () => {
      const validSAC = 'C' + 'A'.repeat(55);
      expect(isValidTokenAddress(validSAC)).toBe(true);
    });

    it('should return true for valid classic format (CODE:GISSUER)', () => {
      const validClassic = 'USDC:G' + 'A'.repeat(55);
      expect(isValidTokenAddress(validClassic)).toBe(true);
    });

    it('should return true for multi-char code in classic format', () => {
      const validClassic = 'AQUA:G' + 'B'.repeat(55);
      expect(isValidTokenAddress(validClassic)).toBe(true);
    });

    it('should return false for invalid SAC format (wrong prefix)', () => {
      const invalidSAC = 'G' + 'A'.repeat(55);
      expect(isValidTokenAddress(invalidSAC)).toBe(false);
    });

    it('should return false for invalid SAC format (wrong length)', () => {
      const invalidSAC = 'C' + 'A'.repeat(50);
      expect(isValidTokenAddress(invalidSAC)).toBe(false);
    });

    it('should return false for invalid classic format (wrong issuer prefix)', () => {
      const invalidClassic = 'USDC:C' + 'A'.repeat(55);
      expect(isValidTokenAddress(invalidClassic)).toBe(false);
    });

    it('should return false for invalid classic format (missing colon)', () => {
      const invalidClassic = 'USDC' + 'G' + 'A'.repeat(55);
      expect(isValidTokenAddress(invalidClassic)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidTokenAddress('')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isValidTokenAddress('not-a-valid-address')).toBe(false);
    });
  });

  describe('clearTokenDiscoveryCache', () => {
    it('should clear caches without errors', () => {
      expect(() => clearTokenDiscoveryCache()).not.toThrow();
    });

    it('should be callable multiple times', () => {
      clearTokenDiscoveryCache();
      clearTokenDiscoveryCache();
      expect(true).toBe(true);
    });
  });

  describe('truncateIssuer', () => {
    it('should return empty string for "native" issuer', () => {
      expect(truncateIssuer('native')).toBe('');
    });

    it('should return empty string for empty issuer', () => {
      expect(truncateIssuer('')).toBe('');
    });

    it('should return full issuer if shorter than truncation length', () => {
      const shortIssuer = 'GABCD';
      expect(truncateIssuer(shortIssuer, 4)).toBe(shortIssuer);
    });

    it('should truncate long issuer with default 4 chars', () => {
      const longIssuer = 'G' + 'A'.repeat(55);
      const result = truncateIssuer(longIssuer);
      expect(result).toBe(`${longIssuer.slice(0, 4)}...${longIssuer.slice(-4)}`);
    });

    it('should truncate with custom char length', () => {
      const longIssuer = 'G' + 'A'.repeat(55);
      const result = truncateIssuer(longIssuer, 6);
      expect(result).toBe(`${longIssuer.slice(0, 6)}...${longIssuer.slice(-6)}`);
    });
  });

  describe('getTokenDisplayInfo', () => {
    it('should return correct info for whitelist token', () => {
      const token: Token = {
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        symbol: 'XLM',
        name: 'Stellar Lumens',
        decimals: 7,
        issuer: 'native',
        domain: 'stellar.org',
        source: 'whitelist',
        verified: true,
      };

      const displayInfo = getTokenDisplayInfo(token);

      expect(displayInfo.symbol).toBe('XLM');
      expect(displayInfo.name).toBe('Stellar Lumens');
      expect(displayInfo.issuerShort).toBe('stellar.org');
    });

    it('should return issuer short when no domain', () => {
      const issuer = 'G' + 'A'.repeat(55);
      const token: Token = {
        address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 7,
        issuer,
        source: 'whitelist',
      };

      const displayInfo = getTokenDisplayInfo(token);

      expect(displayInfo.issuerShort).toBe(`${issuer.slice(0, 4)}...${issuer.slice(-4)}`);
    });

    it('should extract code from CODE:ISSUER format symbol', () => {
      const issuer = 'G' + 'B'.repeat(55);
      const token: Token = {
        address: `USDC:${issuer}`,
        symbol: `USDC:${issuer}`,
        name: 'USD Coin',
        decimals: 7,
        issuer,
        source: 'horizon',
      };

      const displayInfo = getTokenDisplayInfo(token);

      expect(displayInfo.symbol).toBe('USDC');
      expect(displayInfo.issuerShort).toBe(`${issuer.slice(0, 4)}...${issuer.slice(-4)}`);
    });

    it('should use symbol as name when they match', () => {
      const token: Token = {
        address: 'CTOKEN123',
        symbol: 'TOKEN',
        name: 'TOKEN',
        decimals: 7,
        source: 'stellar_expert',
      };

      const displayInfo = getTokenDisplayInfo(token);

      expect(displayInfo.name).toBe('TOKEN');
    });

    it('should include logoURI if present', () => {
      const token: Token = {
        address: 'CTOKEN123',
        symbol: 'XLM',
        name: 'Stellar Lumens',
        decimals: 7,
        logoURI: 'https://example.com/xlm.png',
        source: 'whitelist',
      };

      const displayInfo = getTokenDisplayInfo(token);

      expect(displayInfo.logoURI).toBe('https://example.com/xlm.png');
    });
  });

  describe('getWhitelistTokens', () => {
    it('should return an array of tokens', () => {
      const tokens = getWhitelistTokens();
      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should return tokens with required fields', () => {
      const tokens = getWhitelistTokens();
      const firstToken = tokens[0];

      expect(firstToken).toHaveProperty('address');
      expect(firstToken).toHaveProperty('symbol');
      expect(firstToken).toHaveProperty('name');
      expect(firstToken).toHaveProperty('decimals');
      expect(firstToken).toHaveProperty('source');
      expect(firstToken.source).toBe('whitelist');
    });

    it('should mark all whitelist tokens as verified', () => {
      const tokens = getWhitelistTokens();
      tokens.forEach(token => {
        expect(token.verified).toBe(true);
      });
    });
  });

  describe('getPopularTokens', () => {
    it('should return only popular tokens from whitelist', () => {
      const popularTokens = getPopularTokens();
      expect(Array.isArray(popularTokens)).toBe(true);

      popularTokens.forEach(token => {
        expect(token.popular).toBe(true);
        expect(token.source).toBe('whitelist');
      });
    });

    it('should be a subset of whitelist tokens', () => {
      const whitelistTokens = getWhitelistTokens();
      const popularTokens = getPopularTokens();

      expect(popularTokens.length).toBeLessThanOrEqual(whitelistTokens.length);
    });
  });

  describe('getTokenByAddress', () => {
    beforeEach(() => {
      // Clear cache before each test
      clearTokenDiscoveryCache();
    });

    it('should return token from whitelist', async () => {
      const whitelistTokens = getWhitelistTokens();
      const firstToken = whitelistTokens[0];

      const result = await getTokenByAddress(firstToken.address);

      expect(result).toBeDefined();
      expect(result?.address).toBe(firstToken.address);
      expect(result?.symbol).toBe(firstToken.symbol);
    });

    it('should return null for non-existent address', async () => {
      const nonExistentAddress = 'CNONEXISTENT' + 'A'.repeat(45);

      const result = await getTokenByAddress(nonExistentAddress);

      expect(result).toBeNull();
    });

    it('should cache token after first lookup', async () => {
      const whitelistTokens = getWhitelistTokens();
      const firstToken = whitelistTokens[0];

      // First call - should query whitelist
      const result1 = await getTokenByAddress(firstToken.address);
      expect(result1).toBeDefined();

      // Second call - should use cache (no whitelist query needed)
      const result2 = await getTokenByAddress(firstToken.address);
      expect(result2).toBeDefined();
      expect(result2?.address).toBe(result1?.address);
    });

    it('should handle empty address gracefully', async () => {
      const result = await getTokenByAddress('');

      expect(result).toBeNull();
    });
  });

  describe('fetchStellarExpertTokens', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch and parse tokens from StellarExpert API', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              asset: 'USDC',
              issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
              asset_type: 'credit_alphanum4',
              rating: { average: 4.5 },
              toml_info: {
                name: 'USD Coin',
                image: 'https://example.com/usdc.png',
              },
              domain: 'centre.io',
            },
            {
              asset: 'XLM',
              issuer: 'native',
              asset_type: 'native',
              rating: { average: 5 },
            },
            {
              asset: 'LOWRATED',
              issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              asset_type: 'credit_alphanum12',
              rating: { average: 0.5 },
            },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const tokens = await fetchStellarExpertTokens({ limit: 10, sort: 'rating' });

      expect(tokens).toHaveLength(1); // Only USDC (XLM skipped, LOWRATED filtered)
      expect(tokens[0].symbol).toBe('USDC');
      expect(tokens[0].name).toBe('USD Coin');
      expect(tokens[0].rating).toBe(4.5);
      expect(tokens[0].verified).toBe(true);
      expect(tokens[0].source).toBe('stellar_expert');
      expect(tokens[0].logoURI).toBe('https://example.com/usdc.png');
    });

    it('should return empty array on API error', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        } as Response)
      );

      const tokens = await fetchStellarExpertTokens();

      expect(tokens).toEqual([]);
    });

    it('should handle missing toml_info gracefully', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              asset: 'TOKEN',
              issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              asset_type: 'credit_alphanum12',
              rating: { average: 3 },
              name: 'Token Name',
            },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const tokens = await fetchStellarExpertTokens();

      expect(tokens).toHaveLength(1);
      expect(tokens[0].name).toBe('Token Name');
      expect(tokens[0].logoURI).toBeUndefined();
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const tokens = await fetchStellarExpertTokens();

      expect(tokens).toEqual([]);
    });

    it('should use default options', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ _embedded: { records: [] } }),
        } as Response)
      );

      await fetchStellarExpertTokens();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('sort=rating')
      );
    });
  });

  describe('searchHorizonTokens', () => {
    beforeEach(() => {
      clearTokenDiscoveryCache();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should search and return tokens from Horizon API', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              asset_code: 'USDC',
              asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
              _links: {
                toml: {
                  href: 'https://example.com/.well-known/stellar.toml',
                },
              },
            },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const tokens = await searchHorizonTokens('USDC');

      expect(tokens).toHaveLength(1);
      expect(tokens[0].symbol).toBe('USDC');
      expect(tokens[0].source).toBe('horizon');
      expect(tokens[0].decimals).toBe(7);
    });

    it('should return empty array for queries less than 2 chars', async () => {
      const tokens = await searchHorizonTokens('U');

      expect(tokens).toEqual([]);
    });

    it('should return empty array for empty query', async () => {
      const tokens = await searchHorizonTokens('');

      expect(tokens).toEqual([]);
    });

    it('should cache search results', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              asset_code: 'USDC',
              asset_issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
            },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      // First call
      await searchHorizonTokens('USDC');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await searchHorizonTokens('USDC');
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1 call
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      );

      const tokens = await searchHorizonTokens('NOTFOUND');

      expect(tokens).toEqual([]);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

      const tokens = await searchHorizonTokens('ERROR');

      expect(tokens).toEqual([]);
    });

    it('should extract domain from toml link', async () => {
      const mockResponse = {
        _embedded: {
          records: [
            {
              asset_code: 'USDC',
              asset_issuer: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
              _links: {
                toml: {
                  href: 'https://centre.io/.well-known/stellar.toml',
                },
              },
            },
          ],
        },
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      const tokens = await searchHorizonTokens('USDC');

      expect(tokens[0].domain).toBe('centre.io');
    });
  });

  describe('discoverTokens', () => {
    beforeEach(() => {
      // Mock global fetch to prevent real API calls
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({}),
        } as Response)
      );
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return whitelist tokens when fetch fails', async () => {
      const tokens = await discoverTokens();

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);

      // All tokens should be from whitelist
      tokens.forEach(token => {
        expect(token.source).toBe('whitelist');
      });
    });

    it('should return tokens for short query (only whitelist)', async () => {
      const tokens = await discoverTokens('U'); // Only 1 char

      // Should still return whitelist tokens
      expect(tokens.length).toBeGreaterThan(0);
      tokens.forEach(token => {
        expect(token.source).toBe('whitelist');
      });
    });

    it('should return tokens for 2-char query', async () => {
      const tokens = await discoverTokens('XL');

      // Should attempt to search (fetch called) but return whitelist on failure
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle empty query', async () => {
      const tokens = await discoverTokens('');

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should handle undefined query', async () => {
      const tokens = await discoverTokens(undefined);

      expect(Array.isArray(tokens)).toBe(true);
      expect(tokens.length).toBeGreaterThan(0);
    });
  });
});
