/**
 * AstroSwap SDK
 *
 * TypeScript SDK for interacting with AstroSwap DEX on Stellar/Soroban
 *
 * @packageDocumentation
 */

// Main client
export { AstroSwapClient, createAstroSwapClient } from './client';
export type { AstroSwapClientConfig } from './client';

// Contract clients (custom wrappers)
export {
  BaseContractClient,
  FactoryClient,
  PairClient,
  RouterClient,
  StakingClient,
  AggregatorClient,
  BridgeClient,
} from './contracts';
export type { ContractClientConfig, RouterClientConfig } from './contracts';

// Generated contract bindings (Stellar SDK Contract Client)
export {
  FactoryBinding,
  PairBinding,
  RouterBinding,
  StakingBinding,
  AggregatorBinding,
  BridgeBinding,
} from './contracts';

// Types
export * from './types';

// Router SDK
export { AstroSwapRouter, PoolCache, Pathfinder, SplitOptimizer } from './router';
export type {
  RouterConfig,
  Route,
  SplitRoute,
  RouteQuote,
  SplitQuote,
  HopQuote,
  PoolData,
  RouterStats,
  PathSearchOptions,
  RouterError,
  RouterErrorCode,
} from './router';

// Utilities
export {
  // Math
  getAmountOut,
  getAmountIn,
  getAmountsOut,
  getAmountsIn,
  quote,
  sqrt,
  calculateInitialLiquidity,
  calculateLiquidity,
  calculatePriceImpact,
  calculateShareOfPool,
  // Address
  sortTokens,
  isValidAddress,
  shortenAddress,
  // Amount
  toContractAmount,
  fromContractAmount,
  formatAmount,
  // Time
  getDeadline,
  isDeadlineExpired,
  // Slippage
  withSlippage,
  withSlippageUp,
  // ScVal conversion
  scValToNative,
  nativeToScValTyped,
  // Retry
  retry,
  // Constants
  BPS_DENOMINATOR,
  MINIMUM_LIQUIDITY,
  DEFAULT_DEADLINE_SECONDS,
} from './utils';
