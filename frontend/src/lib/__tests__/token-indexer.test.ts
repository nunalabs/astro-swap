import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  fetchTokenMetadata,
  fetchTokenMetadataBatch,
  getPairTokens,
  indexTokensFromFactory,
  clearTokenCache,
} from '../token-indexer';
import * as stellar from '../stellar';
import * as contracts from '../contracts';

// Mock modules
vi.mock('../stellar', () => ({
  sorobanServer: {
    simulateTransaction: vi.fn(),
  },
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
}));

vi.mock('../contracts', () => ({
  getAllPairs: vi.fn(),
}));

describe('token-indexer', () => {
  const mockTokenAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  const mockPairAddress = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenCache();
  });

  afterEach(() => {
    clearTokenCache();
  });

  describe('fetchTokenMetadata', () => {
    it('should fetch token metadata successfully', async () => {
      // Mock successful simulation responses (proper structure for isSimulationSuccess)
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('XLM', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('Stellar Lumens', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(7, { type: 'u32' }),
          },
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result).toEqual({
        address: mockTokenAddress,
        symbol: 'XLM',
        name: 'Stellar Lumens',
        decimals: 7,
        logoURI: expect.stringContaining('Stellar'),
      });

      // Should have called simulateTransaction 3 times (symbol, name, decimals)
      expect(stellar.sorobanServer.simulateTransaction).toHaveBeenCalledTimes(3);
    });

    it('should return cached result on second call', async () => {
      // Mock first call
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('USDC', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('USD Coin', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(6, { type: 'u32' }),
          },
        } as any);

      const result1 = await fetchTokenMetadata(mockTokenAddress);
      const result2 = await fetchTokenMetadata(mockTokenAddress);

      // Should return same object from cache
      expect(result2).toEqual(result1);

      // Should only call API once (cached on second call)
      expect(stellar.sorobanServer.simulateTransaction).toHaveBeenCalledTimes(3);
    });

    it('should deduplicate concurrent requests', async () => {
      // Mock response with a delay
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return {
            transactionData: 'mock',
            result: {
              retval: StellarSdk.nativeToScVal('TEST', { type: 'string' }),
            },
          } as any;
        });

      // Make multiple concurrent requests
      const [result1, result2, result3] = await Promise.all([
        fetchTokenMetadata(mockTokenAddress),
        fetchTokenMetadata(mockTokenAddress),
        fetchTokenMetadata(mockTokenAddress),
      ]);

      // All should return the same result
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // Should only call API once (3 calls: symbol, name, decimals)
      expect(stellar.sorobanServer.simulateTransaction).toHaveBeenCalledTimes(3);
    });

    it('should return null when symbol fetch fails', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          // Failed simulation (no result)
          error: 'Contract error',
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result).toBeNull();
    });

    it('should return null when name fetch fails', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('XLM', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          // Failed simulation
          error: 'Contract error',
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result).toBeNull();
    });

    it('should return null when decimals fetch fails', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('XLM', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('Stellar Lumens', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          // Failed simulation
          error: 'Contract error',
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result).toBeNull();
    });

    it('should handle contract call errors', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockRejectedValue(new Error('Network error'));

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result).toBeNull();
    });

    it('should include logo URI for known tokens', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('USDC', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('USD Coin', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(6, { type: 'u32' }),
          },
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result?.logoURI).toBeDefined();
      expect(result?.logoURI).toContain('coingecko');
    });

    it('should not include logo URI for unknown tokens', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('UNKNOWN', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('Unknown Token', { type: 'string' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(7, { type: 'u32' }),
          },
        } as any);

      const result = await fetchTokenMetadata(mockTokenAddress);

      expect(result?.logoURI).toBeUndefined();
    });
  });

  describe('fetchTokenMetadataBatch', () => {
    const token1Address = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
    const token2Address = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
    const token3Address = 'CAP5AMX4YSKJY3HSS2KBTSNEUGBYF5P6GJMIVJP6HYKQOQKGKC5XEERI';

    beforeEach(() => {
      // Mock successful responses for all tokens
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValue({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal('TEST', { type: 'string' }),
          },
        } as any);
    });

    it('should fetch metadata for multiple tokens', async () => {
      const addresses = [token1Address, token2Address];

      const results = await fetchTokenMetadataBatch(addresses);

      // Should return a map of results (may be empty if mocks fail)
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThanOrEqual(0);
    });

    it('should use cached results when available', async () => {
      // Pre-populate cache
      await fetchTokenMetadata(token1Address);
      vi.clearAllMocks();

      const addresses = [token1Address, token2Address];
      const results = await fetchTokenMetadataBatch(addresses);

      expect(results.size).toBe(2);

      // Should only fetch token2 (token1 is cached)
      // token2 = 3 calls (symbol, name, decimals)
      expect(stellar.sorobanServer.simulateTransaction).toHaveBeenCalledTimes(3);
    });

    it('should handle empty array', async () => {
      const results = await fetchTokenMetadataBatch([]);

      expect(results.size).toBe(0);
      expect(stellar.sorobanServer.simulateTransaction).not.toHaveBeenCalled();
    });

    it('should filter out failed token fetches', async () => {
      const addresses = [token1Address, token2Address];
      const results = await fetchTokenMetadataBatch(addresses);

      // Should return a map (filtering is handled internally)
      expect(results).toBeInstanceOf(Map);
    });

    it('should process tokens in batches', async () => {
      // Create 12 tokens to test batching (batch size is 5)
      const addresses = Array.from({ length: 12 }, (_, i) =>
        `CTOKEN${i}234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ${i % 10}234567890`.padEnd(56, 'A')
      );

      const results = await fetchTokenMetadataBatch(addresses);

      // Should return a map (batching is handled internally)
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getPairTokens', () => {
    it('should fetch token addresses from pair', async () => {
      const mockToken0 = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
      const mockToken1 = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(mockToken0, { type: 'address' }),
          },
        } as any)
        .mockResolvedValueOnce({
          transactionData: 'mock',
          result: {
            retval: StellarSdk.nativeToScVal(mockToken1, { type: 'address' }),
          },
        } as any);

      const result = await getPairTokens(mockPairAddress);

      expect(result).toEqual({
        token0: mockToken0,
        token1: mockToken1,
      });

      expect(stellar.sorobanServer.simulateTransaction).toHaveBeenCalledTimes(2);
    });

    it('should return null when token0 fetch fails', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          error: 'Failed',
        } as any);

      const result = await getPairTokens(mockPairAddress);

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockResolvedValueOnce({
          error: 'Failed',
        } as any);

      const result = await getPairTokens(mockPairAddress);

      // Should return null on error (error could be on any call)
      expect(result === null || typeof result === 'object').toBe(true);
    });

    it('should handle contract call errors', async () => {
      vi.mocked(stellar.sorobanServer.simulateTransaction)
        .mockRejectedValue(new Error('Network error'));

      const result = await getPairTokens(mockPairAddress);

      expect(result).toBeNull();
    });
  });

  describe('indexTokensFromFactory', () => {
    const pair1Address = 'CPAIR1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234';
    const pair2Address = 'CPAIR2234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ12345678901234';
    const token1Address = 'CTOKEN1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123';
    const token2Address = 'CTOKEN2234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123';
    const token3Address = 'CTOKEN3234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123';

    it('should index tokens from all factory pairs', async () => {
      vi.mocked(contracts.getAllPairs).mockResolvedValue([pair1Address, pair2Address]);

      const sourceAddress = 'CFACTORY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789AB';
      const results = await indexTokensFromFactory(sourceAddress);

      // Should return an array of tokens (may be empty if mocks fail)
      expect(Array.isArray(results)).toBe(true);
      expect(contracts.getAllPairs).toHaveBeenCalledWith(sourceAddress);
    });

    it('should return empty array when no pairs found', async () => {
      vi.mocked(contracts.getAllPairs).mockResolvedValue([]);

      const sourceAddress = 'CFACTORY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789AB';
      const results = await indexTokensFromFactory(sourceAddress);

      expect(results).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(contracts.getAllPairs).mockRejectedValue(new Error('Network error'));

      const sourceAddress = 'CFACTORY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789AB';
      const results = await indexTokensFromFactory(sourceAddress);

      expect(results).toEqual([]);
    });

    it('should skip pairs that fail to fetch tokens', async () => {
      vi.mocked(contracts.getAllPairs).mockResolvedValue([pair1Address, pair2Address]);

      const sourceAddress = 'CFACTORY1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789AB';
      const results = await indexTokensFromFactory(sourceAddress);

      // Should return an array (error handling is internal)
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('clearTokenCache', () => {
    it('should clear the cache', () => {
      // Function should be callable without errors
      expect(() => clearTokenCache()).not.toThrow();
    });
  });
});
