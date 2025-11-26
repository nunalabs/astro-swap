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
        // After rehydration, update balance if connected
        if (state?.isConnected && state?.address) {
          // Re-set the wallet in the kit
          if (state.walletId) {
            walletKit.setWallet(state.walletId);
          }
          // Update balance in background
          state.updateBalance();
        }
      },
    }
  )
);
