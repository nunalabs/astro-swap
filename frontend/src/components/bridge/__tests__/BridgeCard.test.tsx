import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { BridgeCard } from '../BridgeCard';

// Mock Card
vi.mock('../../common/Card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock Button
vi.mock('../../common/Button', () => ({
  Button: forwardRef(
    ({ children, onClick, fullWidth, disabled, ...props }: any, ref: any) => (
      <button
        ref={ref}
        onClick={onClick}
        data-fullwidth={fullWidth}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  ),
}));

// Mock TokenSelector
vi.mock('../../common/TokenSelector', () => ({
  TokenSelector: ({ selectedToken, onSelect }: any) => (
    <button onClick={() => onSelect({ symbol: 'USDC', name: 'USD Coin' })}>
      {selectedToken ? selectedToken.symbol : 'Select Token'}
    </button>
  ),
}));

describe('BridgeCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render bridge card', () => {
      render(<BridgeCard />);

      expect(screen.getByText('Bridge Assets')).toBeInTheDocument();
    });

    it('should render heading with correct styling', () => {
      render(<BridgeCard />);

      const heading = screen.getByRole('heading', { name: 'Bridge Assets' });
      expect(heading).toHaveClass('text-2xl', 'font-bold', 'mb-6');
    });

    it('should render coming soon message', () => {
      render(<BridgeCard />);

      expect(
        screen.getByText('Cross-chain bridges are in development. Coming soon!')
      ).toBeInTheDocument();
    });

    it('should apply small text styling to coming soon message', () => {
      const { container } = render(<BridgeCard />);

      const message = container.querySelector('.text-xs');
      expect(message).toBeInTheDocument();
      expect(message).toHaveClass('text-neutral-400', 'text-center');
    });
  });

  describe('From Chain Selection', () => {
    it('should render From label', () => {
      render(<BridgeCard />);

      expect(screen.getByText('From')).toBeInTheDocument();
    });

    it('should default to Stellar for from chain', () => {
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      expect(fromSelect).toHaveValue('Stellar');
    });

    it('should render all chain options in from select', () => {
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      const options = Array.from(fromSelect.querySelectorAll('option'));

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveTextContent('Stellar');
      expect(options[1]).toHaveTextContent('Ethereum');
      expect(options[2]).toHaveTextContent('BSC');
      expect(options[3]).toHaveTextContent('Polygon');
    });

    it('should disable to chain in from options', () => {
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      const ethereumOption = Array.from(fromSelect.querySelectorAll('option')).find(
        (opt) => opt.textContent === 'Ethereum'
      );

      expect(ethereumOption).toBeDisabled();
    });

    it('should change from chain on selection', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(fromSelect, 'BSC');

      expect(fromSelect).toHaveValue('BSC');
    });
  });

  describe('To Chain Selection', () => {
    it('should render To label', () => {
      render(<BridgeCard />);

      expect(screen.getByText('To')).toBeInTheDocument();
    });

    it('should default to Ethereum for to chain', () => {
      render(<BridgeCard />);

      const toSelect = screen.getAllByRole('combobox')[1];
      expect(toSelect).toHaveValue('Ethereum');
    });

    it('should render all chain options in to select', () => {
      render(<BridgeCard />);

      const toSelect = screen.getAllByRole('combobox')[1];
      const options = Array.from(toSelect.querySelectorAll('option'));

      expect(options).toHaveLength(4);
    });

    it('should disable from chain in to options', () => {
      render(<BridgeCard />);

      const toSelect = screen.getAllByRole('combobox')[1];
      const stellarOption = Array.from(toSelect.querySelectorAll('option')).find(
        (opt) => opt.textContent === 'Stellar'
      );

      expect(stellarOption).toBeDisabled();
    });

    it('should change to chain on selection', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const toSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(toSelect, 'Polygon');

      expect(toSelect).toHaveValue('Polygon');
    });
  });

  describe('Swap Chains Button', () => {
    it('should render swap button', () => {
      const { container } = render(<BridgeCard />);

      const swapButton = container.querySelector('button[class*="bg-card"]');
      expect(swapButton).toBeInTheDocument();
    });

    it('should have swap icon', () => {
      const { container } = render(<BridgeCard />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-5', 'h-5');
    });

    it('should swap chains when clicked', async () => {
      const user = userEvent.setup();
      const { container } = render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      const toSelect = screen.getAllByRole('combobox')[1];

      expect(fromSelect).toHaveValue('Stellar');
      expect(toSelect).toHaveValue('Ethereum');

      const swapButton = container.querySelector('button[class*="bg-card"]');
      await user.click(swapButton!);

      expect(fromSelect).toHaveValue('Ethereum');
      expect(toSelect).toHaveValue('Stellar');
    });

    it('should swap chains twice correctly', async () => {
      const user = userEvent.setup();
      const { container } = render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      const toSelect = screen.getAllByRole('combobox')[1];
      const swapButton = container.querySelector('button[class*="bg-card"]');

      // First swap
      await user.click(swapButton!);
      expect(fromSelect).toHaveValue('Ethereum');
      expect(toSelect).toHaveValue('Stellar');

      // Second swap (back to original)
      await user.click(swapButton!);
      expect(fromSelect).toHaveValue('Stellar');
      expect(toSelect).toHaveValue('Ethereum');
    });

    it('should have hover effect class', () => {
      const { container } = render(<BridgeCard />);

      const swapButton = container.querySelector('button[class*="bg-card"]');
      expect(swapButton).toHaveClass('hover:border-primary');
    });
  });

  describe('Asset Input', () => {
    it('should render Asset label', () => {
      render(<BridgeCard />);

      expect(screen.getByText('Asset')).toBeInTheDocument();
    });

    it('should render amount input', () => {
      render(<BridgeCard />);

      const input = screen.getByPlaceholderText('0.0');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should update amount on input', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');

      expect(input).toHaveValue(100);
    });

    it('should render token selector', () => {
      render(<BridgeCard />);

      expect(screen.getByText('Select Token')).toBeInTheDocument();
    });

    it('should update token when selected', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const tokenButton = screen.getByText('Select Token');
      await user.click(tokenButton);

      expect(screen.getByText('USDC')).toBeInTheDocument();
    });

    it('should have flex gap layout', () => {
      const { container } = render(<BridgeCard />);

      const assetContainer = container.querySelector('.flex.gap-2');
      expect(assetContainer).toBeInTheDocument();
    });
  });

  describe('Fee Information', () => {
    it('should show bridge fee label', () => {
      render(<BridgeCard />);

      expect(screen.getByText('Bridge Fee')).toBeInTheDocument();
    });

    it('should show bridge fee value', () => {
      render(<BridgeCard />);

      expect(screen.getByText('0.1%')).toBeInTheDocument();
    });

    it('should show estimated time label', () => {
      render(<BridgeCard />);

      expect(screen.getByText('Estimated Time')).toBeInTheDocument();
    });

    it('should show estimated time value', () => {
      render(<BridgeCard />);

      expect(screen.getByText('~5 minutes')).toBeInTheDocument();
    });

    it('should have proper fee info styling', () => {
      const { container } = render(<BridgeCard />);

      const feeInfo = container.querySelector('.bg-neutral-800\\/50');
      expect(feeInfo).toBeInTheDocument();
      expect(feeInfo).toHaveClass('rounded-xl', 'space-y-2', 'text-sm');
    });

    it('should display fee items with space between', () => {
      const { container } = render(<BridgeCard />);

      const feeItems = container.querySelectorAll('.justify-between');
      expect(feeItems.length).toBeGreaterThan(0);
    });
  });

  describe('Bridge Button', () => {
    it('should render bridge button', () => {
      render(<BridgeCard />);

      expect(screen.getByRole('button', { name: 'Bridge' })).toBeInTheDocument();
    });

    it('should be disabled when no token selected', () => {
      render(<BridgeCard />);

      const bridgeButton = screen.getByRole('button', { name: 'Bridge' });
      expect(bridgeButton).toBeDisabled();
    });

    it('should be disabled when no amount entered', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const tokenButton = screen.getByText('Select Token');
      await user.click(tokenButton);

      const bridgeButton = screen.getByRole('button', { name: 'Bridge' });
      expect(bridgeButton).toBeDisabled();
    });

    it('should be enabled when both token and amount provided', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const tokenButton = screen.getByText('Select Token');
      await user.click(tokenButton);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');

      const bridgeButton = screen.getByRole('button', { name: 'Bridge' });
      expect(bridgeButton).not.toBeDisabled();
    });

    it('should have fullWidth prop', () => {
      render(<BridgeCard />);

      const bridgeButton = screen.getByRole('button', { name: 'Bridge' });
      expect(bridgeButton).toHaveAttribute('data-fullwidth', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper label elements', () => {
      const { container } = render(<BridgeCard />);

      const labels = container.querySelectorAll('label');
      expect(labels.length).toBe(3);
    });

    it('should have accessible heading', () => {
      render(<BridgeCard />);

      expect(screen.getByRole('heading', { name: 'Bridge Assets' })).toBeInTheDocument();
    });

    it('should have accessible selects', () => {
      render(<BridgeCard />);

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(2);
    });

    it('should have accessible button', () => {
      render(<BridgeCard />);

      expect(screen.getByRole('button', { name: 'Bridge' })).toBeInTheDocument();
    });

    it('should have proper label styling', () => {
      const { container } = render(<BridgeCard />);

      const labels = container.querySelectorAll('label');
      labels.forEach((label) => {
        expect(label).toHaveClass('text-sm', 'text-neutral-400', 'mb-2', 'block');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid chain swapping', async () => {
      const user = userEvent.setup();
      const { container } = render(<BridgeCard />);

      const swapButton = container.querySelector('button[class*="bg-card"]');

      // Rapid swaps
      await user.click(swapButton!);
      await user.click(swapButton!);
      await user.click(swapButton!);

      const fromSelect = screen.getAllByRole('combobox')[0];
      expect(fromSelect).toHaveValue('Ethereum');
    });

    it('should handle empty amount', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const tokenButton = screen.getByText('Select Token');
      await user.click(tokenButton);

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');
      await user.clear(input);

      const bridgeButton = screen.getByRole('button', { name: 'Bridge' });
      expect(bridgeButton).toBeDisabled();
    });

    it('should handle changing chains after selection', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      const toSelect = screen.getAllByRole('combobox')[1];

      await user.selectOptions(fromSelect, 'Polygon');
      await user.selectOptions(toSelect, 'BSC');

      expect(fromSelect).toHaveValue('Polygon');
      expect(toSelect).toHaveValue('BSC');
    });

    it('should maintain disabled state on opposite select', async () => {
      const user = userEvent.setup();
      render(<BridgeCard />);

      const fromSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(fromSelect, 'BSC');

      const toSelect = screen.getAllByRole('combobox')[1];
      const bscOption = Array.from(toSelect.querySelectorAll('option')).find(
        (opt) => opt.textContent === 'BSC'
      );

      expect(bscOption).toBeDisabled();
    });
  });
});
