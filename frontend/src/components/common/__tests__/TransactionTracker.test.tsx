import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { TransactionTracker, PendingTransactionIndicator } from '../TransactionTracker';
import { useTransactionStore } from '../../../stores/transactionStore';
import type { Transaction } from '../../../types';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef(({ children, className, initial, animate, exit, transition, role, ...props }: any, ref: any) => (
      <div ref={ref} className={className} role={role} {...props}>
        {children}
      </div>
    )),
    button: forwardRef(({ children, className, onClick, whileHover, whileTap, ...props }: any, ref: any) => (
      <button ref={ref} className={className} onClick={onClick} {...props}>
        {children}
      </button>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock transaction store
vi.mock('../../../stores/transactionStore');

describe('TransactionTracker', () => {
  const mockTransactions: Transaction[] = [
    {
      hash: 'tx1',
      status: 'pending',
      timestamp: Date.now() - 30000, // 30 seconds ago
      details: {
        type: 'swap',
        tokenIn: 'XLM',
        tokenOut: 'USDC',
        amountIn: '100',
        amountOut: '50',
      },
    },
    {
      hash: 'tx2',
      status: 'success',
      timestamp: Date.now() - 120000, // 2 minutes ago
      details: {
        type: 'add_liquidity',
        tokenA: 'XLM',
        tokenB: 'USDC',
        amountA: '100',
        amountB: '50',
      },
    },
    {
      hash: 'tx3',
      status: 'failed',
      timestamp: Date.now() - 3600000, // 1 hour ago
      details: {
        type: 'stake',
        token: 'XLM',
        amount: '100',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        transactions: [],
        pendingCount: 0,
      };
      return selector(state);
    });
  });

  describe('Rendering', () => {
    it('should not render when no transactions', () => {
      const { container } = render(<TransactionTracker />);

      expect(container.firstChild).toBeNull();
    });

    it('should render when transactions exist', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      expect(container.firstChild).not.toBeNull();
    });

    it('should be fixed at bottom right', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const wrapper = container.querySelector('.fixed.bottom-4.right-4');
      expect(wrapper).toBeInTheDocument();
    });

    it('should have high z-index', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const wrapper = container.querySelector('.z-50');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Floating Button - Pending State', () => {
    it('should show pending count when pending transactions exist', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 2,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      expect(screen.getByText('2 Pending')).toBeInTheDocument();
    });

    it('should show spinner when pending', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should show notification badge when pending', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 3,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const badge = container.querySelector('.absolute.-top-1.-right-1');
      expect(badge).toBeInTheDocument();
    });

    it('should show pending count in notification badge', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 5,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const badgeNumber = container.querySelector('.bg-primary.text-\\[10px\\]');
      expect(badgeNumber).toHaveTextContent('5');
    });

    it('should have aria-label for pending transactions', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 2,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      const button = screen.getByRole('button', { name: '2 pending transactions' });
      expect(button).toBeInTheDocument();
    });
  });

  describe('Floating Button - Success State', () => {
    it('should show success icon when no pending transactions', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: [mockTransactions[1]], // success transaction
          pendingCount: 0,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const successIcon = container.querySelector('.text-green');
      expect(successIcon).toBeInTheDocument();
    });

    it('should show Transactions text when no pending', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: [mockTransactions[1]],
          pendingCount: 0,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      expect(screen.getByText('Transactions')).toBeInTheDocument();
    });

    it('should not show notification badge when no pending', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: [mockTransactions[1]],
          pendingCount: 0,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      const badge = container.querySelector('.absolute.-top-1.-right-1');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('Transaction Panel', () => {
    it('should open panel when button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.getByRole('dialog', { name: 'Recent transactions' })).toBeInTheDocument();
    });

    it('should have Recent Transactions heading', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('heading', { name: 'Recent Transactions' })).toBeInTheDocument();
    });

    it('should have close button in panel', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button', { name: /pending/ }));

      expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
    });

    it('should close panel when close button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button', { name: /pending/ }));
      await user.click(screen.getByRole('button', { name: 'Close panel' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should show up to 10 transactions', async () => {
      const user = userEvent.setup();
      const manyTransactions: Transaction[] = Array.from({ length: 15 }, (_, i) => ({
        hash: `tx${i}`,
        status: 'success' as const,
        timestamp: Date.now() - i * 60000,
        details: {
          type: 'swap' as const,
          tokenIn: 'XLM',
          tokenOut: 'USDC',
          amountIn: '100',
          amountOut: '50',
        },
      }));

      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: manyTransactions,
          pendingCount: 0,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      const txRows = container.querySelectorAll('.hover\\:bg-neutral-800\\/50');
      expect(txRows.length).toBe(10);
    });

    it('should show footer when more than 10 transactions', async () => {
      const user = userEvent.setup();
      const manyTransactions: Transaction[] = Array.from({ length: 15 }, (_, i) => ({
        hash: `tx${i}`,
        status: 'success' as const,
        timestamp: Date.now(),
        details: {
          type: 'swap' as const,
          tokenIn: 'XLM',
          tokenOut: 'USDC',
          amountIn: '100',
          amountOut: '50',
        },
      }));

      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: manyTransactions,
          pendingCount: 0,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByText('Showing 10 of 15 transactions')).toBeInTheDocument();
    });

    it('should not show footer when 10 or fewer transactions', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions.slice(0, 5),
          pendingCount: 0,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      expect(screen.queryByText(/Showing 10 of/)).not.toBeInTheDocument();
    });
  });

  describe('Transaction Row', () => {
    beforeEach(async () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const user = userEvent.setup();
      render(<TransactionTracker />);
      await user.click(screen.getByRole('button'));
    });

    it('should show Swap type', () => {
      expect(screen.getByText('Swap')).toBeInTheDocument();
    });

    it('should show Add Liquidity type', () => {
      expect(screen.getByText('Add Liquidity')).toBeInTheDocument();
    });

    it('should show Stake type', () => {
      expect(screen.getByText('Stake')).toBeInTheDocument();
    });

    it('should show relative time', () => {
      const timeTexts = screen.getAllByText(/ago/);
      expect(timeTexts.length).toBeGreaterThan(0);
    });

    it('should have explorer link', () => {
      const links = screen.getAllByRole('link', { name: 'View on explorer' });
      expect(links.length).toBeGreaterThan(0);
      expect(links[0]).toHaveAttribute('target', '_blank');
      expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should have correct explorer URL', () => {
      const links = screen.getAllByRole('link', { name: 'View on explorer' });
      expect(links[0]).toHaveAttribute(
        'href',
        'https://testnet.stellarchain.io/transactions/tx1'
      );
    });
  });

  describe('Status Icons', () => {
    it('should show pending icon for pending transactions', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);
      await user.click(screen.getByRole('button'));

      const pendingIcons = container.querySelectorAll('.bg-primary\\/20');
      expect(pendingIcons.length).toBeGreaterThan(0);
    });

    it('should show success icon for success transactions', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);
      await user.click(screen.getByRole('button'));

      const successIcons = container.querySelectorAll('.bg-green\\/20');
      expect(successIcons.length).toBeGreaterThan(0);
    });

    it('should show failed icon for failed transactions', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);
      await user.click(screen.getByRole('button'));

      const failedIcons = container.querySelectorAll('.bg-red-500\\/20');
      expect(failedIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Status Badges', () => {
    beforeEach(async () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const user = userEvent.setup();
      render(<TransactionTracker />);
      await user.click(screen.getByRole('button'));
    });

    it('should show Pending badge', () => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should show Success badge', () => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });

    it('should show Failed badge', () => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should have animate ping on pending badge', () => {
      const { container } = render(<TransactionTracker />);
      const pingElements = container.querySelectorAll('.animate-ping');
      expect(pingElements.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-expanded on button', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-haspopup on button', () => {
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });

    it('should have dialog role on panel', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-label on panel', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      expect(screen.getByRole('dialog', { name: 'Recent transactions' })).toBeInTheDocument();
    });

    it('should hide decorative icons from screen readers', async () => {
      const user = userEvent.setup();
      vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
        const state = {
          transactions: mockTransactions,
          pendingCount: 1,
        };
        return selector(state);
      });

      const { container } = render(<TransactionTracker />);

      await user.click(screen.getByRole('button'));

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });
  });
});

describe('PendingTransactionIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when no pending transactions', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 0,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    expect(container.firstChild).toBeNull();
  });

  it('should render when pending transactions exist', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 1,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    expect(container.firstChild).not.toBeNull();
  });

  it('should show pending count', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 3,
      };
      return selector(state);
    });

    render(<PendingTransactionIndicator />);

    expect(screen.getByText('3 pending')).toBeInTheDocument();
  });

  it('should have spinner', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 1,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should have status role', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 1,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    const status = container.querySelector('[role="status"]');
    expect(status).toBeInTheDocument();
  });

  it('should have aria-live polite', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 1,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    const status = container.querySelector('[aria-live="polite"]');
    expect(status).toBeInTheDocument();
  });

  it('should hide spinner from screen readers', () => {
    vi.mocked(useTransactionStore).mockImplementation((selector: any) => {
      const state = {
        pendingCount: 1,
      };
      return selector(state);
    });

    const { container } = render(<PendingTransactionIndicator />);

    const spinner = container.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });
});
