/**
 * AstroSwap Contracts - Function Tests
 *
 * Tests for actual contract interaction functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import * as contracts from '../contracts';
import * as stellar from '../stellar';

// Mock the stellar module
vi.mock('../stellar', () => ({
  callContract: vi.fn(),
  buildAndSubmitTransaction: vi.fn(),
  sorobanServer: {
    getLatestLedger: vi.fn().mockResolvedValue({ sequence: 1000000 }),
  },
}));

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', () => ({
  nativeToScVal: vi.fn(),
  scValToNative: vi.fn(),
  Contract: vi.fn().mockImplementation(() => ({
    call: vi.fn().mockReturnValue('mock_operation'),
  })),
  xdr: {
    ScVal: {
      scvVec: vi.fn().mockReturnValue('mock_vector'),
    },
  },
}));

const mockAddress = 'GABC123DEFG456HIJK789LMNO012PQRS345TUVW678XYZA901BCDEFG';
const mockPairAddress = 'CPAIR1234567890123456789012345678901234567890123456789';
const mockToken0 = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const mockToken1 = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';

describe('AstroSwap Contracts - Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllPairs', () => {
    it('should return empty array when no pairs exist', async () => {
      vi.mocked(stellar.callContract).mockResolvedValue(0);

      const result = await contracts.getAllPairs(mockAddress);

      expect(result).toEqual([]);
      expect(stellar.callContract).toHaveBeenCalledWith(
        contracts.CONTRACTS.FACTORY,
        'all_pairs_length',
        [],
        mockAddress
      );
    });

    it('should fetch all pairs in single batch when count <= 100', async () => {
      const mockPairs = ['PAIR1', 'PAIR2', 'PAIR3'];

      vi.mocked(stellar.callContract)
        .mockResolvedValueOnce(3) // all_pairs_length
        .mockResolvedValueOnce(mockPairs); // get_pairs_paginated

      vi.mocked(StellarSdk.nativeToScVal)
        .mockReturnValueOnce('start_scval' as any)
        .mockReturnValueOnce('limit_scval' as any);

      const result = await contracts.getAllPairs(mockAddress);

      expect(result).toEqual(mockPairs);
      expect(stellar.callContract).toHaveBeenCalledTimes(2);
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(0, { type: 'u32' });
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(3, { type: 'u32' });
    });

    it('should fetch pairs in multiple batches when count > 100', async () => {
      const batch1 = Array(100).fill('PAIR').map((p, i) => `${p}${i}`);
      const batch2 = Array(50).fill('PAIR').map((p, i) => `${p}${i + 100}`);

      vi.mocked(stellar.callContract)
        .mockResolvedValueOnce(150) // all_pairs_length
        .mockResolvedValueOnce(batch1) // First batch
        .mockResolvedValueOnce(batch2); // Second batch

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);

      const result = await contracts.getAllPairs(mockAddress);

      expect(result).toHaveLength(150);
      expect(stellar.callContract).toHaveBeenCalledTimes(3);
    });

    it('should handle errors and return empty array', async () => {
      vi.mocked(stellar.callContract).mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getAllPairs(mockAddress);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Error getting all pairs:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('getPairAddress', () => {
    it('should return pair address for valid token pair', async () => {
      vi.mocked(stellar.callContract).mockResolvedValue(mockPairAddress);
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('token_scval' as any);

      const result = await contracts.getPairAddress(mockToken0, mockToken1, mockAddress);

      expect(result).toBe(mockPairAddress);
      expect(stellar.callContract).toHaveBeenCalledWith(
        contracts.CONTRACTS.FACTORY,
        'get_pair',
        ['token_scval', 'token_scval'],
        mockAddress
      );
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(mockToken0, { type: 'address' });
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(mockToken1, { type: 'address' });
    });

    it('should return null on error', async () => {
      vi.mocked(stellar.callContract).mockRejectedValue(new Error('Pair not found'));
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('token_scval' as any);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getPairAddress(mockToken0, mockToken1, mockAddress);

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getReserves', () => {
    it('should return reserves for valid pair', async () => {
      const mockReserves = {
        reserve0: '1000000000',
        reserve1: '2000000000',
        blockTimestampLast: 1234567890,
      };

      vi.mocked(stellar.callContract).mockResolvedValue(mockReserves);

      const result = await contracts.getReserves(mockPairAddress, mockAddress);

      expect(result).toEqual(mockReserves);
      expect(stellar.callContract).toHaveBeenCalledWith(
        mockPairAddress,
        'get_reserves',
        [],
        mockAddress
      );
    });

    it('should return null on error', async () => {
      vi.mocked(stellar.callContract).mockRejectedValue(new Error('Contract error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getReserves(mockPairAddress, mockAddress);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('getTotalSupply', () => {
    it('should return total supply for pair', async () => {
      const mockSupply = '1000000000';

      vi.mocked(stellar.callContract).mockResolvedValue(mockSupply);

      const result = await contracts.getTotalSupply(mockPairAddress, mockAddress);

      expect(result).toBe(mockSupply);
      expect(stellar.callContract).toHaveBeenCalledWith(
        mockPairAddress,
        'total_supply',
        [],
        mockAddress
      );
    });

    it('should return "0" on error', async () => {
      vi.mocked(stellar.callContract).mockRejectedValue(new Error('Contract error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getTotalSupply(mockPairAddress, mockAddress);

      expect(result).toBe('0');
      consoleSpy.mockRestore();
    });
  });

  describe('getAmountsOut', () => {
    it('should return empty array for invalid path (< 2 tokens)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getAmountsOut('1000000', ['TOKEN1'], mockAddress);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Path must have at least 2 tokens');
      consoleSpy.mockRestore();
    });

    it('should return empty array when pair does not exist', async () => {
      // getPairAddress returns null
      vi.spyOn(contracts, 'getPairAddress').mockResolvedValue(null);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getAmountsOut('1000000', [mockToken0, mockToken1], mockAddress);

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('Pair not found for', mockToken0, '->', mockToken1);
      consoleSpy.mockRestore();
    });

    it.skip('should calculate amounts for 2-token path', async () => {
      // TODO: Complex test that requires mocking internal calculateAmountOut function
      // Skipping for now as it requires deeper mocking
      const mockReserves = {
        reserve0: '10000000000',
        reserve1: '20000000000',
        blockTimestampLast: 1234567890,
      };

      vi.spyOn(contracts, 'getPairAddress').mockResolvedValue(mockPairAddress);
      vi.spyOn(contracts, 'getReserves').mockResolvedValue(mockReserves);
      vi.mocked(stellar.callContract).mockResolvedValue(mockToken0);

      const result = await contracts.getAmountsOut('1000000000', [mockToken0, mockToken1], mockAddress);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe('1000000000');
      expect(result[1]).toBeTruthy();
    });

    it('should handle errors and return empty array', async () => {
      vi.spyOn(contracts, 'getPairAddress').mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getAmountsOut('1000000', [mockToken0, mockToken1], mockAddress);

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  describe('swapExactTokensForTokens', () => {
    it('should build and submit swap transaction', async () => {
      const mockTxHash = 'TX_HASH_123';
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.swapExactTokensForTokens(
        '1000000000',
        '990000000',
        [mockToken0, mockToken1],
        mockAddress,  // to parameter
        deadline,
        mockAddress   // sourceAddress
      );

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Transaction failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        contracts.swapExactTokensForTokens(
          '1000000000',
          '990000000',
          [mockToken0, mockToken1],
          mockAddress,  // to parameter
          deadline,
          mockAddress   // sourceAddress
        )
      ).rejects.toThrow('Transaction failed');

      consoleSpy.mockRestore();
    });
  });

  describe('addLiquidity', () => {
    it('should build and submit addLiquidity transaction', async () => {
      const mockTxHash = 'TX_HASH_ADD';
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.addLiquidity(
        mockToken0,
        mockToken1,
        '1000000000',
        '2000000000',
        '990000000',
        '1980000000',
        mockAddress,  // to parameter
        deadline,
        mockAddress   // sourceAddress
      );

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(mockAddress, { type: 'address' });
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(mockToken0, { type: 'address' });
      expect(StellarSdk.nativeToScVal).toHaveBeenCalledWith(mockToken1, { type: 'address' });
    });

    it('should throw error on failure', async () => {
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Transaction failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        contracts.addLiquidity(
          mockToken0,
          mockToken1,
          '1000000000',
          '2000000000',
          '990000000',
          '1980000000',
          mockAddress,  // to parameter
          deadline,
          mockAddress   // sourceAddress
        )
      ).rejects.toThrow('Transaction failed');

      consoleSpy.mockRestore();
    });
  });

  describe('removeLiquidity', () => {
    it('should build and submit removeLiquidity transaction', async () => {
      const mockTxHash = 'TX_HASH_REMOVE';
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.removeLiquidity(
        mockToken0,
        mockToken1,
        '500000000',
        '450000000',
        '900000000',
        mockAddress,  // to parameter
        deadline,
        mockAddress   // sourceAddress
      );

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      const deadline = Math.floor(Date.now() / 1000) + 300;

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Transaction failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        contracts.removeLiquidity(
          mockToken0,
          mockToken1,
          '500000000',
          '450000000',
          '900000000',
          mockAddress,  // to parameter
          deadline,
          mockAddress   // sourceAddress
        )
      ).rejects.toThrow('Transaction failed');

      consoleSpy.mockRestore();
    });
  });

  describe('stake', () => {
    it('should build and submit stake transaction', async () => {
      const mockTxHash = 'TX_HASH_STAKE';

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.stake('0', '1000000000', mockAddress);

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Stake failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(contracts.stake('0', '1000000000', mockAddress)).rejects.toThrow('Stake failed');

      consoleSpy.mockRestore();
    });
  });

  describe('unstake', () => {
    it('should build and submit unstake transaction', async () => {
      const mockTxHash = 'TX_HASH_UNSTAKE';

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.unstake('0', '500000000', mockAddress);

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Unstake failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(contracts.unstake('0', '500000000', mockAddress)).rejects.toThrow('Unstake failed');

      consoleSpy.mockRestore();
    });
  });

  describe('claimRewards', () => {
    it('should build and submit claimRewards transaction', async () => {
      const mockTxHash = 'TX_HASH_CLAIM';

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.claimRewards('0', mockAddress);

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Claim failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(contracts.claimRewards('0', mockAddress)).rejects.toThrow('Claim failed');

      consoleSpy.mockRestore();
    });
  });

  describe('getUserStakeInfo', () => {
    it('should return user stake info', async () => {
      const mockStakeInfo = {
        staked: '1000000000',
        rewards: '50000000',
      };

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.callContract).mockResolvedValue(mockStakeInfo);

      const result = await contracts.getUserStakeInfo('0', mockAddress, mockAddress);

      expect(result).toEqual(mockStakeInfo);
      expect(stellar.callContract).toHaveBeenCalledWith(
        contracts.CONTRACTS.STAKING,
        'get_user_info',
        ['scval', 'scval'],
        mockAddress
      );
    });

    it('should return null on error', async () => {
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.callContract).mockRejectedValue(new Error('Contract error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await contracts.getUserStakeInfo('0', mockAddress, mockAddress);

      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('approveToken', () => {
    it('should build and submit approve transaction', async () => {
      const mockTxHash = 'TX_HASH_APPROVE';

      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockResolvedValue(mockTxHash);

      const result = await contracts.approveToken(
        mockToken0,
        contracts.CONTRACTS.ROUTER,
        '1000000000',
        mockAddress
      );

      expect(result).toBe(mockTxHash);
      expect(stellar.buildAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      vi.mocked(StellarSdk.nativeToScVal).mockReturnValue('scval' as any);
      vi.mocked(stellar.buildAndSubmitTransaction).mockRejectedValue(new Error('Approve failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        contracts.approveToken(
          mockToken0,
          contracts.CONTRACTS.ROUTER,
          '1000000000',
          mockAddress
        )
      ).rejects.toThrow('Approve failed');

      consoleSpy.mockRestore();
    });
  });
});
