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
 * Sign a transaction with the connected wallet
 */
export async function signTransaction(xdr: string): Promise<string> {
  const { signedTxXdr } = await walletKit.signTransaction(xdr, {
    networkPassphrase: NETWORK === 'mainnet'
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015',
    address: await getWalletAddress(),
  });
  return signedTxXdr;
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

export type { ISupportedWallet };
