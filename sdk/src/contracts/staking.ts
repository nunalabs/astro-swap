/**
 * Staking Contract Client
 *
 * Staking pools for LP tokens with reward distribution
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type { StakeInfo, PoolInfo, StakingConfig, TransactionResult } from '../types';

export class StakingClient extends BaseContractClient {
  constructor(config: ContractClientConfig) {
    super(config);
  }

  // ==================== Read Methods ====================

  /**
   * Get staking configuration
   */
  async getConfig(): Promise<StakingConfig> {
    const [admin, rewardToken, rewardPerSecond, totalAllocPoint] = await Promise.all([
      this.call<string>('get_admin'),
      this.call<string>('get_reward_token'),
      this.call<bigint>('get_reward_per_second'),
      this.call<bigint>('get_total_alloc_point'),
    ]);

    return {
      admin,
      rewardToken,
      rewardPerSecond,
      totalAllocPoint,
    };
  }

  /**
   * Get pool info
   */
  async getPool(poolId: number): Promise<PoolInfo | null> {
    try {
      const result = await this.call<{
        lp_token: string;
        alloc_point: bigint;
        last_reward_time: number;
        acc_reward_per_share: bigint;
        total_staked: bigint;
      }>('get_pool', this.u32ToScVal(poolId));

      return {
        lpToken: result.lp_token,
        allocPoint: result.alloc_point,
        lastRewardTime: result.last_reward_time,
        accRewardPerShare: result.acc_reward_per_share,
        totalStaked: result.total_staked,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all pools
   */
  async getAllPools(): Promise<PoolInfo[]> {
    const poolCount = await this.call<number>('get_pool_count');
    const pools: PoolInfo[] = [];

    for (let i = 0; i < poolCount; i++) {
      const pool = await this.getPool(i);
      if (pool) {
        pools.push(pool);
      }
    }

    return pools;
  }

  /**
   * Get user stake info
   */
  async getStakeInfo(poolId: number, user: string): Promise<StakeInfo | null> {
    try {
      const result = await this.call<{
        amount: bigint;
        staked_at: number;
        reward_debt: bigint;
        multiplier: number;
      }>('get_stake_info', this.u32ToScVal(poolId), this.addressToScVal(user));

      return {
        amount: result.amount,
        stakedAt: result.staked_at,
        rewardDebt: result.reward_debt,
        multiplier: result.multiplier,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get pending rewards for user
   */
  async getPendingRewards(poolId: number, user: string): Promise<bigint> {
    return this.call<bigint>(
      'pending_rewards',
      this.u32ToScVal(poolId),
      this.addressToScVal(user)
    );
  }

  /**
   * Get total staked in a pool
   */
  async getTotalStaked(poolId: number): Promise<bigint> {
    const pool = await this.getPool(poolId);
    return pool?.totalStaked ?? 0n;
  }

  /**
   * Get pool count
   */
  async getPoolCount(): Promise<number> {
    return this.call<number>('get_pool_count');
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    return this.call<boolean>('is_paused');
  }

  // ==================== Write Methods ====================

  /**
   * Initialize staking contract
   */
  async initialize(admin: string, rewardToken: string): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'initialize',
      this.addressToScVal(admin),
      this.addressToScVal(rewardToken)
    );
  }

  /**
   * Add a new staking pool
   */
  async addPool(
    lpToken: string,
    allocPoint: bigint,
    withUpdate: boolean = true
  ): Promise<TransactionResult<number>> {
    return this.execute<number>(
      'add_pool',
      this.addressToScVal(lpToken),
      this.i128ToScVal(allocPoint),
      this.boolToScVal(withUpdate)
    );
  }

  /**
   * Update pool allocation
   */
  async setPoolAlloc(
    poolId: number,
    allocPoint: bigint,
    withUpdate: boolean = true
  ): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'set_pool_alloc',
      this.u32ToScVal(poolId),
      this.i128ToScVal(allocPoint),
      this.boolToScVal(withUpdate)
    );
  }

  /**
   * Stake LP tokens
   */
  async stake(poolId: number, amount: bigint): Promise<TransactionResult<void>> {
    return this.execute<void>('stake', this.u32ToScVal(poolId), this.i128ToScVal(amount));
  }

  /**
   * Unstake LP tokens
   */
  async unstake(poolId: number, amount: bigint): Promise<TransactionResult<void>> {
    return this.execute<void>('unstake', this.u32ToScVal(poolId), this.i128ToScVal(amount));
  }

  /**
   * Claim pending rewards
   */
  async claim(poolId: number): Promise<TransactionResult<bigint>> {
    return this.execute<bigint>('claim', this.u32ToScVal(poolId));
  }

  /**
   * Emergency withdraw (no rewards)
   */
  async emergencyWithdraw(poolId: number): Promise<TransactionResult<bigint>> {
    return this.execute<bigint>('emergency_withdraw', this.u32ToScVal(poolId));
  }

  /**
   * Update reward per second
   */
  async setRewardPerSecond(rewardPerSecond: bigint): Promise<TransactionResult<void>> {
    return this.execute<void>('set_reward_per_second', this.i128ToScVal(rewardPerSecond));
  }

  /**
   * Pause/unpause contract
   */
  async setPaused(paused: boolean): Promise<TransactionResult<void>> {
    return this.execute<void>('set_paused', this.boolToScVal(paused));
  }

  // ==================== Helper Methods ====================

  /**
   * Convert boolean to ScVal
   */
  private boolToScVal(value: boolean) {
    const { xdr } = require('@stellar/stellar-sdk');
    return xdr.ScVal.scvBool(value);
  }

  /**
   * Calculate APR for a pool
   */
  async calculateAPR(
    poolId: number,
    rewardTokenPrice: number,
    lpTokenPrice: number
  ): Promise<number> {
    const [pool, config] = await Promise.all([this.getPool(poolId), this.getConfig()]);

    if (!pool || pool.totalStaked === 0n || config.totalAllocPoint === 0n) {
      return 0;
    }

    // Rewards per year for this pool
    const poolShareOfRewards =
      Number(pool.allocPoint) / Number(config.totalAllocPoint);
    const rewardsPerYear =
      Number(config.rewardPerSecond) * 365 * 24 * 3600 * poolShareOfRewards;
    const rewardValuePerYear = rewardsPerYear * rewardTokenPrice;

    // Total staked value
    const stakedValue = Number(pool.totalStaked) * lpTokenPrice;

    if (stakedValue === 0) return 0;

    return (rewardValuePerYear / stakedValue) * 100;
  }

  /**
   * Get user's staked amount across all pools
   */
  async getUserTotalStaked(user: string): Promise<Map<number, bigint>> {
    const poolCount = await this.getPoolCount();
    const stakes = new Map<number, bigint>();

    for (let i = 0; i < poolCount; i++) {
      const stakeInfo = await this.getStakeInfo(i, user);
      if (stakeInfo && stakeInfo.amount > 0n) {
        stakes.set(i, stakeInfo.amount);
      }
    }

    return stakes;
  }

  /**
   * Stake and auto-claim rewards
   */
  async stakeWithClaim(poolId: number, amount: bigint): Promise<TransactionResult<void>> {
    // First claim any pending rewards
    const pending = await this.getPendingRewards(
      poolId,
      this.keypair?.publicKey() || ''
    );

    if (pending > 0n) {
      await this.claim(poolId);
    }

    return this.stake(poolId, amount);
  }
}
