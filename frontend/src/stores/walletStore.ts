import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  openWalletModal,
  signTransaction as signTx,
  walletKit,
  isMobileDevice,
} from '../lib/wallet-kit';
import { getAccountBalance } from '../lib/stellar';

interface WalletState {
  address: string | null;
  publicKey: string | null;
  walletId: string | null;
  walletName: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMobile: boolean;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  updateBalance: () => Promise<void>;
  signTransaction: (xdr: string) => Promise<string>;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      publicKey: null,
      walletId: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      isMobile: isMobileDevice(),
      balance: '0',

      connect: async () => {
        try {
          set({ isConnecting: true });

          // Open wallet selection modal
          const { address, walletId, walletName } = await openWalletModal();

          set({
            publicKey: address,
            address,
            walletId,
            walletName,
            isConnected: true,
            isConnecting: false,
          });

          // Fetch initial balance
          await get().updateBalance();
        } catch (error) {
          console.error('Error connecting wallet:', error);
          set({ isConnecting: false });
          throw error;
        }
      },

      disconnect: () => {
        set({
          address: null,
          publicKey: null,
          walletId: null,
          walletName: null,
          isConnected: false,
          balance: '0',
        });
      },

      updateBalance: async () => {
        const { address } = get();
        if (!address) return;

        try {
          const balance = await getAccountBalance(address);
          set({ balance });
        } catch (error) {
          console.error('Error updating balance:', error);
        }
      },

      signTransaction: async (xdr: string) => {
        const { isConnected } = get();
        if (!isConnected) {
          throw new Error('Wallet not connected');
        }

        return signTx(xdr);
      },
    }),
    {
      name: 'astroswap-wallet',
      partialize: (state) => ({
        address: state.address,
        publicKey: state.publicKey,
        walletId: state.walletId,
        walletName: state.walletName,
        isConnected: state.isConnected,
      }),
      onRehydrateStorage: () => (state) => {
        // M-2: Validate wallet persistence integrity
        if (state?.isConnected && state?.address) {
          // Verify wallet is actually available in wallet kit
          try {
            if (state.walletId) {
              // Check if wallet still exists in wallet kit
              const wallet = walletKit.getWallet(state.walletId);

              if (!wallet) {
                // Wallet no longer available, clear stale state
                console.warn('Wallet no longer available, clearing stale connection');
                state.disconnect();
                return;
              }

              // Re-set the wallet in the kit
              walletKit.setWallet(state.walletId);

              // Update balance in background
              state.updateBalance();
            } else {
              // No walletId but isConnected - invalid state
              console.warn('Invalid wallet state: connected but no walletId');
              state.disconnect();
            }
          } catch (error) {
            // Error checking wallet, clear stale state
            console.error('Error validating wallet state:', error);
            state.disconnect();
          }
        }
      },
    }
  )
);
