import { describe, it, expect } from 'vitest';
import {
  applySlippage,
  calculateSlippageAmount,
} from '../utils';

describe('utils', () => {
  describe('applySlippage', () => {
    it('should apply 0.5% slippage correctly', () => {
      const result = applySlippage('1000000000', 0.5);
      expect(result).toBe('995000000');
    });

    it('should apply 1.0% slippage correctly', () => {
      const result = applySlippage('1000000000', 1.0);
      expect(result).toBe('990000000');
    });

    it('should apply 5% slippage correctly', () => {
      const result = applySlippage('1000000000', 5);
      expect(result).toBe('950000000');
    });

    it('should handle 0% slippage', () => {
      const result = applySlippage('1000000000', 0);
      expect(result).toBe('1000000000');
    });

    it('should handle small amounts', () => {
      const result = applySlippage('1000', 0.5);
      expect(result).toBe('995');
    });

    it('should handle very large amounts', () => {
      const amount = '999999999999999999';
      const result = applySlippage(amount, 1.0);
      // 1% slippage: amount * 0.99
      expect(result).toBe('989999999999999999');
    });

    it('should return "0" for invalid amount (error path)', () => {
      const result = applySlippage('invalid', 0.5);
      expect(result).toBe('0');
    });

    it('should return "0" for empty string (error path)', () => {
      const result = applySlippage('', 0.5);
      expect(result).toBe('0');
    });

    it('should return "0" for non-numeric string (error path)', () => {
      const result = applySlippage('abc123', 1.0);
      expect(result).toBe('0');
    });

    it('should handle decimal input by catching error', () => {
      // BigInt doesn't accept decimals, should trigger catch block
      const result = applySlippage('1000.5', 0.5);
      expect(result).toBe('0');
    });

    it('should handle negative amounts (calculates negative result)', () => {
      const result = applySlippage('-1000000', 0.5);
      // BigInt handles negative numbers: -1000000 * 0.995 = -995000
      expect(result).toBe('-995000');
    });
  });

  describe('calculateSlippageAmount', () => {
    it('should calculate slippage amount for 0.5%', () => {
      // 1000000000 - 995000000 = 5000000
      const result = calculateSlippageAmount('1000000000', 0.5);
      expect(result).toBe('5000000');
    });

    it('should calculate slippage amount for 1.0%', () => {
      // 1000000000 - 990000000 = 10000000
      const result = calculateSlippageAmount('1000000000', 1.0);
      expect(result).toBe('10000000');
    });

    it('should calculate slippage amount for 5%', () => {
      // 1000000000 - 950000000 = 50000000
      const result = calculateSlippageAmount('1000000000', 5);
      expect(result).toBe('50000000');
    });

    it('should return "0" for 0% slippage', () => {
      const result = calculateSlippageAmount('1000000000', 0);
      expect(result).toBe('0');
    });

    it('should handle small amounts', () => {
      // 1000 - 995 = 5
      const result = calculateSlippageAmount('1000', 0.5);
      expect(result).toBe('5');
    });

    it('should handle very large amounts', () => {
      const amount = '999999999999999999';
      // 1% slippage: 999999999999999999 - 989999999999999999 = 10000000000000000
      const result = calculateSlippageAmount(amount, 1.0);
      expect(result).toBe('10000000000000000');
    });

    it('should return "0" for invalid amount (error path)', () => {
      const result = calculateSlippageAmount('invalid', 0.5);
      expect(result).toBe('0');
    });

    it('should return "0" for empty string (error path)', () => {
      const result = calculateSlippageAmount('', 0.5);
      expect(result).toBe('0');
    });

    it('should return "0" for non-numeric string (error path)', () => {
      const result = calculateSlippageAmount('xyz', 1.0);
      expect(result).toBe('0');
    });

    it('should handle decimal input by catching error', () => {
      const result = calculateSlippageAmount('1000.5', 0.5);
      expect(result).toBe('0');
    });

    it('should handle negative amounts (calculates negative difference)', () => {
      const result = calculateSlippageAmount('-1000000', 0.5);
      // -1000000 - (-995000) = -5000
      expect(result).toBe('-5000');
    });
  });
});
