/**
 * AstroSwap Error Handling
 * Maps contract error codes and common DeFi errors to user-friendly messages
 * Provides actionable suggestions and retry capabilities
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
  103: 'Token decimals mismatch.',
  104: 'Token transfer not authorized.',

  // Liquidity errors (200-299)
  200: 'Insufficient liquidity in the pool for this trade.',
  201: 'Slippage tolerance exceeded. Try increasing your slippage settings.',
  202: 'The minimum amount requirement was not met.',
  203: 'Deadline has passed. Please try again.',
  204: 'Invalid liquidity amount provided.',
  205: 'Zero liquidity provided.',
  206: 'Liquidity too low. Minimum required is 1000 units.',
  207: 'Price impact too high. Consider splitting your trade.',

  // Pool errors (300-399)
  300: 'This trading pair already exists.',
  301: 'Trading pair not found.',
  302: 'Invalid pool reserves.',
  303: 'Pool is not active.',
  304: 'K invariant violation detected.',

  // Balance errors (400-499)
  400: 'Insufficient balance to complete this transaction.',
  401: 'Transfer failed. Please check your balance and try again.',
  402: 'Allowance too low. Please approve the token first.',
  403: 'Cannot transfer to self.',
  404: 'Burn amount exceeds balance.',

  // System errors (500-599)
  500: 'Invalid argument provided.',
  501: 'Fee amount is too high.',
  502: 'Mathematical overflow occurred.',
  503: 'Invalid amount. Please enter a positive number.',
  504: 'Contract is currently paused. Please try again later.',
  505: 'Invalid pair address.',
  506: 'Operation not supported.',
  507: 'Rate limit exceeded. Please wait and try again.',

  // Astro-Shiba integration (600-699)
  600: 'Token has not graduated from the launchpad yet.',
  601: 'Token has already graduated.',
  602: 'Invalid launchpad contract address.',
  603: 'Graduation requirements not met.',

  // Staking errors (700-799)
  700: 'Staking pool not found.',
  701: 'Insufficient staked balance.',
  702: 'Staking pool has ended.',
  703: 'No rewards to claim.',
  704: 'Unstake amount exceeds staked balance.',

  // Bridge errors (800-899)
  800: 'Bridge is not available for this token.',
  801: 'Bridge transaction failed.',
  802: 'Invalid destination chain.',
  803: 'Bridge limit exceeded.',
};

// Common Stellar/Soroban error patterns with suggestions
interface ErrorPattern {
  pattern: RegExp;
  message: string;
  suggestion?: string;
  isRetryable?: boolean;
  isWarning?: boolean;
}

const STELLAR_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /insufficient\s*balance/i,
    message: 'Insufficient balance to complete this transaction.',
    suggestion: 'Check your wallet balance and ensure you have enough tokens plus fees.',
    isWarning: true,
  },
  {
    pattern: /transaction\s*failed/i,
    message: 'Transaction failed. Please check your inputs and try again.',
    isRetryable: true,
  },
  {
    pattern: /network\s*error|fetch\s*error|failed\s*to\s*fetch/i,
    message: 'Network error. Please check your connection and try again.',
    suggestion: 'Ensure you have a stable internet connection.',
    isRetryable: true,
  },
  {
    pattern: /timeout|ETIMEDOUT/i,
    message: 'Request timed out. The network may be congested.',
    suggestion: 'The Stellar network may be busy. Wait a moment and try again.',
    isRetryable: true,
  },
  {
    pattern: /user\s*rejected|user\s*denied|cancelled|canceled/i,
    message: 'Transaction was cancelled.',
    suggestion: 'You can try again when ready.',
    isWarning: true,
  },
  {
    pattern: /simulation\s*failed/i,
    message: 'Transaction simulation failed. The trade may not be possible.',
    suggestion: 'Check your amounts and try a smaller trade size.',
  },
  {
    pattern: /contract\s*not\s*found/i,
    message: 'Smart contract not found. Please contact support.',
  },
  {
    pattern: /tx_bad_seq/i,
    message: 'Transaction sequence error. Your wallet may be out of sync.',
    suggestion: 'Refresh the page and try again.',
    isRetryable: true,
  },
  {
    pattern: /tx_too_late/i,
    message: 'Transaction deadline has passed. Please try again.',
    isRetryable: true,
  },
  {
    pattern: /op_underfunded/i,
    message: 'Insufficient XLM for transaction fees.',
    suggestion: 'Ensure you have at least 1 XLM for network fees.',
    isWarning: true,
  },
  {
    pattern: /op_no_trust/i,
    message: 'Trustline not established for this token.',
    suggestion: 'You need to add a trustline for this asset first.',
    isWarning: true,
  },
  {
    pattern: /op_low_reserve/i,
    message: 'Account reserve requirement not met.',
    suggestion: 'You need more XLM to maintain your account reserves.',
    isWarning: true,
  },
  {
    pattern: /wallet\s*not\s*connected|not\s*connected/i,
    message: 'Wallet not connected.',
    suggestion: 'Please connect your wallet to continue.',
    isWarning: true,
  },
  {
    pattern: /freighter|albedo|xbull/i,
    message: 'Wallet connection issue.',
    suggestion: 'Make sure your wallet extension is unlocked and try again.',
    isRetryable: true,
  },
  {
    pattern: /budget\s*exceeded/i,
    message: 'Transaction too complex for current network limits.',
    suggestion: 'Try a simpler operation or contact support.',
  },
  {
    pattern: /expired|ledger\s*sequence/i,
    message: 'Transaction expired before confirmation.',
    suggestion: 'Network was slow. Please try again.',
    isRetryable: true,
  },
];

export interface ParsedError {
  code?: number;
  title: string;
  message: string;
  suggestion?: string;
  isRetryable?: boolean;
  isWarning?: boolean;
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
      isRetryable: isCodeRetryable(errorCode),
      isWarning: isCodeWarning(errorCode),
    };
  }

  return {
    code: errorCode,
    title: 'Contract Error',
    message: `An error occurred (code: ${errorCode}). Please try again.`,
    suggestion: 'If the problem persists, please contact support.',
    isRetryable: true, // Unknown errors are often transient
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

    // Also check for numeric error codes like "error: 400"
    const numericMatch = error.message.match(/error[:\s]+(\d+)/i);
    if (numericMatch) {
      const code = parseInt(numericMatch[1], 10);
      if (CONTRACT_ERRORS[code]) {
        return parseContractError(code);
      }
    }

    // Check for Stellar error patterns
    for (const errorPattern of STELLAR_ERROR_PATTERNS) {
      if (errorPattern.pattern.test(error.message)) {
        return {
          title: errorPattern.isWarning ? 'Warning' : 'Transaction Error',
          message: errorPattern.message,
          suggestion: errorPattern.suggestion || 'Please try again or adjust your transaction parameters.',
          isRetryable: errorPattern.isRetryable,
          isWarning: errorPattern.isWarning,
        };
      }
    }

    // Return the original error message if no pattern matches
    return {
      title: 'Error',
      message: sanitizeErrorMessage(error.message) || 'An unexpected error occurred.',
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

    // Check for Stellar patterns in string errors
    for (const errorPattern of STELLAR_ERROR_PATTERNS) {
      if (errorPattern.pattern.test(error)) {
        return {
          title: errorPattern.isWarning ? 'Warning' : 'Transaction Error',
          message: errorPattern.message,
          suggestion: errorPattern.suggestion,
          isRetryable: errorPattern.isRetryable,
          isWarning: errorPattern.isWarning,
        };
      }
    }

    return {
      title: 'Error',
      message: sanitizeErrorMessage(error),
      suggestion: 'Please try again.',
    };
  }

  // Handle objects with message property
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return parseError((error as { message: unknown }).message);
  }

  // Unknown error type
  return {
    title: 'Unknown Error',
    message: 'An unexpected error occurred. Please try again.',
    suggestion: 'If the problem persists, please contact support.',
  };
}

/**
 * Sanitize error messages to remove technical details
 */
