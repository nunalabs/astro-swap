import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { SwapCard } from '../SwapCard';
import { useSwap } from '../../../hooks/useSwap';
import { useSwapApproval } from '../../../hooks/useTokenApproval';
import { useWalletStore } from '../../../stores/walletStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Token } from '../../../types';

// Mock hooks
vi.mock('../../../hooks/useSwap');
vi.mock('../../../hooks/useTokenApproval');
vi.mock('../../../stores/walletStore');
vi.mock('../../../stores/settingsStore');

// Mock child components
vi.mock('../../../components/common/Card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

vi.mock('../../../components/common/Button', () => ({
  Button: forwardRef(({ children, onClick, disabled, isLoading, variant, fullWidth, ...props }: any, ref: any) => (
    <button
      ref={ref}
      onClick={onClick}
      disabled={disabled || isLoading}
      data-variant={variant}
      data-fullwidth={fullWidth ? 'true' : 'false'}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  )),
}));

vi.mock('../../../components/common/Tooltip', () => ({
  InfoTooltip: ({ content }: any) => <div data-testid="info-tooltip">{content}</div>,
}));

vi.mock('../TokenInput', () => ({
  TokenInput: ({ label, token, amount, onTokenSelect, onAmountChange, readOnly, showBalance }: any) => (
    <div data-testid={`token-input-${label.toLowerCase()}`}>
      <label>{label}</label>
      <input
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        readOnly={readOnly}
        data-token={token?.symbol}
        data-show-balance={showBalance}
      />
      <button onClick={() => onTokenSelect({ symbol: 'TEST', address: 'test' })}>Select Token</button>
    </div>
  ),
}));

vi.mock('../SwapSettings', () => ({
  SwapSettings: () => <div data-testid="swap-settings">Settings</div>,
}));

vi.mock('../SwapConfirmationModal', () => ({
  SwapConfirmationModal: ({ isOpen, onClose, onConfirm }: any) =>
    isOpen ? (
      <div data-testid="confirmation-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
}));

vi.mock('../../../components/common/ApprovalButton', () => ({
  ApprovalButton: ({ tokenSymbol, onApprove, onApproveExact }: any) => (
    <div data-testid="approval-button">
      <button onClick={onApprove}>Approve {tokenSymbol}</button>
      {onApproveExact && <button onClick={onApproveExact}>Approve Exact</button>}
    </div>
  ),
  ApprovalStatus: ({ status, tokenSymbol }: any) => (
    <div data-testid="approval-status">
      {status}: {tokenSymbol}
    </div>
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: forwardRef(({ children, onClick, ...props }: any, ref: any) => (
      <button ref={ref} onClick={onClick} {...props}>
        {children}
      </button>
    )),
  },
}));

describe('SwapCard', () => {
  const mockXLM: Token = {
    address: 'native',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    icon: '',
    balance: '1000.0',
  };

  const mockUSDC: Token = {
    address: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 7,
    icon: '',
    balance: '500.0',
  };

  const mockSwap = vi.fn();
  const mockSwitchTokens = vi.fn();
  const mockSetAmountIn = vi.fn();
  const mockApprove = vi.fn();
  const mockApproveExact = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useSwap
    vi.mocked(useSwap).mockReturnValue({
      amountIn: '',
      amountOut: '',
      priceImpact: 0,
      route: [mockXLM, mockUSDC],
      isLoadingQuote: false,
      isSwapping: false,
      isSimulating: false,
      setAmountIn: mockSetAmountIn,
      swap: mockSwap,
      switchTokens: mockSwitchTokens,
    });

    // Default mock for useSwapApproval
    vi.mocked(useSwapApproval).mockReturnValue({
      status: 'approved',
      needsApproval: false,
      isApproving: false,
      isLoadingAllowance: false,
      approve: mockApprove,
      approveExact: mockApproveExact,
    });

    // Default mock for useWalletStore
    vi.mocked(useWalletStore).mockReturnValue(true); // isConnected = true

    // Default mock for useSettingsStore
    vi.mocked(useSettingsStore).mockReturnValue(0.5); // slippageTolerance = 0.5%
  });

  describe('Rendering', () => {
    it('should render swap header', () => {
      render(<SwapCard />);
      expect(screen.getByRole('heading', { name: 'Swap' })).toBeInTheDocument();
    });

    it('should render swap settings', () => {
      render(<SwapCard />);
      expect(screen.getByTestId('swap-settings')).toBeInTheDocument();
    });

    it('should render from and to token inputs', () => {
      render(<SwapCard />);
      expect(screen.getByTestId('token-input-from')).toBeInTheDocument();
      expect(screen.getByTestId('token-input-to')).toBeInTheDocument();
    });

    it('should render switch tokens button', () => {
      render(<SwapCard />);
      expect(screen.getByRole('button', { name: 'Switch input and output tokens' })).toBeInTheDocument();
    });

    it('should render switch button with correct accessibility', () => {
      render(<SwapCard />);
      const switchButton = screen.getByRole('button', { name: 'Switch input and output tokens' });
      expect(switchButton).toHaveAttribute('aria-label', 'Switch input and output tokens');
    });
  });

  describe('Wallet Connection States', () => {
    it('should show Connect Wallet button when not connected', () => {
      vi.mocked(useWalletStore).mockReturnValue(false);

      render(<SwapCard />);
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeDisabled();
    });

    it('should not show approval status when not connected', () => {
      vi.mocked(useWalletStore).mockReturnValue(false);
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.queryByTestId('approval-status')).not.toBeInTheDocument();
    });
  });

  describe('Button States', () => {
    it('should show Enter Amount button when amount is 0', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '0',
        amountOut: '',
        priceImpact: 0,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enter Amount' })).toBeDisabled();
    });

    it('should show approval button when needs approval', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      vi.mocked(useSwapApproval).mockReturnValue({
        status: 'none',
        needsApproval: true,
        isApproving: false,
        isLoadingAllowance: false,
        approve: mockApprove,
        approveExact: mockApproveExact,
      });

      render(<SwapCard />);
      expect(screen.getByTestId('approval-button')).toBeInTheDocument();
    });

    it('should show Swap button when ready to swap', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByRole('button', { name: 'Swap' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Swap' })).not.toBeDisabled();
    });

    it('should show Loading when simulating', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: true,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      // Button shows Loading... when isLoading is true (isSwapping || isSimulating)
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show Loading when swapping', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: true,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Price Impact', () => {
    it('should show low price impact with green color', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99.5',
        priceImpact: 1,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('+1.00%')).toBeInTheDocument();
      expect(screen.getByText('+1.00%')).toHaveClass('text-green');
    });

    it('should show medium price impact with primary color', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '97',
        priceImpact: 3,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('+3.00%')).toBeInTheDocument();
      expect(screen.getByText('+3.00%')).toHaveClass('text-primary');
    });

    it('should show high price impact with red color', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('+6.00%')).toBeInTheDocument();
      expect(screen.getByText('+6.00%')).toHaveClass('text-red-300');
    });

    it('should show warning icon for high price impact', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText(/High price impact warning/i)).toBeInTheDocument();
    });

    it('should show Swap Anyway button for high price impact', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByRole('button', { name: 'Swap Anyway' })).toBeInTheDocument();
    });

    it('should show danger variant for high price impact button', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      const button = screen.getByRole('button', { name: 'Swap Anyway' });
      expect(button).toHaveAttribute('data-variant', 'danger');
    });

    it('should show high price impact warning message', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('High Price Impact')).toBeInTheDocument();
      expect(screen.getByText(/price impact of 6.00%/)).toBeInTheDocument();
    });
  });

  describe('Swap Details', () => {
    it('should show loading state when fetching quote', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '',
        priceImpact: 0,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: true,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('Fetching best rate...')).toBeInTheDocument();
    });

    it('should show rate when quote is ready', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('Rate')).toBeInTheDocument();
      expect(screen.getByText(/1 XLM ≈/)).toBeInTheDocument();
    });

    it('should show route when multi-hop swap', () => {
      const mockBTC: Token = {
        address: 'BTC123',
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 7,
        icon: '',
        balance: '1.0',
      };

      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockBTC, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText('Route')).toBeInTheDocument();
      expect(screen.getByText('XLM → BTC → USDC')).toBeInTheDocument();
    });

    it('should not show route for direct swap', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.queryByText('Route')).not.toBeInTheDocument();
    });

    it('should show minimum received with slippage', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '100',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      vi.mocked(useSettingsStore).mockReturnValue(0.5); // 0.5% slippage

      render(<SwapCard />);
      // Multiple "Minimum Received" text exists (label + tooltip), so use getAllByText
      expect(screen.getAllByText('Minimum Received').length).toBeGreaterThan(0);
      // 100 * (1 - 0.5/100) = 99.5
      expect(screen.getByText(/99.500000/)).toBeInTheDocument();
    });

    it('should not show swap details when no amount entered', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '0',
        amountOut: '',
        priceImpact: 0,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.queryByText('Rate')).not.toBeInTheDocument();
      expect(screen.queryByText('Price Impact')).not.toBeInTheDocument();
    });
  });

  describe('Token Switching', () => {
    it('should call switchTokens when switch button clicked', async () => {
      const user = userEvent.setup();

      render(<SwapCard />);

      const switchButton = screen.getByRole('button', { name: 'Switch input and output tokens' });
      await user.click(switchButton);

      expect(mockSwitchTokens).toHaveBeenCalledTimes(1);
    });
  });

  describe('Approval Flow', () => {
    it('should show approval status when connected and amount entered', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByTestId('approval-status')).toBeInTheDocument();
    });

    it('should pass approval callbacks to ApprovalButton', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      vi.mocked(useSwapApproval).mockReturnValue({
        status: 'none',
        needsApproval: true,
        isApproving: false,
        isLoadingAllowance: false,
        approve: mockApprove,
        approveExact: mockApproveExact,
      });

      render(<SwapCard />);
      expect(screen.getByTestId('approval-button')).toBeInTheDocument();
      expect(screen.getByText('Approve XLM')).toBeInTheDocument();
      expect(screen.getByText('Approve Exact')).toBeInTheDocument();
    });
  });

  describe('Confirmation Modal', () => {
    it('should open confirmation modal when Swap clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);

      const swapButton = screen.getByRole('button', { name: 'Swap' });
      await user.click(swapButton);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });

    it('should close confirmation modal when Close clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);

      // Open modal
      await user.click(screen.getByRole('button', { name: 'Swap' }));
      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();

      // Close modal
      await user.click(screen.getByText('Close'));
      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });

    it('should call swap and close modal when Confirm clicked', async () => {
      const user = userEvent.setup();

      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);

      // Open modal
      await user.click(screen.getByRole('button', { name: 'Swap' }));

      // Confirm swap
      await user.click(screen.getByText('Confirm'));

      await waitFor(() => {
        expect(mockSwap).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Tooltips', () => {
    it('should render Price Impact tooltip', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      const tooltips = screen.getAllByTestId('info-tooltip');
      expect(tooltips.length).toBeGreaterThan(0);
    });

    it('should render Minimum Received tooltip', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      // Multiple "Minimum Received" text exists (label + tooltip)
      expect(screen.getAllByText('Minimum Received').length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 0 rate calculation', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '0',
        priceImpact: 0,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      const { container } = render(<SwapCard />);
      // Should not crash with division by zero - check that component renders
      expect(container).toBeInTheDocument();
      expect(screen.getByText(/1 XLM/)).toBeInTheDocument();
      expect(screen.getByText(/≈/)).toBeInTheDocument();
    });

    it('should handle empty route', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      const { container } = render(<SwapCard />);
      expect(container).toBeInTheDocument();
    });

    it('should not render confirmation modal when tokens are null', () => {
      render(<SwapCard />);
      // Modal should not render if tokenIn or tokenOut is null
      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible switch button', () => {
      render(<SwapCard />);
      const switchButton = screen.getByRole('button', { name: 'Switch input and output tokens' });
      expect(switchButton).toHaveAccessibleName('Switch input and output tokens');
    });

    it('should have minimum touch target for switch button', () => {
      const { container } = render(<SwapCard />);
      const switchButton = container.querySelector('.min-w-\\[44px\\]');
      expect(switchButton).toBeInTheDocument();
    });

    it('should have sr-only text for high price impact', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '94',
        priceImpact: 6,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      render(<SwapCard />);
      expect(screen.getByText(/High price impact warning/i)).toHaveClass('sr-only');
    });

    it('should have aria-hidden for decorative icons', () => {
      vi.mocked(useSwap).mockReturnValue({
        amountIn: '100',
        amountOut: '99',
        priceImpact: 0.5,
        route: [mockXLM, mockUSDC],
        isLoadingQuote: false,
        isSwapping: false,
        isSimulating: false,
        setAmountIn: mockSetAmountIn,
        swap: mockSwap,
        switchTokens: mockSwitchTokens,
      });

      const { container } = render(<SwapCard />);
      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});
