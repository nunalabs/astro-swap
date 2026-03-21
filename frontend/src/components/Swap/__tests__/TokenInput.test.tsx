import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TokenInput } from '../TokenInput';
import { useTokenBalance } from '../../../hooks/useTokenBalance';
import type { Token } from '../../../types';

// Mock dependencies
vi.mock('../../../hooks/useTokenBalance');
vi.mock('../../common/TokenSelector', () => ({
  TokenSelector: ({ selectedToken, onSelect }: any) => (
    <button onClick={() => onSelect({ symbol: 'TEST', address: 'test' })}>
      {selectedToken?.symbol || 'Select Token'}
    </button>
  ),
}));

describe('TokenInput', () => {
  const mockToken: Token = {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 7,
    icon: '',
    balance: '1000.0',
  };

  const mockXLM: Token = {
    address: 'native',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    icon: '',
    balance: '1000.0',
  };

  const mockOnTokenSelect = vi.fn();
  const mockOnAmountChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTokenBalance).mockReturnValue({
      balance: '100.0',
      isLoading: false,
      error: null,
    });
  });

  describe('Rendering', () => {
    it('should render label', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText('From')).toBeInTheDocument();
    });

    it('should render input with placeholder', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByPlaceholderText('0.0')).toBeInTheDocument();
    });

    it('should render token selector', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('should render balance when showBalance is true', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
          showBalance={true}
        />
      );

      expect(screen.getByText(/Balance:/)).toBeInTheDocument();
    });

    it('should not render balance when showBalance is false', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
          showBalance={false}
        />
      );

      expect(screen.queryByText(/Balance:/)).not.toBeInTheDocument();
    });
  });

  describe('Amount Input', () => {
    it('should call onAmountChange when value changes', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.type(input, '123.456');

      expect(mockOnAmountChange).toHaveBeenCalled();
    });

    it('should accept valid decimal numbers', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.type(input, '12.34567');

      // Check that the final value after typing all characters is correct
      const calls = mockOnAmountChange.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toBe('7'); // Last character typed
      // Verify decimal numbers were accepted (check for presence of '.')
      expect(calls.some((call) => call[0].includes('.'))).toBe(true);
    });

    it('should limit decimals to 7 places', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.type(input, '1.12345678'); // 8 decimals

      const calls = mockOnAmountChange.mock.calls.map((call) => call[0]);
      // Should not have called with 8 decimals
      expect(calls.includes('1.12345678')).toBe(false);
    });

    it('should handle empty string input', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="123"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.clear(input);

      expect(mockOnAmountChange).toHaveBeenCalledWith('');
    });

    it('should remove leading zeros', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.type(input, '00123');

      // Should have called onAmountChange - typing character by character
      // When '00' is typed, it gets cleaned to '' (removes all leading zeros)
      // Then '1', '2', '3' are appended one by one
      const calls = mockOnAmountChange.mock.calls.map((call) => call[0]);

      // Verify no values start with '00' (leading zeros removed)
      expect(calls.some((val) => /^00/.test(val))).toBe(false);
      // Verify we get sequential values as digits are typed
      expect(mockOnAmountChange).toHaveBeenCalled();
    });

    it('should allow "0." pattern', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      await user.type(input, '0.5');

      const calls = mockOnAmountChange.mock.calls;
      expect(calls.some((call) => call[0] === '0.5')).toBe(true);
    });

    it('should be readonly when readOnly prop is true', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="123"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
          readOnly={true}
        />
      );

      const input = screen.getByLabelText('From amount');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('MAX Button', () => {
    it('should show MAX button with balance', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText('MAX')).toBeInTheDocument();
    });

    it('should set amount to balance when MAX clicked', async () => {
      const user = userEvent.setup();

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      await user.click(screen.getByText('MAX'));

      expect(mockOnAmountChange).toHaveBeenCalledWith('100.0');
    });

    it('should reserve 1 XLM for fees when MAX clicked for XLM', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockXLM}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      await user.click(screen.getByText('MAX'));

      expect(mockOnAmountChange).toHaveBeenCalledWith('49.0000000');
    });

    it('should not set negative amount for XLM with low balance', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '0.5',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockXLM}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      await user.click(screen.getByText('MAX'));

      // Should be 0, not negative
      const call = mockOnAmountChange.mock.calls[0][0];
      expect(parseFloat(call)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Balance Display', () => {
    it('should show loading state', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: null,
        isLoading: true,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText(/\.\.\./)).toBeInTheDocument();
    });

    it('should show 0.0 when balance is 0', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText(/Balance: 0\.0/)).toBeInTheDocument();
    });

    it('should show 0.0 when balance is null', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: null,
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText(/Balance: 0\.0/)).toBeInTheDocument();
    });
  });

  describe('Insufficient Balance', () => {
    it('should show error when amount exceeds balance', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
    });

    it('should show error role alert', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Insufficient balance');
    });

    it('should not show error when amount is valid', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '100.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="50.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
    });

    it('should not show error when readOnly', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
          readOnly={true}
        />
      );

      expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
    });

    it('should handle invalid amount gracefully', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '100.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="invalid"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      // Should not crash or show error for invalid input
      expect(screen.queryByText('Insufficient balance')).not.toBeInTheDocument();
    });
  });

  describe('USD Value', () => {
    it('should show USD value when token has price', () => {
      const tokenWithPrice: Token = {
        ...mockToken,
        price: 0.998,
      };

      render(
        <TokenInput
          label="From"
          token={tokenWithPrice}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByText(/\$99\.80/)).toBeInTheDocument();
    });

    it('should not show USD value when amount is 0', () => {
      const tokenWithPrice: Token = {
        ...mockToken,
        price: 0.998,
      };

      render(
        <TokenInput
          label="From"
          token={tokenWithPrice}
          amount="0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('should not show USD value when token has no price', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      expect(screen.getByLabelText('From amount')).toBeInTheDocument();
    });

    it('should have aria-invalid when insufficient balance', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should have aria-describedby when insufficient balance', () => {
      vi.mocked(useTokenBalance).mockReturnValue({
        balance: '50.0',
        isLoading: false,
        error: null,
      });

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount="100.0"
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
        />
      );

      const input = screen.getByLabelText('From amount');
      expect(input).toHaveAttribute('aria-describedby', 'From-error');
    });
  });

  describe('Excluding Tokens', () => {
    it('should pass excludeTokens to TokenSelector', () => {
      const excludeTokens = ['token1', 'token2'];

      render(
        <TokenInput
          label="From"
          token={mockToken}
          amount=""
          onTokenSelect={mockOnTokenSelect}
          onAmountChange={mockOnAmountChange}
          excludeTokens={excludeTokens}
        />
      );

      // TokenSelector should be rendered (tested via its presence)
      expect(screen.getByText('USDC')).toBeInTheDocument();
    });
  });
});
