/**
 * Pair Contract Client
 *
 * AMM liquidity pool for a token pair
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type { PairInfo, PairReserves, TransactionResult } from '../types';
import { getAmountOut, getAmountIn, calculatePriceImpact } from '../utils';

export class PairClient extends BaseContractClient {
  constructor(config: ContractClientConfig) {
    super(config);
  }

  // ==================== Read Methods ====================

  /**
   * Get pair info including reserves and total supply
   */
  async getPairInfo(): Promise<PairInfo> {
    const [token0, token1, reserves, totalSupply, feeBps] = await Promise.all([
      this.call<string>('token_0'),
      this.call<string>('token_1'),
      this.getReserves(),
      this.call<bigint>('total_supply'),
      this.call<number>('get_fee_bps'),
    ]);

    return {
      token0,
      token1,
      reserve0: reserves.reserve0,
      reserve1: reserves.reserve1,
      totalSupply,
      feeBps,
    };
  }

  /**
   * Get token addresses
   */
  async getTokens(): Promise<{ token0: string; token1: string }> {
    const [token0, token1] = await Promise.all([
      this.call<string>('token_0'),
      this.call<string>('token_1'),
    ]);
    return { token0, token1 };
  }

  /**
   * Get current reserves
   */
  async getReserves(): Promise<PairReserves> {
    const result = await this.call<{
      reserve_0: bigint;
      reserve_1: bigint;
      block_timestamp_last: number;
    }>('get_reserves');

    return {
      reserve0: result.reserve_0,
      reserve1: result.reserve_1,
      blockTimestampLast: result.block_timestamp_last,
    };
  }

  /**
   * Get total LP token supply
   */
  async getTotalSupply(): Promise<bigint> {
    return this.call<bigint>('total_supply');
  }

  /**
   * Get LP token balance for an address
   */
  async getBalance(account: string): Promise<bigint> {
    return this.call<bigint>('balance', this.addressToScVal(account));
  }

  /**
   * Get fee in basis points
   */
  async getFeeBps(): Promise<number> {
    return this.call<number>('get_fee_bps');
  }

  /**
   * Get k-last (product of reserves at last liquidity event)
   */
  async getKLast(): Promise<bigint> {
    return this.call<bigint>('k_last');
  }

  // ==================== Write Methods ====================

  /**
   * Swap tokens (low-level, prefer using Router)
   */
  async swap(
    amount0Out: bigint,
    amount1Out: bigint,
    to: string
  ): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'swap',
      this.i128ToScVal(amount0Out),
      this.i128ToScVal(amount1Out),
      this.addressToScVal(to)
    );
  }

  /**
   * Mint LP tokens (low-level, prefer using Router)
   */
  async mint(to: string): Promise<TransactionResult<bigint>> {
    return this.execute<bigint>('mint', this.addressToScVal(to));
  }

  /**
   * Burn LP tokens (low-level, prefer using Router)
   */
  async burn(to: string): Promise<TransactionResult<{ amount0: bigint; amount1: bigint }>> {
    return this.execute<{ amount0: bigint; amount1: bigint }>('burn', this.addressToScVal(to));
  }

  /**
   * Sync reserves with actual balances
   */
  async sync(): Promise<TransactionResult<void>> {
    return this.execute<void>('sync');
  }

  /**
   * Skim excess tokens to an address
   */
  async skim(to: string): Promise<TransactionResult<void>> {
    return this.execute<void>('skim', this.addressToScVal(to));
  }

  // ==================== Calculation Methods ====================

  /**
   * Calculate output amount for a swap
   */
  async calculateAmountOut(
    amountIn: bigint,
    tokenIn: string
  ): Promise<{ amountOut: bigint; priceImpactBps: number }> {
    const [{ token0 }, reserves, feeBps] = await Promise.all([
      this.getTokens(),
      this.getReserves(),
      this.getFeeBps(),
    ]);

    const isToken0 = tokenIn.toLowerCase() === token0.toLowerCase();
    const reserveIn = isToken0 ? reserves.reserve0 : reserves.reserve1;
    const reserveOut = isToken0 ? reserves.reserve1 : reserves.reserve0;

    const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);
    const priceImpactBps = calculatePriceImpact(amountIn, reserveIn, reserveOut, feeBps);

    return { amountOut, priceImpactBps };
  }

  /**
   * Calculate input amount needed for desired output
   */
  async calculateAmountIn(amountOut: bigint, tokenOut: string): Promise<bigint> {
    const [{ token0 }, reserves, feeBps] = await Promise.all([
      this.getTokens(),
      this.getReserves(),
      this.getFeeBps(),
    ]);

    const isToken0Out = tokenOut.toLowerCase() === token0.toLowerCase();
    const reserveIn = isToken0Out ? reserves.reserve1 : reserves.reserve0;
    const reserveOut = isToken0Out ? reserves.reserve0 : reserves.reserve1;

    return getAmountIn(amountOut, reserveIn, reserveOut, feeBps);
  }

  /**
   * Get current price (token1 per token0)
   */
  async getPrice(): Promise<{ price0: number; price1: number }> {
    const reserves = await this.getReserves();

    if (reserves.reserve0 === 0n || reserves.reserve1 === 0n) {
      return { price0: 0, price1: 0 };
    }

    const price0 = Number(reserves.reserve1) / Number(reserves.reserve0);
    const price1 = Number(reserves.reserve0) / Number(reserves.reserve1);

    return { price0, price1 };
  }

  /**
   * Calculate share of pool for LP tokens
   */
  async calculateShareOfPool(lpTokens: bigint): Promise<number> {
    const totalSupply = await this.getTotalSupply();
    if (totalSupply === 0n) return 0;
    return Number((lpTokens * 10000n) / totalSupply) / 100;
  }

  /**
   * Calculate withdrawal amounts for LP tokens
   */
  async calculateWithdrawalAmounts(
    lpTokens: bigint
  ): Promise<{ amount0: bigint; amount1: bigint }> {
    const [reserves, totalSupply] = await Promise.all([this.getReserves(), this.getTotalSupply()]);

    if (totalSupply === 0n) {
      return { amount0: 0n, amount1: 0n };
    }

    const amount0 = (lpTokens * reserves.reserve0) / totalSupply;
    const amount1 = (lpTokens * reserves.reserve1) / totalSupply;

    return { amount0, amount1 };
  }
}
