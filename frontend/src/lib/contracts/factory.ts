/**
 * Factory Contract Functions
 * Handles pair creation and discovery
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { callContract } from '../stellar';
import { CONTRACTS } from './config';

/**
 * Factory Contract - Get all pairs using pagination
 */
export async function getAllPairs(sourceAddress: string): Promise<string[]> {
  try {
    const totalPairs = await callContract(
      CONTRACTS.FACTORY,
      'all_pairs_length',
      [],
      sourceAddress
    ) as number;

    if (totalPairs === 0) {
      return [];
    }

    const allPairs: string[] = [];
    const batchSize = 100;

    for (let start = 0; start < totalPairs; start += batchSize) {
      const limit = Math.min(batchSize, totalPairs - start);

      const startScVal = StellarSdk.nativeToScVal(start, { type: 'u32' });
      const limitScVal = StellarSdk.nativeToScVal(limit, { type: 'u32' });

      const batch = await callContract(
        CONTRACTS.FACTORY,
        'get_pairs_paginated',
        [startScVal, limitScVal],
        sourceAddress
      ) as string[];

      allPairs.push(...batch);
    }

    return allPairs;
  } catch (error) {
    return [];
  }
}

/**
 * Factory Contract - Get pair address for token pair
 */
export async function getPairAddress(
  token0: string,
  token1: string,
  sourceAddress: string
): Promise<string | null> {
  try {
    const token0ScVal = StellarSdk.nativeToScVal(token0, { type: 'address' });
    const token1ScVal = StellarSdk.nativeToScVal(token1, { type: 'address' });

    const result = await callContract(
      CONTRACTS.FACTORY,
      'get_pair',
      [token0ScVal, token1ScVal],
      sourceAddress
    );

    return result as string;
  } catch (error) {
    return null;
  }
}
