/**
 * Router Contract Functions
 * Handles swaps, liquidity operations, and amount calculations
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { buildAndSubmitTransaction } from '../stellar';
import { CONTRACTS } from './config';
import { getPairAddress } from './factory';
import { getReservesForSwap } from './pair';

/**
 * Calculate amount out using constant product formula
 * Fee is 30 bps (0.3%)
 */
function calculateAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps = 30n
): bigint {
  if (reserveIn === 0n || reserveOut === 0n) return 0n;

  const amountInWithFee = amountIn * (10000n - feeBps);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;

  return numerator / denominator;
}

/**
 * Get amounts out for a path - OPTIMIZED with batch RPC calls
 */
export async function getAmountsOut(
  amountIn: string,
  path: string[],
  sourceAddress: string
): Promise<string[]> {
  try {
    if (path.length < 2) {
      console.error('Path must have at least 2 tokens');
      return [];
    }

    // Step 1: Get all pair addresses in parallel
    const pairPromises = [];
    for (let i = 0; i < path.length - 1; i++) {
      pairPromises.push(getPairAddress(path[i], path[i + 1], sourceAddress));
    }

    const pairAddresses = await Promise.all(pairPromises);

    for (let i = 0; i < pairAddresses.length; i++) {
      if (!pairAddresses[i]) {
        console.error('Pair not found for', path[i], '->', path[i + 1]);
        return [];
      }
    }

    // Step 2: Get all reserves in parallel
    const reservesPromises = [];
    for (let i = 0; i < path.length - 1; i++) {
      reservesPromises.push(
        getReservesForSwap(pairAddresses[i]!, path[i], path[i + 1], sourceAddress)
      );
    }

    const reservesList = await Promise.all(reservesPromises);

    for (let i = 0; i < reservesList.length; i++) {
      if (!reservesList[i]) {
        console.error('Could not get reserves for hop', i);
        return [];
      }
    }

    // Step 3: Calculate amounts locally
    const amounts: string[] = [amountIn];
    let currentAmount = BigInt(amountIn);

    for (let i = 0; i < path.length - 1; i++) {
      const { reserveIn, reserveOut } = reservesList[i]!;

      console.log(`🔄 Swap hop ${i}: ${path[i].slice(0, 8)}... → ${path[i + 1].slice(0, 8)}...`);
      console.log(`💰 Reserves:`, {
        reserveIn: reserveIn.toString(),
        reserveOut: reserveOut.toString(),
      });

      const amountOut = calculateAmountOut(currentAmount, reserveIn, reserveOut);
      console.log(`📈 Amount out:`, amountOut.toString());

      amounts.push(amountOut.toString());
      currentAmount = amountOut;
    }

    return amounts;
  } catch (error) {
    console.error('Error getting amounts out:', error);
    return [];
  }
}

/**
 * Router Contract - Swap exact tokens for tokens
 */
export async function swapExactTokensForTokens(
  amountIn: string,
  amountOutMin: string,
  path: string[],
  _to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const userScVal = StellarSdk.nativeToScVal(sourceAddress, { type: 'address' });
    const amountInScVal = StellarSdk.nativeToScVal(amountIn, { type: 'i128' });
    const amountOutMinScVal = StellarSdk.nativeToScVal(amountOutMin, { type: 'i128' });
    const pathScVal = StellarSdk.xdr.ScVal.scvVec(
      path.map(addr => StellarSdk.nativeToScVal(addr, { type: 'address' }))
    );
    const deadlineScVal = StellarSdk.nativeToScVal(deadline, { type: 'u64' });

    const operation = contract.call(
      'swap_exact_tokens_for_tokens',
      userScVal,
      amountInScVal,
      amountOutMinScVal,
      pathScVal,
      deadlineScVal
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error swapping tokens:', error);
    throw error;
  }
}

/**
 * Router Contract - Add liquidity
 */
export async function addLiquidity(
  tokenA: string,
  tokenB: string,
  amountADesired: string,
  amountBDesired: string,
  amountAMin: string,
  amountBMin: string,
  _to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const operation = contract.call(
      'add_liquidity',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(amountADesired, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBDesired, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(deadline, { type: 'u64' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error adding liquidity:', error);
    throw error;
  }
}

/**
 * Router Contract - Remove liquidity
 */
export async function removeLiquidity(
  tokenA: string,
  tokenB: string,
  liquidity: string,
  amountAMin: string,
  amountBMin: string,
  _to: string,
  deadline: number,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.ROUTER);

    const operation = contract.call(
      'remove_liquidity',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenA, { type: 'address' }),
      StellarSdk.nativeToScVal(tokenB, { type: 'address' }),
      StellarSdk.nativeToScVal(liquidity, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountAMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(amountBMin, { type: 'i128' }),
      StellarSdk.nativeToScVal(deadline, { type: 'u64' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error removing liquidity:', error);
    throw error;
  }
}
