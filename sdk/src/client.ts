/**
 * AstroSwap SDK Client
 *
 * Main entry point for interacting with AstroSwap DEX
 */

import { Keypair } from '@stellar/stellar-sdk';
import type { NetworkConfig, ContractAddresses, NetworkType } from './types';
import { NETWORKS } from './types';
import {
  FactoryClient,
  PairClient,
  RouterClient,
  StakingClient,
  AggregatorClient,
  BridgeClient,
} from './contracts';

export interface AstroSwapClientConfig {
  network: NetworkType | NetworkConfig;
  contracts: ContractAddresses;
  secretKey?: string;
}

/**
 * Main AstroSwap SDK Client
 *
 * Provides unified access to all AstroSwap contracts and functionality
 *
 * @example
 * ```typescript
 * import { AstroSwapClient } from '@astroswap/sdk';
 *
 * const client = new AstroSwapClient({
 *   network: 'testnet',
 *   contracts: {
 *     factory: 'CXXX...',
 *     router: 'CXXX...',
 *   },
 *   secretKey: 'SXXX...',
 * });
 *
 * // Get swap quote
 * const quote = await client.router.getSwapQuote(
 *   1000000000n,
 *   [tokenA, tokenB],
 *   50
 * );
 *
 * // Execute swap
 * const result = await client.router.swap(
 *   tokenA,
 *   tokenB,
 *   1000000000n,
 *   quote.amountOut,
 *   recipientAddress
 * );
 * ```
 */
export class AstroSwapClient {
  public readonly network: NetworkConfig;
  public readonly contracts: ContractAddresses;
  private keypair?: Keypair;

  // Contract clients
  public readonly factory: FactoryClient;
  public readonly router: RouterClient;
  public readonly staking?: StakingClient;
  public readonly aggregator?: AggregatorClient;
  public readonly bridge?: BridgeClient;

  // Pair client cache
  private pairClients: Map<string, PairClient> = new Map();

  constructor(config: AstroSwapClientConfig) {
    // Resolve network config
    this.network =
      typeof config.network === 'string' ? NETWORKS[config.network] : config.network;

    this.contracts = config.contracts;

    // Set up keypair if provided
    if (config.secretKey) {
      this.keypair = Keypair.fromSecret(config.secretKey);
    }

    // Initialize contract clients
    this.factory = new FactoryClient({
      contractId: config.contracts.factory,
      network: this.network,
      keypair: this.keypair,
    });

    this.router = new RouterClient({
      contractId: config.contracts.router,
      network: this.network,
      keypair: this.keypair,
      factoryAddress: config.contracts.factory,
    });

    if (config.contracts.staking) {
      this.staking = new StakingClient({
        contractId: config.contracts.staking,
        network: this.network,
        keypair: this.keypair,
      });
    }

    if (config.contracts.aggregator) {
      this.aggregator = new AggregatorClient({
        contractId: config.contracts.aggregator,
        network: this.network,
        keypair: this.keypair,
      });
    }

    if (config.contracts.bridge) {
      this.bridge = new BridgeClient({
        contractId: config.contracts.bridge,
        network: this.network,
        keypair: this.keypair,
      });
    }
  }

  /**
   * Get the public key of the configured account
   */
  get publicKey(): string | undefined {
    return this.keypair?.publicKey();
  }

  /**
   * Set a new keypair for signing transactions
   */
  setKeypair(secretKey: string): void {
    this.keypair = Keypair.fromSecret(secretKey);

    // Update all contract clients
    this.factory.setKeypair(this.keypair);
    this.router.setKeypair(this.keypair);
    this.staking?.setKeypair(this.keypair);
    this.aggregator?.setKeypair(this.keypair);
    this.bridge?.setKeypair(this.keypair);

    // Update cached pair clients
    for (const client of this.pairClients.values()) {
      client.setKeypair(this.keypair);
    }
  }

