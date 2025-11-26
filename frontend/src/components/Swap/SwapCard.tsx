import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { TokenInput } from './TokenInput';
import { SwapSettings } from './SwapSettings';
import { useSwap } from '../../hooks/useSwap';
import { useWalletStore } from '../../stores/walletStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Token } from '../../types';
import { formatPercent } from '../../lib/utils';

export function SwapCard() {
  const [tokenIn, setTokenIn] = useState<Token | null>(null);
  const [tokenOut, setTokenOut] = useState<Token | null>(null);

  const isConnected = useWalletStore((state) => state.isConnected);
  const slippageTolerance = useSettingsStore((state) => state.slippageTolerance);

  const {
    amountIn,
    amountOut,
    priceImpact,
    route,
    isLoadingQuote,
    isSwapping,
    setAmountIn,
    swap,
    switchTokens,
  } = useSwap(tokenIn, tokenOut);

  const handleSwitchTokens = () => {
    const temp = tokenIn;
    setTokenIn(tokenOut);
    setTokenOut(temp);
    switchTokens();
  };

  const canSwap = isConnected && tokenIn && tokenOut && parseFloat(amountIn) > 0 && parseFloat(amountOut) > 0;

  return (
    <Card className="max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Swap</h2>
        <SwapSettings />
      </div>

      {/* Token Inputs */}
      <div className="space-y-2 mb-6">
        <TokenInput
          label="From"
          token={tokenIn}
          amount={amountIn}
          onTokenSelect={setTokenIn}
          onAmountChange={setAmountIn}
          excludeTokens={tokenOut ? [tokenOut.address] : []}
        />

        {/* Switch Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSwitchTokens}
            className="p-2 bg-card border border-neutral-700 rounded-xl hover:border-primary transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
          </motion.button>
        </div>

        <TokenInput
          label="To"
          token={tokenOut}
          amount={amountOut}
          onTokenSelect={setTokenOut}
          onAmountChange={() => {}} // Read-only
          excludeTokens={tokenIn ? [tokenIn.address] : []}
          readOnly
          showBalance={false}
        />
      </div>

      {/* Swap Details */}
      {tokenIn && tokenOut && parseFloat(amountIn) > 0 && (
        <div className="space-y-2 mb-6 p-4 bg-neutral-800/50 rounded-xl text-sm">
          {isLoadingQuote ? (
            <div className="flex items-center justify-center py-4">
              <div className="spinner" />
              <span className="ml-2 text-neutral-400">Fetching best rate...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between">
                <span className="text-neutral-400">Rate</span>
                <span className="font-medium">
                  1 {tokenIn.symbol} ≈{' '}
                  {parseFloat(amountOut) > 0 && parseFloat(amountIn) > 0
                    ? (parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)
                    : '0'}{' '}
                  {tokenOut.symbol}
                </span>
              </div>

              {route.length > 2 && (
                <div className="flex justify-between">
                  <span className="text-neutral-400">Route</span>
                  <span className="font-medium">
                    {route.map((t) => t.symbol).join(' → ')}
                  </span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-neutral-400">Price Impact</span>
                <span
                  className={`font-medium ${
                    priceImpact > 5 ? 'text-red-500' : priceImpact > 2 ? 'text-primary' : 'text-green'
                  }`}
                >
                  {formatPercent(priceImpact, 2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-400">Slippage Tolerance</span>
                <span className="font-medium">{slippageTolerance}%</span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-400">Minimum Received</span>
                <span className="font-medium">
                  {(parseFloat(amountOut) * (1 - slippageTolerance / 100)).toFixed(6)} {tokenOut.symbol}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Swap Button */}
      {!isConnected ? (
        <Button fullWidth disabled>
          Connect Wallet
        </Button>
      ) : !tokenIn || !tokenOut ? (
        <Button fullWidth disabled>
          Select Tokens
        </Button>
      ) : parseFloat(amountIn) === 0 ? (
        <Button fullWidth disabled>
          Enter Amount
        </Button>
      ) : (
        <Button onClick={swap} fullWidth isLoading={isSwapping} disabled={!canSwap}>
          {priceImpact > 5 ? 'Swap Anyway' : 'Swap'}
        </Button>
      )}

      {/* Warning for high price impact */}
      {priceImpact > 5 && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div className="flex gap-2">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="text-sm text-red-500">
              <p className="font-semibold">High Price Impact</p>
              <p className="text-red-400">This swap has a price impact of {priceImpact.toFixed(2)}%. You may receive significantly less than expected.</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
