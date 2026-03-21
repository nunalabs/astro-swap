import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { StakingCard } from '../StakingCard';
import { useStaking } from '../../../hooks/useStaking';
import type { StakingPool } from '../../../types';

// Mock useStaking hook
vi.mock('../../../hooks/useStaking');

// Mock Card
vi.mock('../../common/Card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
}));

// Mock Button
vi.mock('../../common/Button', () => ({
  Button: forwardRef(
    ({ children, onClick, variant, size, fullWidth, isLoading, ...props }: any, ref: any) => (
      <button
        ref={ref}
        onClick={onClick}
        data-variant={variant}
        data-size={size}
        data-fullwidth={fullWidth}
        disabled={isLoading}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    )
  ),
}));

// Mock Modal
vi.mock('../../common/Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock utils
vi.mock('../../../lib/utils', () => ({
  formatNumber: (num: number, decimals: number) => num.toFixed(decimals),
  formatPercent: (num: number, decimals: number) => `${num.toFixed(decimals)}%`,
  formatTokenAmount: (amount: string, decimals: number, displayDecimals: number) =>
    parseFloat(amount).toFixed(displayDecimals),
  isValidContractId: vi.fn(() => true),
}));

describe('StakingCard', () => {
  const mockStake = vi.fn();
  const mockUnstake = vi.fn();
  const mockClaimRewards = vi.fn();

  const mockPool: StakingPool = {
    address: 'CSTAKING123',
    lpToken: {
      address: 'CLPTOKEN',
      symbol: 'XLM-USDC LP',
      name: 'XLM-USDC Liquidity Pool',
      decimals: 7,
    },
    rewardToken: {
      address: 'CASTRO',
      symbol: 'ASTRO',
      name: 'Astro Token',
      decimals: 7,
    },
    totalStaked: '100000.5',
    rewardRate: '0.0001',
    apr: 25.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render staking card', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('XLM-USDC LP Staking')).toBeInTheDocument();
    });

    it('should show reward token info', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('Earn ASTRO')).toBeInTheDocument();
    });

    it('should display APR badge', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('25.50% APR')).toBeInTheDocument();
    });
  });

  describe('Pool Stats', () => {
    it('should show total staked', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('Total Staked')).toBeInTheDocument();
      expect(screen.getByText('100000.50')).toBeInTheDocument();
    });

    it('should show reward rate', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('Reward Rate')).toBeInTheDocument();
      expect(screen.getByText('0.0001/sec')).toBeInTheDocument();
    });
  });

  describe('User Staking Info', () => {
    it('should show user staked amount when available', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000.5',
          rewards: '50.25',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('Your Staked')).toBeInTheDocument();
      expect(screen.getByText('1000.5000')).toBeInTheDocument();
    });

    it('should show pending rewards when available', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000.5',
          rewards: '50.25',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByText('Pending Rewards')).toBeInTheDocument();
      expect(screen.getByText('50.2500')).toBeInTheDocument();
    });

    it('should not show user info when not staked', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.queryByText('Your Staked')).not.toBeInTheDocument();
      expect(screen.queryByText('Pending Rewards')).not.toBeInTheDocument();
    });

    it('should apply green color to rewards', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '50',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      const { container } = render(<StakingCard pool={mockPool} />);

      const rewardsElement = container.querySelector('.text-green');
      expect(rewardsElement).toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should show Stake button', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByRole('button', { name: 'Stake' })).toBeInTheDocument();
    });

    it('should show Unstake button', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByRole('button', { name: 'Unstake' })).toBeInTheDocument();
    });

    it('should show Claim Rewards button when has rewards', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '50',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.getByRole('button', { name: 'Claim Rewards' })).toBeInTheDocument();
    });

    it('should not show Claim Rewards when no rewards', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '0',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.queryByRole('button', { name: 'Claim Rewards' })).not.toBeInTheDocument();
    });

    it('should not show Claim Rewards when no stakeInfo', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      expect(screen.queryByRole('button', { name: 'Claim Rewards' })).not.toBeInTheDocument();
    });
  });

  describe('Stake Modal', () => {
    it('should open stake modal when Stake clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      expect(screen.getByRole('dialog', { name: 'Stake LP Tokens' })).toBeInTheDocument();
    });

    it('should have input in stake modal', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      const input = screen.getByPlaceholderText('0.0');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
    });

    it('should update stake amount on input', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');

      expect(input).toHaveValue(100);
    });

    it('should call stake when modal Stake button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');

      const modalStakeButton = screen.getAllByRole('button', { name: 'Stake' })[1];
      await user.click(modalStakeButton);

      expect(mockStake).toHaveBeenCalledWith({ amount: '100' });
    });

    it('should close stake modal after staking', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '100');

      const modalStakeButton = screen.getAllByRole('button', { name: 'Stake' })[1];
      await user.click(modalStakeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Unstake Modal', () => {
    it('should open unstake modal when Unstake clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Unstake' }));

      expect(screen.getByRole('dialog', { name: 'Unstake LP Tokens' })).toBeInTheDocument();
    });

    it('should call unstake when modal Unstake button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Unstake' }));

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '50');

      const modalUnstakeButton = screen.getAllByRole('button', { name: 'Unstake' })[1];
      await user.click(modalUnstakeButton);

      expect(mockUnstake).toHaveBeenCalledWith({ amount: '50' });
    });

    it('should close unstake modal after unstaking', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Unstake' }));

      const input = screen.getByPlaceholderText('0.0');
      await user.type(input, '50');

      const modalUnstakeButton = screen.getAllByRole('button', { name: 'Unstake' })[1];
      await user.click(modalUnstakeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading on stake button when staking', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: true,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Stake' }));

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading on unstake button when unstaking', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: true,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Unstake' }));

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading on claim button when claiming', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '50',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: true,
      });

      render(<StakingCard pool={mockPool} />);

      const claimButton = screen.getByRole('button', { name: 'Loading...' });
      expect(claimButton).toBeInTheDocument();
    });
  });

  describe('Claim Rewards', () => {
    it('should call claimRewards when Claim Rewards clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '50',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      await user.click(screen.getByRole('button', { name: 'Claim Rewards' }));

      expect(mockClaimRewards).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button variants', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: {
          staked: '1000',
          rewards: '50',
        },
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      const stakeButton = screen.getByRole('button', { name: 'Stake' });
      const unstakeButton = screen.getByRole('button', { name: 'Unstake' });
      const claimButton = screen.getByRole('button', { name: 'Claim Rewards' });

      expect(unstakeButton).toHaveAttribute('data-variant', 'secondary');
      expect(claimButton).toHaveAttribute('data-variant', 'outline');
    });

    it('should have small size buttons', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      const stakeButton = screen.getByRole('button', { name: 'Stake' });
      expect(stakeButton).toHaveAttribute('data-size', 'sm');
    });

    it('should have fullWidth buttons', () => {
      vi.mocked(useStaking).mockReturnValue({
        stakeInfo: null,
        stake: mockStake,
        unstake: mockUnstake,
        claimRewards: mockClaimRewards,
        isStaking: false,
        isUnstaking: false,
        isClaiming: false,
      });

      render(<StakingCard pool={mockPool} />);

      const stakeButton = screen.getByRole('button', { name: 'Stake' });
      expect(stakeButton).toHaveAttribute('data-fullwidth', 'true');
    });
  });
});
