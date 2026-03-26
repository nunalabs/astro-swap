/**
 * Contract Types and Configuration
 * Shared types and contract addresses for all contract modules
 */

import type { Token, Pool } from '../../types';

/**
 * Staking contract types (raw contract responses)
 */
export interface ContractStakingPool {
  pool_id: number;
  lp_token: string;
  reward_token: string;
  total_staked: bigint;
  reward_per_second: bigint;
  start_time: bigint;
  end_time: bigint;
  last_update_time: bigint;
  acc_reward_per_share: bigint;
}

export interface ContractUserStake {
  amount: bigint;
  reward_debt: bigint;
  stake_time: bigint;
  multiplier: number;
}

export interface ReservesResult {
  reserve0: string;
  reserve1: string;
  timestamp: number;
}

export interface ReservesForPairResult {
  reserveA: string;
  reserveB: string;
  token0: string;
  token1: string;
  timestamp: number;
}

export interface ReservesForSwapResult {
  reserveIn: bigint;
  reserveOut: bigint;
}

export { Token, Pool };
