import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import { TokenInput } from './TokenInput';
import { mockXLM, mockUSDC } from '../../test/utils';

// Mock the useTokenBalance hook
vi.mock('../../hooks/useTokenBalance', () => ({
  useTokenBalance: vi.fn(() => ({
    balance: '100.0000000',
    isLoading: false,
  })),
}));

// Mock TokenSelector since it has complex dependencies
vi.mock('../common/TokenSelector', () => ({
  TokenSelector: ({ selectedToken, onSelect }: { selectedToken: typeof mockXLM | null; onSelect: (token: typeof mockXLM) => void }) => (
    <button
      data-testid="token-selector"
      onClick={() => onSelect(mockUSDC)}
    >
      {selectedToken?.symbol || 'Select'}
    </button>
  ),
}));

describe('TokenInput', () => {
  const defaultProps = {
    label: 'From',
    token: mockXLM,
    amount: '10',
    onTokenSelect: vi.fn(),
    onAmountChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders label', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.getByText('From')).toBeInTheDocument();
    });

    it('renders amount input', () => {
      render(<TokenInput {...defaultProps} />);
      const input = screen.getByRole('spinbutton', { name: /from amount/i });
      expect(input).toHaveValue(10);
    });

    it('renders token selector', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.getByTestId('token-selector')).toBeInTheDocument();
      expect(screen.getByText('XLM')).toBeInTheDocument();
    });

    it('displays balance when showBalance is true', () => {
      render(<TokenInput {...defaultProps} />);
      expect(screen.getByText(/Balance:/)).toBeInTheDocument();
    });

    it('hides balance when showBalance is false', () => {
      render(<TokenInput {...defaultProps} showBalance={false} />);
      expect(screen.queryByText(/Balance:/)).not.toBeInTheDocument();
    });
  });

  describe('amount input', () => {
    it('calls onAmountChange when typing', () => {
      const onAmountChange = vi.fn();
      render(<TokenInput {...defaultProps} onAmountChange={onAmountChange} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '25' } });

      expect(onAmountChange).toHaveBeenCalledWith('25');
    });

    it('is readonly when readOnly prop is true', () => {
      render(<TokenInput {...defaultProps} readOnly />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('readonly');
    });

    it('has correct accessibility attributes', () => {
      render(<TokenInput {...defaultProps} />);
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-label', 'From amount');
    });
  });

  describe('token selection', () => {
    it('calls onTokenSelect when token is selected', () => {
      const onTokenSelect = vi.fn();
      render(<TokenInput {...defaultProps} onTokenSelect={onTokenSelect} />);

      fireEvent.click(screen.getByTestId('token-selector'));
      expect(onTokenSelect).toHaveBeenCalledWith(mockUSDC);
    });
  });

  describe('MAX button', () => {
    it('sets max amount when MAX is clicked', () => {
      const onAmountChange = vi.fn();
      render(<TokenInput {...defaultProps} onAmountChange={onAmountChange} />);

      // Click the balance/MAX button
      const maxButton = screen.getByText(/MAX/).closest('button');
      if (maxButton) {
        fireEvent.click(maxButton);
      }

      // For XLM, should leave 1 XLM for fees
      expect(onAmountChange).toHaveBeenCalledWith('99.0000000');
    });

    it('uses full balance for non-XLM tokens', () => {
      const onAmountChange = vi.fn();
      render(
        <TokenInput
          {...defaultProps}
          token={mockUSDC}
          onAmountChange={onAmountChange}
        />
      );

      const maxButton = screen.getByText(/MAX/).closest('button');
      if (maxButton) {
        fireEvent.click(maxButton);
      }

      expect(onAmountChange).toHaveBeenCalledWith('100.0000000');
    });
  });

  describe('insufficient balance', () => {
    it('shows error when amount exceeds balance', () => {
      render(<TokenInput {...defaultProps} amount="150" />);

      expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('applies error styling to input', () => {
      render(<TokenInput {...defaultProps} amount="150" />);

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('text-red-500');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not show error when amount is within balance', () => {
      render(<TokenInput {...defaultProps} amount="50" />);

      expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
    });

    it('does not check balance in readonly mode', () => {
      render(<TokenInput {...defaultProps} amount="150" readOnly />);

      expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
    });
  });

  describe('USD value', () => {
    it('displays USD value when token has price', () => {
      render(<TokenInput {...defaultProps} token={{ ...mockXLM, price: 0.15 }} />);

      // 10 tokens * $0.15 = $1.50
      expect(screen.getByText(/~\$1\.50/)).toBeInTheDocument();
    });

    it('does not display USD value when amount is 0', () => {
      render(<TokenInput {...defaultProps} amount="0" />);

      expect(screen.queryByText(/~\$/)).not.toBeInTheDocument();
    });
  });

  describe('Input validation', () => {
    it('removes leading zeros from input', () => {
      const onAmountChange = vi.fn();
      render(<TokenInput {...defaultProps} amount="" onAmountChange={onAmountChange} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '007' } });

      // Should remove leading zeros and call onAmountChange with '7'
      expect(onAmountChange).toHaveBeenCalledWith('7');
    });

    it('preserves "0." pattern when typing decimal', () => {
      const onAmountChange = vi.fn();
      render(<TokenInput {...defaultProps} amount="" onAmountChange={onAmountChange} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0.' } });

      // Should not remove the zero before decimal point
      expect(onAmountChange).toHaveBeenCalledWith('0.');
    });

    it('handles edge case with multiple leading zeros', () => {
      const onAmountChange = vi.fn();
      render(<TokenInput {...defaultProps} amount="" onAmountChange={onAmountChange} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '00.5' } });

      // Should remove ALL leading zeros, resulting in '.5'
      expect(onAmountChange).toHaveBeenCalledWith('.5');
    });
  });
});
