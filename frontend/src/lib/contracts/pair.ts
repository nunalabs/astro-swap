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

    if (Array.isArray(result) && result.length === 2) {
      const reserves = {
        reserve0: result[0]?.toString() || '0',
        reserve1: result[1]?.toString() || '0',
        timestamp: Date.now(),
      };
      return reserves;
    }

    return null;
  } catch (error) {
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
    const [reserves, token0, token1] = await Promise.all([
      getReserves(pairAddress, sourceAddress),
      callContract(pairAddress, 'token_0', [], sourceAddress) as Promise<string>,
      callContract(pairAddress, 'token_1', [], sourceAddress) as Promise<string>,
    ]);

    if (!reserves) {
      return null;
    }

    let reserveA: string;
    let reserveB: string;

    if (tokenA === token0 && tokenB === token1) {
      reserveA = reserves.reserve0;
      reserveB = reserves.reserve1;
    } else if (tokenA === token1 && tokenB === token0) {
      reserveA = reserves.reserve1;
      reserveB = reserves.reserve0;
    } else {
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
