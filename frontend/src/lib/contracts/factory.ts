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
    console.log('🔍 Fetching total pairs from factory:', CONTRACTS.FACTORY);

    const totalPairs = await callContract(
      CONTRACTS.FACTORY,
      'all_pairs_length',
      [],
      sourceAddress
    ) as number;

    console.log(`📊 Factory reports ${totalPairs} total pairs`);

    if (totalPairs === 0) {
      console.log('⚠️ No pairs exist in factory yet');
      return [];
    }

    const allPairs: string[] = [];
    const batchSize = 100;

    for (let start = 0; start < totalPairs; start += batchSize) {
      const limit = Math.min(batchSize, totalPairs - start);
      console.log(`📥 Fetching pairs batch: start=${start}, limit=${limit}`);

      const startScVal = StellarSdk.nativeToScVal(start, { type: 'u32' });
      const limitScVal = StellarSdk.nativeToScVal(limit, { type: 'u32' });

      const batch = await callContract(
        CONTRACTS.FACTORY,
        'get_pairs_paginated',
        [startScVal, limitScVal],
        sourceAddress
      ) as string[];

      console.log(`✅ Received ${batch.length} pair addresses in batch`);
      allPairs.push(...batch);
    }

    return allPairs;
  } catch (error) {
    console.error('Error getting all pairs:', error);
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

    console.log('🏭 Factory.get_pair result:', {
      token0: token0.substring(0, 8) + '...',
      token1: token1.substring(0, 8) + '...',
      pairAddress: result ? (result as string).substring(0, 8) + '...' : null,
    });

    return result as string;
  } catch (error) {
    console.error('Error getting pair address:', error);
    return null;
  }
}
