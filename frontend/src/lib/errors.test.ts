import { describe, it, expect, vi } from 'vitest';
import {
  parseError,
  parseContractError,
  formatErrorForToast,
  createErrorToast,
  createWarningToast,
  CONTRACT_ERRORS,
} from './errors';

describe('errors', () => {
  describe('parseContractError', () => {
    it('parses known error codes', () => {
      const result = parseContractError(200);
      expect(result.code).toBe(200);
      expect(result.title).toBe('Liquidity Error');
      expect(result.message).toContain('Insufficient liquidity');
      expect(result.suggestion).toBeDefined();
    });

    it('handles unknown error codes', () => {
      const result = parseContractError(9999);
      expect(result.code).toBe(9999);
      expect(result.title).toBe('Contract Error');
      expect(result.message).toContain('9999');
    });

    it('marks retryable errors correctly', () => {
      const reentrancyError = parseContractError(8);
      expect(reentrancyError.isRetryable).toBe(true);

      const deadlineError = parseContractError(203);
      expect(deadlineError.isRetryable).toBe(true);

      const balanceError = parseContractError(400);
      expect(balanceError.isRetryable).toBeFalsy();
    });

    it('marks warning errors correctly', () => {
      const slippageError = parseContractError(201);
      expect(slippageError.isWarning).toBe(true);

      const balanceError = parseContractError(400);
      expect(balanceError.isWarning).toBe(true);

      const liquidityError = parseContractError(200);
      expect(liquidityError.isWarning).toBeFalsy();
    });
  });

  describe('parseError', () => {
    it('parses Error objects with contract codes', () => {
      const error = new Error('Transaction failed: Error(Contract, #200)');
      const result = parseError(error);
      expect(result.code).toBe(200);
      expect(result.message).toContain('liquidity');
    });

    it('parses Error objects with numeric codes', () => {
      const error = new Error('error: 400 - insufficient balance');
      const result = parseError(error);
      expect(result.code).toBe(400);
    });

    it('matches Stellar error patterns', () => {
      const timeoutError = new Error('Request timeout after 30s');
      const result = parseError(timeoutError);
      expect(result.message).toContain('timed out');
      expect(result.isRetryable).toBe(true);
    });

    it('handles user rejection', () => {
      const error = new Error('User rejected the transaction');
      const result = parseError(error);
      expect(result.message).toContain('cancelled');
      expect(result.isWarning).toBe(true);
    });

    it('handles network errors', () => {
      const error = new Error('Network error: failed to fetch');
      const result = parseError(error);
      expect(result.message).toContain('Network error');
      expect(result.isRetryable).toBe(true);
    });

    it('handles string errors', () => {
      const result = parseError('Something went wrong');
      expect(result.title).toBe('Error');
      expect(result.message).toBe('Something went wrong');
    });

    it('handles string errors with patterns', () => {
      const result = parseError('user cancelled the request');
      expect(result.message).toContain('cancelled');
    });

    it('handles objects with message property', () => {
      const error = { message: 'Error(Contract, #400)' };
      const result = parseError(error);
      expect(result.code).toBe(400);
    });

    it('handles unknown error types', () => {
      const result = parseError(null);
      expect(result.title).toBe('Unknown Error');
    });

    it('sanitizes long error messages', () => {
      const longMessage = 'x'.repeat(300);
      const error = new Error(longMessage);
      const result = parseError(error);
      expect(result.message.length).toBeLessThan(210);
      expect(result.message).toContain('...');
    });
  });

  describe('formatErrorForToast', () => {
    it('formats contract errors correctly', () => {
      const error = new Error('Error(Contract, #200)');
      const result = formatErrorForToast(error);
      expect(result.type).toBe('error');
      expect(result.title).toBe('Liquidity Error');
      expect(result.description).toContain('liquidity');
    });

    it('sets warning type for user-fixable errors', () => {
      const error = new Error('Error(Contract, #400)');
      const result = formatErrorForToast(error);
      expect(result.type).toBe('warning');
    });

    it('includes retry action for retryable errors', () => {
      const error = new Error('timeout');
      const retryFn = vi.fn();
      const result = formatErrorForToast(error, retryFn);

      expect(result.action).toBeDefined();
      expect(result.action?.label).toBe('Try Again');
      result.action?.onClick();
      expect(retryFn).toHaveBeenCalled();
    });

    it('does not include retry action for non-retryable errors', () => {
      const error = new Error('Error(Contract, #300)'); // Pair exists - not retryable
      const retryFn = vi.fn();
      const result = formatErrorForToast(error, retryFn);
      expect(result.action).toBeUndefined();
    });

    it('sets appropriate duration', () => {
      const warningError = new Error('Error(Contract, #400)');
      const warningResult = formatErrorForToast(warningError);
      expect(warningResult.duration).toBe(5000);

      const fatalError = new Error('Error(Contract, #200)');
      const fatalResult = formatErrorForToast(fatalError);
      expect(fatalResult.duration).toBe(8000);
    });
  });

  describe('createErrorToast', () => {
    it('creates a simple error toast', () => {
      const result = createErrorToast('Test Error', 'Test description');
      expect(result.type).toBe('error');
      expect(result.title).toBe('Test Error');
      expect(result.description).toBe('Test description');
    });

    it('includes retry action when provided', () => {
      const retryFn = vi.fn();
      const result = createErrorToast('Test', 'Desc', retryFn);
      expect(result.action).toBeDefined();
      result.action?.onClick();
      expect(retryFn).toHaveBeenCalled();
    });
  });

  describe('createWarningToast', () => {
    it('creates a warning toast', () => {
      const result = createWarningToast('Test Warning', 'Test description');
      expect(result.type).toBe('warning');
      expect(result.title).toBe('Test Warning');
    });

    it('includes custom action when provided', () => {
      const actionFn = vi.fn();
      const result = createWarningToast('Test', 'Desc', 'Fix It', actionFn);
      expect(result.action?.label).toBe('Fix It');
      result.action?.onClick();
      expect(actionFn).toHaveBeenCalled();
    });
  });

  describe('CONTRACT_ERRORS', () => {
    it('has error messages for all documented codes', () => {
      // Verify key error codes exist
      expect(CONTRACT_ERRORS[200]).toBeDefined();
      expect(CONTRACT_ERRORS[400]).toBeDefined();
      expect(CONTRACT_ERRORS[504]).toBeDefined();
    });

    it('error messages are user-friendly', () => {
      // Should not contain technical jargon
      Object.values(CONTRACT_ERRORS).forEach(message => {
        expect(message).not.toMatch(/^\s*$/); // Not empty
        expect(message.length).toBeGreaterThan(10); // Meaningful length
        expect(message[0]).toMatch(/[A-Z]/); // Starts with capital
      });
    });
  });
});
