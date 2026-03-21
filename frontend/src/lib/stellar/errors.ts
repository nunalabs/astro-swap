/**
 * Stellar Error Handling
 *
 * Centralized error parsing and handling for Stellar SDK operations.
 */

import * as StellarSdk from '@stellar/stellar-sdk';

export class StellarTransactionError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'StellarTransactionError';
  }
}

/**
 * Type for HTTP errors from Stellar SDK/Horizon
 */
export interface HttpError extends Error {
  response?: {
    status: number;
    data?: {
      message?: string;
    };
  };
}

/**
 * Type guard to check if error is an HTTP error
 */
export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    typeof (error as HttpError).response === 'object'
  );
}

/**
 * Parse Stellar SDK errors into user-friendly messages
 */
export function parseError(error: unknown): { message: string; code?: string } {
  if (typeof error === 'string') {
    return { message: error };
  }

  if (error instanceof Error) {
    // Check for specific Stellar error patterns
    const message = error.message.toLowerCase();

    if (message.includes('insufficient balance')) {
      return {
        message: 'Insufficient balance to complete transaction',
        code: 'INSUFFICIENT_BALANCE',
      };
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        message: 'Transaction timed out. It may still succeed - check your wallet.',
        code: 'TIMEOUT',
      };
    }

    if (message.includes('not found')) {
      return {
        message: 'Resource not found on network',
        code: 'NOT_FOUND',
      };
    }

    if (message.includes('union switch') || message.includes('xdr')) {
      return {
        message: 'Error parsing blockchain data. Please try again.',
        code: 'XDR_PARSE_ERROR',
      };
    }

    if (message.includes('user') && (message.includes('rejected') || message.includes('denied'))) {
      return {
        message: 'Transaction rejected by user',
        code: 'USER_REJECTED',
      };
    }

    return { message: error.message };
  }

  // Check if it's an HTTP error from Stellar SDK
  if (isHttpError(error)) {
    if (error.response?.data?.message) {
      return { message: error.response.data.message };
    }
  }

  // Handle object-like errors with message property
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;

    if (typeof err.message === 'string') {
      return {
        message: err.message,
        code: typeof err.code === 'string' ? err.code : undefined
      };
    }
  }

  return { message: 'An unknown error occurred', code: 'UNKNOWN' };
}

/**
 * Extract error from simulation result
 */
export function extractSimulationError(
  result: StellarSdk.rpc.Api.SimulateTransactionResponse
): string {
  if (StellarSdk.rpc.Api.isSimulationError(result)) {
    return result.error || 'Simulation failed';
  }

  if (StellarSdk.rpc.Api.isSimulationRestore(result)) {
    return 'Contract data needs restoration. Please restore and try again.';
  }

  return 'Transaction simulation failed';
}
