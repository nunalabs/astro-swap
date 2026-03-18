import { motion } from 'framer-motion';
import { StakingCard } from '../components/Staking/StakingCard';
import { useWalletStore } from '../stores/walletStore';
import { useStakingPools } from '../hooks/useStakingPools';

export function Staking() {
  const isConnected = useWalletStore((state) => state.isConnected);
  const { pools, isLoading, error } = useStakingPools();

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
      ) : isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-6 bg-neutral-700 rounded mb-4"></div>
              <div className="h-4 bg-neutral-700 rounded mb-2"></div>
              <div className="h-4 bg-neutral-700 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2 text-red-500">Error Loading Pools</h3>
          <p className="text-neutral-400">{error instanceof Error ? error.message : 'Unknown error occurred'}</p>
        </div>
      ) : pools.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <StakingCard key={pool.address} pool={pool} />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">No Staking Pools Available</h3>
          <p className="text-neutral-400">Staking pools will be available soon. Check back later!</p>
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
