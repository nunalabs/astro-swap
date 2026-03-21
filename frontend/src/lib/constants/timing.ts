/**
 * Timing Constants
 * Centralized timing values for the application
 */

/**
 * Horizon sync delay
 * Time to wait for Stellar Horizon to sync after transaction (milliseconds)
 * Increased to 5s to ensure reliable ledger synchronization
 */
export const HORIZON_SYNC_DELAY = 5000;

/**
 * Query stale times (milliseconds)
 */
export const STALE_TIME = {
  /** Pool data freshness (30 seconds) */
  POOLS: 30000,

  /** Swap quote freshness (10 seconds) */
  QUOTES: 10000,

  /** Token metadata freshness (5 minutes) */
  TOKEN_METADATA: 5 * 60 * 1000,

  /** Token balances freshness (15 seconds) */
  BALANCES: 15000,
} as const;

/**
 * Debounce times (milliseconds)
 */
export const DEBOUNCE = {
  /** Search input debounce */
  SEARCH: 300,

  /** Amount input debounce */
  AMOUNT_INPUT: 500,
} as const;

/**
 * Token indexing interval
 * How often to automatically re-index tokens from factory (milliseconds)
 */
export const TOKEN_INDEX_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Toast auto-dismiss duration (milliseconds)
 */
export const TOAST_DURATION = {
  /** Success messages */
  SUCCESS: 5000,

  /** Error messages */
  ERROR: 10000,

  /** Warning messages */
  WARNING: 7000,

  /** Info messages */
  INFO: 5000,
} as const;
