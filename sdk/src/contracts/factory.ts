/**
 * Factory Contract Client
 *
 * Manages pair creation and registry for the DEX
 */

import type { ContractClientConfig } from './base';
import { BaseContractClient } from './base';
import type {
  FactoryConfig,
  CreatePairParams,
  CreatePairResult,
  TransactionResult,
} from '../types';
import { sortTokens } from '../utils';

export class FactoryClient extends BaseContractClient {
  constructor(config: ContractClientConfig) {
    super(config);
  }

  // ==================== Read Methods ====================

  /**
   * Get factory configuration
   */
  async getConfig(): Promise<FactoryConfig> {
    const admin = await this.call<string>('get_admin');
    const pairWasmHash = await this.call<string>('get_pair_wasm_hash');
    const protocolFeeBps = await this.call<number>('get_protocol_fee_bps');
    const feeRecipient = await this.call<string | null>('get_fee_recipient');

    return {
      admin,
      pairWasmHash,
      protocolFeeBps,
      feeRecipient: feeRecipient || undefined,
    };
  }

  /**
   * Get pair address for two tokens
   */
  async getPair(tokenA: string, tokenB: string): Promise<string | null> {
    const [token0, token1] = sortTokens(tokenA, tokenB);
    return this.call<string | null>(
      'get_pair',
      this.addressToScVal(token0),
      this.addressToScVal(token1)
    );
  }

  /**
   * Get all pairs
   */
  async getAllPairs(): Promise<string[]> {
    return this.call<string[]>('get_all_pairs');
  }

  /**
   * Get pair count
   */
  async getPairCount(): Promise<number> {
    return this.call<number>('get_pair_count');
  }

  /**
   * Check if contract is initialized
   */
  async isInitialized(): Promise<boolean> {
    return this.call<boolean>('is_initialized');
  }

  // ==================== Write Methods ====================

  /**
   * Initialize the factory contract
   */
  async initialize(
    admin: string,
    pairWasmHash: string,
    protocolFeeBps: number
  ): Promise<TransactionResult<void>> {
    return this.execute<void>(
      'initialize',
      this.addressToScVal(admin),
      this.symbolToScVal(pairWasmHash), // Hash as bytes
      this.u32ToScVal(protocolFeeBps)
    );
  }

  /**
   * Create a new trading pair
   */
  async createPair(params: CreatePairParams): Promise<TransactionResult<CreatePairResult>> {
    const [token0, token1] = sortTokens(params.tokenA, params.tokenB);

    const result = await this.execute<string>(
      'create_pair',
      this.addressToScVal(token0),
      this.addressToScVal(token1)
    );

    if (result.status === 'success' && result.result) {
      return {
        ...result,
        result: {
          pairAddress: result.result,
          token0,
          token1,
        },
      };
    }

    // Error case - no result field needed
    return { status: result.status, hash: result.hash, error: result.error };
  }

  /**
   * Set fee recipient address
   */
  async setFeeRecipient(recipient: string): Promise<TransactionResult<void>> {
    return this.execute<void>('set_fee_recipient', this.addressToScVal(recipient));
  }

  /**
   * Update protocol fee
   */
  async setProtocolFee(feeBps: number): Promise<TransactionResult<void>> {
    return this.execute<void>('set_protocol_fee', this.u32ToScVal(feeBps));
  }

  /**
   * Update admin address
   */
  async setAdmin(newAdmin: string): Promise<TransactionResult<void>> {
    return this.execute<void>('set_admin', this.addressToScVal(newAdmin));
  }

  // ==================== Utility Methods ====================

  /**
   * Check if a pair exists for the given tokens
   */
  async pairExists(tokenA: string, tokenB: string): Promise<boolean> {
    const pair = await this.getPair(tokenA, tokenB);
    return pair !== null;
  }

  /**
   * Get pair address, throwing if not found
   */
  async getPairOrThrow(tokenA: string, tokenB: string): Promise<string> {
    const pair = await this.getPair(tokenA, tokenB);
    if (!pair) {
      throw new Error(`Pair not found for ${tokenA}/${tokenB}`);
    }
    return pair;
  }
}
