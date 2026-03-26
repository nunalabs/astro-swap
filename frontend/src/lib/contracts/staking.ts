/**
 * Staking Contract Functions
 * Handles LP token staking, rewards, and pool management
 */

import * as StellarSdk from '@stellar/stellar-sdk';
import { callContract, buildAndSubmitTransaction } from '../stellar';
import { CONTRACTS } from './config';
import type { ContractStakingPool } from './types';

/**
 * Staking Contract - Get pool count
 */
export async function getStakingPoolCount(sourceAddress: string): Promise<number> {
  try {
    const result = await callContract(
      CONTRACTS.STAKING,
      'pool_count',
      [],
      sourceAddress
    );
    return Number(result);
  } catch (error) {
    console.error('Error getting staking pool count:', error);
    return 0;
  }
}

/**
 * Staking Contract - Get pool info
 */
export async function getStakingPoolInfo(
  poolId: number,
  sourceAddress: string
): Promise<ContractStakingPool | null> {
  try {
    const poolIdScVal = StellarSdk.nativeToScVal(poolId, { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'pool_info',
      [poolIdScVal],
      sourceAddress
    );

    return result;
  } catch (error) {
    console.error(`Error getting staking pool info for pool ${poolId}:`, error);
    return null;
  }
}

/**
 * Staking Contract - Get pending rewards for user
 */
export async function getPendingRewards(
  poolId: number,
  userAddress: string,
  sourceAddress: string
): Promise<string> {
  try {
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });
    const poolIdScVal = StellarSdk.nativeToScVal(poolId, { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'pending_rewards',
      [userScVal, poolIdScVal],
      sourceAddress
    );

    return String(result);
  } catch (error) {
    console.error('Error getting pending rewards:', error);
    return '0';
  }
}

/**
 * Staking Contract - Stake LP tokens
 */
export async function stake(
  poolId: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'stake',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' }),
      StellarSdk.nativeToScVal(amount, { type: 'i128' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error staking:', error);
    throw error;
  }
}

/**
 * Staking Contract - Unstake LP tokens
 */
export async function unstake(
  poolId: string,
  amount: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'unstake',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' }),
      StellarSdk.nativeToScVal(amount, { type: 'i128' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error unstaking:', error);
    throw error;
  }
}

/**
 * Staking Contract - Claim rewards
 */
export async function claimRewards(
  poolId: string,
  sourceAddress: string
): Promise<string> {
  try {
    const contract = new StellarSdk.Contract(CONTRACTS.STAKING);

    const operation = contract.call(
      'claim_rewards',
      StellarSdk.nativeToScVal(sourceAddress, { type: 'address' }),
      StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' })
    );

    return await buildAndSubmitTransaction(sourceAddress, [operation]);
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}

/**
 * Staking Contract - Get user stake info
 */
export async function getUserStakeInfo(
  poolId: string,
  userAddress: string,
  sourceAddress: string
): Promise<{ staked: string; rewards: string } | null> {
  try {
    const userScVal = StellarSdk.nativeToScVal(userAddress, { type: 'address' });
    const poolIdScVal = StellarSdk.nativeToScVal(Number(poolId), { type: 'u32' });

    const result = await callContract(
      CONTRACTS.STAKING,
      'user_info',
      [userScVal, poolIdScVal],
      sourceAddress
    );

    return result as { staked: string; rewards: string };
  } catch (error) {
    console.error('Error getting user stake info:', error);
    return null;
  }
}
