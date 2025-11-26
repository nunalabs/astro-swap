import { motion } from 'framer-motion';
import { StakingCard } from '../components/Staking/StakingCard';
import { useWalletStore } from '../stores/walletStore';
import type { StakingPool } from '../types';

// Mock staking pools - replace with actual data
const MOCK_POOLS: StakingPool[] = [
  {
    address: 'POOL1',
    lpToken: { address: 'LP1', symbol: 'XLM-USDC LP', name: 'XLM-USDC LP Token', decimals: 7 },
    rewardToken: { address: 'ASTRO', symbol: 'ASTRO', name: 'AstroSwap Token', decimals: 7 },
    totalStaked: '1000000',
    rewardRate: '10',
    apr: 45.5,
    startTime: Date.now() - 86400000 * 30,
    endTime: Date.now() + 86400000 * 60,
  },
];

export function Staking() {
  const isConnected = useWalletStore((state) => state.isConnected);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto"
    >
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2 gradient-text">Staking Pools</h1>
        <p className="text-neutral-400">Stake LP tokens and earn rewards</p>
      </div>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-neutral-400">Connect your wallet to view and manage staking pools</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_POOLS.map((pool) => (
            <StakingCard key={pool.address} pool={pool} />
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-12 card p-8">
        <h2 className="text-2xl font-bold mb-6">How Staking Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <div className="text-3xl font-bold gradient-text mb-2">1</div>
            <h3 className="font-semibold mb-2">Provide Liquidity</h3>
            <p className="text-sm text-neutral-400">
              Add liquidity to a pool to receive LP tokens
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold gradient-text mb-2">2</div>
            <h3 className="font-semibold mb-2">Stake LP Tokens</h3>
            <p className="text-sm text-neutral-400">
              Stake your LP tokens in a staking pool
            </p>
          </div>
          <div>
            <div className="text-3xl font-bold gradient-text mb-2">3</div>
            <h3 className="font-semibold mb-2">Earn Rewards</h3>
            <p className="text-sm text-neutral-400">
              Claim your rewards anytime while earning APR
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
