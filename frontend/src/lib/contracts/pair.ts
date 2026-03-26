/**
 * Pair Contract Functions
 * Handles reserves, total supply, and pair data
 */

import { callContract } from '../stellar';
import type { ReservesResult, ReservesForPairResult, ReservesForSwapResult } from './types';

/**
 * Pair Contract - Get reserves
 * Returns tuple (reserve0, reserve1) from Soroban
 */
export async function getReserves(
  pairAddress: string,
  sourceAddress: string
): Promise<ReservesResult | null> {
  try {
    const result = await callContract(
      pairAddress,
      'get_reserves',
      [],
      sourceAddress
    );

    console.log('🔍 getReserves raw result:', {
      result,
      isArray: Array.isArray(result),
      length: Array.isArray(result) ? result.length : 'N/A',
    });

    if (Array.isArray(result) && result.length === 2) {
      const reserves = {
        reserve0: result[0]?.toString() || '0',
        reserve1: result[1]?.toString() || '0',
        timestamp: Date.now(),
      };
      console.log('✅ Parsed reserves:', reserves);
      return reserves;
    }

    console.warn('❌ Unexpected reserves format:', result);
    return null;
  } catch (error) {
    console.error('❌ Error getting reserves:', error);
    return null;
  }
}

/**
 * Pair Contract - Get total supply of LP tokens
 */
export async function getTotalSupply(
  pairAddress: string,
  sourceAddress: string
): Promise<string> {
  try {
    const result = await callContract(
      pairAddress,
      'total_supply',
      [],
      sourceAddress
    );
    return String(result);
  } catch (error) {
    console.error('Error getting total supply:', error);
    return '0';
  }
}

/**
 * Get reserves with tokens matched correctly
 * Ensures reserves are ALWAYS matched to the correct tokens
 */
export async function getReservesForPair(
  pairAddress: string,
  tokenA: string,
  tokenB: string,
  sourceAddress: string
): Promise<ReservesForPairResult | null> {
  try {
    console.log('🔍 getReservesForPair called:', {
      pairAddress: pairAddress.slice(0, 8) + '...',
      tokenA: tokenA.slice(0, 8) + '...',
      tokenB: tokenB.slice(0, 8) + '...',
    });

    const [reserves, token0, token1] = await Promise.all([
      getReserves(pairAddress, sourceAddress),
      callContract(pairAddress, 'token_0', [], sourceAddress) as Promise<string>,
      callContract(pairAddress, 'token_1', [], sourceAddress) as Promise<string>,
    ]);

    if (!reserves) {
      console.error('❌ Failed to fetch reserves');
      return null;
    }

    console.log('📊 Contract data:', {
      pairAddress: pairAddress.slice(0, 8) + '...',
      token0: token0.slice(0, 8) + '...',
      token1: token1.slice(0, 8) + '...',
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
    });

    let reserveA: string;
    let reserveB: string;

    if (tokenA === token0 && tokenB === token1) {
      reserveA = reserves.reserve0;
      reserveB = reserves.reserve1;
      console.log('✅ tokenA=token0, tokenB=token1');
    } else if (tokenA === token1 && tokenB === token0) {
      reserveA = reserves.reserve1;
      reserveB = reserves.reserve0;
      console.log('✅ tokenA=token1, tokenB=token0');
    } else {
      console.error('❌ Token mismatch!', { tokenA, tokenB, token0, token1 });
      return null;
    }

    return {
      reserveA,
      reserveB,
      token0,
      token1,
      timestamp: reserves.timestamp,
    };
  } catch (error) {
    console.error('❌ Error in getReservesForPair:', error);
    return null;
  }
}

/**
 * Get reserves for swap calculations with correct ordering
 */
export async function getReservesForSwap(
  pairAddress: string,
  tokenIn: string,
  tokenOut: string,
  sourceAddress: string
): Promise<ReservesForSwapResult | null> {
  const result = await getReservesForPair(pairAddress, tokenIn, tokenOut, sourceAddress);

  if (!result) {
    return null;
  }

  return {
    reserveIn: BigInt(result.reserveA),
    reserveOut: BigInt(result.reserveB),
  };
}
