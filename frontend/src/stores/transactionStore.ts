import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transaction } from '../types';

/**
 * Transaction Store
 * Tracks pending and historical transactions for the connected wallet
 */

interface TransactionState {
  transactions: Transaction[];
  pendingCount: number;
  addTransaction: (transaction: Omit<Transaction, 'timestamp'>) => void;
  updateTransaction: (hash: string, updates: Partial<Transaction>) => void;
  clearOldTransactions: () => void;
  getTransaction: (hash: string) => Transaction | undefined;
  getPendingTransactions: () => Transaction[];
}

// Keep transactions for 7 days
const TRANSACTION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      pendingCount: 0,

      addTransaction: (transaction) => {
        const newTransaction: Transaction = {
          ...transaction,
          timestamp: Date.now(),
        };

        set((state) => {
          const newTransactions = [newTransaction, ...state.transactions].slice(0, 50); // Keep last 50
          const pendingCount = newTransactions.filter(t => t.status === 'pending').length;
          return {
            transactions: newTransactions,
            pendingCount,
          };
        });
      },

      updateTransaction: (hash, updates) => {
        set((state) => {
          const newTransactions = state.transactions.map((tx) =>
            tx.hash === hash ? { ...tx, ...updates } : tx
          );
          const pendingCount = newTransactions.filter(t => t.status === 'pending').length;
          return {
            transactions: newTransactions,
            pendingCount,
          };
        });
      },

      clearOldTransactions: () => {
        const cutoff = Date.now() - TRANSACTION_RETENTION_MS;
        set((state) => {
          const newTransactions = state.transactions.filter(
            (tx) => tx.timestamp > cutoff || tx.status === 'pending'
          );
          const pendingCount = newTransactions.filter(t => t.status === 'pending').length;
          return {
            transactions: newTransactions,
            pendingCount,
          };
        });
      },

      getTransaction: (hash) => {
        return get().transactions.find((tx) => tx.hash === hash);
      },

      getPendingTransactions: () => {
        return get().transactions.filter((tx) => tx.status === 'pending');
      },
    }),
    {
      name: 'astroswap-transactions',
      partialize: (state) => ({
        transactions: state.transactions,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Recalculate pending count on rehydration
          state.pendingCount = state.transactions.filter(t => t.status === 'pending').length;
        }
      },
    }
  )
);

// Clean up old transactions on load
useTransactionStore.getState().clearOldTransactions();
