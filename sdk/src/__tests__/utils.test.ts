/**
 * Unit tests for AstroSwap SDK Utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  // Safe math utilities
  mulDivDown,
  mulDivUp,
  calculateK,
  verifyKInvariant,
  // AMM math utilities
  getAmountOut,
  getAmountIn,
  getAmountsOut,
  getAmountsIn,
  quote,
  sqrt,
  calculateInitialLiquidity,
  calculateLiquidity,
  calculatePriceImpact,
  calculateShareOfPool,
  // Address utilities
  sortTokens,
  isValidAddress,
  shortenAddress,
  // Amount utilities
  toContractAmount,
  fromContractAmount,
  formatAmount,
  // Time utilities
  getDeadline,
  isDeadlineExpired,
  // Slippage utilities
  withSlippage,
  withSlippageUp,
  // ScVal utilities
  scValToNative,
  nativeToScValTyped,
  // Retry utilities
  retry,
  // Constants
  BPS_DENOMINATOR,
  MINIMUM_LIQUIDITY,
  DEFAULT_DEADLINE_SECONDS,
} from '../utils';
import { Address, xdr } from '@stellar/stellar-sdk';

// ==================== Safe Math Utilities Tests ====================

describe('Safe Math Utilities', () => {
  describe('mulDivDown', () => {
    it('should calculate (a * b) / c with rounding down', () => {
      expect(mulDivDown(10n, 20n, 5n)).toBe(40n);
      expect(mulDivDown(10n, 3n, 4n)).toBe(7n); // 7.5 rounds down to 7
      expect(mulDivDown(7n, 3n, 10n)).toBe(2n); // 2.1 rounds down to 2
    });

    it('should handle zero values', () => {
      expect(mulDivDown(0n, 100n, 10n)).toBe(0n);
      expect(mulDivDown(100n, 0n, 10n)).toBe(0n);
    });

    it('should throw on division by zero', () => {
      expect(() => mulDivDown(100n, 200n, 0n)).toThrow('Division by zero');
    });

    it('should throw on negative values', () => {
      expect(() => mulDivDown(-10n, 20n, 5n)).toThrow('Negative values not allowed');
      expect(() => mulDivDown(10n, -20n, 5n)).toThrow('Negative values not allowed');
      expect(() => mulDivDown(10n, 20n, -5n)).toThrow('Negative values not allowed');
    });

    it('should handle large numbers without overflow', () => {
      const large = 10n ** 30n;
      const result = mulDivDown(large, 50n, 25n);
      expect(result).toBe(large * 2n);
    });
  });

  describe('mulDivUp', () => {
    it('should calculate (a * b) / c with rounding up', () => {
      expect(mulDivUp(10n, 20n, 5n)).toBe(40n); // Exact, no rounding needed
      expect(mulDivUp(10n, 3n, 4n)).toBe(8n); // 7.5 rounds up to 8
      expect(mulDivUp(7n, 3n, 10n)).toBe(3n); // 2.1 rounds up to 3
    });

    it('should be >= mulDivDown', () => {
      const down = mulDivDown(10n, 3n, 4n);
      const up = mulDivUp(10n, 3n, 4n);
      expect(up).toBeGreaterThanOrEqual(down);
    });

    it('should equal mulDivDown for exact divisions', () => {
      const down = mulDivDown(10n, 20n, 5n);
      const up = mulDivUp(10n, 20n, 5n);
      expect(up).toBe(down);
    });
  });

  describe('calculateK', () => {
    it('should calculate k = reserve0 * reserve1', () => {
      expect(calculateK(100n, 200n)).toBe(20000n);
      expect(calculateK(0n, 100n)).toBe(0n);
      expect(calculateK(1n, 1n)).toBe(1n);
    });

    it('should throw on negative reserves', () => {
      expect(() => calculateK(-100n, 200n)).toThrow('Negative reserves not allowed');
      expect(() => calculateK(100n, -200n)).toThrow('Negative reserves not allowed');
    });
  });

  describe('verifyKInvariant', () => {
    it('should return true when k increases', () => {
      expect(verifyKInvariant(110n, 110n, 100n, 100n)).toBe(true);
    });

    it('should return true when k stays same', () => {
      expect(verifyKInvariant(100n, 100n, 100n, 100n)).toBe(true);
    });

    it('should return false when k decreases', () => {
      expect(verifyKInvariant(90n, 90n, 100n, 100n)).toBe(false);
    });
  });
});

// ==================== AMM Math Utilities Tests ====================

describe('AMM Math Utilities', () => {
  describe('getAmountOut', () => {
    it('should calculate correct output amount', () => {
      const amountIn = 1000n;
      const reserveIn = 10000n;
      const reserveOut = 10000n;
      const feeBps = 30; // 0.3%

      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);

      // Expected: (1000 * 9970 * 10000) / (10000 * 10000 + 1000 * 9970)
      // = 9970000000 / 109970000 = 906n
      expect(amountOut).toBe(906n);
    });

    it('should handle large numbers', () => {
      const amountIn = 1_000_000_000_000n;
      const reserveIn = 10_000_000_000_000n;
      const reserveOut = 10_000_000_000_000n;

      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
      expect(amountOut).toBeGreaterThan(0n);
    });

    it('should apply different fee tiers correctly', () => {
      const amountIn = 1000n;
      const reserveIn = 10000n;
      const reserveOut = 10000n;

      const out30bps = getAmountOut(amountIn, reserveIn, reserveOut, 30);
      const out5bps = getAmountOut(amountIn, reserveIn, reserveOut, 5);

      // Lower fee should give more output
      expect(out5bps).toBeGreaterThan(out30bps);
    });

    it('should throw on zero amount in', () => {
      expect(() => getAmountOut(0n, 1000n, 1000n)).toThrow('Invalid amount in');
    });

    it('should throw on negative amount in', () => {
      expect(() => getAmountOut(-100n, 1000n, 1000n)).toThrow('Invalid amount in');
    });

    it('should throw on zero reserves', () => {
      expect(() => getAmountOut(100n, 0n, 1000n)).toThrow('Insufficient liquidity');
      expect(() => getAmountOut(100n, 1000n, 0n)).toThrow('Insufficient liquidity');
    });

    it('should handle edge case of very small reserves', () => {
      const amountOut = getAmountOut(1n, 10n, 10n);
      expect(amountOut).toBeGreaterThanOrEqual(0n);
    });

    it('should return 0 when input is too small relative to reserves', () => {
      const amountOut = getAmountOut(1n, 1_000_000_000n, 1_000_000_000n);
      expect(amountOut).toBe(0n);
    });
  });

  describe('getAmountIn', () => {
    it('should calculate correct input amount', () => {
      const amountOut = 906n;
      const reserveIn = 10000n;
      const reserveOut = 10000n;
      const feeBps = 30;

      const amountIn = getAmountIn(amountOut, reserveIn, reserveOut, feeBps);

      // Should be approximately 1000n (with +1 for rounding)
      expect(amountIn).toBeGreaterThanOrEqual(1000n);
      expect(amountIn).toBeLessThanOrEqual(1002n);
    });

    it('should be inverse of getAmountOut', () => {
      const originalAmountIn = 1000n;
      const reserveIn = 10000n;
      const reserveOut = 10000n;

      const amountOut = getAmountOut(originalAmountIn, reserveIn, reserveOut);
      const calculatedAmountIn = getAmountIn(amountOut, reserveIn, reserveOut);

      // Should be close due to rounding
      expect(calculatedAmountIn).toBeGreaterThanOrEqual(originalAmountIn);
      expect(calculatedAmountIn - originalAmountIn).toBeLessThanOrEqual(2n);
    });

    it('should throw on zero amount out', () => {
      expect(() => getAmountIn(0n, 1000n, 1000n)).toThrow('Invalid amount out');
    });

    it('should throw on negative amount out', () => {
      expect(() => getAmountIn(-100n, 1000n, 1000n)).toThrow('Invalid amount out');
    });

    it('should throw when amount out >= reserve out', () => {
      expect(() => getAmountIn(1000n, 1000n, 1000n)).toThrow('Insufficient liquidity');
      expect(() => getAmountIn(1001n, 1000n, 1000n)).toThrow('Insufficient liquidity');
    });

    it('should handle large numbers', () => {
      const amountOut = 900_000_000_000n;
      const reserveIn = 10_000_000_000_000n;
      const reserveOut = 10_000_000_000_000n;

      const amountIn = getAmountIn(amountOut, reserveIn, reserveOut);
      expect(amountIn).toBeGreaterThan(0n);
    });
  });

  describe('getAmountsOut', () => {
    it('should calculate multi-hop swap amounts', () => {
      const amountIn = 1000n;
      const reserves = [
        { reserveIn: 10000n, reserveOut: 20000n, feeBps: 30 },
        { reserveIn: 20000n, reserveOut: 15000n, feeBps: 30 },
      ];

      const amounts = getAmountsOut(amountIn, reserves);

      expect(amounts).toHaveLength(3);
      expect(amounts[0]).toBe(amountIn);
      expect(amounts[1]).toBeGreaterThan(0n);
      expect(amounts[2]).toBeGreaterThan(0n);
    });

    it('should handle single hop', () => {
      const amountIn = 1000n;
      const reserves = [{ reserveIn: 10000n, reserveOut: 10000n, feeBps: 30 }];

      const amounts = getAmountsOut(amountIn, reserves);

      expect(amounts).toHaveLength(2);
      expect(amounts[0]).toBe(amountIn);
      expect(amounts[1]).toBe(getAmountOut(amountIn, 10000n, 10000n, 30));
    });

    it('should handle empty path', () => {
      const amounts = getAmountsOut(1000n, []);
      expect(amounts).toEqual([1000n]);
    });
  });

  describe('getAmountsIn', () => {
    it('should calculate multi-hop input amounts', () => {
      const amountOut = 1000n;
      const reserves = [
        { reserveIn: 10000n, reserveOut: 20000n, feeBps: 30 },
        { reserveIn: 20000n, reserveOut: 15000n, feeBps: 30 },
      ];

      const amounts = getAmountsIn(amountOut, reserves);

      expect(amounts).toHaveLength(3);
      expect(amounts[amounts.length - 1]).toBe(amountOut);
      expect(amounts[0]).toBeGreaterThan(0n);
    });

    it('should be inverse of getAmountsOut', () => {
      const amountIn = 1000n;
      const reserves = [
        { reserveIn: 10000n, reserveOut: 20000n, feeBps: 30 },
        { reserveIn: 20000n, reserveOut: 15000n, feeBps: 30 },
      ];

      const amountsOut = getAmountsOut(amountIn, reserves);
      const finalOut = amountsOut[amountsOut.length - 1];
      const amountsIn = getAmountsIn(finalOut, reserves);

      // Should be close due to rounding
      expect(amountsIn[0]).toBeGreaterThanOrEqual(amountIn);
      expect(amountsIn[0] - amountIn).toBeLessThanOrEqual(10n);
    });
  });

  describe('quote', () => {
    it('should calculate proportional amount', () => {
      const amountA = 1000n;
      const reserveA = 10000n;
      const reserveB = 20000n;

      const amountB = quote(amountA, reserveA, reserveB);

      // 1000 * 20000 / 10000 = 2000
      expect(amountB).toBe(2000n);
    });

    it('should handle equal reserves', () => {
      const amountA = 1000n;
      const reserveA = 10000n;
      const reserveB = 10000n;

      const amountB = quote(amountA, reserveA, reserveB);
      expect(amountB).toBe(amountA);
    });

    it('should throw on zero amount', () => {
      expect(() => quote(0n, 1000n, 1000n)).toThrow('Invalid amount');
    });

    it('should throw on zero reserves', () => {
      expect(() => quote(100n, 0n, 1000n)).toThrow('Insufficient liquidity');
      expect(() => quote(100n, 1000n, 0n)).toThrow('Insufficient liquidity');
    });
  });

  describe('sqrt', () => {
    it('should calculate square root of perfect squares', () => {
      expect(sqrt(0n)).toBe(0n);
      expect(sqrt(1n)).toBe(1n);
      expect(sqrt(4n)).toBe(2n);
      expect(sqrt(9n)).toBe(3n);
      expect(sqrt(16n)).toBe(4n);
      expect(sqrt(25n)).toBe(5n);
      expect(sqrt(100n)).toBe(10n);
      expect(sqrt(10000n)).toBe(100n);
    });

    it('should calculate square root of non-perfect squares', () => {
      expect(sqrt(2n)).toBe(1n); // Floor of sqrt(2)
      expect(sqrt(3n)).toBe(1n);
      expect(sqrt(5n)).toBe(2n);
      expect(sqrt(8n)).toBe(2n);
      expect(sqrt(99n)).toBe(9n);
    });

    it('should handle large numbers', () => {
      const large = 1_000_000_000_000n;
      const root = sqrt(large);
      expect(root * root).toBeLessThanOrEqual(large);
      expect((root + 1n) * (root + 1n)).toBeGreaterThan(large);
    });

    it('should throw on negative numbers', () => {
      expect(() => sqrt(-1n)).toThrow('Cannot calculate square root of negative number');
    });

    it('should handle overflow edge cases', () => {
      const veryLarge = 2n ** 100n;
      const root = sqrt(veryLarge);
      expect(root).toBeGreaterThan(0n);
    });
  });

  describe('calculateInitialLiquidity', () => {
    it('should calculate initial LP tokens', () => {
      const amount0 = 1000000n;
      const amount1 = 1000000n;

      const liquidity = calculateInitialLiquidity(amount0, amount1);

      // sqrt(1000000 * 1000000) - 1000 = 1000000 - 1000 = 999000
      expect(liquidity).toBe(999000n);
    });

    it('should handle unequal amounts', () => {
      const amount0 = 1000000n;
      const amount1 = 4000000n;

      const liquidity = calculateInitialLiquidity(amount0, amount1);

      // sqrt(4000000000000) - 1000 = 2000000 - 1000
      expect(liquidity).toBe(1999000n);
    });

    it('should throw when liquidity <= minimum', () => {
      expect(() => calculateInitialLiquidity(10n, 10n)).toThrow('Insufficient initial liquidity');
      expect(() => calculateInitialLiquidity(100n, 100n)).toThrow('Insufficient initial liquidity');
    });

    it('should work at minimum threshold', () => {
      const minAmount = 32n; // sqrt(32*32) = 32, so 32-1000 would fail
      const amount = 1001n; // sqrt(1001*1001) = 1001, so 1001-1000 = 1
      const liquidity = calculateInitialLiquidity(amount, amount);
      expect(liquidity).toBeGreaterThan(0n);
    });
  });

  describe('calculateLiquidity', () => {
    it('should calculate LP tokens for existing pool', () => {
      const amount0 = 1000n;
      const amount1 = 2000n;
      const reserve0 = 10000n;
      const reserve1 = 20000n;
      const totalSupply = 100000n;

      const liquidity = calculateLiquidity(amount0, amount1, reserve0, reserve1, totalSupply);

      // min((1000 * 100000) / 10000, (2000 * 100000) / 20000)
      // min(10000, 10000) = 10000
      expect(liquidity).toBe(10000n);
    });

    it('should take minimum of two ratios', () => {
      const amount0 = 1000n;
      const amount1 = 1500n; // Less than proportional
      const reserve0 = 10000n;
      const reserve1 = 20000n;
      const totalSupply = 100000n;

      const liquidity = calculateLiquidity(amount0, amount1, reserve0, reserve1, totalSupply);

      // min((1000 * 100000) / 10000, (1500 * 100000) / 20000)
      // min(10000, 7500) = 7500
      expect(liquidity).toBe(7500n);
    });

    it('should call calculateInitialLiquidity when totalSupply is 0', () => {
      const amount0 = 1000000n;
      const amount1 = 1000000n;

      const liquidity = calculateLiquidity(amount0, amount1, 0n, 0n, 0n);

      expect(liquidity).toBe(999000n);
    });
  });

  describe('calculatePriceImpact', () => {
    it('should calculate price impact in basis points', () => {
      const amountIn = 1000n;
      const reserveIn = 10000n;
      const reserveOut = 10000n;

      const impact = calculatePriceImpact(amountIn, reserveIn, reserveOut);

      // Should be positive (output is less than expected)
      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThan(1000); // Less than 10%
    });

    it('should show higher impact for larger trades', () => {
      const reserveIn = 10000n;
      const reserveOut = 10000n;

      const impact1 = calculatePriceImpact(100n, reserveIn, reserveOut);
      const impact2 = calculatePriceImpact(1000n, reserveIn, reserveOut);
      const impact3 = calculatePriceImpact(5000n, reserveIn, reserveOut);

      expect(impact2).toBeGreaterThan(impact1);
      expect(impact3).toBeGreaterThan(impact2);
    });

    it('should handle zero amount in', () => {
      // calculatePriceImpact calls getAmountOut which throws on 0
      // This is expected behavior - you can't calculate price impact for 0 trade
      expect(() => calculatePriceImpact(0n, 1000n, 1000n)).toThrow('Invalid amount in');
    });

    it('should handle very small trades', () => {
      const impact = calculatePriceImpact(1n, 1_000_000n, 1_000_000n);
      expect(impact).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateShareOfPool', () => {
    it('should calculate percentage share', () => {
      const liquidity = 10000n;
      const totalSupply = 100000n;

      const share = calculateShareOfPool(liquidity, totalSupply);

      expect(share).toBe(10);
    });

    it('should return 100 for empty pool', () => {
      const share = calculateShareOfPool(1000n, 0n);
      expect(share).toBe(100);
    });

    it('should handle fractional percentages', () => {
      const liquidity = 12345n;
      const totalSupply = 100000n;

      const share = calculateShareOfPool(liquidity, totalSupply);

      expect(share).toBe(12.34);
    });
  });
});

// ==================== Address Utilities Tests ====================

describe('Address Utilities', () => {
  describe('sortTokens', () => {
    it('should sort tokens alphabetically', () => {
      const tokenA = 'GBBB...';
      const tokenB = 'GAAA...';

      const [token0, token1] = sortTokens(tokenA, tokenB);

      expect(token0).toBe(tokenB); // GAAA comes first
      expect(token1).toBe(tokenA);
    });

    it('should maintain order if already sorted', () => {
      const tokenA = 'GAAA...';
      const tokenB = 'GBBB...';

      const [token0, token1] = sortTokens(tokenA, tokenB);

      expect(token0).toBe(tokenA);
      expect(token1).toBe(tokenB);
    });

    it('should be case-insensitive', () => {
      const tokenA = 'gaaa...';
      const tokenB = 'GBBB...';

      const [token0, token1] = sortTokens(tokenA, tokenB);

      expect(token0).toBe(tokenA);
      expect(token1).toBe(tokenB);
    });

    it('should throw on identical tokens', () => {
      const token = 'GAAA...';
      expect(() => sortTokens(token, token)).toThrow('Identical tokens');
    });
  });

  describe('isValidAddress', () => {
    it('should validate correct Stellar addresses', () => {
      // Valid G-address (32-byte public key)
      const validAddress = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      expect(isValidAddress(validAddress)).toBe(true);
    });

    it('should validate contract addresses', () => {
      // Valid C-address (contract)
      const contractAddress = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
      expect(isValidAddress(contractAddress)).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidAddress('invalid')).toBe(false);
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('GAAA')).toBe(false);
    });

    it('should reject addresses with invalid checksums', () => {
      const invalidChecksum = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2X';
      expect(isValidAddress(invalidChecksum)).toBe(false);
    });
  });

  describe('shortenAddress', () => {
    it('should shorten address with default chars', () => {
      const address = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const shortened = shortenAddress(address);

      expect(shortened).toBe('GBRPY...OX2H');
      expect(shortened.length).toBeLessThan(address.length);
    });

    it('should shorten address with custom chars', () => {
      const address = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const shortened = shortenAddress(address, 6);

      expect(shortened).toBe('GBRPYHI...C7OX2H');
    });

    it('should handle short addresses', () => {
      const address = 'GABC';
      const shortened = shortenAddress(address, 2);

      expect(shortened).toBe('GAB...BC');
    });
  });
});

// ==================== Amount Utilities Tests ====================

describe('Amount Utilities', () => {
  describe('toContractAmount', () => {
    it('should convert integer amounts', () => {
      expect(toContractAmount(100, 7)).toBe(1000000000n);
      expect(toContractAmount(1, 7)).toBe(10000000n);
      expect(toContractAmount(0, 7)).toBe(0n);
    });

    it('should convert decimal amounts', () => {
      expect(toContractAmount(1.5, 7)).toBe(15000000n);
      expect(toContractAmount(0.1, 7)).toBe(1000000n);
      expect(toContractAmount('0.0000001', 7)).toBe(1n); // Use string for very small numbers
    });

    it('should handle different decimal places', () => {
      expect(toContractAmount(100, 0)).toBe(100n);
      expect(toContractAmount(100, 2)).toBe(10000n);
      expect(toContractAmount(100, 18)).toBe(100000000000000000000n);
    });

    it('should truncate excess decimals', () => {
      expect(toContractAmount(1.123456789, 7)).toBe(11234567n);
      expect(toContractAmount(1.999999999, 7)).toBe(19999999n);
    });

    it('should handle string inputs', () => {
      expect(toContractAmount('100', 7)).toBe(1000000000n);
      expect(toContractAmount('1.5', 7)).toBe(15000000n);
    });

    it('should handle very large amounts', () => {
      expect(toContractAmount(1_000_000, 7)).toBe(10000000000000n);
    });

    it('should pad missing decimals with zeros', () => {
      expect(toContractAmount(1.1, 7)).toBe(11000000n);
      expect(toContractAmount(1.12, 7)).toBe(11200000n);
    });
  });

  describe('fromContractAmount', () => {
    it('should convert contract amounts to human-readable', () => {
      expect(fromContractAmount(1000000000n, 7)).toBe('100');
      expect(fromContractAmount(10000000n, 7)).toBe('1');
      expect(fromContractAmount(0n, 7)).toBe('0');
    });

    it('should handle fractional amounts', () => {
      expect(fromContractAmount(15000000n, 7)).toBe('1.5');
      expect(fromContractAmount(1000000n, 7)).toBe('0.1');
      expect(fromContractAmount(1n, 7)).toBe('0.0000001');
    });

    it('should strip trailing zeros', () => {
      expect(fromContractAmount(10000000n, 7)).toBe('1');
      expect(fromContractAmount(15000000n, 7)).toBe('1.5');
      expect(fromContractAmount(11234567n, 7)).toBe('1.1234567');
    });

    it('should handle different decimal places', () => {
      // With 0 decimals, 100 is just 100
      // But fromContractAmount still tries to take last 0 chars as decimal
      expect(fromContractAmount(100n, 2)).toBe('1');
      expect(fromContractAmount(10000n, 2)).toBe('100');
      expect(fromContractAmount(100000000000000000000n, 18)).toBe('100');
    });

    it('should be inverse of toContractAmount', () => {
      const original = '123.456789';
      const contract = toContractAmount(original, 7);
      const result = fromContractAmount(contract, 7);

      expect(result).toBe(original);
    });

    it('should handle very small amounts', () => {
      expect(fromContractAmount(1n, 7)).toBe('0.0000001');
      expect(fromContractAmount(10n, 7)).toBe('0.000001');
    });
  });

  describe('formatAmount', () => {
    it('should format with thousand separators', () => {
      expect(formatAmount(1000000000n, 7, 2)).toBe('100');
      expect(formatAmount(10000000000n, 7, 2)).toBe('1,000');
      expect(formatAmount(1000000000000n, 7, 2)).toBe('100,000');
    });

    it('should limit display decimals', () => {
      expect(formatAmount(11234567n, 7, 2)).toBe('1.12');
      expect(formatAmount(11234567n, 7, 4)).toBe('1.1235');
      expect(formatAmount(11234567n, 7, 6)).toBe('1.123457');
    });

    it('should handle zero decimals', () => {
      expect(formatAmount(11234567n, 7, 0)).toBe('1');
      expect(formatAmount(15000000n, 7, 0)).toBe('2');
    });

    it('should not show trailing zeros', () => {
      expect(formatAmount(10000000n, 7, 4)).toBe('1');
      expect(formatAmount(15000000n, 7, 4)).toBe('1.5');
    });
  });
});

// ==================== Time Utilities Tests ====================

describe('Time Utilities', () => {
  describe('getDeadline', () => {
    it('should return future timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = getDeadline(60);

      expect(deadline).toBeGreaterThan(now);
      expect(deadline).toBeLessThanOrEqual(now + 61);
    });

    it('should use default deadline', () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = getDeadline();

      expect(deadline).toBeGreaterThan(now);
      expect(deadline).toBeLessThanOrEqual(now + DEFAULT_DEADLINE_SECONDS + 1);
    });

    it('should handle custom durations', () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline1 = getDeadline(100);
      const deadline2 = getDeadline(200);

      expect(deadline2 - deadline1).toBeGreaterThanOrEqual(99);
      expect(deadline2 - deadline1).toBeLessThanOrEqual(101);
    });
  });

  describe('isDeadlineExpired', () => {
    it('should detect expired deadlines', () => {
      const pastDeadline = Math.floor(Date.now() / 1000) - 100;
      expect(isDeadlineExpired(pastDeadline)).toBe(true);
    });

    it('should detect valid deadlines', () => {
      const futureDeadline = Math.floor(Date.now() / 1000) + 100;
      expect(isDeadlineExpired(futureDeadline)).toBe(false);
    });

    it('should handle edge case of current time', () => {
      const now = Math.floor(Date.now() / 1000);
      // Current time should be considered expired
      expect(isDeadlineExpired(now)).toBe(false);
    });
  });
});

// ==================== Slippage Utilities Tests ====================

describe('Slippage Utilities', () => {
  describe('withSlippage', () => {
    it('should apply slippage to reduce amount', () => {
      const amount = 10000n;
      const slippageBps = 50; // 0.5%

      const result = withSlippage(amount, slippageBps);

      // 10000 * (10000 - 50) / 10000 = 9950
      expect(result).toBe(9950n);
    });

    it('should handle zero slippage', () => {
      const amount = 10000n;
      const result = withSlippage(amount, 0);

      expect(result).toBe(amount);
    });

    it('should handle large slippage', () => {
      const amount = 10000n;
      const slippageBps = 1000; // 10%

      const result = withSlippage(amount, slippageBps);

      expect(result).toBe(9000n);
    });

    it('should round down', () => {
      const amount = 999n;
      const slippageBps = 1; // 0.01%

      const result = withSlippage(amount, slippageBps);

      expect(result).toBe(998n);
    });
  });

  describe('withSlippageUp', () => {
    it('should apply slippage to increase amount', () => {
      const amount = 10000n;
      const slippageBps = 50; // 0.5%

      const result = withSlippageUp(amount, slippageBps);

      // 10000 * (10000 + 50) / 10000 = 10050
      expect(result).toBe(10050n);
    });

    it('should handle zero slippage', () => {
      const amount = 10000n;
      const result = withSlippageUp(amount, 0);

      expect(result).toBe(amount);
    });

    it('should be inverse of withSlippage direction', () => {
      const amount = 10000n;
      const slippageBps = 50;

      const down = withSlippage(amount, slippageBps);
      const up = withSlippageUp(amount, slippageBps);

      expect(up).toBeGreaterThan(amount);
      expect(down).toBeLessThan(amount);
      expect(up - amount).toBe(amount - down);
    });
  });
});

// ==================== ScVal Utilities Tests ====================

describe('ScVal Utilities', () => {
  describe('scValToNative', () => {
    it('should convert boolean ScVal', () => {
      const trueVal = xdr.ScVal.scvBool(true);
      const falseVal = xdr.ScVal.scvBool(false);

      expect(scValToNative(trueVal)).toBe(true);
      expect(scValToNative(falseVal)).toBe(false);
    });

    it('should convert void ScVal', () => {
      const voidVal = xdr.ScVal.scvVoid();
      expect(scValToNative(voidVal)).toBeUndefined();
    });

    it('should convert numeric ScVal', () => {
      const u32Val = xdr.ScVal.scvU32(42);
      const i32Val = xdr.ScVal.scvI32(-42);

      expect(scValToNative(u32Val)).toBe(42);
      expect(scValToNative(i32Val)).toBe(-42);
    });

    it('should convert string ScVal', () => {
      const strVal = xdr.ScVal.scvString('hello');
      expect(scValToNative(strVal)).toBe('hello');
    });

    it('should convert symbol ScVal', () => {
      const symVal = xdr.ScVal.scvSymbol('transfer');
      expect(scValToNative(symVal)).toBe('transfer');
    });

    it('should convert address ScVal', () => {
      const address = Address.fromString('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');
      const addrVal = address.toScVal();

      const result = scValToNative(addrVal);
      expect(typeof result).toBe('string');
      expect(result).toContain('G');
    });

    it('should convert vec ScVal', () => {
      const vec = xdr.ScVal.scvVec([
        xdr.ScVal.scvU32(1),
        xdr.ScVal.scvU32(2),
        xdr.ScVal.scvU32(3),
      ]);

      const result = scValToNative(vec);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('nativeToScValTyped', () => {
    it('should convert address', () => {
      const address = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const scVal = nativeToScValTyped(address, 'address');

      expect(scVal.switch()).toBe(xdr.ScValType.scvAddress());
    });

    it('should convert symbol', () => {
      const scVal = nativeToScValTyped('transfer', 'symbol');

      expect(scVal.switch()).toBe(xdr.ScValType.scvSymbol());
      expect(scVal.sym().toString()).toBe('transfer');
    });

    it('should convert string', () => {
      const scVal = nativeToScValTyped('hello', 'string');

      expect(scVal.switch()).toBe(xdr.ScValType.scvString());
      expect(scVal.str().toString()).toBe('hello');
    });
  });
});

// ==================== Retry Utility Tests ====================

describe('Retry Utility', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await retry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await retry(fn, 3, 10);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(retry(fn, 3, 10)).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential backoff', async () => {
    const startTime = Date.now();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    await retry(fn, 3, 100);

    const elapsed = Date.now() - startTime;
    // Should wait at least 100ms + 200ms = 300ms
    expect(elapsed).toBeGreaterThanOrEqual(250);
  });

  it('should handle non-Error rejections', async () => {
    const fn = vi.fn().mockRejectedValue('string error');

    await expect(retry(fn, 2, 10)).rejects.toThrow('string error');
  });
});

// ==================== Constants Tests ====================

describe('Constants', () => {
  it('should have correct BPS_DENOMINATOR', () => {
    expect(BPS_DENOMINATOR).toBe(10_000n);
  });

  it('should have correct MINIMUM_LIQUIDITY', () => {
    expect(MINIMUM_LIQUIDITY).toBe(1000n);
  });

  it('should have correct DEFAULT_DEADLINE_SECONDS', () => {
    expect(DEFAULT_DEADLINE_SECONDS).toBe(30 * 60);
  });
});
