import { memo, useCallback, useMemo } from 'react';
import { TokenSelector } from '../common/TokenSelector';
import { useTokenBalance } from '../../hooks/useTokenBalance';
import type { Token } from '../../types';
import { formatTokenAmount, formatNumber, cn } from '../../lib/utils';

interface TokenInputProps {
  label: string;
  token: Token | null;
  amount: string;
  onTokenSelect: (token: Token) => void;
  onAmountChange: (amount: string) => void;
  excludeTokens?: string[];
  readOnly?: boolean;
  showBalance?: boolean;
}

export const TokenInput = memo(function TokenInput({
  label,
  token,
  amount,
  onTokenSelect,
  onAmountChange,
  excludeTokens,
  readOnly = false,
  showBalance = true,
}: TokenInputProps) {
  const { balance, isLoading: isLoadingBalance } = useTokenBalance(token);

  // Check if amount exceeds balance
  const insufficientBalance = useMemo(() => {
    if (!balance || !amount || readOnly) return false;
    try {
      const amountNum = parseFloat(amount);
      const balanceNum = parseFloat(balance);
      return amountNum > 0 && balanceNum >= 0 && amountNum > balanceNum;
    } catch {
      return false;
    }
  }, [balance, amount, readOnly]);

  const handleMaxClick = useCallback(() => {
    if (balance && parseFloat(balance) > 0) {
      // For native XLM, leave some for fees
      if (token?.symbol === 'XLM') {
        const maxAmount = Math.max(0, parseFloat(balance) - 1); // Leave 1 XLM for fees
        onAmountChange(maxAmount.toFixed(7));
      } else {
        onAmountChange(balance);
      }
    }
  }, [balance, token?.symbol, onAmountChange]);

  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onAmountChange(e.target.value);
  }, [onAmountChange]);

  const displayBalance = () => {
    if (isLoadingBalance) return '...';
    if (!balance || balance === '0') return '0.0';
    // For XLM, balance is already in readable format
    if (token?.symbol === 'XLM') {
      return formatNumber(parseFloat(balance), 4);
    }
    // For other tokens, format based on decimals
    return formatTokenAmount(balance, token?.decimals || 7, 4);
  };

  return (
    <div className="space-y-2">
      {/* Label and Balance */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-400">{label}</span>
        {showBalance && token && (
          <button
            onClick={handleMaxClick}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Balance: {displayBalance()}
            <span className="ml-1 text-primary hover:underline">MAX</span>
          </button>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        <div className={cn(
          "flex items-center gap-3 p-4 bg-neutral-800 rounded-xl border transition-colors",
          insufficientBalance
            ? "border-red-500 focus-within:border-red-400"
            : "border-neutral-700 focus-within:border-primary"
        )}>
          <input
            type="number"
            value={amount}
            onChange={handleAmountChange}
            placeholder="0.0"
            className={cn(
              "flex-1 bg-transparent text-2xl font-semibold outline-none",
              insufficientBalance && "text-red-500"
            )}
            readOnly={readOnly}
            step="any"
            min="0"
            aria-label={`${label} amount`}
            aria-invalid={insufficientBalance}
            aria-describedby={insufficientBalance ? `${label}-error` : undefined}
          />

          <TokenSelector
            selectedToken={token}
            onSelect={onTokenSelect}
            excludeTokens={excludeTokens}
          />
        </div>

        {/* Insufficient Balance Warning */}
        {insufficientBalance && (
          <div
            id={`${label}-error`}
            className="absolute -bottom-6 left-0 flex items-center gap-1 text-sm text-red-500"
            role="alert"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Insufficient balance
          </div>
        )}

        {/* USD Value (if token has price) */}
        {!insufficientBalance && token?.price && parseFloat(amount) > 0 && (
          <div className="absolute -bottom-6 right-0 text-sm text-neutral-400">
            ~${(parseFloat(amount) * token.price).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
});
