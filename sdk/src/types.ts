/**
 * AstroSwap SDK Types
 *
 * TypeScript types matching Soroban contract structures
 */

// ==================== Network Configuration ====================

export type NetworkType = 'testnet' | 'mainnet' | 'futurenet' | 'standalone';

export interface NetworkConfig {
  network: NetworkType;
  rpcUrl: string;
  networkPassphrase: string;
  friendbotUrl?: string;
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  testnet: {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  mainnet: {
    network: 'mainnet',
    rpcUrl: 'https://soroban-rpc.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
  },
  futurenet: {
    network: 'futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; October 2022',
    friendbotUrl: 'https://friendbot-futurenet.stellar.org',
  },
  standalone: {
    network: 'standalone',
    rpcUrl: 'http://localhost:8000/soroban/rpc',
    networkPassphrase: 'Standalone Network ; February 2017',
    friendbotUrl: 'http://localhost:8000/friendbot',
  },
};

// ==================== Contract Addresses ====================

export interface ContractAddresses {
  factory: string;
  router: string;
  staking?: string;
  aggregator?: string;
  bridge?: string;
}

// ==================== Core Types ====================

export interface PairInfo {
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  feeBps: number;
}

export interface PairReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
}

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  path: string[];
  priceImpactBps: number;
  fee: bigint;
}

export interface LiquidityQuote {
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  shareOfPool: number;
}

// ==================== Factory Types ====================

export interface FactoryConfig {
  admin: string;
  pairWasmHash: string;
  protocolFeeBps: number;
  feeRecipient?: string;
}

export interface CreatePairParams {
  tokenA: string;
  tokenB: string;
}

export interface CreatePairResult {
  pairAddress: string;
  token0: string;
  token1: string;
}

// ==================== Router Types ====================

export interface SwapExactTokensParams {
  amountIn: bigint;
  amountOutMin: bigint;
  path: string[];
  to: string;
  deadline: number;
}

export interface SwapTokensForExactParams {
  amountOut: bigint;
  amountInMax: bigint;
  path: string[];
  to: string;
  deadline: number;
}

export interface AddLiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: bigint;
  amountBDesired: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  to: string;
  deadline: number;
}

export interface AddLiquidityResult {
  amountA: bigint;
  amountB: bigint;
  liquidity: bigint;
}

export interface RemoveLiquidityParams {
  tokenA: string;
  tokenB: string;
  liquidity: bigint;
  amountAMin: bigint;
  amountBMin: bigint;
  to: string;
  deadline: number;
}

export interface RemoveLiquidityResult {
  amountA: bigint;
  amountB: bigint;
}

// ==================== Staking Types ====================

export interface StakeInfo {
  amount: bigint;
  stakedAt: number;
  rewardDebt: bigint;
  multiplier: number;
}

export interface PoolInfo {
  lpToken: string;
  allocPoint: bigint;
  lastRewardTime: number;
  accRewardPerShare: bigint;
  totalStaked: bigint;
}

export interface StakingConfig {
  admin: string;
  rewardToken: string;
  rewardPerSecond: bigint;
  totalAllocPoint: bigint;
}

// ==================== Aggregator Types ====================

export enum Protocol {
  AstroSwap = 0,
  Soroswap = 1,
  Phoenix = 2,
  Aqua = 3,
}

export interface ProtocolAdapter {
  protocolId: Protocol;
  factoryAddress: string;
  isActive: boolean;
  defaultFeeBps: number;
}

export interface AggregatorConfig {
  maxHops: number;
  maxSplits: number;
  aggregatorFeeBps: number;
}

export interface RouteStep {
  protocol: Protocol;
  pool: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
}

export interface BestRoute {
  steps: RouteStep[];
  totalAmountIn: bigint;
  totalAmountOut: bigint;
  protocols: Protocol[];
}

export interface AggregatorSwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  deadline: number;
}

