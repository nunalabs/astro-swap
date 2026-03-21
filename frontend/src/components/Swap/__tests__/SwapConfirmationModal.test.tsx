import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { SwapConfirmationModal } from '../SwapConfirmationModal';
import type { Token } from '../../../types';

// Mock Modal
vi.mock('../../common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children, size, 'aria-describedby': ariaDescribedby }: any) =>
    isOpen ? (
      <div data-testid="confirmation-modal" role="dialog" aria-label={title} aria-describedby={ariaDescribedby} data-size={size}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock Button
vi.mock('../../common/Button', () => ({
  Button: forwardRef(
    ({ children, onClick, isLoading, disabled, variant, fullWidth, ...props }: any, ref: any) => (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled || isLoading}
        data-loading={isLoading}
        data-variant={variant}
        data-fullwidth={fullWidth}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    )
  ),
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
}));

// Mock utils
vi.mock('../../../lib/utils', () => ({
  formatPercent: (value: number, decimals: number) => `${value.toFixed(decimals)}%`,
}));

describe('SwapConfirmationModal', () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  const mockXLM: Token = {
    address: 'native',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    logoURI: 'https://example.com/xlm.png',
  };

  const mockUSDC: Token = {
    address: 'CUSDC...',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://example.com/usdc.png',
  };

  const mockASTRO: Token = {
    address: 'CASTRO...',
    symbol: 'ASTRO',
    name: 'Astro Token',
    decimals: 7,
  };

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    tokenIn: mockXLM,
    tokenOut: mockUSDC,
    amountIn: '100',
    amountOut: '50',
    priceImpact: 1.5,
    slippageTolerance: 0.5,
    minimumReceived: '49.75',
    route: [mockXLM, mockUSDC],
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(<SwapConfirmationModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByTestId('confirmation-modal')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('confirmation-modal')).toBeInTheDocument();
    });

    it('should have Confirm Swap title', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('dialog', { name: 'Confirm Swap' })).toBeInTheDocument();
    });

    it('should use small size', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByTestId('confirmation-modal')).toHaveAttribute('data-size', 'sm');
    });

    it('should have screen reader description', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(
        screen.getByText(/You are about to swap 100 XLM for approximately 50 USDC/)
      ).toBeInTheDocument();
    });

    it('should have sr-only class for description', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} />);

      const description = container.querySelector('.sr-only');
      expect(description).toBeInTheDocument();
    });
  });

  describe('Token Display', () => {
    it('should show token in amount and symbol', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('You pay')).toBeInTheDocument();
      expect(screen.getAllByText('XLM')[0]).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });

    it('should show token out amount and symbol', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('You receive')).toBeInTheDocument();
      expect(screen.getAllByText('USDC')[0]).toBeInTheDocument();
      expect(screen.getByText('50')).toBeInTheDocument();
    });

    it('should display token logo when available', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      const xlmLogo = screen.getByAltText('XLM logo');
      expect(xlmLogo).toHaveAttribute('src', 'https://example.com/xlm.png');

      const usdcLogo = screen.getByAltText('USDC logo');
      expect(usdcLogo).toHaveAttribute('src', 'https://example.com/usdc.png');
    });

    it('should show fallback when logo not available', () => {
      render(
        <SwapConfirmationModal
          {...defaultProps}
          tokenIn={{ ...mockXLM, logoURI: undefined }}
          tokenOut={{ ...mockUSDC, logoURI: undefined }}
        />
      );

      // Fallbacks show first letter of symbol
      const fallbacks = screen.getAllByText(/^[XU]$/);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('should show arrow between tokens', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} />);

      // Arrow SVG with down arrow path
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Swap Details', () => {
    it('should show exchange rate', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Rate')).toBeInTheDocument();
      // 50/100 = 0.5
      expect(screen.getByText(/1 XLM = 0.500000 USDC/)).toBeInTheDocument();
    });

    it('should show price impact', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Price Impact')).toBeInTheDocument();
      expect(screen.getByText('1.50%')).toBeInTheDocument();
    });

    it('should show slippage tolerance', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Slippage Tolerance')).toBeInTheDocument();
      expect(screen.getByText('0.5%')).toBeInTheDocument();
    });

    it('should show minimum received', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByText('Minimum Received')).toBeInTheDocument();
      expect(screen.getByText('49.75 USDC')).toBeInTheDocument();
    });

    it('should calculate rate correctly for different amounts', () => {
      render(<SwapConfirmationModal {...defaultProps} amountIn="200" amountOut="100" />);

      // 100/200 = 0.5
      expect(screen.getByText(/1 XLM = 0.500000 USDC/)).toBeInTheDocument();
    });
  });

  describe('Price Impact Colors', () => {
    it('should show green for low price impact (<2%)', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} priceImpact={1.5} />);

      const priceImpact = screen.getByText('1.50%');
      expect(priceImpact).toHaveClass('text-green');
    });

    it('should show primary color for medium price impact (2-5%)', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} priceImpact={3.5} />);

      const priceImpact = screen.getByText('3.50%');
      expect(priceImpact).toHaveClass('text-primary');
    });

    it('should show red for high price impact (>5%)', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      const priceImpact = screen.getByText('8.50%');
      expect(priceImpact).toHaveClass('text-red-500');
      expect(priceImpact).toHaveClass('font-semibold');
    });
  });

  describe('Route Display', () => {
    it('should not show route for direct swap (2 tokens)', () => {
      render(<SwapConfirmationModal {...defaultProps} route={[mockXLM, mockUSDC]} />);

      expect(screen.queryByText('Route')).not.toBeInTheDocument();
    });

    it('should show route for multi-hop swap (>2 tokens)', () => {
      render(
        <SwapConfirmationModal {...defaultProps} route={[mockXLM, mockASTRO, mockUSDC]} />
      );

      expect(screen.getByText('Route')).toBeInTheDocument();
    });

    it('should display all tokens in route', () => {
      render(
        <SwapConfirmationModal {...defaultProps} route={[mockXLM, mockASTRO, mockUSDC]} />
      );

      expect(screen.getAllByText('XLM').length).toBeGreaterThan(0);
      expect(screen.getByText('ASTRO')).toBeInTheDocument();
      expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
    });

    it('should show arrows between route tokens', () => {
      const { container } = render(
        <SwapConfirmationModal {...defaultProps} route={[mockXLM, mockASTRO, mockUSDC]} />
      );

      // Should have SVG arrows for route
      const arrows = container.querySelectorAll('svg');
      expect(arrows.length).toBeGreaterThan(0);
    });
  });

  describe('High Price Impact Warning', () => {
    it('should not show warning for low price impact', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={3} />);

      expect(screen.queryByText('High Price Impact Warning')).not.toBeInTheDocument();
    });

    it('should show warning for high price impact (>5%)', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      expect(screen.getByText('High Price Impact Warning')).toBeInTheDocument();
    });

    it('should have role="alert" for warning', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="polite" for warning', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
    });

    it('should show price impact percentage in warning', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      expect(
        screen.getByText(/This swap has a 8.50% price impact/)
      ).toBeInTheDocument();
    });

    it('should show warning icon', () => {
      const { container } = render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      const warningIcon = container.querySelector('.text-red-500.flex-shrink-0');
      expect(warningIcon).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should have Cancel button', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should have Confirm button', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Confirm Swap' })).toBeInTheDocument();
    });

    it('should show "Swap Anyway" for high price impact', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      expect(screen.getByRole('button', { name: 'Swap Anyway' })).toBeInTheDocument();
    });

    it('should call onClose when Cancel clicked', async () => {
      const user = userEvent.setup();
      render(<SwapConfirmationModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onConfirm when Confirm clicked', async () => {
      const user = userEvent.setup();
      render(<SwapConfirmationModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: 'Confirm Swap' }));

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it('should use danger variant for high price impact', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={8.5} />);

      const confirmButton = screen.getByRole('button', { name: 'Swap Anyway' });
      expect(confirmButton).toHaveAttribute('data-variant', 'danger');
    });

    it('should use primary variant for normal price impact', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={2} />);

      const confirmButton = screen.getByRole('button', { name: 'Confirm Swap' });
      expect(confirmButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Loading State', () => {
    it('should show loading on confirm button', () => {
      render(<SwapConfirmationModal {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should disable confirm button when loading', () => {
      render(<SwapConfirmationModal {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText('Loading...').closest('button');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable cancel button when loading', () => {
      render(<SwapConfirmationModal {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Transaction Notice', () => {
    it('should show transaction notice', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(
        screen.getByText(/Output is estimated. You will receive at least 49.75 USDC/)
      ).toBeInTheDocument();
    });

    it('should update notice with minimum received amount', () => {
      render(<SwapConfirmationModal {...defaultProps} minimumReceived="100.5" />);

      expect(screen.getByText(/You will receive at least 100.5 USDC/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have role="dialog" for modal', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-describedby linking to description', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'swap-confirmation-description');
    });

    it('should have proper alt text for token logos', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      expect(screen.getByAltText('XLM logo')).toBeInTheDocument();
      expect(screen.getByAltText('USDC logo')).toBeInTheDocument();
    });

    it('should have fullWidth buttons', () => {
      render(<SwapConfirmationModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      const confirmButton = screen.getByRole('button', { name: 'Confirm Swap' });

      expect(cancelButton).toHaveAttribute('data-fullwidth', 'true');
      expect(confirmButton).toHaveAttribute('data-fullwidth', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amounts gracefully', () => {
      render(<SwapConfirmationModal {...defaultProps} amountIn="0" amountOut="0" />);

      // Should display the amounts (multiple zeros)
      expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    });

    it('should handle very large amounts', () => {
      render(
        <SwapConfirmationModal {...defaultProps} amountIn="1000000" amountOut="500000" />
      );

      expect(screen.getByText('1000000')).toBeInTheDocument();
      expect(screen.getByText('500000')).toBeInTheDocument();
    });

    it('should handle very small amounts', () => {
      render(
        <SwapConfirmationModal {...defaultProps} amountIn="0.000001" amountOut="0.000002" />
      );

      expect(screen.getByText('0.000001')).toBeInTheDocument();
      expect(screen.getByText('0.000002')).toBeInTheDocument();
    });

    it('should handle exact 5% price impact threshold', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={5.0} />);

      // At exactly 5%, should NOT show warning (>5%)
      expect(screen.queryByText('High Price Impact Warning')).not.toBeInTheDocument();
    });

    it('should handle 5.01% price impact threshold', () => {
      render(<SwapConfirmationModal {...defaultProps} priceImpact={5.01} />);

      // Just above 5%, should show warning
      expect(screen.getByText('High Price Impact Warning')).toBeInTheDocument();
    });
  });
});