function sanitizeErrorMessage(message: string): string {
  if (!message) return 'An error occurred.';

  // Remove technical prefixes
  let sanitized = message
    .replace(/^Error:\s*/i, '')
    .replace(/^HostError:\s*/i, '')
    .replace(/^ContractError:\s*/i, '')
    .replace(/^AssertionError:\s*/i, '');

  // Truncate very long messages
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200) + '...';
  }

  // Capitalize first letter
  sanitized = sanitized.charAt(0).toUpperCase() + sanitized.slice(1);

  return sanitized;
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
  const suggestions: Record<number, string> = {
    // General
    8: 'Wait a moment and try again.',

    // Token
    102: 'Use a supported token from the list.',

    // Liquidity
    200: 'Try reducing your trade amount or wait for more liquidity.',
    201: 'Go to Settings and increase your slippage tolerance.',
    203: 'Increase your transaction deadline in Settings.',
    206: 'Add at least 1000 units of each token.',
    207: 'Split your trade into smaller amounts.',

    // Pool
    301: 'This trading pair does not exist yet. You can create it by adding liquidity.',

    // Balance
    400: 'Check your wallet balance and ensure you have enough tokens plus gas fees.',
    401: 'Ensure you have enough XLM for network fees.',
    402: 'Click "Approve" to authorize the contract to use your tokens.',

    // System
    504: 'The contract is paused for maintenance. Please try again later.',
    507: 'Wait a few seconds and try again.',

    // Staking
    701: 'You cannot unstake more than you have staked.',
    702: 'This staking pool has ended. Claim any remaining rewards.',
    703: 'Stake tokens first to earn rewards.',

    // Bridge
    800: 'This token is not available for bridging.',
    803: 'Try a smaller amount within the bridge limits.',
  };

  return suggestions[code];
}