  /**
   * Get a PairClient for a specific pair
   */
  async getPairClient(tokenA: string, tokenB: string): Promise<PairClient> {
    const pairAddress = await this.factory.getPairOrThrow(tokenA, tokenB);

    if (!this.pairClients.has(pairAddress)) {
      const client = new PairClient({
        contractId: pairAddress,
        network: this.network,
        keypair: this.keypair,
      });
      this.pairClients.set(pairAddress, client);
    }

    return this.pairClients.get(pairAddress)!;
  }

  /**
   * Get a PairClient by address
   */
  getPairClientByAddress(pairAddress: string): PairClient {
    if (!this.pairClients.has(pairAddress)) {
      const client = new PairClient({
        contractId: pairAddress,
        network: this.network,
        keypair: this.keypair,
      });
      this.pairClients.set(pairAddress, client);
    }

    return this.pairClients.get(pairAddress)!;
  }

  // ==================== Convenience Methods ====================

  /**
   * Get all available pairs
   */
  async getAllPairs(): Promise<string[]> {
    return this.factory.getAllPairs();
  }

  /**
   * Check if a pair exists
   */
  async pairExists(tokenA: string, tokenB: string): Promise<boolean> {
    return this.factory.pairExists(tokenA, tokenB);
  }

  /**
   * Simple swap with automatic slippage
   */
  async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    slippageBps: number = 50
  ) {
    if (!this.keypair) {
      throw new Error('No keypair set for signing');
    }

    return this.router.swapMultiHop([tokenIn, tokenOut], amountIn, slippageBps, this.keypair.publicKey());
  }

  /**
   * Add liquidity with automatic slippage
   */
  async addLiquidity(
    tokenA: string,
    tokenB: string,
    amountA: bigint,
    amountB: bigint,
    slippageBps: number = 50
  ) {
    if (!this.keypair) {
      throw new Error('No keypair set for signing');
    }

    return this.router.addLiquiditySimple(
      tokenA,
      tokenB,
      amountA,
      amountB,
      this.keypair.publicKey(),
      slippageBps
    );
  }

  /**
   * Find best route using aggregator (if available)
   */
  async findBestRoute(tokenIn: string, tokenOut: string, amountIn: bigint) {
    if (this.aggregator) {
      return this.aggregator.findBestRoute(tokenIn, tokenOut, amountIn);
    }

    // Fallback to router
    const amounts = await this.router.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return {
      steps: [],
      totalAmountIn: amountIn,
      totalAmountOut: amounts[amounts.length - 1],
      protocols: [0],
    };
  }

  /**
   * Get swap quote with price impact
   */
  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: bigint, slippageBps: number = 50) {
    // Try aggregator first if available
    if (this.aggregator) {
      const route = await this.aggregator.findBestRoute(tokenIn, tokenOut, amountIn);
      if (route) {
        return {
          amountIn,
          amountOut: route.totalAmountOut,
          path: [tokenIn, tokenOut],
          priceImpactBps: 0, // Would need pair info to calculate
          fee: (amountIn * 30n) / 10000n,
          source: 'aggregator',
        };
      }
    }

    // Fallback to router
    return {
      ...(await this.router.getSwapQuote(amountIn, [tokenIn, tokenOut], slippageBps)),
      source: 'router',
    };
  }

  /**
   * Get staking info for the current account
   */
  async getMyStakes() {
    if (!this.keypair) {
      throw new Error('No keypair set');
    }
    if (!this.staking) {
      throw new Error('Staking contract not configured');
    }

    return this.staking.getUserTotalStaked(this.keypair.publicKey());
  }

  /**
   * Claim all pending staking rewards
   */
  async claimAllRewards() {
    if (!this.keypair) {
      throw new Error('No keypair set');
    }
    if (!this.staking) {
      throw new Error('Staking contract not configured');
    }

    const stakes = await this.getMyStakes();
    const results = [];

    for (const [poolId] of stakes) {
      const pending = await this.staking.getPendingRewards(poolId, this.keypair.publicKey());
      if (pending > 0n) {
        const result = await this.staking.claim(poolId);
        results.push({ poolId, result });
      }
    }

    return results;
  }
}

/**
 * Create a new AstroSwap client
 */
export function createAstroSwapClient(config: AstroSwapClientConfig): AstroSwapClient {
  return new AstroSwapClient(config);
}
