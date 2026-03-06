import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  ISupportedWallet,
  FREIGHTER_ID,
  XBULL_ID,
  LOBSTR_ID,
  ALBEDO_ID,
} from '@creit.tech/stellar-wallets-kit';

// Network configuration
const NETWORK = import.meta.env.VITE_STELLAR_NETWORK || 'testnet';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet'
  ? 'Public Global Stellar Network ; September 2015'
  : 'Test SDF Network ; September 2015';

// Timing configuration (inspired by Albedo patterns)
const SIGNING_TIMEOUT_MS = 30_000; // 30 seconds for user to sign
const TRANSACTION_TIME_BOUNDS_SECONDS = 300; // 5 minutes validity

// Error types for better UX
export type WalletErrorType = 'cancelled' | 'timeout' | 'network' | 'validation' | 'unknown';

export class WalletError extends Error {
  type: WalletErrorType;
  recoverable: boolean;
  userMessage: string;

  constructor(type: WalletErrorType, message: string, userMessage: string, recoverable = true) {
    super(message);
    this.type = type;
    this.recoverable = recoverable;
    this.userMessage = userMessage;
    this.name = 'WalletError';
  }
}

// Initialize the wallet kit with all supported modules
export const walletKit = new StellarWalletsKit({
  network: NETWORK === 'mainnet' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

// Wallet IDs for reference
export const WALLET_IDS = {
  FREIGHTER: FREIGHTER_ID,
  XBULL: XBULL_ID,
  LOBSTR: LOBSTR_ID,
  ALBEDO: ALBEDO_ID,
} as const;

// Wallet metadata for UI
export const WALLET_METADATA: Record<string, { name: string; icon: string; mobile: boolean }> = {
  [FREIGHTER_ID]: {
    name: 'Freighter',
    icon: '/wallets/freighter.svg',
    mobile: false,
  },
  [XBULL_ID]: {
    name: 'xBull',
    icon: '/wallets/xbull.svg',
    mobile: true,
  },
  [LOBSTR_ID]: {
    name: 'LOBSTR',
    icon: '/wallets/lobstr.svg',
    mobile: true,
  },
  [ALBEDO_ID]: {
    name: 'Albedo',
    icon: '/wallets/albedo.svg',
    mobile: true,
  },
};

export type WalletId = keyof typeof WALLET_IDS;

export interface WalletConnection {
  address: string;
  walletId: string;
  walletName: string;
}

/**
 * Open wallet selection modal
 */
export async function openWalletModal(): Promise<WalletConnection> {
  return new Promise((resolve, reject) => {
    walletKit.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          walletKit.setWallet(option.id);
          const { address } = await walletKit.getAddress();

          resolve({
            address,
            walletId: option.id,
            walletName: option.name,
          });
        } catch (error) {
          reject(error);
        }
      },
      onClosed: (reason: unknown) => {
        if (reason === 'user' || reason === undefined) {
          reject(new Error('User closed wallet modal'));
        }
      },
      modalTitle: 'Connect Wallet',
      notAvailableText: 'Not installed',
    });
  });
}

/**
 * Get current wallet address
 */
export async function getWalletAddress(): Promise<string> {
  const { address } = await walletKit.getAddress();
  return address;
}

/**
 * Helper: Create timeout promise
 */
function timeoutPromise<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new WalletError(
        'timeout',
        message,
        'Signature request timed out. Please try again.',
        true
      ));
    }, ms);
  });
}

/**
 * Sign a transaction with the connected wallet
 * Features:
 * - Timeout protection (30s default)
 * - User-friendly error messages
 * - Cancellation detection
 */
export async function signTransaction(
  xdr: string,
  options?: {
    description?: string;
    timeout?: number;
  }
): Promise<string> {
  const timeout = options?.timeout ?? SIGNING_TIMEOUT_MS;
  const address = await getWalletAddress();

  try {
    // Race between signing and timeout
    const { signedTxXdr } = await Promise.race([
      walletKit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      }),
      timeoutPromise<{ signedTxXdr: string }>(timeout, 'Transaction signing timed out'),
    ]);

    return signedTxXdr;
  } catch (error) {
    // Handle specific error types
    if (error instanceof WalletError) {
      throw error;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : '';

    // User cancelled
    if (message.includes('cancel') || message.includes('rejected') || message.includes('denied')) {
      throw new WalletError(
        'cancelled',
        'User cancelled the transaction',
        'Transaction cancelled.',
        false
      );
    }

    // Network errors
    if (message.includes('network') || message.includes('connection')) {
      throw new WalletError(
        'network',
        `Network error: ${message}`,
        'Network error. Please check your connection and try again.',
        true
      );
    }

    // Unknown errors
    throw new WalletError(
      'unknown',
      error instanceof Error ? error.message : 'Unknown error',
      'An unexpected error occurred. Please try again.',
      true
    );
  }
}

/**
 * Sign an authorization entry
 */
export async function signAuthEntry(
  authEntry: string,
  address: string
): Promise<string> {
  const { signedAuthEntry } = await walletKit.signAuthEntry(authEntry, {
    networkPassphrase: NETWORK === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015',
    address,
  });
  return signedAuthEntry;
}

/**
 * Check if running on mobile device
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get mobile-compatible wallets
 */
export function getMobileWallets(): string[] {
  return Object.entries(WALLET_METADATA)
    .filter(([_, meta]) => meta.mobile)
    .map(([id]) => id);
}

/**
 * Disconnect current wallet
 */
export function disconnectWallet(): void {
  // The kit doesn't have a built-in disconnect, we just clear state
  // The wallet store will handle clearing local state
}

/**
 * Submit a signed transaction with retry logic
 * Implements exponential backoff with jitter (Albedo pattern)
 */
export async function submitWithRetry(
  submitFn: () => Promise<unknown>,
  maxRetries = 3
): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await submitFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on user errors or validation errors
      const message = lastError.message.toLowerCase();
      if (message.includes('invalid') || message.includes('malformed')) {
        throw new WalletError(
          'validation',
          lastError.message,
          'Transaction validation failed. Please check your inputs.',
          false
        );
      }

      // Last attempt - throw the error
      if (attempt === maxRetries) {
        throw new WalletError(
          'network',
          lastError.message,
          'Transaction submission failed after multiple attempts. Please try again later.',
          true
        );
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        1000 * Math.pow(2, attempt - 1) + Math.random() * 1000,
        10_000
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Get recommended transaction time bounds
 * Based on Albedo's pattern for network resilience
 */
export function getTransactionTimeBounds(): { minTime: number; maxTime: number } {
  const now = Math.floor(Date.now() / 1000);
  return {
    minTime: now,
    maxTime: now + TRANSACTION_TIME_BOUNDS_SECONDS,
  };
}

// Export network configuration for use elsewhere
export { NETWORK, NETWORK_PASSPHRASE };

export type { ISupportedWallet };
