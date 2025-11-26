/**
 * Router Contract Client
 *
 * High-level swap and liquidity operations
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type {
  SwapExactTokensParams,
  SwapTokensForExactParams,
  AddLiquidityParams,
  AddLiquidityResult,
  RemoveLiquidityParams,
  RemoveLiquidityResult,
  SwapQuote,
  TransactionResult,
} from '../types';
import { getDeadline, withSlippage, DEFAULT_DEADLINE_SECONDS } from '../utils';

export interface RouterClientConfig extends ContractClientConfig {
  factoryAddress: string;
}

export class RouterClient extends BaseContractClient {
  public readonly factoryAddress: string;

  constructor(config: RouterClientConfig) {
    super(config);
    this.factoryAddress = config.factoryAddress;
  }

  // ==================== Read Methods ====================

  /**
   * Get amounts out for a path
   */
  async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]> {
    const pathScVal = this.vecToScVal(path.map((addr) => this.addressToScVal(addr)));
    return this.call<bigint[]>('get_amounts_out', this.i128ToScVal(amountIn), pathScVal);
  }

  /**
   * Get amounts in for a path
   */
  async getAmountsIn(amountOut: bigint, path: string[]): Promise<bigint[]> {
    const pathScVal = this.vecToScVal(path.map((addr) => this.addressToScVal(addr)));
    return this.call<bigint[]>('get_amounts_in', this.i128ToScVal(amountOut), pathScVal);
  }

  /**
   * Get factory address
   */
  async getFactory(): Promise<string> {
    return this.call<string>('factory');
  }

  /**
   * Check if initialized
   */
  async isInitialized(): Promise<boolean> {
    return this.call<boolean>('is_initialized');
  }

  // ==================== Write Methods ====================

  /**
   * Initialize the router
   */
  async initialize(factory: string, admin: string): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'initialize',
      this.addressToScVal(factory),
      this.addressToScVal(admin)
    );
  }

  /**
   * Swap exact tokens for tokens
   */
  async swapExactTokensForTokens(
    params: SwapExactTokensParams
  ): Promise<TransactionResult<bigint[]>> {
    const pathScVal = this.vecToScVal(params.path.map((addr) => this.addressToScVal(addr)));

    return this.execute<bigint[]>(
      'swap_exact_tokens_for_tokens',
      this.i128ToScVal(params.amountIn),
      this.i128ToScVal(params.amountOutMin),
      pathScVal,
      this.addressToScVal(params.to),
      this.u32ToScVal(params.deadline)
    );
  }

  /**
   * Swap tokens for exact tokens
   */
  async swapTokensForExactTokens(
    params: SwapTokensForExactParams
  ): Promise<TransactionResult<bigint[]>> {
    const pathScVal = this.vecToScVal(params.path.map((addr) => this.addressToScVal(addr)));

    return this.execute<bigint[]>(
      'swap_tokens_for_exact_tokens',
      this.i128ToScVal(params.amountOut),
      this.i128ToScVal(params.amountInMax),
      pathScVal,
      this.addressToScVal(params.to),
      this.u32ToScVal(params.deadline)
    );
  }

  /**
   * Add liquidity to a pair
   */
  async addLiquidity(params: AddLiquidityParams): Promise<TransactionResult<AddLiquidityResult>> {
    const result = await this.execute<{
      amount_a: bigint;
      amount_b: bigint;
      liquidity: bigint;
    }>(
      'add_liquidity',
      this.addressToScVal(params.tokenA),
      this.addressToScVal(params.tokenB),
      this.i128ToScVal(params.amountADesired),
      this.i128ToScVal(params.amountBDesired),
      this.i128ToScVal(params.amountAMin),
      this.i128ToScVal(params.amountBMin),
      this.addressToScVal(params.to),
      this.u32ToScVal(params.deadline)
    );

    if (result.status === 'success' && result.result) {
      return {
        ...result,
        result: {
          amountA: result.result.amount_a,
          amountB: result.result.amount_b,
          liquidity: result.result.liquidity,
        },
      };
    }

    // Error case - no result field needed
    return { status: result.status, hash: result.hash, error: result.error };
  }

  /**
   * Remove liquidity from a pair
   */
  async removeLiquidity(
    params: RemoveLiquidityParams
  ): Promise<TransactionResult<RemoveLiquidityResult>> {
    const result = await this.execute<{
      amount_a: bigint;
      amount_b: bigint;
    }>(
      'remove_liquidity',
      this.addressToScVal(params.tokenA),
      this.addressToScVal(params.tokenB),
      this.i128ToScVal(params.liquidity),
      this.i128ToScVal(params.amountAMin),
      this.i128ToScVal(params.amountBMin),
      this.addressToScVal(params.to),
      this.u32ToScVal(params.deadline)
    );

    if (result.status === 'success' && result.result) {
      return {
        ...result,
        result: {
          amountA: result.result.amount_a,
          amountB: result.result.amount_b,
        },
      };
    }

    // Error case - no result field needed
    return { status: result.status, hash: result.hash, error: result.error };
  }

  // ==================== Helper Methods ====================

  /**
   * Get a swap quote with price impact
   */
  async getSwapQuote(
    amountIn: bigint,
    path: string[],
    slippageBps: number = 50
  ): Promise<SwapQuote> {
    const amounts = await this.getAmountsOut(amountIn, path);
    const amountOut = amounts[amounts.length - 1];

    // Calculate price impact (simplified - for accurate calculation would need reserves)
    const priceImpactBps =
      amountOut > 0n ? Number(((amountIn - amountOut) * 10000n) / amountIn) : 0;

    const fee = (amountIn * 30n) / 10000n; // Assume 0.3% fee

    return {
      amountIn,
      amountOut: withSlippage(amountOut, slippageBps),
      path,
      priceImpactBps,
      fee,
    };
  }

  /**
   * Simple swap helper with automatic deadline
   */
  async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    minAmountOut: bigint,
    recipient: string,
    deadlineSeconds: number = DEFAULT_DEADLINE_SECONDS
  ): Promise<TransactionResult<bigint[]>> {
    return this.swapExactTokensForTokens({
      amountIn,
      amountOutMin: minAmountOut,
      path: [tokenIn, tokenOut],
      to: recipient,
      deadline: getDeadline(deadlineSeconds),
    });
  }

  /**
   * Multi-hop swap helper
   */
  async swapMultiHop(
    path: string[],
    amountIn: bigint,
    slippageBps: number = 50,
    recipient: string,
    deadlineSeconds: number = DEFAULT_DEADLINE_SECONDS
  ): Promise<TransactionResult<bigint[]>> {
    const amounts = await this.getAmountsOut(amountIn, path);
    const amountOutMin = withSlippage(amounts[amounts.length - 1], slippageBps);

    return this.swapExactTokensForTokens({
      amountIn,
      amountOutMin,
      path,
      to: recipient,
      deadline: getDeadline(deadlineSeconds),
    });
  }

  /**
   * Add liquidity helper with automatic slippage
   */
  async addLiquiditySimple(
    tokenA: string,
    tokenB: string,
    amountA: bigint,
    amountB: bigint,
    recipient: string,
    slippageBps: number = 50,
    deadlineSeconds: number = DEFAULT_DEADLINE_SECONDS
  ): Promise<TransactionResult<AddLiquidityResult>> {
    return this.addLiquidity({
      tokenA,
      tokenB,
      amountADesired: amountA,
      amountBDesired: amountB,
      amountAMin: withSlippage(amountA, slippageBps),
      amountBMin: withSlippage(amountB, slippageBps),
      to: recipient,
      deadline: getDeadline(deadlineSeconds),
    });
  }

  /**
   * Remove liquidity helper with automatic slippage
   */
  async removeLiquiditySimple(
    tokenA: string,
    tokenB: string,
    liquidity: bigint,
    expectedAmountA: bigint,
    expectedAmountB: bigint,
    recipient: string,
    slippageBps: number = 50,
    deadlineSeconds: number = DEFAULT_DEADLINE_SECONDS
  ): Promise<TransactionResult<RemoveLiquidityResult>> {
    return this.removeLiquidity({
      tokenA,
      tokenB,
      liquidity,
      amountAMin: withSlippage(expectedAmountA, slippageBps),
      amountBMin: withSlippage(expectedAmountB, slippageBps),
      to: recipient,
      deadline: getDeadline(deadlineSeconds),
    });
  }
}
