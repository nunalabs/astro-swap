import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatNumber,
  formatTokenAmount,
  formatCurrency,
  formatPercent,
  shortenAddress,
  calculatePriceImpact,
  calculateMinimumReceived,
  isValidAddress,
  isValidContractId,
  formatTimeAgo,
  parseTokenAmount,
  safeDivide,
  calculateAPR,
  getChangeColor,
  truncate,
  debounce,
} from './utils';

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('handles undefined values', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });
  });

  describe('formatNumber', () => {
    it('formats basic numbers', () => {
      expect(formatNumber(1234.56, 2)).toBe('1,234.56');
    });

    it('handles string input', () => {
      expect(formatNumber('1234.5678', 2)).toBe('1,234.57');
    });

    it('returns 0 for NaN', () => {
      expect(formatNumber(NaN)).toBe('0');
    });

    it('formats compact notation', () => {
      expect(formatNumber(1234567, 2, true)).toBe('1.23M');
      expect(formatNumber(1234567890, 2, true)).toBe('1.23B');
      expect(formatNumber(12345, 2, true)).toBe('12.35K');
    });
  });

  describe('formatTokenAmount', () => {
    it('formats token amounts with decimals', () => {
      // 1000 tokens with 7 decimals = 10000000000
      expect(formatTokenAmount('10000000000', 7, 4)).toBe('1,000.0000');
    });

    it('handles very small amounts', () => {
      expect(formatTokenAmount('1', 7, 4)).toBe('<0.0001');
    });

    it('returns 0 for NaN', () => {
      expect(formatTokenAmount('invalid')).toBe('0');
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('handles string input', () => {
      expect(formatCurrency('99.99')).toBe('$99.99');
    });

    it('returns $0.00 for NaN', () => {
      expect(formatCurrency('invalid')).toBe('$0.00');
    });
  });

  describe('formatPercent', () => {
    it('formats positive percentages with + sign', () => {
      expect(formatPercent(5.25)).toBe('+5.25%');
    });

    it('formats negative percentages', () => {
      expect(formatPercent(-3.5)).toBe('-3.50%');
    });

    it('handles zero', () => {
      expect(formatPercent(0)).toBe('+0.00%');
    });
  });

  describe('shortenAddress', () => {
    it('shortens long addresses', () => {
      const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP123456';
      expect(shortenAddress(address)).toBe('GABCDE...3456');
    });

    it('handles custom char length', () => {
      const address = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP123456';
      expect(shortenAddress(address, 6)).toBe('GABCDEFG...123456');
    });

    it('returns empty string for empty input', () => {
      expect(shortenAddress('')).toBe('');
    });
  });

  describe('calculatePriceImpact', () => {
    it('calculates price impact correctly', () => {
      // Small trade should have small price impact
      const impact = calculatePriceImpact('1000000', '1000000', '1000');
      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThan(1);
    });

    it('returns 0 for zero inputs', () => {
      expect(calculatePriceImpact('0', '1000', '100')).toBe(0);
      expect(calculatePriceImpact('1000', '0', '100')).toBe(0);
      expect(calculatePriceImpact('1000', '1000', '0')).toBe(0);
    });

    it('larger trades have higher impact', () => {
      const smallImpact = calculatePriceImpact('1000000', '1000000', '1000');
      const largeImpact = calculatePriceImpact('1000000', '1000000', '100000');
      expect(largeImpact).toBeGreaterThan(smallImpact);
    });
  });

  describe('calculateMinimumReceived', () => {
    it('calculates minimum received with slippage', () => {
      // 100 tokens with 1% slippage = 99 minimum
      expect(calculateMinimumReceived('100', 1)).toBe('99');
    });

    it('handles 0.5% slippage', () => {
      const result = parseFloat(calculateMinimumReceived('100', 0.5));
      expect(result).toBeCloseTo(99.5);
    });

    it('returns 0 for invalid input', () => {
      expect(calculateMinimumReceived('invalid', 1)).toBe('0');
    });
  });

  describe('isValidAddress', () => {
    it('validates correct Stellar addresses', () => {
      // G + 55 alphanumeric characters = 56 total
      const validAddress = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP1234567';
      expect(validAddress.length).toBe(56);
      expect(isValidAddress(validAddress)).toBe(true);
    });

    it('rejects invalid addresses', () => {
      expect(isValidAddress('')).toBe(false);
      expect(isValidAddress('abc')).toBe(false);
      expect(isValidAddress('CABCDEFG')).toBe(false); // Wrong prefix
      expect(isValidAddress('GAB')).toBe(false); // Too short
    });
  });

  describe('isValidContractId', () => {
    it('validates correct contract IDs', () => {
      // C + 55 alphanumeric characters = 56 total
      const validContract = 'CABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOP1234567';
      expect(validContract.length).toBe(56);
      expect(isValidContractId(validContract)).toBe(true);
    });

    it('rejects invalid contract IDs', () => {
      expect(isValidContractId('')).toBe(false);
      expect(isValidContractId('GABCDEF')).toBe(false); // Wrong prefix
      expect(isValidContractId('CAB')).toBe(false); // Too short
    });
  });

  describe('formatTimeAgo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('formats seconds ago', () => {
      const timestamp = Date.now() - 30000; // 30 seconds ago
      expect(formatTimeAgo(timestamp)).toBe('30s ago');
    });

    it('formats minutes ago', () => {
      const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      expect(formatTimeAgo(timestamp)).toBe('5m ago');
    });

    it('formats hours ago', () => {
      const timestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      expect(formatTimeAgo(timestamp)).toBe('2h ago');
    });

    it('formats days ago', () => {
      const timestamp = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3 days ago
      expect(formatTimeAgo(timestamp)).toBe('3d ago');
    });
  });

  describe('parseTokenAmount', () => {
    it('parses token amounts to raw units', () => {
      // 1.5 tokens with 7 decimals = 15000000
      expect(parseTokenAmount('1.5', 7)).toBe('15000000');
    });

    it('returns 0 for invalid input', () => {
      expect(parseTokenAmount('invalid', 7)).toBe('0');
    });

    it('floors the result', () => {
      // Ensures we don't get fractional raw units
      expect(parseTokenAmount('1.23456789', 7)).toBe('12345678');
    });
  });

  describe('safeDivide', () => {
    it('divides normally when denominator is not 0', () => {
      expect(safeDivide(10, 2)).toBe(5);
    });

    it('returns 0 when denominator is 0', () => {
      expect(safeDivide(10, 0)).toBe(0);
    });
  });

  describe('calculateAPR', () => {
    it('calculates APR correctly', () => {
      // 1 reward per second, 1000 total staked, $1 prices
      const apr = calculateAPR('1', '1000', 1, 1);
      // 1 * 86400 * 365 / 1000 * 100 = 3153600%
      expect(apr).toBeCloseTo(3153600);
    });

    it('returns 0 when total staked is 0', () => {
      expect(calculateAPR('1', '0', 1, 1)).toBe(0);
    });
  });

  describe('getChangeColor', () => {
    it('returns green for positive change', () => {
      expect(getChangeColor(5)).toBe('text-green');
    });

    it('returns red for negative change', () => {
      expect(getChangeColor(-5)).toBe('text-red-500');
    });

    it('returns neutral for zero', () => {
      expect(getChangeColor(0)).toBe('text-neutral-400');
    });
  });

  describe('truncate', () => {
    it('truncates long text', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
    });

    it('returns original if shorter than max', () => {
      expect(truncate('Hi', 5)).toBe('Hi');
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces function calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
