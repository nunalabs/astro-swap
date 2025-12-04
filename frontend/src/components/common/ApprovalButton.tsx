import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './Button';
import { cn } from '../../lib/utils';

interface ApprovalButtonProps {
  tokenSymbol: string;
  needsApproval: boolean;
  isApproving: boolean;
  isLoadingAllowance: boolean;
  onApprove: () => Promise<unknown>;
  onApproveExact?: () => Promise<unknown>;
  disabled?: boolean;
  className?: string;
}

/**
 * Button component for token approval with unlimited/exact options
 */
export const ApprovalButton = memo(function ApprovalButton({
  tokenSymbol,
  needsApproval,
  isApproving,
  isLoadingAllowance,
  onApprove,
  onApproveExact,
  disabled = false,
  className,
}: ApprovalButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  const handleApprove = useCallback(async () => {
    await onApprove();
    setShowOptions(false);
  }, [onApprove]);

  const handleApproveExact = useCallback(async () => {
    if (onApproveExact) {
      await onApproveExact();
      setShowOptions(false);
    }
  }, [onApproveExact]);

  if (!needsApproval && !isLoadingAllowance) {
    return null;
  }

  if (isLoadingAllowance) {
    return (
      <Button
        variant="secondary"
        disabled
        fullWidth
        className={className}
      >
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Checking approval...
        </div>
      </Button>
    );
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="secondary"
        onClick={() => setShowOptions(!showOptions)}
        isLoading={isApproving}
        disabled={disabled || isApproving}
        fullWidth
        aria-expanded={showOptions}
        aria-haspopup="menu"
      >
        {isApproving ? `Approving ${tokenSymbol}...` : `Approve ${tokenSymbol}`}
      </Button>

      <AnimatePresence>
        {showOptions && !isApproving && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden shadow-lg z-10"
            role="menu"
          >
            <button
              onClick={handleApprove}
              className="w-full px-4 py-3 text-left hover:bg-neutral-700 transition-colors"
              role="menuitem"
            >
              <div className="font-medium">Unlimited Approval</div>
              <div className="text-sm text-neutral-400">
                Approve once, swap anytime (recommended)
              </div>
            </button>

            {onApproveExact && (
              <button
                onClick={handleApproveExact}
                className="w-full px-4 py-3 text-left hover:bg-neutral-700 transition-colors border-t border-neutral-700"
                role="menuitem"
              >
                <div className="font-medium">Exact Amount</div>
                <div className="text-sm text-neutral-400">
                  Only approve this transaction amount
                </div>
              </button>
            )}

            <button
              onClick={() => setShowOptions(false)}
              className="w-full px-4 py-2 text-sm text-neutral-400 hover:bg-neutral-700 transition-colors border-t border-neutral-700"
              role="menuitem"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * Inline approval status indicator
 */
export const ApprovalStatus = memo(function ApprovalStatus({
  status,
  tokenSymbol,
}: {
  status: 'unknown' | 'none' | 'pending' | 'approved' | 'error';
  tokenSymbol: string;
}) {
  if (status === 'approved') {
    return (
      <div className="flex items-center gap-1 text-sm text-green" role="status">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        {tokenSymbol} approved
      </div>
    );
  }

  if (status === 'none') {
    return (
      <div className="flex items-center gap-1 text-sm text-yellow-500" role="status">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {tokenSymbol} needs approval
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-1 text-sm text-primary">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Approving {tokenSymbol}...
      </div>
    );
  }

  return null;
});
