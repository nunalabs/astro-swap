import { memo } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Token } from '../../types';
import { formatPercent } from '../../lib/utils';

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  slippageTolerance: number;
  minimumReceived: string;
  route: Token[];
  isLoading: boolean;
}

export const SwapConfirmationModal = memo(function SwapConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  priceImpact,
  slippageTolerance,
  minimumReceived,
  route,
  isLoading,
}: SwapConfirmationModalProps) {
  const isHighPriceImpact = priceImpact > 5;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Swap"
      size="sm"
      aria-describedby="swap-confirmation-description"
    >
      <div className="space-y-6">
        {/* Description for screen readers */}
        <p id="swap-confirmation-description" className="sr-only">
          You are about to swap {amountIn} {tokenIn.symbol} for approximately {amountOut} {tokenOut.symbol}.
          Please review the details below and confirm the transaction.
        </p>

        {/* Token amounts */}
        <div className="space-y-3">
          {/* From */}
          <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              {tokenIn.logoURI ? (
                <img
                  src={tokenIn.logoURI}
                  alt={`${tokenIn.symbol} logo`}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                  <span className="text-sm font-medium">{tokenIn.symbol[0]}</span>
                </div>
              )}
              <div>
                <p className="text-sm text-neutral-400">You pay</p>
                <p className="text-lg font-semibold">{tokenIn.symbol}</p>
              </div>
            </div>
            <p className="text-xl font-bold">{amountIn}</p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <motion.div
              initial={{ y: -5 }}
              animate={{ y: 5 }}
              transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.5 }}
              className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"
            >
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </motion.div>
          </div>

          {/* To */}
          <div className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl">
            <div className="flex items-center gap-3">
              {tokenOut.logoURI ? (
                <img
                  src={tokenOut.logoURI}
                  alt={`${tokenOut.symbol} logo`}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-700 flex items-center justify-center">
                  <span className="text-sm font-medium">{tokenOut.symbol[0]}</span>
                </div>
              )}
              <div>
                <p className="text-sm text-neutral-400">You receive</p>
                <p className="text-lg font-semibold">{tokenOut.symbol}</p>
              </div>
            </div>
            <p className="text-xl font-bold text-green">{amountOut}</p>
          </div>
        </div>

        {/* Route (if multi-hop) */}
        {route.length > 2 && (
          <div className="p-3 bg-neutral-800/30 rounded-xl">
            <p className="text-sm text-neutral-400 mb-2">Route</p>
            <div className="flex items-center gap-2 flex-wrap">
              {route.map((token, index) => (
                <div key={token.address} className="flex items-center gap-2">
                  <span className="text-sm font-medium">{token.symbol}</span>
                  {index < route.length - 1 && (
                    <svg className="w-4 h-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Swap details */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-400">Rate</span>
            <span>
              1 {tokenIn.symbol} = {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {tokenOut.symbol}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Price Impact</span>
            <span className={isHighPriceImpact ? 'text-red-500 font-semibold' : priceImpact > 2 ? 'text-primary' : 'text-green'}>
              {formatPercent(priceImpact, 2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Slippage Tolerance</span>
            <span>{slippageTolerance}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">Minimum Received</span>
            <span>{minimumReceived} {tokenOut.symbol}</span>
          </div>
        </div>

        {/* High price impact warning */}
        {isHighPriceImpact && (
          <div
            className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl"
            role="alert"
            aria-live="polite"
          >
            <div className="flex gap-3">
              <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="font-semibold text-red-500">High Price Impact Warning</p>
                <p className="text-sm text-red-400 mt-1">
                  This swap has a {priceImpact.toFixed(2)}% price impact. You may receive significantly less than expected.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            fullWidth
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant={isHighPriceImpact ? 'danger' : 'primary'}
            onClick={onConfirm}
            fullWidth
            isLoading={isLoading}
          >
            {isHighPriceImpact ? 'Swap Anyway' : 'Confirm Swap'}
          </Button>
        </div>

        {/* Transaction notice */}
        <p className="text-xs text-neutral-500 text-center">
          Output is estimated. You will receive at least {minimumReceived} {tokenOut.symbol} or the transaction will revert.
        </p>
      </div>
    </Modal>
  );
});
