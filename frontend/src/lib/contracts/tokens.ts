/**
 * Token Contract Functions
 * Handles token approvals and interactions
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { buildAndSubmitTransaction } from '../stellar';
import { LEDGERS_PER_DAY } from '../constants';

/**
 * Token Contract - Approve spending
 */
export async function approveToken(
  tokenAddress: string,
  spender: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const { sorobanServer } = await import('../stellar');

    const contract = new StellarSdk.Contract(tokenAddress);

    const latestLedger = await sorobanServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    const daysToExpire = 7;
    const expirationLedger = currentLedger + (daysToExpire * LEDGERS_PER_DAY);

    const operation = contract.call(
      'approve',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(spender, { type: 'address' }),
      StellarSdk.nativeToScVal(amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(expirationLedger, { type: 'u32' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error approving token:', error);
    throw error;
  }
}
