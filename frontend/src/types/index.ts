// Token types
export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  price?: number;
}

// Wallet types
export interface WalletState {
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

// Pool types
export interface Pool {
  address: string;
  token0: Token;
  token1: Token;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  lpTokenAddress: string;
  fee: number; // in basis points
  userLiquidity?: string;
  apr?: number;
  volume24h?: number;
  tvl?: number;
}

// Swap types
export interface SwapRoute {
  path: Token[];
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  minimumReceived: string;
}

export interface SwapSettings {
  slippageTolerance: number; // percentage
  deadline: number; // minutes
  multihops: boolean;
}

// Staking types
export interface StakingPool {
  address: string;
  lpToken: Token;
  rewardToken: Token;
  totalStaked: string;
  rewardRate: string;
  apr: number;
  userStaked?: string;
  userRewards?: string;
  startTime: number;
  endTime: number;
}

// Bridge types
export interface BridgeAsset {
  symbol: string;
  name: string;
  chains: string[];
  addresses: Record<string, string>;
  decimals: number;
  logoURI?: string;
}

export interface BridgeTransaction {
  id: string;
  fromChain: string;
  toChain: string;
  asset: string;
  amount: string;
  recipient: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  txHash?: string;
  timestamp: number;
}

// Transaction types
export interface Transaction {
  hash: string;
  type: 'swap' | 'add_liquidity' | 'remove_liquidity' | 'stake' | 'unstake' | 'claim' | 'bridge';
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  details: Record<string, unknown>;
}

// Chart data types
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume?: number;
}

export interface PriceChartData {
  prices: ChartDataPoint[];
  volumes: ChartDataPoint[];
  timeframe: '1H' | '1D' | '1W' | '1M' | 'ALL';
}

// Portfolio types
export interface PortfolioPosition {
  type: 'token' | 'liquidity' | 'staking';
  token?: Token;
  pool?: Pool;
  stakingPool?: StakingPool;
  balance: string;
  value: number;
  change24h?: number;
}

export interface PortfolioStats {
  totalValue: number;
  change24h: number;
  change24hPercentage: number;
  positions: PortfolioPosition[];
}

// Settings types
export interface UserSettings {
  slippageTolerance: number;
  deadline: number;
  expertMode: boolean;
  darkMode: boolean;
  currency: 'USD' | 'EUR' | 'GBP';
  language: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

// Contract types
export interface ContractCall {
  contractId: string;
  method: string;
  args: unknown[];
}

// Error types
export class AstroSwapError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'AstroSwapError';
    this.code = code;
    this.details = details;
  }
}

// Toast/Notification types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}
