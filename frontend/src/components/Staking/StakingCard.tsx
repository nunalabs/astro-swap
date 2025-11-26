import { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useStaking } from '../../hooks/useStaking';
import type { StakingPool } from '../../types';
import { formatNumber, formatPercent, formatTokenAmount } from '../../lib/utils';

interface StakingCardProps {
  pool: StakingPool;
}

export function StakingCard({ pool }: StakingCardProps) {
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');

  const { stakeInfo, stake, unstake, claimRewards, isStaking, isUnstaking, isClaiming } = useStaking(pool.address);

  const handleStake = () => {
    stake({ amount: stakeAmount });
    setStakeAmount('');
    setShowStakeModal(false);
  };

  const handleUnstake = () => {
    unstake({ amount: unstakeAmount });
    setUnstakeAmount('');
    setShowUnstakeModal(false);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">{pool.lpToken.symbol} Staking</h3>
            <p className="text-sm text-neutral-400">Earn {pool.rewardToken.symbol}</p>
          </div>
          <div className="badge-success text-lg">{formatPercent(pool.apr, 2)} APR</div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-neutral-400 mb-1">Total Staked</p>
            <p className="font-semibold">{formatNumber(parseFloat(pool.totalStaked), 2)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-400 mb-1">Reward Rate</p>
            <p className="font-semibold">{formatNumber(parseFloat(pool.rewardRate), 4)}/sec</p>
          </div>
        </div>

        {stakeInfo && (
          <div className="space-y-3 mb-6">
            <div className="p-4 bg-gradient-card rounded-xl">
              <p className="text-xs text-neutral-400 mb-1">Your Staked</p>
              <p className="text-xl font-bold">{formatTokenAmount(stakeInfo.staked, pool.lpToken.decimals, 4)}</p>
            </div>

            <div className="p-4 bg-gradient-card rounded-xl">
              <p className="text-xs text-neutral-400 mb-1">Pending Rewards</p>
              <p className="text-xl font-bold text-green">{formatTokenAmount(stakeInfo.rewards, pool.rewardToken.decimals, 4)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <Button onClick={() => setShowStakeModal(true)} size="sm" fullWidth>
            Stake
          </Button>
          <Button onClick={() => setShowUnstakeModal(true)} variant="secondary" size="sm" fullWidth>
            Unstake
          </Button>
        </div>

        {stakeInfo && parseFloat(stakeInfo.rewards) > 0 && (
          <Button onClick={() => claimRewards()} variant="outline" size="sm" fullWidth isLoading={isClaiming}>
            Claim Rewards
          </Button>
        )}
      </Card>

      {/* Stake Modal */}
      <Modal isOpen={showStakeModal} onClose={() => setShowStakeModal(false)} title="Stake LP Tokens">
        <div className="space-y-4">
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="0.0"
            className="input"
          />
          <Button onClick={handleStake} fullWidth isLoading={isStaking}>
            Stake
          </Button>
        </div>
      </Modal>

      {/* Unstake Modal */}
      <Modal isOpen={showUnstakeModal} onClose={() => setShowUnstakeModal(false)} title="Unstake LP Tokens">
        <div className="space-y-4">
          <input
            type="number"
            value={unstakeAmount}
            onChange={(e) => setUnstakeAmount(e.target.value)}
            placeholder="0.0"
            className="input"
          />
          <Button onClick={handleUnstake} fullWidth isLoading={isUnstaking}>
            Unstake
          </Button>
        </div>
      </Modal>
    </>
  );
}
