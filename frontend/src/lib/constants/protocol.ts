/**
 * Protocol Constants
 * DEX and blockchain protocol-specific values
 */

/**
 * DEX Fee (in basis points)
 * 30 bps = 0.30%
 */
export const FEE_BPS = 30n;

/**
 * LP Token decimals
 * All LP tokens use 7 decimals (Stellar standard)
 */
export const LP_DECIMALS = 7;

/**
 * Minimum trade amount
 * Prevents dust trades (in stroops)
 * 0.1 XLM = 1_000_000 stroops
 */
export const MIN_TRADE_AMOUNT = 1_000_000n;

/**
 * Ledgers per day on Stellar
 * ~5 second close time = 17,280 ledgers/day
 */
export const LEDGERS_PER_DAY = 17280;

/**
 * Stellar transaction limits
 */
export const STELLAR_LIMITS = {
  /** Maximum operations per transaction */
  MAX_OPERATIONS: 100,

  /** Maximum memo size (bytes) */
  MAX_MEMO_SIZE: 28,

  /** Base reserve (in XLM) */
  BASE_RESERVE: 1,

  /** Reserve per entry (in XLM) */
  RESERVE_PER_ENTRY: 0.5,
} as const;

/**
 * Contract gas limits
 */
export const GAS_LIMITS = {
  /** Swap transaction */
  SWAP: 10_000_000,

  /** Add liquidity */
  ADD_LIQUIDITY: 15_000_000,

  /** Remove liquidity */
  REMOVE_LIQUIDITY: 15_000_000,

  /** Token transfer */
  TRANSFER: 5_000_000,
} as const;

/**
 * Default slippage tolerance (percentage)
 */
export const DEFAULT_SLIPPAGE = 0.5;

/**
 * Default transaction deadline (minutes)
 */
export const DEFAULT_DEADLINE = 20;
