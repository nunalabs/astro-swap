/**
 * Pool Amounts Calculator Hook
 *
 * Handles optimal amount calculations for liquidity provision.
 * Extracted from Pool.tsx for better separation of concerns.
 */

import { useMemo, useCallback } from 'react';
import { parseTokenAmount } from '../lib/utils';
import type { Pool, Token } from '../types';

export function usePoolAmounts(
  pool: Pool | null | undefined,
  tokenA: Token | null,
  tokenB: Token | null
) {
  /**
   * Detect if pool is empty (first liquidity)
   */
  const isEmptyPool = useMemo(() => {
    if (!pool) return false;
    const reserve0 = BigInt(pool.reserve0);
    const reserve1 = BigInt(pool.reserve1);
    return reserve0 === 0n || reserve1 === 0n;
  }, [pool]);

  /**
   * Calculate optimal amount B based on amount A and pool ratio
   */
  const calculateAmountB = useCallback((amountAValue: string): string => {
    if (!pool || !amountAValue || parseFloat(amountAValue) === 0) {
      return '';
    }

    // Check if pool has liquidity
    const reserve0 = BigInt(pool.reserve0);
    const reserve1 = BigInt(pool.reserve1);

    // If pool is empty, don't auto-calculate (allow manual entry)
    if (reserve0 === 0n || reserve1 === 0n) {
      console.log('Empty pool - enter amounts manually to establish initial ratio');
      return '';
    }

    if (!tokenA || !tokenB) return '';

    try {
      const amountABigInt = BigInt(parseTokenAmount(amountAValue, tokenA.decimals));

      let calculatedAmountB: bigint;

      // Check which token is which in the pool
      if (pool.token0.address === tokenA.address) {
        // amountB = (amountA * reserve1) / reserve0
        calculatedAmountB = (amountABigInt * reserve1) / reserve0;
      } else {
        // amountB = (amountA * reserve0) / reserve1
        calculatedAmountB = (amountABigInt * reserve0) / reserve1;
      }

      // Convert back to human-readable format
      const decimals = tokenB.decimals;
      const divisor = BigInt(10 ** decimals);
      const wholePart = calculatedAmountB / divisor;
      const fractionalPart = calculatedAmountB % divisor;

      return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`.replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error calculating amount B:', error);
      return '';
    }
  }, [pool, tokenA, tokenB]);

  /**
   * Calculate optimal amount A based on amount B and pool ratio
   */
  const calculateAmountA = useCallback((amountBValue: string): string => {
    if (!pool || !amountBValue || parseFloat(amountBValue) === 0) {
      return '';
    }

    // Check if pool has liquidity
    const reserve0 = BigInt(pool.reserve0);
    const reserve1 = BigInt(pool.reserve1);

    // If pool is empty, don't auto-calculate (allow manual entry)
    if (reserve0 === 0n || reserve1 === 0n) {
      console.log('Empty pool - enter amounts manually to establish initial ratio');
      return '';
    }

    if (!tokenA || !tokenB) return '';

    try {
      const amountBBigInt = BigInt(parseTokenAmount(amountBValue, tokenB.decimals));

      let calculatedAmountA: bigint;

      // Check which token is which in the pool
      if (pool.token1.address === tokenB.address) {
        // amountA = (amountB * reserve0) / reserve1
        calculatedAmountA = (amountBBigInt * reserve0) / reserve1;
      } else {
        // amountA = (amountB * reserve1) / reserve0
        calculatedAmountA = (amountBBigInt * reserve1) / reserve0;
      }

      // Convert back to human-readable format
      const decimals = tokenA.decimals;
      const divisor = BigInt(10 ** decimals);
      const wholePart = calculatedAmountA / divisor;
      const fractionalPart = calculatedAmountA % divisor;

      return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0')}`.replace(/\.?0+$/, '');
    } catch (error) {
      console.error('Error calculating amount A:', error);
      return '';
    }
  }, [pool, tokenA, tokenB]);

  return {
    isEmptyPool,
    calculateAmountA,
    calculateAmountB,
  };
}
