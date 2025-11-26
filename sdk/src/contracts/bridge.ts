/**
 * Bridge Contract Client
 *
 * Integration with Astro-Shiba launchpad for token graduation
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type {
  GraduatedToken,
  GraduationParams,
  TransactionResult,
  Pagination,
  PaginatedResult,
} from '../types';

export class BridgeClient extends BaseContractClient {
  constructor(config: ContractClientConfig) {
    super(config);
  }

  // ==================== Read Methods ====================

  /**
   * Check if a token has graduated
   */
  async isGraduated(token: string): Promise<boolean> {
    return this.call<boolean>('is_token_graduated', this.addressToScVal(token));
  }

  /**
   * Get graduated token info
   */
  async getGraduatedToken(token: string): Promise<GraduatedToken | null> {
    try {
      const result = await this.call<{
        token: string;
        pair: string;
        initial_liquidity: bigint;
        graduated_at: number;
        creator: string;
        lp_tokens_burned: bigint;
      }>('get_graduated_token', this.addressToScVal(token));

      return {
        token: result.token,
        pair: result.pair,
        initialLiquidity: result.initial_liquidity,
        graduatedAt: result.graduated_at,
        creator: result.creator,
        lpTokensBurned: result.lp_tokens_burned,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get total graduation count
   */
  async getGraduationCount(): Promise<number> {
    return this.call<number>('get_graduation_count');
  }

  /**
   * Get graduated tokens with pagination
   */
  async getGraduatedTokens(
    pagination: Pagination = { offset: 0, limit: 10 }
  ): Promise<PaginatedResult<GraduatedToken>> {
    const total = await this.getGraduationCount();
    const items: GraduatedToken[] = [];

    const start = pagination.offset;
    const end = Math.min(start + pagination.limit, total);

    for (let i = start; i < end; i++) {
      try {
        const tokenAddress = await this.call<string>(
          'get_graduation_by_index',
          this.u32ToScVal(i)
        );
        const token = await this.getGraduatedToken(tokenAddress);
        if (token) {
          items.push(token);
        }
      } catch {
        // Skip invalid indices
      }
    }

    return {
      items,
      total,
      hasMore: end < total,
    };
  }

  /**
   * Get factory address
   */
  async getFactory(): Promise<string> {
    return this.call<string>('get_factory');
  }

  /**
   * Get staking address
   */
  async getStaking(): Promise<string> {
    return this.call<string>('get_staking');
  }

  /**
   * Get launchpad address
   */
  async getLaunchpad(): Promise<string | null> {
    try {
      return await this.call<string>('get_launchpad');
    } catch {
      return null;
    }
  }

  /**
   * Get quote token address (XLM wrapper or USDC)
   */
  async getQuoteToken(): Promise<string | null> {
    try {
      return await this.call<string>('get_quote_token');
    } catch {
      return null;
    }
  }

  /**
   * Check if contract is paused
   */
  async isPaused(): Promise<boolean> {
    return this.call<boolean>('is_paused');
  }

  // ==================== Write Methods ====================

  /**
   * Initialize bridge contract
   */
  async initialize(
    admin: string,
    factory: string,
    staking: string,
    quoteToken: string
  ): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'initialize',
      this.addressToScVal(admin),
      this.addressToScVal(factory),
      this.addressToScVal(staking),
      this.addressToScVal(quoteToken)
    );
  }

  /**
   * Set launchpad address
   */
  async setLaunchpad(launchpad: string): Promise<TransactionResult<void>> {
    return this.execute<void>('set_launchpad', this.addressToScVal(launchpad));
  }

  /**
   * Graduate a token from launchpad to DEX
   */
  async graduateToken(params: GraduationParams): Promise<TransactionResult<GraduatedToken>> {
    const { xdr } = require('@stellar/stellar-sdk');

    // Build metadata ScVal
    const metadataScVal = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('name'),
        val: xdr.ScVal.scvString(params.metadata.name),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('symbol'),
        val: xdr.ScVal.scvString(params.metadata.symbol),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('decimals'),
        val: this.u32ToScVal(params.metadata.decimals),
      }),
    ]);

    const result = await this.execute<{
      token: string;
      pair: string;
      initial_liquidity: bigint;
      graduated_at: number;
      creator: string;
      lp_tokens_burned: bigint;
    }>(
      'graduate_token',
      this.addressToScVal(params.token),
      this.i128ToScVal(params.tokenAmount),
      this.i128ToScVal(params.quoteAmount),
      metadataScVal
    );

    if (result.status === 'success' && result.result) {
      return {
        ...result,
        result: {
          token: result.result.token,
          pair: result.result.pair,
          initialLiquidity: result.result.initial_liquidity,
          graduatedAt: result.result.graduated_at,
          creator: result.result.creator,
          lpTokensBurned: result.result.lp_tokens_burned,
        },
      };
    }

    // Error case - no result field needed
    return { status: result.status, hash: result.hash, error: result.error };
  }

  /**
   * Pause/unpause contract
   */
  async setPaused(paused: boolean): Promise<TransactionResult<void>> {
    const { xdr } = require('@stellar/stellar-sdk');
    return this.execute<void>('set_paused', xdr.ScVal.scvBool(paused));
  }

  /**
   * Update admin
   */
  async setAdmin(newAdmin: string): Promise<TransactionResult<void>> {
    return this.execute<void>('set_admin', this.addressToScVal(newAdmin));
  }

  // ==================== Helper Methods ====================

  /**
   * Check if a token can be graduated
   */
  async canGraduate(token: string): Promise<{ canGraduate: boolean; reason?: string }> {
    // Check if already graduated
    if (await this.isGraduated(token)) {
      return { canGraduate: false, reason: 'Token already graduated' };
    }

    // Check if contract is paused
    if (await this.isPaused()) {
      return { canGraduate: false, reason: 'Bridge contract is paused' };
    }

    // Check if launchpad is set
    const launchpad = await this.getLaunchpad();
    if (!launchpad) {
      return { canGraduate: false, reason: 'Launchpad not configured' };
    }

    return { canGraduate: true };
  }

  /**
   * Get recently graduated tokens
   */
  async getRecentGraduations(limit: number = 10): Promise<GraduatedToken[]> {
    const total = await this.getGraduationCount();
    const start = Math.max(0, total - limit);

    const tokens: GraduatedToken[] = [];

    for (let i = total - 1; i >= start; i--) {
      try {
        const tokenAddress = await this.call<string>(
          'get_graduation_by_index',
          this.u32ToScVal(i)
        );
        const token = await this.getGraduatedToken(tokenAddress);
        if (token) {
          tokens.push(token);
        }
      } catch {
        // Skip invalid indices
      }
    }

    return tokens;
  }

  /**
   * Search graduated tokens by creator
   */
  async getGraduationsByCreator(creator: string): Promise<GraduatedToken[]> {
    const total = await this.getGraduationCount();
    const tokens: GraduatedToken[] = [];

    for (let i = 0; i < total; i++) {
      try {
        const tokenAddress = await this.call<string>(
          'get_graduation_by_index',
          this.u32ToScVal(i)
        );
        const token = await this.getGraduatedToken(tokenAddress);
        if (token && token.creator === creator) {
          tokens.push(token);
        }
      } catch {
        // Skip invalid indices
      }
    }

    return tokens;
  }

  /**
   * Calculate total liquidity graduated
   */
  async getTotalLiquidityGraduated(): Promise<bigint> {
    const total = await this.getGraduationCount();
    let totalLiquidity = 0n;

    for (let i = 0; i < total; i++) {
      try {
        const tokenAddress = await this.call<string>(
          'get_graduation_by_index',
          this.u32ToScVal(i)
        );
        const token = await this.getGraduatedToken(tokenAddress);
        if (token) {
          totalLiquidity += token.initialLiquidity;
        }
      } catch {
        // Skip invalid indices
      }
    }

    return totalLiquidity;
  }
}