// ==================== Bridge Types ====================

export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  description?: string;
  imageUri?: string;
}

export interface GraduatedToken {
  token: string;
  pair: string;
  initialLiquidity: bigint;
  graduatedAt: number;
  creator: string;
  lpTokensBurned: bigint;
}

export interface GraduationParams {
  token: string;
  tokenAmount: bigint;
  quoteAmount: bigint;
  metadata: TokenMetadata;
}

// ==================== Transaction Types ====================

export type TransactionStatus = 'pending' | 'submitted' | 'success' | 'failed';

export interface TransactionResult<T = unknown> {
  status: TransactionStatus;
  hash?: string;
  result?: T;
  error?: string;
  ledger?: number;
}

export interface SimulationResult<T = unknown> {
  result: T;
  minResourceFee: bigint;
  transactionData: string;
}

// ==================== Event Types ====================

export interface SwapEvent {
  sender: string;
  amountIn: bigint;
  amountOut: bigint;
  tokenIn: string;
  tokenOut: string;
  timestamp: number;
}

export interface LiquidityEvent {
  sender: string;
  amount0: bigint;
  amount1: bigint;
  liquidity: bigint;
  type: 'add' | 'remove';
  timestamp: number;
}

export interface GraduationEvent {
  token: string;
  pair: string;
  creator: string;
  initialLiquidity: bigint;
  timestamp: number;
}

// ==================== Error Types ====================

export enum AstroSwapErrorCode {
  NotInitialized = 1,
  AlreadyInitialized = 2,
  Unauthorized = 3,
  InvalidAmount = 4,
  InsufficientLiquidity = 5,
  InsufficientBalance = 6,
  SlippageExceeded = 7,
  DeadlineExpired = 8,
  IdenticalTokens = 9,
  PairExists = 10,
  PairNotFound = 11,
  PoolNotFound = 12,
  InvalidPath = 13,
  Overflow = 14,
  Underflow = 15,
  DivisionByZero = 16,
  ContractPaused = 17,
  ReentrancyDetected = 18,
  InvalidFee = 19,
  InsufficientOutputAmount = 20,
  ExcessiveInputAmount = 21,
  ProtocolNotFound = 22,
  NoRouteFound = 23,
  TokenNotGraduated = 24,
  AlreadyGraduated = 25,
  InvalidLaunchpad = 26,
  GraduationThresholdNotMet = 27,
}

export class AstroSwapError extends Error {
  constructor(
    public code: AstroSwapErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'AstroSwapError';
  }

  static fromCode(code: number): AstroSwapError {
    const errorMessages: Record<number, string> = {
      1: 'Contract not initialized',
      2: 'Contract already initialized',
      3: 'Unauthorized access',
      4: 'Invalid amount',
      5: 'Insufficient liquidity',
      6: 'Insufficient balance',
      7: 'Slippage tolerance exceeded',
      8: 'Transaction deadline expired',
      9: 'Identical tokens provided',
      10: 'Pair already exists',
      11: 'Pair not found',
      12: 'Pool not found',
      13: 'Invalid swap path',
      14: 'Arithmetic overflow',
      15: 'Arithmetic underflow',
      16: 'Division by zero',
      17: 'Contract is paused',
      18: 'Reentrancy detected',
      19: 'Invalid fee configuration',
      20: 'Insufficient output amount',
      21: 'Excessive input amount',
      22: 'Protocol not found',
      23: 'No route found for swap',
      24: 'Token not graduated',
      25: 'Token already graduated',
      26: 'Invalid launchpad address',
      27: 'Graduation threshold not met',
    };

    return new AstroSwapError(
      code as AstroSwapErrorCode,
      errorMessages[code] || `Unknown error (code: ${code})`
    );
  }
}

// ==================== Utility Types ====================

export interface Pagination {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export type Subscriber<T> = (event: T) => void;

export interface Subscription {
  unsubscribe: () => void;
}
