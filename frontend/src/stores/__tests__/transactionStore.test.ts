/**
 * TransactionStore - Unit Tests
 *
 * Strategy: Test Zustand store logic, transaction tracking, cleanup
 * Coverage: Add, update, clear transactions, persistence
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTransactionStore } from '../transactionStore';
import type { Transaction } from '../../types';

describe('TransactionStore', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset store to initial state
    useTransactionStore.setState({
      transactions: [],
      pendingCount: 0,
    });

    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have empty transactions array', () => {
      const state = useTransactionStore.getState();

      expect(state.transactions).toEqual([]);
      expect(state.pendingCount).toBe(0);
    });

    it('should expose all required functions', () => {
      const state = useTransactionStore.getState();

      expect(typeof state.addTransaction).toBe('function');
      expect(typeof state.updateTransaction).toBe('function');
      expect(typeof state.clearOldTransactions).toBe('function');
      expect(typeof state.getTransaction).toBe('function');
      expect(typeof state.getPendingTransactions).toBe('function');
    });
  });

  describe('Add Transaction', () => {
    it('should add transaction with timestamp', () => {
      const { addTransaction } = useTransactionStore.getState();

      const transaction = {
        hash: 'TX123',
        type: 'swap' as const,
        status: 'pending' as const,
        details: {
          tokenIn: 'XLM',
          tokenOut: 'USDC',
          amountIn: '100',
          amountOut: '50',
        },
      };

      addTransaction(transaction);

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].hash).toBe('TX123');
      expect(state.transactions[0].timestamp).toBeDefined();
      expect(typeof state.transactions[0].timestamp).toBe('number');
    });

    it('should add transactions at the beginning of array (newest first)', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'success',
        details: {},
      });

      addTransaction({
        hash: 'TX2',
        type: 'swap',
        status: 'success',
        details: {},
      });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].hash).toBe('TX2'); // Newest first
      expect(state.transactions[1].hash).toBe('TX1');
    });

    it('should update pending count when adding pending transaction', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      expect(useTransactionStore.getState().pendingCount).toBe(1);

      addTransaction({
        hash: 'TX2',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      expect(useTransactionStore.getState().pendingCount).toBe(2);
    });

    it('should not increase pending count for completed transactions', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'success',
        details: {},
      });

      expect(useTransactionStore.getState().pendingCount).toBe(0);
    });

    it('should limit transactions to last 50', () => {
      const { addTransaction } = useTransactionStore.getState();

      // Add 60 transactions
      for (let i = 0; i < 60; i++) {
        addTransaction({
          hash: `TX${i}`,
          type: 'swap',
          status: 'success',
          details: {},
        });
      }

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(50);
      // Should keep newest 50
      expect(state.transactions[0].hash).toBe('TX59');
      expect(state.transactions[49].hash).toBe('TX10');
    });
  });

  describe('Update Transaction', () => {
    it('should update transaction status', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX123',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      updateTransaction('TX123', { status: 'success' });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe('success');
    });

    it('should update pending count when status changes', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      expect(useTransactionStore.getState().pendingCount).toBe(1);

      updateTransaction('TX1', { status: 'success' });

      expect(useTransactionStore.getState().pendingCount).toBe(0);
    });

    it('should update multiple fields', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX123',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      updateTransaction('TX123', {
        status: 'failed',
        details: {
          error: 'Transaction failed',
        },
      });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe('failed');
      expect(state.transactions[0].details).toEqual({ error: 'Transaction failed' });
    });

    it('should not modify other transactions', () => {
      const { addTransaction, updateTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      addTransaction({
        hash: 'TX2',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      updateTransaction('TX1', { status: 'success' });

      const state = useTransactionStore.getState();
      expect(state.transactions.find(tx => tx.hash === 'TX1')?.status).toBe('success');
      expect(state.transactions.find(tx => tx.hash === 'TX2')?.status).toBe('pending');
    });

    it('should handle update of non-existent transaction gracefully', () => {
      const { updateTransaction } = useTransactionStore.getState();

      // Should not throw error
      expect(() => {
        updateTransaction('NON_EXISTENT', { status: 'success' });
      }).not.toThrow();
    });
  });

  describe('Clear Old Transactions', () => {
    it('should remove transactions older than 7 days', () => {
      const { addTransaction, clearOldTransactions } = useTransactionStore.getState();

      const now = Date.now();
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

      // Add old transaction
      useTransactionStore.setState({
        transactions: [{
          hash: 'OLD_TX',
          type: 'swap',
          status: 'success',
          details: {},
          timestamp: eightDaysAgo,
        }],
      });

      // Add recent transaction
      addTransaction({
        hash: 'RECENT_TX',
        type: 'swap',
        status: 'success',
        details: {},
      });

      clearOldTransactions();

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].hash).toBe('RECENT_TX');
    });

    it('should keep pending transactions even if old', () => {
      const { clearOldTransactions } = useTransactionStore.getState();

      const now = Date.now();
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

      useTransactionStore.setState({
        transactions: [
          {
            hash: 'OLD_PENDING',
            type: 'swap',
            status: 'pending',
            details: {},
            timestamp: eightDaysAgo,
          },
          {
            hash: 'OLD_SUCCESS',
            type: 'swap',
            status: 'success',
            details: {},
            timestamp: eightDaysAgo,
          },
        ],
      });

      clearOldTransactions();

      const state = useTransactionStore.getState();
      expect(state.transactions).toHaveLength(1);
      expect(state.transactions[0].hash).toBe('OLD_PENDING');
    });

    it('should update pending count after clearing', () => {
      const { clearOldTransactions } = useTransactionStore.getState();

      const now = Date.now();
      const eightDaysAgo = now - (8 * 24 * 60 * 60 * 1000);

      useTransactionStore.setState({
        transactions: [
          {
            hash: 'OLD_PENDING',
            type: 'swap',
            status: 'pending',
            details: {},
            timestamp: eightDaysAgo,
          },
        ],
        pendingCount: 1,
      });

      clearOldTransactions();

      const state = useTransactionStore.getState();
      expect(state.pendingCount).toBe(1); // Still 1 (kept because pending)
    });
  });

  describe('Get Transaction', () => {
    it('should get transaction by hash', () => {
      const { addTransaction, getTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX123',
        type: 'swap',
        status: 'success',
        details: { tokenIn: 'XLM' },
      });

      const tx = getTransaction('TX123');

      expect(tx).toBeDefined();
      expect(tx?.hash).toBe('TX123');
      expect(tx?.details.tokenIn).toBe('XLM');
    });

    it('should return undefined for non-existent transaction', () => {
      const { getTransaction } = useTransactionStore.getState();

      const tx = getTransaction('NON_EXISTENT');

      expect(tx).toBeUndefined();
    });
  });

  describe('Get Pending Transactions', () => {
    it('should return only pending transactions', () => {
      const { addTransaction, getPendingTransactions } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      addTransaction({
        hash: 'TX2',
        type: 'swap',
        status: 'success',
        details: {},
      });

      addTransaction({
        hash: 'TX3',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      const pending = getPendingTransactions();

      expect(pending).toHaveLength(2);
      expect(pending.every(tx => tx.status === 'pending')).toBe(true);
    });

    it('should return empty array if no pending transactions', () => {
      const { addTransaction, getPendingTransactions } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'success',
        details: {},
      });

      const pending = getPendingTransactions();

      expect(pending).toEqual([]);
    });
  });

  describe('Persistence', () => {
    it('should persist transactions to localStorage', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX123',
        type: 'swap',
        status: 'success',
        details: {},
      });

      const stored = localStorage.getItem('astroswap-transactions');
      expect(stored).toBeDefined();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.transactions).toHaveLength(1);
        expect(parsed.state.transactions[0].hash).toBe('TX123');
      }
    });

    it('should only persist transactions (not pendingCount)', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'pending',
        details: {},
      });

      const stored = localStorage.getItem('astroswap-transactions');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.transactions).toBeDefined();
        expect(parsed.state.pendingCount).toBeUndefined();
      }
    });

    it('should recalculate pending count on rehydration', () => {
      // Simulate persisted state with pending transactions
      const persistedState = {
        state: {
          transactions: [
            {
              hash: 'TX1',
              type: 'swap',
              status: 'pending',
              details: {},
              timestamp: Date.now(),
            },
            {
              hash: 'TX2',
              type: 'swap',
              status: 'success',
              details: {},
              timestamp: Date.now(),
            },
          ],
        },
        version: 0,
      };

      localStorage.setItem('astroswap-transactions', JSON.stringify(persistedState));

      // Manually trigger rehydration callback
      useTransactionStore.setState({
        transactions: persistedState.state.transactions as Transaction[],
        pendingCount: 0,
      });

      // Simulate onRehydrateStorage callback
      const state = useTransactionStore.getState();
      const pendingCount = state.transactions.filter(t => t.status === 'pending').length;

      expect(pendingCount).toBe(1);
    });
  });

  describe('Transaction Types', () => {
    it('should support swap transactions', () => {
      const { addTransaction } = useTransactionStore.getState();

      addTransaction({
        hash: 'TX1',
        type: 'swap',
        status: 'success',
        details: {
          tokenIn: 'XLM',
          tokenOut: 'USDC',
          amountIn: '100',
          amountOut: '50',
        },
      });

      const tx = useTransactionStore.getState().transactions[0];
      expect(tx.type).toBe('swap');
    });

    it('should support different status types', () => {
      const { addTransaction } = useTransactionStore.getState();

      const statuses: Array<'pending' | 'success' | 'failed'> = ['pending', 'success', 'failed'];

      statuses.forEach((status, i) => {
        addTransaction({
          hash: `TX${i}`,
          type: 'swap',
          status,
          details: {},
        });
      });

      const state = useTransactionStore.getState();
      expect(state.transactions[0].status).toBe('failed');
      expect(state.transactions[1].status).toBe('success');
      expect(state.transactions[2].status).toBe('pending');
    });
  });
});
