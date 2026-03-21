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
// Note: Some wallets like Albedo may show loading states after signing
// but they should return the signed XDR quickly once user confirms
const SIGNING_TIMEOUT_MS = 120_000; // 2 minutes for signing (generous for all wallets)
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

/**
 * Get the callback URL for web-based wallets
 *
 * IMPORTANT: Only Albedo requires this callback URL
 * - Albedo is a web-based wallet that uses popup + redirect flow
 * - After signing, Albedo redirects to this callback page
 * - The callback page posts the signed transaction back to the opener window
 * - Without this, Albedo will hang after the user signs
 *
 * Other wallets (Freighter, xBull, LOBSTR, Rabet) are extensions or mobile
 * and communicate directly without needing callbacks
 */
const getCallbackUrl = (): string => {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/albedo-callback.html`;
  }
  return '/albedo-callback.html';
};

// Initialize the wallet kit with all supported modules
export const walletKit = new StellarWalletsKit({
  network: NETWORK === 'mainnet' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
  // Required for web-based wallets like Albedo
  horizonUrl: NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org',
  // Albedo callback URL - critical for Albedo to work
  defaultNetwork: NETWORK === 'mainnet' ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
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
 * Open wallet selection modal with automatic reconnection on window focus
 */
export async function openWalletModal(): Promise<WalletConnection> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    let selectedWallet: ISupportedWallet | null = null;

    // Cleanup function to remove event listener
    const cleanup = () => {
      window.removeEventListener('focus', handleWindowFocus);
    };

    // Handle window regaining focus (user returning from wallet popup)
    const handleWindowFocus = async () => {
      // Only try if we have a selected wallet and haven't resolved yet
      if (!selectedWallet || resolved) return;

      try {
        console.log('🔄 Window focused - attempting to get wallet address...');
        const { address } = await walletKit.getAddress();

        if (address && !resolved) {
          resolved = true;
          cleanup();
          console.log('✅ Wallet connected on focus:', address);
          resolve({
            address,
            walletId: selectedWallet.id,
            walletName: selectedWallet.name,
          });
        }
      } catch (error) {
        console.log('⏳ Wallet not ready yet, waiting for approval...');
        // Silently continue - user may still be approving
      }
    };

    // Add focus listener for automatic reconnection
    window.addEventListener('focus', handleWindowFocus);

    walletKit.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        selectedWallet = option;

        try {
          walletKit.setWallet(option.id);
          const { address } = await walletKit.getAddress();

          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({
              address,
              walletId: option.id,
              walletName: option.name,
            });
          }
        } catch (error) {
          console.log('⏳ Wallet selected, waiting for user approval in extension...');
          // Don't reject here - the focus handler will retry when user comes back
          // Only reject if user explicitly closes the wallet approval
          if (error instanceof Error &&
              (error.message.includes('User rejected') ||
               error.message.includes('User cancelled') ||
               error.message.includes('denied'))) {
            cleanup();
            reject(error);
          }
        }
      },
      onClosed: (reason: unknown) => {
        cleanup();
        if ((reason === 'user' || reason === undefined) && !resolved) {
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

  // CRITICAL FIX: Get wallet ID from store (don't rely on walletKit.selectedWalletId)
  // The walletKit loses state after page reload, but our store persists it correctly
  let walletIdToUse: string | null = null;

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('astroswap-wallet');
      if (stored) {
        const walletState = JSON.parse(stored);
        if (walletState.state?.walletId && walletState.state?.isConnected) {
          walletIdToUse = walletState.state.walletId;
          console.log(`🔄 Using wallet from store: ${walletIdToUse}`);

          // Set it in walletKit (may or may not work, but doesn't matter)
          walletKit.setWallet(walletIdToUse);
        }
      }
    } catch (e) {
      console.error('Failed to read wallet from storage:', e);
    }
  }

  // Check if wallet is available
  if (!walletIdToUse) {
    console.error('❌ No wallet found in storage');
    throw new WalletError(
      'validation',
      'No wallet connected',
      'Please connect your wallet first.',
      false
    );
  }

  const address = await getWalletAddress();
  console.log(`📍 Signing with ${walletIdToUse} wallet: ${address.substring(0, 8)}...`);

  const isAlbedo = walletIdToUse === ALBEDO_ID;

  if (isAlbedo) {
    console.log('📡 Albedo detected - will use callback URL for proper popup/redirect flow');

    // Add debug listener for postMessage events (to diagnose callback issues)
    const messageHandler = (event: MessageEvent) => {
      console.log('📨 PostMessage received:', {
        origin: event.origin,
        type: event.data?.type,
        source: event.data?.source,
        hasPayload: !!event.data?.payload,
        data: event.data
      });

      if (event.data?.type === 'ALBEDO_CALLBACK' || event.data?.source === 'albedo') {
        console.log('✅ Albedo callback message detected!', event.data);
      }
    };

    window.addEventListener('message', messageHandler);

    // Cleanup listener after timeout
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      console.log('🧹 Removed debug message listener');
    }, timeout);
  }

  console.log(`🔐 Requesting signature (timeout: ${timeout}ms)...`);
  const startTime = Date.now();

  try {
    // Build transaction signing options
    // Albedo (web-based wallet) requires callback URL for popup/redirect flow
    // Extension wallets (Freighter, xBull, LOBSTR) communicate directly
    interface SigningOptions {
      networkPassphrase: string;
      address: string;
      submit: boolean;
      callback?: string;
    }

    const signingOptions: SigningOptions = {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
      submit: false, // Only sign, don't submit - we handle submission
    };

    // Add callback URL only for Albedo (web-based wallet)
    if (isAlbedo) {
      signingOptions.callback = getCallbackUrl();
      console.log(`📞 Callback URL set: ${signingOptions.callback}`);
    }

    // Race between signing and timeout
    const { signedTxXdr } = await Promise.race([
      walletKit.signTransaction(xdr, signingOptions),
      timeoutPromise<{ signedTxXdr: string }>(timeout, 'Transaction signing timed out'),
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`✅ Signature received from ${walletIdToUse} (took ${elapsed}ms)`);

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
