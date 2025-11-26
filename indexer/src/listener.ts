import { rpc } from '@stellar/stellar-sdk';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import {
  parseSorobanEvent,
  calculatePrices,
  bigIntToString,
  retryWithBackoff,
  isRetryableError,
  sleep,
} from './utils';
import type { IndexerConfig, ParsedSorobanEvent } from './types';
import { EventParseError, RPCError } from './types';

export class EventListener {
  private server: rpc.Server;
  private prisma: PrismaClient;
  private config: IndexerConfig;
  private isRunning = false;
  private abortController: AbortController | null = null;

  constructor(config: IndexerConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
    this.server = new rpc.Server(config.stellar.rpcUrl, {
      allowHttp: config.stellar.network === 'testnet',
    });
  }

  /**
   * Start listening for events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event listener is already running');
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    logger.info(
      {
        network: this.config.stellar.network,
        factory: this.config.contracts.factory,
        rpcUrl: this.config.stellar.rpcUrl,
      },
      'Starting event listener'
    );

    // Start listening loops
    await Promise.all([
      this.listenToFactory(),
      this.listenToPairs(),
    ]);
  }

  /**
   * Stop listening for events
   */
  async stop(): Promise<void> {
    logger.info('Stopping event listener');
    this.isRunning = false;
    this.abortController?.abort();
  }

