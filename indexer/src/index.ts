import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { EventListener } from './listener';
import { APIServer } from './api';
import type { IndexerConfig } from './types';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const config: IndexerConfig = {
  stellar: {
    network: (process.env.STELLAR_NETWORK as 'testnet' | 'mainnet') || 'testnet',
    rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl: process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  },
  contracts: {
    factory: process.env.FACTORY_CONTRACT_ID || '',
    router: process.env.ROUTER_CONTRACT_ID,
    staking: process.env.STAKING_CONTRACT_ID,
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  api: {
    port: parseInt(process.env.API_PORT || '3001', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
  },
  listener: {
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000', 10),
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),
  },
  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    pretty: process.env.LOG_PRETTY === 'true',
  },
};

// ============================================================================
// Validation
// ============================================================================

function validateConfig(): void {
  if (!config.contracts.factory) {
    throw new Error('FACTORY_CONTRACT_ID is required');
  }

  if (!config.database.url) {
    throw new Error('DATABASE_URL is required');
  }

  logger.info(
    {
      network: config.stellar.network,
      factory: config.contracts.factory,
      rpcUrl: config.stellar.rpcUrl,
      apiPort: config.api.port,
    },
    'Configuration loaded'
  );
}

// ============================================================================
// Application
// ============================================================================

class IndexerApp {
  private prisma: PrismaClient;
  private listener: EventListener;
  private apiServer: APIServer;

  constructor() {
    this.prisma = new PrismaClient({
      log: config.logging.level === 'debug' ? ['query', 'error', 'warn'] : ['error'],
    });

    this.listener = new EventListener(config, this.prisma);
    this.apiServer = new APIServer(config, this.prisma);
  }

  /**
   * Start the indexer application
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting AstroSwap Indexer');

      // Validate configuration
      validateConfig();

      // Connect to database
      await this.connectDatabase();

      // Start API server
      await this.apiServer.start();

      // Start event listener
      await this.listener.start();

      logger.info('AstroSwap Indexer started successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to start indexer');
      await this.shutdown();
      process.exit(1);
    }
  }

  /**
   * Connect to database
   */
  private async connectDatabase(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Database connected');

      // Test query
      await this.prisma.$queryRaw`SELECT 1`;
      logger.info('Database health check passed');
    } catch (error) {
      logger.error({ error }, 'Database connection failed');
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down indexer');

    try {
      // Stop listener
      await this.listener.stop();

      // Disconnect database
      await this.prisma.$disconnect();

      logger.info('Indexer shut down successfully');
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const app = new IndexerApp();

  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await app.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await app.shutdown();
    process.exit(0);
  });

  process.on('unhandledRejection', (error) => {
    logger.error({ error }, 'Unhandled rejection');
  });

  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  // Start application
  await app.start();
}

// Run
if (require.main === module) {
  main().catch((error) => {
    logger.error({ error }, 'Fatal error');
    process.exit(1);
  });
}

export { IndexerApp, config };
