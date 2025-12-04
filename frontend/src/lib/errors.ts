/**
 * AstroSwap Error Handling
 * Maps contract error codes and common DeFi errors to user-friendly messages
 */

import type { ToastAction } from '../types';

// Contract error codes from astroswap-shared
export const CONTRACT_ERRORS: Record<number, string> = {
  // General errors (1-99)
  1: 'This contract has already been initialized.',
  2: 'Unauthorized access. You do not have permission to perform this action.',
  8: 'Transaction rejected due to reentrancy protection. Please try again.',

  // Token errors (100-199)
  100: 'Invalid token address provided.',
  101: 'Cannot use the same token for both sides of the swap.',
  102: 'Token not found in the supported list.',

  // Liquidity errors (200-299)
  200: 'Insufficient liquidity in the pool for this trade.',
  201: 'Slippage tolerance exceeded. Try increasing your slippage settings.',
  202: 'The minimum amount requirement was not met.',
  203: 'Deadline has passed. Please try again.',
  204: 'Invalid liquidity amount provided.',
  205: 'Zero liquidity provided.',

  // Pool errors (300-399)
  300: 'This trading pair already exists.',
  301: 'Trading pair not found.',
  302: 'Invalid pool reserves.',

  // Balance errors (400-499)
  400: 'Insufficient balance to complete this transaction.',
  401: 'Transfer failed. Please check your balance and try again.',
  402: 'Allowance too low. Please approve the token first.',

  // System errors (500-599)
  500: 'Invalid argument provided.',
  501: 'Fee amount is too high.',
  502: 'Mathematical overflow occurred.',
  503: 'Invalid amount. Please enter a positive number.',
  504: 'Contract is currently paused. Please try again later.',
  505: 'Invalid pair address.',

  // Astro-Shiba integration (600-699)
  600: 'Token has not graduated from the launchpad yet.',
  601: 'Token has already graduated.',
  602: 'Invalid launchpad contract address.',
};

// Common Stellar/Soroban error patterns
const STELLAR_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /insufficient\s*balance/i,
    message: 'Insufficient balance to complete this transaction.',
  },
  {
    pattern: /transaction\s*failed/i,
    message: 'Transaction failed. Please check your inputs and try again.',
  },
  {
    pattern: /network\s*error/i,
    message: 'Network error. Please check your connection and try again.',
  },
  {
    pattern: /timeout/i,
    message: 'Request timed out. The network may be congested.',
  },
  {
    pattern: /user\s*rejected/i,
    message: 'Transaction was rejected by your wallet.',
  },
  {
    pattern: /simulation\s*failed/i,
    message: 'Transaction simulation failed. The trade may not be possible.',
  },
  {
    pattern: /contract\s*not\s*found/i,
    message: 'Smart contract not found. Please contact support.',
  },
  {
    pattern: /tx_bad_seq/i,
    message: 'Transaction sequence error. Please refresh and try again.',
  },
  {
    pattern: /tx_too_late/i,
    message: 'Transaction deadline has passed. Please try again.',
  },
  {
    pattern: /op_underfunded/i,
    message: 'Insufficient funds to cover transaction fees.',
  },
  {
    pattern: /op_no_trust/i,
    message: 'Trustline not established for this token.',
  },
];

export interface ParsedError {
  code?: number;
  title: string;
  message: string;
  suggestion?: string;
}

/**
 * Parse a contract error code to a user-friendly message
 */
export function parseContractError(errorCode: number): ParsedError {
  const message = CONTRACT_ERRORS[errorCode];

  if (message) {
    return {
      code: errorCode,
      title: getErrorTitle(errorCode),
      message,
      suggestion: getErrorSuggestion(errorCode),
    };
  }

  return {
    code: errorCode,
    title: 'Contract Error',
    message: `An error occurred (code: ${errorCode}). Please try again.`,
    suggestion: 'If the problem persists, please contact support.',
  };
}

/**
 * Parse any error to a user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  // Handle error objects
  if (error instanceof Error) {
    // Check for contract error codes in the message
    const codeMatch = error.message.match(/Error\(Contract,\s*#(\d+)\)/);
    if (codeMatch) {
      return parseContractError(parseInt(codeMatch[1], 10));
    }

    // Check for Stellar error patterns
    for (const { pattern, message } of STELLAR_ERROR_PATTERNS) {
      if (pattern.test(error.message)) {
        return {
          title: 'Transaction Error',
          message,
          suggestion: 'Please try again or adjust your transaction parameters.',
        };
      }
    }

    // Return the original error message if no pattern matches
    return {
      title: 'Error',
      message: error.message || 'An unexpected error occurred.',
      suggestion: 'Please try again. If the problem persists, contact support.',
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    // Check for contract error codes
    const codeMatch = error.match(/Error\(Contract,\s*#(\d+)\)/);
    if (codeMatch) {
      return parseContractError(parseInt(codeMatch[1], 10));
    }

    return {
      title: 'Error',
      message: error,
      suggestion: 'Please try again.',
    };
  }

  // Unknown error type
  return {
    title: 'Unknown Error',
    message: 'An unexpected error occurred. Please try again.',
    suggestion: 'If the problem persists, please contact support.',
  };
}

/**
 * Get an appropriate title based on error code range
 */
function getErrorTitle(code: number): string {
  if (code < 100) return 'System Error';
  if (code < 200) return 'Token Error';
  if (code < 300) return 'Liquidity Error';
  if (code < 400) return 'Pool Error';
  if (code < 500) return 'Balance Error';
  if (code < 600) return 'Transaction Error';
  return 'Integration Error';
}

/**
 * Get a helpful suggestion based on error code
 */
function getErrorSuggestion(code: number): string | undefined {
  switch (code) {
    case 200:
      return 'Try reducing your trade amount or wait for more liquidity.';
    case 201:
      return 'Go to Settings and increase your slippage tolerance.';
    case 203:
      return 'Increase your transaction deadline in Settings.';
    case 400:
      return 'Check your wallet balance and ensure you have enough tokens.';
    case 402:
      return 'Click "Approve" to authorize the contract to use your tokens.';
    case 504:
      return 'The contract is paused for maintenance. Please try again later.';
    default:
      return undefined;
  }
}

/**
 * Format error for display in toast notifications
 * @param error - The error to format
 * @param retryAction - Optional retry function to include as toast action
 */
export function formatErrorForToast(
  error: unknown,
  retryAction?: () => void
): {
  type: 'error' | 'warning';
  title: string;
  description: string;
  action?: ToastAction;
} {
  const parsed = parseError(error);

  // Determine if it's a warning (user action needed) or error
  const isWarning = [201, 203, 400, 402, 504].includes(parsed.code || 0);

  // Errors that are retryable (network issues, timeouts, etc.)
  const isRetryable = isRetryableError(parsed.code, error);

  return {
    type: isWarning ? 'warning' : 'error',
    title: parsed.title,
    description: parsed.suggestion
      ? `${parsed.message} ${parsed.suggestion}`
      : parsed.message,
    action:
      retryAction && isRetryable
        ? { label: 'Try Again', onClick: retryAction }
        : undefined,
  };
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(code: number | undefined, error: unknown): boolean {
  // Network/timeout errors are always retryable
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('tx_bad_seq')
    ) {
      return true;
    }
  }

  // Some contract errors are retryable
  const retryableCodes = [
    8, // Reentrancy - just try again
    203, // Deadline expired - can retry with new deadline
  ];

  return code !== undefined && retryableCodes.includes(code);
}