  /**
   * Listen to factory contract events (PairCreated)
   */
  private async listenToFactory(): Promise<void> {
    const factoryAddress = this.config.contracts.factory;

    logger.info({ factoryAddress }, 'Starting factory event listener');

    while (this.isRunning) {
      try {
        // Get last synced block
        const syncStatus = await this.prisma.syncStatus.upsert({
          where: { contractAddress: factoryAddress },
          create: {
            contractAddress: factoryAddress,
            contractType: 'factory',
            lastBlock: 0n,
          },
          update: {},
        });

        // Fetch events from last block
        const events = await this.fetchContractEvents(
          factoryAddress,
          Number(syncStatus.lastBlock)
        );

        logger.debug(
          { count: events.length, fromBlock: syncStatus.lastBlock },
          'Fetched factory events'
        );

        // Process events
        for (const event of events) {
          try {
            if (event.type === 'pair_created') {
              await this.handlePairCreated(event);
            }

            // Update sync status
            await this.prisma.syncStatus.update({
              where: { contractAddress: factoryAddress },
              data: {
                lastBlock: BigInt(event.ledger),
                lastTxHash: event.txHash,
                lastEventTime: new Date(event.ledgerClosedAt),
              },
            });
          } catch (error) {
            logger.error(
              {
                error: error instanceof Error ? error.message : String(error),
                event: event.type,
                txHash: event.txHash,
              },
              'Failed to process factory event'
            );
          }
        }

        // Wait before next poll
        await sleep(this.config.listener.pollingInterval);
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            factoryAddress,
          },
          'Error in factory listener loop'
        );

        if (isRetryableError(error)) {
          await sleep(this.config.listener.retryDelay);
        } else {
          await sleep(this.config.listener.pollingInterval * 2);
        }
      }
    }
  }

  /**
   * Listen to all pair contract events (Swap, Deposit, Withdraw, Sync)
   */
  private async listenToPairs(): Promise<void> {
    logger.info('Starting pair event listener');

    while (this.isRunning) {
      try {
        // Get all pairs
        const pairs = await this.prisma.pair.findMany({
          select: { address: true },
        });

        if (pairs.length === 0) {
          await sleep(this.config.listener.pollingInterval * 2);
          continue;
        }

        logger.debug({ count: pairs.length }, 'Monitoring pairs');

        // Process each pair
        for (const pair of pairs) {
          if (!this.isRunning) break;

          try {
            await this.processPairEvents(pair.address);
          } catch (error) {
            logger.error(
              {
                error: error instanceof Error ? error.message : String(error),
                pairAddress: pair.address,
              },
              'Failed to process pair events'
            );
          }
        }

        // Wait before next poll
        await sleep(this.config.listener.pollingInterval);
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'Error in pair listener loop'
        );

        await sleep(this.config.listener.retryDelay);
      }
    }
  }

  /**
   * Process events for a specific pair
   */
  private async processPairEvents(pairAddress: string): Promise<void> {
    // Get last synced block for this pair
    const syncStatus = await this.prisma.syncStatus.upsert({
      where: { contractAddress: pairAddress },
      create: {
        contractAddress: pairAddress,
        contractType: 'pair',
        lastBlock: 0n,
      },
      update: {},
    });

    // Fetch events
    const events = await this.fetchContractEvents(
      pairAddress,
      Number(syncStatus.lastBlock)
    );

    if (events.length === 0) return;

    logger.debug(
      { pairAddress, count: events.length },
      'Processing pair events'
    );

    // Process events
    for (const event of events) {
      try {
        switch (event.type) {
          case 'swap':
            await this.handleSwap(event, pairAddress);
            break;
          case 'deposit':
          case 'mint':
            await this.handleDeposit(event, pairAddress);
            break;
          case 'withdraw':
          case 'burn':
            await this.handleWithdraw(event, pairAddress);
            break;
          case 'sync':
            await this.handleSync(event, pairAddress);
            break;
        }

        // Update sync status
        await this.prisma.syncStatus.update({
          where: { contractAddress: pairAddress },
          data: {
            lastBlock: BigInt(event.ledger),
            lastTxHash: event.txHash,
            lastEventTime: new Date(event.ledgerClosedAt),
          },
        });
      } catch (error) {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
            event: event.type,
            txHash: event.txHash,
            pairAddress,
          },
          'Failed to process pair event'
        );
      }
    }
  }

  /**
   * Fetch contract events from RPC
   */
  private async fetchContractEvents(
    contractId: string,
    startLedger: number
  ): Promise<ParsedSorobanEvent[]> {
    return retryWithBackoff(async () => {
      try {
        const response = await this.server.getEvents({
          startLedger: startLedger || undefined,
          filters: [
            {
              type: 'contract',
              contractIds: [contractId],
            },
          ],
          limit: this.config.listener.batchSize,
        });

        const events: ParsedSorobanEvent[] = [];

        for (const event of response.events || []) {
          try {
            // Convert ScVal to XDR base64 string
            const eventXdr = event.value.toXDR('base64');
            const parsed = parseSorobanEvent(
              contractId,
              eventXdr,
              event.ledger,
              event.ledgerClosedAt,
              event.txHash
            );
            events.push(parsed);
          } catch (error) {
            if (error instanceof EventParseError) {
              logger.debug({ error: error.message }, 'Skipping non-contract event');
            } else {
              throw error;
            }
          }
        }

        return events;
      } catch (error) {
        throw new RPCError('Failed to fetch events', {
          contractId,
          startLedger,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.listener.maxRetries);
  }

  /**
   * Handle PairCreated event
   */
  private async handlePairCreated(event: ParsedSorobanEvent): Promise<void> {
    const { token0, token1, pair } = event.data;

    logger.info({ token0, token1, pair }, 'New pair created');

    // Create pair in database
    await this.prisma.pair.create({
      data: {
        address: pair,
        token0,
        token1,
        reserve0: '0',
        reserve1: '0',
        totalSupply: '0',
        lastSyncBlock: BigInt(event.ledger),
      },
    });

    // Initialize sync status for new pair
    await this.prisma.syncStatus.create({
      data: {
        contractAddress: pair,
        contractType: 'pair',
        lastBlock: BigInt(event.ledger),
        lastTxHash: event.txHash,
        lastEventTime: new Date(event.ledgerClosedAt),
      },
    });

    // Update protocol stats
    await this.updateProtocolStats();
  }

  /**
   * Handle Swap event
   */
  private async handleSwap(
    event: ParsedSorobanEvent,
    pairAddress: string
  ): Promise<void> {
    const { sender, to, amount0In, amount1In, amount0Out, amount1Out } =
      event.data;

    // Get pair from database
    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddress },
    });

    if (!pair) {
      logger.error({ pairAddress }, 'Pair not found for swap event');
      return;
    }

    // Create swap record
    await this.prisma.swap.create({
      data: {
        pairId: pair.id,
        txHash: event.txHash,
        sender,
        recipient: to,
        amount0In: bigIntToString(amount0In),
        amount1In: bigIntToString(amount1In),
        amount0Out: bigIntToString(amount0Out),
        amount1Out: bigIntToString(amount1Out),
        timestamp: new Date(event.ledgerClosedAt),
        blockNumber: BigInt(event.ledger),
      },
    });

    logger.info({ pairAddress, sender, txHash: event.txHash }, 'Swap processed');
  }

  /**
   * Handle Deposit (Mint) event
   */
  private async handleDeposit(
    event: ParsedSorobanEvent,
    pairAddress: string
  ): Promise<void> {
    const { sender, amount0, amount1, liquidity } = event.data;

    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddress },
    });

    if (!pair) return;

    // Create liquidity event
    await this.prisma.liquidityEvent.create({
      data: {
        pairId: pair.id,
        txHash: event.txHash,
        sender,
        type: 'DEPOSIT',
        amount0: bigIntToString(amount0),
        amount1: bigIntToString(amount1),
        liquidity: bigIntToString(liquidity),
        timestamp: new Date(event.ledgerClosedAt),
        blockNumber: BigInt(event.ledger),
      },
    });

    // Update user position
    await this.updateUserPosition(sender, pair.id, liquidity, true);

    logger.info({ pairAddress, sender }, 'Deposit processed');
  }

  /**
   * Handle Withdraw (Burn) event
   */
  private async handleWithdraw(
    event: ParsedSorobanEvent,
    pairAddress: string
  ): Promise<void> {
    const { sender, amount0, amount1, liquidity } = event.data;

    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddress },
    });

    if (!pair) return;

    // Create liquidity event
    await this.prisma.liquidityEvent.create({
      data: {
        pairId: pair.id,
        txHash: event.txHash,
        sender,
        type: 'WITHDRAW',
        amount0: bigIntToString(amount0),
        amount1: bigIntToString(amount1),
        liquidity: bigIntToString(liquidity),
        timestamp: new Date(event.ledgerClosedAt),
        blockNumber: BigInt(event.ledger),
      },
    });

    // Update user position
    await this.updateUserPosition(sender, pair.id, liquidity, false);

    logger.info({ pairAddress, sender }, 'Withdraw processed');
  }

  /**
   * Handle Sync event
   */
  private async handleSync(
    event: ParsedSorobanEvent,
    pairAddress: string
  ): Promise<void> {
    const { reserve0, reserve1 } = event.data;

    const pair = await this.prisma.pair.findUnique({
      where: { address: pairAddress },
    });

    if (!pair) return;

    // Update pair reserves
    await this.prisma.pair.update({
      where: { address: pairAddress },
      data: {
        reserve0: bigIntToString(reserve0),
        reserve1: bigIntToString(reserve1),
        lastSyncBlock: BigInt(event.ledger),
      },
    });

    // Calculate and store price
    const prices = calculatePrices(
      reserve0,
      reserve1,
      pair.token0Decimals,
      pair.token1Decimals
    );

    await this.updatePriceHistory(pair.id, prices, new Date(event.ledgerClosedAt));

    logger.debug({ pairAddress, reserve0: reserve0.toString(), reserve1: reserve1.toString() }, 'Sync processed');
  }

  /**
   * Update user LP position
   */
  private async updateUserPosition(
    user: string,
    pairId: string,
    liquidityDelta: bigint,
    isDeposit: boolean
  ): Promise<void> {
    const position = await this.prisma.position.findUnique({
      where: {
        user_pairId: {
          user,
          pairId,
        },
      },
    });

    const currentBalance = BigInt(position?.lpBalance || '0');
    const newBalance = isDeposit
      ? currentBalance + liquidityDelta
      : currentBalance - liquidityDelta;

    await this.prisma.position.upsert({
      where: {
        user_pairId: {
          user,
          pairId,
        },
      },
      create: {
        user,
        pairId,
        lpBalance: bigIntToString(newBalance),
        firstDepositAt: isDeposit ? new Date() : undefined,
      },
      update: {
        lpBalance: bigIntToString(newBalance),
      },
    });
  }

  /**
   * Update price history for different intervals
   */
  private async updatePriceHistory(
    pairId: string,
    prices: any,
    timestamp: Date
  ): Promise<void> {
    const intervals = ['MINUTE_1', 'MINUTE_5', 'HOUR_1', 'DAY_1'];

    for (const interval of intervals) {
      await this.prisma.priceHistory.upsert({
        where: {
          pairId_timestamp_interval: {
            pairId,
            timestamp,
            interval: interval as any,
          },
        },
        create: {
          pairId,
          price0: prices.price0,
          price1: prices.price1,
          reserve0: bigIntToString(prices.reserve0),
          reserve1: bigIntToString(prices.reserve1),
          timestamp,
          interval: interval as any,
        },
        update: {
          price0: prices.price0,
          price1: prices.price1,
          reserve0: bigIntToString(prices.reserve0),
          reserve1: bigIntToString(prices.reserve1),
        },
      });
    }
  }

  /**
   * Update protocol-wide statistics
   */
  private async updateProtocolStats(): Promise<void> {
    const totalPairs = await this.prisma.pair.count();
    const totalSwaps = await this.prisma.swap.count();
    const totalUsers = await this.prisma.position.groupBy({
      by: ['user'],
    });

    await this.prisma.protocolStats.upsert({
      where: { id: 'global' },
      create: {
        id: 'global',
        totalPairs,
        totalSwaps,
        totalUsers: totalUsers.length,
      },
      update: {
        totalPairs,
        totalSwaps,
        totalUsers: totalUsers.length,
      },
    });
  }
}