/**
 * Check if error is retryable based on code
 */
function isCodeRetryable(code: number): boolean {
  const retryableCodes = [
    8,   // Reentrancy - just try again
    203, // Deadline expired - can retry with new deadline
    507, // Rate limit - wait and retry
  ];
  return retryableCodes.includes(code);
}

/**
 * Check if error is a warning (user action needed)
 */
function isCodeWarning(code: number): boolean {
  const warningCodes = [
    201, // Slippage - user can fix
    203, // Deadline - user can fix
    400, // Balance - user can fix
    402, // Allowance - user can fix
    504, // Paused - wait
    701, // Unstake amount - user can fix
    703, // No rewards - info
  ];
  return warningCodes.includes(code);
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
  duration?: number;
} {
  const parsed = parseError(error);

  // Use the warning flag from parsed error, fallback to checking code
  const isWarning = parsed.isWarning || isCodeWarning(parsed.code || 0);

  // Use the retryable flag from parsed error
  const isRetryable = parsed.isRetryable || isRetryableFromError(error);

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
    // Warnings auto-dismiss faster, errors stay longer
    duration: isWarning ? 5000 : 8000,
  };
}

/**
 * Determine if an error is retryable based on error content
 */
function isRetryableFromError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('tx_bad_seq') ||
      msg.includes('fetch') ||
      msg.includes('expired')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Create a simple error toast for common scenarios
 */
export function createErrorToast(
  title: string,
  description: string,
  retryAction?: () => void
): {
  type: 'error';
  title: string;
  description: string;
  action?: ToastAction;
} {
  return {
    type: 'error',
    title,
    description,
    action: retryAction ? { label: 'Try Again', onClick: retryAction } : undefined,
  };
}

/**
 * Create a warning toast for user-fixable issues
 */
export function createWarningToast(
  title: string,
  description: string,
  actionLabel?: string,
  action?: () => void
): {
  type: 'warning';
  title: string;
  description: string;
  action?: ToastAction;
} {
  return {
    type: 'warning',
    title,
    description,
    action: action && actionLabel ? { label: actionLabel, onClick: action } : undefined,
  };
}
