import { TokenSelector } from '../common/TokenSelector';
import { useTokenBalance } from '../../hooks/useTokenBalance';
import type { Token } from '../../types';
import { formatTokenAmount, formatNumber } from '../../lib/utils';

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

export function TokenInput({
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

  const handleMaxClick = () => {
    if (balance && parseFloat(balance) > 0) {
      // For native XLM, leave some for fees
      if (token?.symbol === 'XLM') {
        const maxAmount = Math.max(0, parseFloat(balance) - 1); // Leave 1 XLM for fees
        onAmountChange(maxAmount.toFixed(7));
      } else {
        onAmountChange(balance);
      }
    }
  };

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
        <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl border border-neutral-700 focus-within:border-primary transition-colors">
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.0"
            className="flex-1 bg-transparent text-2xl font-semibold outline-none"
            readOnly={readOnly}
            step="any"
            min="0"
          />

          <TokenSelector
            selectedToken={token}
            onSelect={onTokenSelect}
            excludeTokens={excludeTokens}
          />
        </div>

        {/* USD Value (if token has price) */}
        {token?.price && parseFloat(amount) > 0 && (
          <div className="absolute -bottom-6 right-0 text-sm text-neutral-400">
            ~${(parseFloat(amount) * token.price).toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
