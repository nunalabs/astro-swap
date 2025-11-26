import { useState } from 'react';
import { motion } from 'framer-motion';
import { PoolCard } from '../components/Pool/PoolCard';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { TokenInput } from '../components/Swap/TokenInput';
import { usePool } from '../hooks/usePool';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { Token, Pool } from '../types';

export function Pool() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  const [tokenA, setTokenA] = useState<Token | null>(null);
  const [tokenB, setTokenB] = useState<Token | null>(null);
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [removeAmount, setRemoveAmount] = useState('');

  const isConnected = useWalletStore((state) => state.isConnected);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);

  const { pools, isLoading, addLiquidity, removeLiquidity, isAddingLiquidity, isRemovingLiquidity } = usePool();

  const handleAddLiquidity = () => {
    if (tokenA && tokenB && amountA && amountB) {
      addLiquidity({ tokenA, tokenB, amountA, amountB, slippage: slippageTolerance });
      setShowAddModal(false);
      setAmountA('');
      setAmountB('');
    }
  };

  const handleRemoveLiquidity = () => {
    if (selectedPool && removeAmount) {
      removeLiquidity({
        tokenA: selectedPool.token0,
        tokenB: selectedPool.token1,
        liquidity: removeAmount,
      });
      setShowRemoveModal(false);
      setRemoveAmount('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 gradient-text">Liquidity Pools</h1>
          <p className="text-neutral-400">Provide liquidity and earn trading fees</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          Add Liquidity
        </Button>
      </div>

      {!isConnected ? (
        <div className="card p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
          <p className="text-neutral-400">Connect your wallet to view and manage liquidity pools</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
          <span className="ml-2">Loading pools...</span>
        </div>
      ) : pools.length === 0 ? (
        <div className="card p-12 text-center">
          <h3 className="text-xl font-semibold mb-2">No Pools Found</h3>
          <p className="text-neutral-400 mb-4">Be the first to create a liquidity pool</p>
          <Button onClick={() => setShowAddModal(true)}>
            Create Pool
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pools.map((pool) => (
            <PoolCard
              key={pool.address}
              pool={pool}
              onAddLiquidity={() => {
                setTokenA(pool.token0);
                setTokenB(pool.token1);
                setShowAddModal(true);
              }}
              onRemoveLiquidity={() => {
                setSelectedPool(pool);
                setShowRemoveModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Add Liquidity Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Liquidity" size="md">
        <div className="space-y-4">
          <TokenInput
            label="Token A"
            token={tokenA}
            amount={amountA}
            onTokenSelect={setTokenA}
            onAmountChange={setAmountA}
            excludeTokens={tokenB ? [tokenB.address] : []}
          />

          <TokenInput
            label="Token B"
            token={tokenB}
            amount={amountB}
            onTokenSelect={setTokenB}
            onAmountChange={setAmountB}
            excludeTokens={tokenA ? [tokenA.address] : []}
          />

          <Button
            onClick={handleAddLiquidity}
            fullWidth
            isLoading={isAddingLiquidity}
            disabled={!tokenA || !tokenB || !amountA || !amountB}
          >
            Add Liquidity
          </Button>
        </div>
      </Modal>

      {/* Remove Liquidity Modal */}
      <Modal isOpen={showRemoveModal} onClose={() => setShowRemoveModal(false)} title="Remove Liquidity" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-neutral-400 mb-2 block">Amount</label>
            <input
              type="number"
              value={removeAmount}
              onChange={(e) => setRemoveAmount(e.target.value)}
              placeholder="0.0"
              className="input"
            />
          </div>

          <Button
            onClick={handleRemoveLiquidity}
            fullWidth
            isLoading={isRemovingLiquidity}
            disabled={!removeAmount}
          >
            Remove Liquidity
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
