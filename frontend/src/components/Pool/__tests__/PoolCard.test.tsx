import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { PoolCard } from '../PoolCard';
import type { Pool } from '../../../types';

// Mock Card
vi.mock('../../common/Card', () => ({
  Card: ({ children, hover, className }: any) => (
    <div data-hover={hover} className={className}>
      {children}
    </div>
  ),
}));

// Mock Button
vi.mock('../../common/Button', () => ({
  Button: forwardRef(
    ({ children, onClick, variant, size, fullWidth, ...props }: any, ref: any) => (
      <button
        ref={ref}
        onClick={onClick}
        data-variant={variant}
        data-size={size}
        data-fullwidth={fullWidth}
        {...props}
      >
        {children}
      </button>
    )
  ),
}));

// Mock utils
vi.mock('../../../lib/utils', () => ({
  formatNumber: (num: number, decimals: number) => num.toFixed(decimals),
  formatCurrency: (num: number) => `$${num.toLocaleString()}`,
  formatPercent: (num: number, decimals: number) => `${num.toFixed(decimals)}%`,
}));

describe('PoolCard', () => {
  const mockOnAddLiquidity = vi.fn();
  const mockOnRemoveLiquidity = vi.fn();

  const mockPool: Pool = {
    address: 'CPOOL123',
    token0: {
      address: 'native',
      symbol: 'XLM',
      name: 'Stellar Lumens',
      decimals: 7,
      logoURI: 'https://example.com/xlm.png',
    },
    token1: {
      address: 'CUSDC',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      logoURI: 'https://example.com/usdc.png',
    },
    reserve0: '10000.5',
    reserve1: '5000.25',
    fee: 30,
    tvl: 15000.75,
    volume24h: 2500.50,
    apr: 12.5,
    userLiquidity: '100.5',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render pool card', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('XLM/USDC')).toBeInTheDocument();
    });

    it('should use Card component with hover', () => {
      const { container } = render(<PoolCard pool={mockPool} />);

      const card = container.querySelector('[data-hover="true"]');
      expect(card).toBeInTheDocument();
    });

    it('should apply padding class', () => {
      const { container } = render(<PoolCard pool={mockPool} />);

      const card = container.querySelector('.p-6');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Token Display', () => {
    it('should show token pair name', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('XLM/USDC')).toBeInTheDocument();
    });

    it('should show token logos when available', () => {
      render(<PoolCard pool={mockPool} />);

      const xlmLogo = screen.getByAltText('XLM');
      const usdcLogo = screen.getByAltText('USDC');

      expect(xlmLogo).toHaveAttribute('src', 'https://example.com/xlm.png');
      expect(usdcLogo).toHaveAttribute('src', 'https://example.com/usdc.png');
    });

    it('should not render logos when logoURI not available', () => {
      const poolWithoutLogos: Pool = {
        ...mockPool,
        token0: { ...mockPool.token0, logoURI: undefined },
        token1: { ...mockPool.token1, logoURI: undefined },
      };

      render(<PoolCard pool={poolWithoutLogos} />);

      expect(screen.queryByAltText('XLM')).not.toBeInTheDocument();
      expect(screen.queryByAltText('USDC')).not.toBeInTheDocument();
    });

    it('should show fee percentage', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('Fee: 0.3%')).toBeInTheDocument();
    });

    it('should calculate fee percentage correctly', () => {
      const poolWith25Fee: Pool = {
        ...mockPool,
        fee: 25,
      };

      render(<PoolCard pool={poolWith25Fee} />);

      expect(screen.getByText('Fee: 0.25%')).toBeInTheDocument();
    });
  });

  describe('APR Display', () => {
    it('should show APR badge when available', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('12.50% APR')).toBeInTheDocument();
    });

    it('should not show APR badge when not available', () => {
      const poolWithoutAPR: Pool = {
        ...mockPool,
        apr: undefined,
      };

      render(<PoolCard pool={poolWithoutAPR} />);

      expect(screen.queryByText(/APR/)).not.toBeInTheDocument();
    });

    it('should apply success badge class to APR', () => {
      const { container } = render(<PoolCard pool={mockPool} />);

      const aprBadge = container.querySelector('.badge-success');
      expect(aprBadge).toBeInTheDocument();
    });
  });

  describe('Pool Metrics', () => {
    it('should show TVL', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('TVL')).toBeInTheDocument();
      expect(screen.getByText('$15,000.75')).toBeInTheDocument();
    });

    it('should show 24h Volume', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('24h Volume')).toBeInTheDocument();
      expect(screen.getByText('$2,500.5')).toBeInTheDocument();
    });

    it('should show dash when TVL not available', () => {
      const poolWithoutTVL: Pool = {
        ...mockPool,
        tvl: undefined,
      };

      render(<PoolCard pool={poolWithoutTVL} />);

      const metrics = screen.getAllByText('-');
      expect(metrics.length).toBeGreaterThan(0);
    });

    it('should show dash when volume not available', () => {
      const poolWithoutVolume: Pool = {
        ...mockPool,
        volume24h: undefined,
      };

      render(<PoolCard pool={poolWithoutVolume} />);

      const metrics = screen.getAllByText('-');
      expect(metrics.length).toBeGreaterThan(0);
    });
  });

  describe('Reserves Display', () => {
    it('should show token0 reserve label', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('XLM Reserve')).toBeInTheDocument();
    });

    it('should show token1 reserve label', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('USDC Reserve')).toBeInTheDocument();
    });

    it('should show token0 reserve amount', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('10000.50')).toBeInTheDocument();
    });

    it('should show token1 reserve amount', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('5000.25')).toBeInTheDocument();
    });

    it('should use monospace font for reserves', () => {
      const { container } = render(<PoolCard pool={mockPool} />);

      const monoElements = container.querySelectorAll('.font-mono');
      expect(monoElements.length).toBeGreaterThan(0);
    });
  });

  describe('User Liquidity', () => {
    it('should show user liquidity when available', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByText('Your Liquidity')).toBeInTheDocument();
      expect(screen.getByText('100.5000')).toBeInTheDocument();
    });

    it('should not show user liquidity section when not available', () => {
      const poolWithoutUserLiquidity: Pool = {
        ...mockPool,
        userLiquidity: undefined,
      };

      render(<PoolCard pool={poolWithoutUserLiquidity} />);

      expect(screen.queryByText('Your Liquidity')).not.toBeInTheDocument();
    });

    it('should not show user liquidity when zero', () => {
      const poolWithZeroLiquidity: Pool = {
        ...mockPool,
        userLiquidity: '0',
      };

      render(<PoolCard pool={poolWithZeroLiquidity} />);

      expect(screen.queryByText('Your Liquidity')).not.toBeInTheDocument();
    });

    it('should show user liquidity with 4 decimal places', () => {
      const poolWithPreciseLiquidity: Pool = {
        ...mockPool,
        userLiquidity: '123.456789',
      };

      render(<PoolCard pool={poolWithPreciseLiquidity} />);

      expect(screen.getByText('123.4568')).toBeInTheDocument();
    });

    it('should apply gradient card styling to user liquidity', () => {
      const { container } = render(<PoolCard pool={mockPool} />);

      const liquiditySection = container.querySelector('.bg-gradient-card');
      expect(liquiditySection).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should always show Add Liquidity button', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByRole('button', { name: 'Add Liquidity' })).toBeInTheDocument();
    });

    it('should show Remove button when user has liquidity', () => {
      render(<PoolCard pool={mockPool} />);

      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('should not show Remove button when user has no liquidity', () => {
      const poolWithoutUserLiquidity: Pool = {
        ...mockPool,
        userLiquidity: undefined,
      };

      render(<PoolCard pool={poolWithoutUserLiquidity} />);

      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('should not show Remove button when liquidity is zero', () => {
      const poolWithZeroLiquidity: Pool = {
        ...mockPool,
        userLiquidity: '0',
      };

      render(<PoolCard pool={poolWithZeroLiquidity} />);

      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    });

    it('should use primary variant for Add Liquidity button', () => {
      render(<PoolCard pool={mockPool} />);

      const addButton = screen.getByRole('button', { name: 'Add Liquidity' });
      expect(addButton).toHaveAttribute('data-variant', 'primary');
    });

    it('should use secondary variant for Remove button', () => {
      render(<PoolCard pool={mockPool} />);

      const removeButton = screen.getByRole('button', { name: 'Remove' });
      expect(removeButton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should use small size for buttons', () => {
      render(<PoolCard pool={mockPool} />);

      const addButton = screen.getByRole('button', { name: 'Add Liquidity' });
      expect(addButton).toHaveAttribute('data-size', 'sm');
    });

    it('should use fullWidth for buttons', () => {
      render(<PoolCard pool={mockPool} />);

      const addButton = screen.getByRole('button', { name: 'Add Liquidity' });
      expect(addButton).toHaveAttribute('data-fullwidth', 'true');
    });
  });

  describe('Interactions', () => {
    it('should call onAddLiquidity when Add button clicked', async () => {
      const user = userEvent.setup();
      render(<PoolCard pool={mockPool} onAddLiquidity={mockOnAddLiquidity} />);

      await user.click(screen.getByRole('button', { name: 'Add Liquidity' }));

      expect(mockOnAddLiquidity).toHaveBeenCalled();
    });

    it('should call onRemoveLiquidity when Remove button clicked', async () => {
      const user = userEvent.setup();
      render(<PoolCard pool={mockPool} onRemoveLiquidity={mockOnRemoveLiquidity} />);

      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(mockOnRemoveLiquidity).toHaveBeenCalled();
    });

    it('should not throw when callbacks not provided', async () => {
      const user = userEvent.setup();
      render(<PoolCard pool={mockPool} />);

      const addButton = screen.getByRole('button', { name: 'Add Liquidity' });
      await user.click(addButton);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle pool with all optional fields missing', () => {
      const minimalPool: Pool = {
        address: 'CPOOL',
        token0: {
          address: 'native',
          symbol: 'XLM',
          name: 'Stellar Lumens',
          decimals: 7,
        },
        token1: {
          address: 'CUSDC',
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        },
        reserve0: '100',
        reserve1: '50',
        fee: 30,
      };

      render(<PoolCard pool={minimalPool} />);

      expect(screen.getByText('XLM/USDC')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Liquidity' })).toBeInTheDocument();
    });

    it('should handle very large reserve numbers', () => {
      const largePool: Pool = {
        ...mockPool,
        reserve0: '1000000000.123456',
        reserve1: '2000000000.654321',
      };

      render(<PoolCard pool={largePool} />);

      expect(screen.getByText('1000000000.12')).toBeInTheDocument();
      expect(screen.getByText('2000000000.65')).toBeInTheDocument();
    });

    it('should handle very small reserve numbers', () => {
      const smallPool: Pool = {
        ...mockPool,
        reserve0: '0.000001',
        reserve1: '0.000002',
      };

      render(<PoolCard pool={smallPool} />);

      // Should round to 0.00 (multiple instances)
      expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
    });

    it('should handle zero reserves', () => {
      const zeroPool: Pool = {
        ...mockPool,
        reserve0: '0',
        reserve1: '0',
      };

      render(<PoolCard pool={zeroPool} />);

      expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
    });

    it('should handle high fee percentage', () => {
      const highFeePool: Pool = {
        ...mockPool,
        fee: 100,
      };

      render(<PoolCard pool={highFeePool} />);

      expect(screen.getByText('Fee: 1%')).toBeInTheDocument();
    });
  });
});
