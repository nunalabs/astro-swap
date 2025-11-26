/**
 * Aggregator Contract Client
 *
 * Smart Order Routing across multiple DEX protocols
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type {
  Protocol,
  ProtocolAdapter,
  AggregatorConfig,
  BestRoute,
  AggregatorSwapParams,
  TransactionResult,
} from '../types';
import { getDeadline, withSlippage, DEFAULT_DEADLINE_SECONDS } from '../utils';

export class AggregatorClient extends BaseContractClient {
  constructor(config: ContractClientConfig) {
    super(config);
  }

  // ==================== Read Methods ====================

  /**
   * Get aggregator configuration
   */
  async getConfig(): Promise<AggregatorConfig> {
    const result = await this.call<{
      max_hops: number;
      max_splits: number;
      aggregator_fee_bps: number;
    }>('get_config');

    return {
      maxHops: result.max_hops,
      maxSplits: result.max_splits,
      aggregatorFeeBps: result.aggregator_fee_bps,
    };
  }

  /**
   * Get registered protocol
   */
  async getProtocol(protocolId: Protocol): Promise<ProtocolAdapter | null> {
    try {
      const result = await this.call<{
        protocol_id: number;
        factory_address: string;
        is_active: boolean;
        default_fee_bps: number;
      }>('get_protocol', this.u32ToScVal(protocolId));

      return {
        protocolId: result.protocol_id as Protocol,
        factoryAddress: result.factory_address,
        isActive: result.is_active,
        defaultFeeBps: result.default_fee_bps,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all registered protocols
   */
  async getAllProtocols(): Promise<ProtocolAdapter[]> {
    const count = await this.call<number>('get_protocol_count');
    const protocols: ProtocolAdapter[] = [];

    for (let i = 0; i < count; i++) {
      const protocol = await this.getProtocol(i as Protocol);
      if (protocol) {
        protocols.push(protocol);
      }
    }

    return protocols;
  }

  /**
   * Get active protocols only
   */
  async getActiveProtocols(): Promise<ProtocolAdapter[]> {
    const all = await this.getAllProtocols();
    return all.filter((p) => p.isActive);
  }

  /**
   * Find best route for a swap
   */
  async findBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<BestRoute | null> {
    try {
      const result = await this.call<{
        steps: Array<{
          protocol: number;
          pool: string;
          token_in: string;
          token_out: string;
          amount_in: bigint;
          amount_out: bigint;
        }>;
        total_amount_in: bigint;
        total_amount_out: bigint;
        protocols: number[];
      }>(
        'find_best_route',
        this.addressToScVal(tokenIn),
        this.addressToScVal(tokenOut),
        this.i128ToScVal(amountIn)
      );

      return {
        steps: result.steps.map((step) => ({
          protocol: step.protocol as Protocol,
          pool: step.pool,
          tokenIn: step.token_in,
          tokenOut: step.token_out,
          amountIn: step.amount_in,
          amountOut: step.amount_out,
        })),
        totalAmountIn: result.total_amount_in,
        totalAmountOut: result.total_amount_out,
        protocols: result.protocols as Protocol[],
      };
    } catch {
      return null;
    }
  }

  /**
   * Get quote from specific protocol
   */
  async getProtocolQuote(
    protocolId: Protocol,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<bigint | null> {
    try {
      return await this.call<bigint>(
        'get_protocol_quote',
        this.u32ToScVal(protocolId),
        this.addressToScVal(tokenIn),
        this.addressToScVal(tokenOut),
        this.i128ToScVal(amountIn)
      );
    } catch {
      return null;
    }
  }

  /**
   * Get quotes from all protocols
   */
  async getAllQuotes(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<Map<Protocol, bigint>> {
    const protocols = await this.getActiveProtocols();
    const quotes = new Map<Protocol, bigint>();

    await Promise.all(
      protocols.map(async (protocol) => {
        const quote = await this.getProtocolQuote(
          protocol.protocolId,
          tokenIn,
          tokenOut,
          amountIn
        );
        if (quote !== null && quote > 0n) {
          quotes.set(protocol.protocolId, quote);
        }
      })
    );

    return quotes;
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    return this.call<boolean>('is_paused');
  }

  // ==================== Write Methods ====================

  /**
   * Initialize aggregator
   */
  async initialize(admin: string, astroswapFactory: string): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'initialize',
      this.addressToScVal(admin),
      this.addressToScVal(astroswapFactory)
    );
  }

  /**
   * Register a new protocol
   */
  async registerProtocol(
    protocolId: Protocol,
    factoryAddress: string,
    defaultFeeBps: number
  ): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'register_protocol',
      this.u32ToScVal(protocolId),
      this.addressToScVal(factoryAddress),
      this.u32ToScVal(defaultFeeBps)
    );
  }

  /**
   * Update protocol status
   */
  async setProtocolActive(
    protocolId: Protocol,
    isActive: boolean
  ): Promise<TransactionResult<void>> {
    const { xdr } = require('@stellar/stellar-sdk');
    return this.execute<void>(
      'set_protocol_active',
      this.u32ToScVal(protocolId),
      xdr.ScVal.scvBool(isActive)
    );
  }

  /**
   * Execute aggregated swap
   */
  async swap(params: AggregatorSwapParams): Promise<TransactionResult<bigint>> {
    return this.execute<bigint>(
      'swap',
      this.addressToScVal(params.tokenIn),
      this.addressToScVal(params.tokenOut),
      this.i128ToScVal(params.amountIn),
      this.i128ToScVal(params.minAmountOut),
      this.u32ToScVal(params.deadline)
    );
  }

  /**
   * Update aggregator configuration
   */
  async setConfig(config: AggregatorConfig): Promise<TransactionResult<void>> {
    const { xdr } = require('@stellar/stellar-sdk');
    const configScVal = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('max_hops'),
        val: this.u32ToScVal(config.maxHops),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('max_splits'),
        val: this.u32ToScVal(config.maxSplits),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('aggregator_fee_bps'),
        val: this.u32ToScVal(config.aggregatorFeeBps),
      }),
    ]);

    return this.execute<void>('set_config', configScVal);
  }

  /**
   * Set fee recipient
   */
  async setFeeRecipient(recipient: string): Promise<TransactionResult<void>> {
    return this.execute<void>('set_fee_recipient', this.addressToScVal(recipient));
  }

  /**
   * Pause/unpause contract
   */
  async setPaused(paused: boolean): Promise<TransactionResult<void>> {
    const { xdr } = require('@stellar/stellar-sdk');
    return this.execute<void>('set_paused', xdr.ScVal.scvBool(paused));
  }

  // ==================== Helper Methods ====================

  /**
   * Simple swap with best route finding
   */
  async swapWithBestRoute(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageBps: number = 50,
    deadlineSeconds: number = DEFAULT_DEADLINE_SECONDS
  ): Promise<TransactionResult<bigint>> {
    // Find best route first
    const route = await this.findBestRoute(tokenIn, tokenOut, amountIn);

    if (!route) {
      throw new Error('No route found for swap');
    }

    const minAmountOut = withSlippage(route.totalAmountOut, slippageBps);

    return this.swap({
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      deadline: getDeadline(deadlineSeconds),
    });
  }

  /**
   * Compare routes across all protocols
   */
  async compareRoutes(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint
  ): Promise<{
    bestProtocol: Protocol | null;
    bestAmount: bigint;
    allQuotes: Array<{ protocol: Protocol; amount: bigint; savings: bigint }>;
  }> {
    const quotes = await this.getAllQuotes(tokenIn, tokenOut, amountIn);

    let bestProtocol: Protocol | null = null;
    let bestAmount = 0n;

    for (const [protocol, amount] of quotes) {
      if (amount > bestAmount) {
        bestAmount = amount;
        bestProtocol = protocol;
      }
    }

    const allQuotes = Array.from(quotes.entries()).map(([protocol, amount]) => ({
      protocol,
      amount,
      savings: bestAmount - amount,
    }));

    // Sort by amount descending
    allQuotes.sort((a, b) => (b.amount > a.amount ? 1 : -1));

    return {
      bestProtocol,
      bestAmount,
      allQuotes,
    };
  }

  /**
   * Get protocol name
   */
  getProtocolName(protocol: Protocol): string {
    const names: Record<Protocol, string> = {
      0: 'AstroSwap',
      1: 'Soroswap',
      2: 'Phoenix',
      3: 'Aqua',
    };
    return names[protocol] || 'Unknown';
  }
}
