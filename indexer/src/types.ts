import { z } from 'zod';

// ============================================================================
// Contract Event Types
// ============================================================================

export interface PairCreatedEvent {
  token0: string;
  token1: string;
  pair: string;
  pairCount: bigint;
}

export interface SwapEvent {
  sender: string;
  to: string;
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
}

export interface DepositEvent {
  sender: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
}

export interface WithdrawEvent {
  sender: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
}

export interface SyncEvent {
  reserve0: bigint;
  reserve1: bigint;
}

// ============================================================================
// Soroban Event Parsing
// ============================================================================

export interface ParsedSorobanEvent {
  contractId: string;
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  txHash: string;
  data: Record<string, any>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface PairResponse {
  address: string;
  token0: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  token1: {
    address: string;
    symbol: string;
    decimals: number;
    reserve: string;
  };
  totalSupply: string;
  lpFee: number;
  protocolFee: number;
  price0: string;
  price1: string;
  tvlUSD?: string;
  volume24hUSD?: string;
  createdAt: string;
}

export interface SwapResponse {
  txHash: string;
  sender: string;
  recipient: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  amountInUSD?: string;
  amountOutUSD?: string;
  timestamp: string;
}

export interface LiquidityEventResponse {
  txHash: string;
  sender: string;
  type: 'DEPOSIT' | 'WITHDRAW';
  amount0: string;
  amount1: string;
  liquidity: string;
  valueUSD?: string;
  timestamp: string;
}

export interface PositionResponse {
  user: string;
  pair: {
    address: string;
    token0: string;
    token1: string;
  };
  lpBalance: string;
  stakedBalance: string;
  token0Amount: string;
  token1Amount: string;
  valueUSD?: string;
  firstDepositAt?: string;
}

export interface PriceHistoryResponse {
  timestamp: string;
  price0: string;
  price1: string;
  reserve0: string;
  reserve1: string;
  volumeUSD?: string;
  tvlUSD?: string;
}

export interface StatsResponse {
  totalVolumeUSD: string;
  volume24hUSD: string;
  totalTVLUSD: string;
  totalFeesUSD: string;
  fees24hUSD: string;
  totalPairs: number;
  totalUsers: number;
  totalSwaps: number;
}

// ============================================================================
// Validation Schemas
// ============================================================================

export const AddressSchema = z.string().regex(/^C[A-Z0-9]{55}$/, 'Invalid Stellar address');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const TimeRangeSchema = z.object({
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
});

export const PriceIntervalSchema = z.enum([
  'MINUTE_1',
  'MINUTE_5',
  'MINUTE_15',
  'HOUR_1',
  'HOUR_4',
  'DAY_1',
]);

// ============================================================================
// Configuration Types
// ============================================================================

export interface IndexerConfig {
  stellar: {
    network: 'testnet' | 'mainnet';
    rpcUrl: string;
    horizonUrl: string;
  };
  contracts: {
    factory: string;
    router?: string;
    staking?: string;
  };
  database: {
    url: string;
  };
  api: {
    port: number;
    corsOrigins: string[];
  };
  listener: {
    pollingInterval: number; // milliseconds
    batchSize: number;
    maxRetries: number;
    retryDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty: boolean;
  };
}

// ============================================================================
// Internal Types
// ============================================================================

export interface EventHandler {
  contractId: string;
  eventType: string;
  handler: (event: ParsedSorobanEvent) => Promise<void>;
}

export interface SyncProgress {
  contractAddress: string;
  contractType: string;
  lastBlock: bigint;
  lastTxHash?: string;
  isSyncing: boolean;
}

export interface PriceCalculation {
  price0: string;
  price1: string;
  reserve0: bigint;
  reserve1: bigint;
}

export interface TVLCalculation {
  tvlUSD: string;
  token0USD: string;
  token1USD: string;
}

// ============================================================================
// Error Types
// ============================================================================

export class IndexerError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IndexerError';
  }
}

export class EventParseError extends IndexerError {
  constructor(message: string, details?: any) {
    super(message, 'EVENT_PARSE_ERROR', details);
    this.name = 'EventParseError';
  }
}

export class DatabaseError extends IndexerError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }
}

export class RPCError extends IndexerError {
  constructor(message: string, details?: any) {
    super(message, 'RPC_ERROR', details);
    this.name = 'RPCError';
  }
}
