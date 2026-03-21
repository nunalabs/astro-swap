import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { ApprovalButton, ApprovalStatus } from '../ApprovalButton';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef(({ children, onClick, ...props }: any, ref: any) => (
      <div ref={ref} onClick={onClick} {...props}>
        {children}
      </div>
    )),
    button: forwardRef(({ children, onClick, ...props }: any, ref: any) => (
      <button ref={ref} onClick={onClick} {...props}>
        {children}
      </button>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('ApprovalButton', () => {
  const mockOnApprove = vi.fn().mockResolvedValue(undefined);
  const mockOnApproveExact = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering States', () => {
    it('should not render when approval not needed and not loading', () => {
      const { container } = render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={false}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render loading state when checking allowance', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={false}
          isApproving={false}
          isLoadingAllowance={true}
          onApprove={mockOnApprove}
        />
      );

      expect(screen.getByText('Checking approval...')).toBeInTheDocument();
    });

    it('should render approve button when approval needed', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      expect(screen.getByRole('button', { name: 'Approve USDC' })).toBeInTheDocument();
    });

    it('should render approving state', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={true}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      // Button shows "Loading..." when isLoading is true
      expect(screen.getByRole('button', { name: /Loading/ })).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should be disabled when loading allowance', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={false}
          isApproving={false}
          isLoadingAllowance={true}
          onApprove={mockOnApprove}
        />
      );

      const button = screen.getByText('Checking approval...').closest('button');
      expect(button).toBeDisabled();
    });

    it('should show spinner when loading allowance', () => {
      const { container } = render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={false}
          isApproving={false}
          isLoadingAllowance={true}
          onApprove={mockOnApprove}
        />
      );

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Approve Button', () => {
    it('should toggle options menu when clicked', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      const button = screen.getByRole('button', { name: 'Approve USDC' });
      await user.click(button);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should have aria-expanded attribute', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      const button = screen.getByRole('button', { name: 'Approve USDC' });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have aria-haspopup attribute', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      const button = screen.getByRole('button', { name: 'Approve USDC' });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
          disabled={true}
        />
      );

      const button = screen.getByRole('button', { name: 'Approve USDC' });
      expect(button).toBeDisabled();
    });

    it('should be disabled when approving', () => {
      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={true}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Options Menu', () => {
    it('should render Unlimited Approval option', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));

      expect(screen.getByText('Unlimited Approval')).toBeInTheDocument();
      expect(screen.getByText(/Approve once, swap anytime/)).toBeInTheDocument();
    });

    it('should render Exact Amount option when onApproveExact provided', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
          onApproveExact={mockOnApproveExact}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));

      expect(screen.getByText('Exact Amount')).toBeInTheDocument();
      expect(screen.getByText(/Only approve this transaction amount/)).toBeInTheDocument();
    });

    it('should not render Exact Amount option when onApproveExact not provided', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));

      expect(screen.queryByText('Exact Amount')).not.toBeInTheDocument();
    });

    it('should render Cancel option', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));

      expect(screen.getByRole('menuitem', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('should hide menu when approving', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      rerender(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={true}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Approval Actions', () => {
    it('should call onApprove when Unlimited Approval clicked', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      await user.click(screen.getByText('Unlimited Approval'));

      expect(mockOnApprove).toHaveBeenCalled();
    });

    it('should close menu after Unlimited Approval', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      await user.click(screen.getByText('Unlimited Approval'));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should call onApproveExact when Exact Amount clicked', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
          onApproveExact={mockOnApproveExact}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      await user.click(screen.getByText('Exact Amount'));

      expect(mockOnApproveExact).toHaveBeenCalled();
    });

    it('should close menu after Exact Amount approval', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
          onApproveExact={mockOnApproveExact}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      await user.click(screen.getByText('Exact Amount'));

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      });
    });

    it('should close menu when Cancel clicked', async () => {
      const user = userEvent.setup();

      render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Approve USDC' }));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(screen.getByRole('menuitem', { name: 'Cancel' }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <ApprovalButton
          tokenSymbol="USDC"
          needsApproval={true}
          isApproving={false}
          isLoadingAllowance={false}
          onApprove={mockOnApprove}
          className="custom-class"
        />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});

describe('ApprovalStatus', () => {
  describe('Approved State', () => {
    it('should render approved status', () => {
      render(<ApprovalStatus status="approved" tokenSymbol="USDC" />);

      expect(screen.getByText('USDC approved')).toBeInTheDocument();
    });

    it('should have role="status" for approved', () => {
      render(<ApprovalStatus status="approved" tokenSymbol="USDC" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render checkmark icon for approved', () => {
      const { container } = render(<ApprovalStatus status="approved" tokenSymbol="USDC" />);

      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should have green color for approved', () => {
      const { container } = render(<ApprovalStatus status="approved" tokenSymbol="USDC" />);

      const status = container.querySelector('.text-green');
      expect(status).toBeInTheDocument();
    });
  });

  describe('None State (Needs Approval)', () => {
    it('should render needs approval status', () => {
      render(<ApprovalStatus status="none" tokenSymbol="USDC" />);

      expect(screen.getByText('USDC needs approval')).toBeInTheDocument();
    });

    it('should have role="status" for none', () => {
      render(<ApprovalStatus status="none" tokenSymbol="USDC" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should render warning icon for none', () => {
      const { container } = render(<ApprovalStatus status="none" tokenSymbol="USDC" />);

      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should have yellow color for none', () => {
      const { container } = render(<ApprovalStatus status="none" tokenSymbol="USDC" />);

      const status = container.querySelector('.text-yellow-500');
      expect(status).toBeInTheDocument();
    });
  });

  describe('Pending State', () => {
    it('should render pending status', () => {
      render(<ApprovalStatus status="pending" tokenSymbol="USDC" />);

      expect(screen.getByText(/Approving USDC/)).toBeInTheDocument();
    });

    it('should render spinner for pending', () => {
      const { container } = render(<ApprovalStatus status="pending" tokenSymbol="USDC" />);

      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should have primary color for pending', () => {
      const { container } = render(<ApprovalStatus status="pending" tokenSymbol="USDC" />);

      const status = container.querySelector('.text-primary');
      expect(status).toBeInTheDocument();
    });
  });

  describe('Unknown and Error States', () => {
    it('should not render for unknown status', () => {
      const { container } = render(<ApprovalStatus status="unknown" tokenSymbol="USDC" />);

      expect(container.firstChild).toBeNull();
    });

    it('should not render for error status', () => {
      const { container } = render(<ApprovalStatus status="error" tokenSymbol="USDC" />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('Different Tokens', () => {
    it('should display correct token symbol', () => {
      render(<ApprovalStatus status="approved" tokenSymbol="XLM" />);

      expect(screen.getByText('XLM approved')).toBeInTheDocument();
    });

    it('should work with long token names', () => {
      render(<ApprovalStatus status="none" tokenSymbol="VERYLONGTOKEN" />);

      expect(screen.getByText('VERYLONGTOKEN needs approval')).toBeInTheDocument();
    });
  });
});
