import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { PoolCard } from '../components/Pool/PoolCard';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { TokenInput } from '../components/Swap/TokenInput';
import { usePool } from '../hooks/usePool';
import { useWalletStore } from '../stores/walletStore';
import { useSettingsStore } from '../stores/settingsStore';
import { parseTokenAmount } from '../lib/utils';
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

  // Find existing pool for selected token pair
  const existingPool = useMemo(() => {
    if (!tokenA || !tokenB) return null;

    return pools.find(pool =>
      (pool.token0.address === tokenA.address && pool.token1.address === tokenB.address) ||
      (pool.token1.address === tokenA.address && pool.token0.address === tokenB.address)
    );
  }, [pools, tokenA, tokenB]);

  // ✅ FIX: Detect if pool is empty (first liquidity)
  const isEmptyPool = useMemo(() => {
    if (!existingPool) return false;
    const reserve0 = BigInt(existingPool.reserve0);
    const reserve1 = BigInt(existingPool.reserve1);
    return reserve0 === 0n || reserve1 === 0n;
  }, [existingPool]);

  // Calculate optimal amount B based on amount A and pool ratio
  const calculateAmountB = useCallback((amountAValue: string) => {
    if (!existingPool || !amountAValue || parseFloat(amountAValue) === 0) {
      return '';
    }

    // Check if pool has liquidity
    const reserve0 = BigInt(existingPool.reserve0);
    const reserve1 = BigInt(existingPool.reserve1);

    // ✅ FIX: If pool is empty, don't auto-calculate (allow manual entry)
    if (reserve0 === 0n || reserve1 === 0n) {
      console.log('Empty pool - enter amounts manually to establish initial ratio');
      return ''; // Return empty but DON'T block manual input
    }

    try {
      const amountABigInt = BigInt(parseTokenAmount(amountAValue, tokenA!.decimals));

      let calculatedAmountB: bigint;

      // Check which token is which in the pool
      if (existingPool.token0.address === tokenA!.address) {
        // amountB = (amountA * reserve1) / reserve0
        calculatedAmountB = (amountABigInt * reserve1) / reserve0;
      } else {
        // amountB = (amountA * reserve0) / reserve1
        calculatedAmountB = (amountABigInt * reserve0) / reserve1;
      }

      // Convert back to human-readable format
      const decimals = tokenB!.decimals;
      const divisor = BigInt(10 ** decimals);
      const wholePart = calculatedAmountB / divisor;
      const fractionalPart = calculatedAmountB % divisor;

      return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`.replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error calculating amount B:', error);
      return '';
    }
  }, [existingPool, tokenA, tokenB]);

  // Calculate optimal amount A based on amount B and pool ratio
  const calculateAmountA = useCallback((amountBValue: string) => {
    if (!existingPool || !amountBValue || parseFloat(amountBValue) === 0) {
      return '';
    }

    // Check if pool has liquidity
    const reserve0 = BigInt(existingPool.reserve0);
    const reserve1 = BigInt(existingPool.reserve1);

    // ✅ FIX: If pool is empty, don't auto-calculate (allow manual entry)
    if (reserve0 === 0n || reserve1 === 0n) {
      console.log('Empty pool - enter amounts manually to establish initial ratio');
      return ''; // Return empty but DON'T block manual input
    }

    try {
      const amountBBigInt = BigInt(parseTokenAmount(amountBValue, tokenB!.decimals));
      const reserve0BigInt = reserve0;
      const reserve1BigInt = reserve1;

      let calculatedAmountA: bigint;

      // Check which token is which in the pool
      if (existingPool.token1.address === tokenB!.address) {
        // amountA = (amountB * reserve0) / reserve1
        calculatedAmountA = (amountBBigInt * reserve0BigInt) / reserve1BigInt;
      } else {
        // amountA = (amountB * reserve1) / reserve0
        calculatedAmountA = (amountBBigInt * reserve1BigInt) / reserve0BigInt;
      }

      // Convert back to human-readable format
      const decimals = tokenA!.decimals;
      const divisor = BigInt(10 ** decimals);
      const wholePart = calculatedAmountA / divisor;
      const fractionalPart = calculatedAmountA % divisor;

      return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`.replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error calculating amount A:', error);
      return '';
    }
  }, [existingPool, tokenA, tokenB]);

  // Handle amount A change with auto-calculation
  const handleAmountAChange = useCallback((value: string) => {
    setAmountA(value);

    // ✅ FIX: Only auto-calculate if pool has liquidity
    if (existingPool && value && parseFloat(value) > 0 && !isEmptyPool) {
      const calculatedB = calculateAmountB(value);
      if (calculatedB) {
        setAmountB(calculatedB);
      }
    }
  }, [existingPool, calculateAmountB, isEmptyPool]);

  // Handle amount B change with auto-calculation
  const handleAmountBChange = useCallback((value: string) => {
    setAmountB(value);

    // ✅ FIX: Only auto-calculate if pool has liquidity
    if (existingPool && value && parseFloat(value) > 0 && !isEmptyPool) {
      const calculatedA = calculateAmountA(value);
      if (calculatedA) {
        setAmountA(calculatedA);
      }
    }
  }, [existingPool, calculateAmountA, isEmptyPool]);

  // Calculate pool share and current price
  const poolInfo = useMemo(() => {
    if (!existingPool || !amountA || !amountB || !tokenA || !tokenB) return null;

    try {
      const reserve0 = BigInt(existingPool.reserve0);
      const reserve1 = BigInt(existingPool.reserve1);
      const totalSupply = BigInt(existingPool.totalSupply);

      // ✅ FIX: If pool is empty, show initial price based on user input
      if (reserve0 === 0n || reserve1 === 0n) {
        // Calculate initial price from user input
        const amountANum = parseFloat(amountA);
        const amountBNum = parseFloat(amountB);

        if (amountANum > 0 && amountBNum > 0) {
          const initialPrice = (amountBNum / amountANum).toFixed(6);
          return {
            price: `1 ${tokenA.symbol} = ${initialPrice} ${tokenB.symbol}`,
            sharePercent: '100.0000', // First LP owns 100%
            isInitialLiquidity: true,
          };
        }

        return null;
      }

      // Calculate current price (token1 per token0)
      let price: string;
      if (existingPool.token0.address === tokenA.address) {
        price = (Number(reserve1) / Number(reserve0)).toFixed(6);
      } else {
        price = (Number(reserve0) / Number(reserve1)).toFixed(6);
      }

      // Calculate share of pool after adding liquidity
      const amountABigInt = BigInt(parseTokenAmount(amountA, tokenA.decimals));
      const liquidity = (amountABigInt * totalSupply) / (existingPool.token0.address === tokenA.address ? reserve0 : reserve1);
      const sharePercent = Number((liquidity * 10000n) / (totalSupply + liquidity)) / 100;

      return {
        price: `1 ${tokenA.symbol} = ${price} ${tokenB.symbol}`,
        sharePercent: sharePercent.toFixed(4),
      };
    } catch (error) {
      console.error('Error calculating pool info:', error);
      return null;
    }
  }, [existingPool, tokenA, tokenB, amountA, amountB]);

  // Stable callbacks to prevent Modal re-renders
  const closeAddModal = useCallback(() => setShowAddModal(false), []);
  const closeRemoveModal = useCallback(() => setShowRemoveModal(false), []);

  const handleAddLiquidity = useCallback(() => {
    if (tokenA && tokenB && amountA && amountB) {
      addLiquidity(
        { tokenA, tokenB, amountA, amountB, slippage: slippageTolerance },
        {
          onSuccess: () => {
            setShowAddModal(false);
            setAmountA('');
            setAmountB('');
          },
        }
      );
    }
  }, [tokenA, tokenB, amountA, amountB, addLiquidity, slippageTolerance]);

  const handleRemoveLiquidity = useCallback(() => {
    if (selectedPool && removeAmount) {
      removeLiquidity(
        {
          tokenA: selectedPool.token0,
          tokenB: selectedPool.token1,
          liquidity: removeAmount,
          pool: selectedPool, // Pass pool data for slippage protection
        },
        {
          onSuccess: () => {
            // Close modal and reset form only on success
            setShowRemoveModal(false);
            setRemoveAmount('');
          },
          // On error, keep modal open so user can see the error toast and try again
        }
      );
    }
  }, [selectedPool, removeAmount, removeLiquidity]);

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
      <Modal isOpen={showAddModal} onClose={closeAddModal} title="Add Liquidity" size="md">
        <div className="space-y-4">
          {/* ✅ FIX: Initial Liquidity Banner */}
          {existingPool && isEmptyPool && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-yellow-400">First Liquidity</p>
                  <p className="text-yellow-300 mt-1">
                    This pool is empty. Enter both amounts manually to establish the initial ratio.
                  </p>
                  <p className="text-yellow-300 text-xs mt-1">
                    You'll be the first LP - receiving 100% of the pool
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pool Info Banner */}
          {existingPool && poolInfo && !poolInfo.isInitialLiquidity && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm">
                  <p className="font-semibold text-blue-400">Existing Pool</p>
                  <p className="text-blue-300 mt-1">
                    Current price: {poolInfo.price}
                  </p>
                  <p className="text-blue-300">
                    Your share: {poolInfo.sharePercent}% of pool
                  </p>
                </div>
              </div>
            </div>
          )}

          <TokenInput
            label="Token A"
            token={tokenA}
            amount={amountA}
            onTokenSelect={setTokenA}
            onAmountChange={handleAmountAChange}
            excludeTokens={tokenB ? [tokenB.address] : []}
          />

          {/* ✅ FIX: Only show auto-calc message if pool has liquidity */}
          {existingPool && !isEmptyPool && (
            <div className="flex justify-center -my-2 relative z-10">
              <div className="px-3 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-400">
                Auto-calculated based on pool ratio
              </div>
            </div>
          )}

          {/* ✅ FIX: Show manual input message for empty pool */}
          {existingPool && isEmptyPool && (
            <div className="flex justify-center -my-2 relative z-10">
              <div className="px-3 py-1 bg-yellow-800 border border-yellow-700 rounded-lg text-xs text-yellow-300">
                Ingrese ambos amounts manualmente
              </div>
            </div>
          )}

          <TokenInput
            label="Token B"
            token={tokenB}
            amount={amountB}
            onTokenSelect={setTokenB}
            onAmountChange={handleAmountBChange}
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
      <Modal isOpen={showRemoveModal} onClose={closeRemoveModal} title="Remove Liquidity" size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-neutral-400 mb-2 block">LP Token Amount</label>
            <input
              type="number"
              value={removeAmount}
              onChange={(e) => setRemoveAmount(e.target.value)}
              placeholder="0.0"
              className="input"
            />
            {selectedPool && (
              <p className="text-xs text-neutral-400 mt-1">
                Pool: {selectedPool.token0.symbol} / {selectedPool.token1.symbol}
              </p>
            )}
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
