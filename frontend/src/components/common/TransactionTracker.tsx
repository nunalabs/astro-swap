import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTransactionStore } from '../../stores/transactionStore';
import type { Transaction } from '../../types';

const STELLAR_EXPLORER_URL = 'https://testnet.stellarchain.io/transactions';

/**
 * Transaction status badge with animation
 */
const StatusBadge = memo(function StatusBadge({ status }: { status: Transaction['status'] }) {
  const statusConfig = {
    pending: {
      bg: 'bg-primary/20',
      text: 'text-primary',
      label: 'Pending',
      animate: true,
    },
    success: {
      bg: 'bg-green/20',
      text: 'text-green',
      label: 'Success',
      animate: false,
    },
    failed: {
      bg: 'bg-red-500/20',
      text: 'text-red-500',
      label: 'Failed',
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.animate && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
      )}
      {config.label}
    </span>
  );
});

/**
 * Format transaction type for display
 */
function formatTxType(type: Transaction['type']): string {
  const typeLabels: Record<Transaction['type'], string> = {
    swap: 'Swap',
    add_liquidity: 'Add Liquidity',
    remove_liquidity: 'Remove Liquidity',
    stake: 'Stake',
    unstake: 'Unstake',
    claim: 'Claim Rewards',
    bridge: 'Bridge',
  };
  return typeLabels[type] || type;
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Single transaction row
 */
const TransactionRow = memo(function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex items-center justify-between p-3 hover:bg-neutral-800/50 rounded-lg transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {tx.status === 'pending' ? (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : tx.status === 'success' ? (
            <div className="w-8 h-8 rounded-full bg-green/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}
        </div>

        <div>
          <div className="font-medium text-sm">{formatTxType(tx.type)}</div>
          <div className="text-xs text-neutral-400">{formatRelativeTime(tx.timestamp)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <StatusBadge status={tx.status} />
        <a
          href={`${STELLAR_EXPLORER_URL}/${tx.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-neutral-700 rounded-lg transition-colors"
          aria-label="View on explorer"
        >
          <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </motion.div>
  );
});

/**
 * Floating transaction tracker button and panel
 */
export const TransactionTracker = memo(function TransactionTracker() {
  const [isOpen, setIsOpen] = useState(false);
  const transactions = useTransactionStore((state) => state.transactions);
  const pendingCount = useTransactionStore((state) => state.pendingCount);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Don't render if no transactions
  if (transactions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Button */}
      <motion.button
        onClick={toggleOpen}
        className="relative flex items-center gap-2 px-4 py-3 bg-card border border-neutral-700 rounded-xl shadow-lg hover:border-primary transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={`${pendingCount} pending transactions`}
      >
        {pendingCount > 0 ? (
          <>
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">{pendingCount} Pending</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 text-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Transactions</span>
          </>
        )}

        {/* Notification badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-[10px] font-bold items-center justify-center">
              {pendingCount}
            </span>
          </span>
        )}
      </motion.button>

      {/* Transaction Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-2 w-80 max-h-96 bg-card border border-neutral-700 rounded-xl shadow-xl overflow-hidden"
            role="dialog"
            aria-label="Recent transactions"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-700">
              <h3 className="font-semibold">Recent Transactions</h3>
              <button
                onClick={toggleOpen}
                className="p-1 hover:bg-neutral-700 rounded-lg transition-colors"
                aria-label="Close panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Transaction List */}
            <div className="overflow-y-auto max-h-72 p-2">
              <AnimatePresence mode="popLayout">
                {transactions.slice(0, 10).map((tx) => (
                  <TransactionRow key={tx.hash} tx={tx} />
                ))}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {transactions.length > 10 && (
              <div className="p-3 border-t border-neutral-700 text-center">
                <span className="text-xs text-neutral-400">
                  Showing 10 of {transactions.length} transactions
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * Inline pending indicator for use in headers/navbars
 */
export const PendingTransactionIndicator = memo(function PendingTransactionIndicator() {
  const pendingCount = useTransactionStore((state) => state.pendingCount);

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full" role="status" aria-live="polite">
      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <span className="text-sm font-medium text-primary">
        {pendingCount} pending
      </span>
    </div>
  );
});
