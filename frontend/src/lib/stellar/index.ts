/**
 * Stellar SDK Module
 *
 * Modular, scalable architecture for Stellar/Soroban interactions.
 *
 * Structure:
 * - config.ts: Network configuration
 * - errors.ts: Error handling
 * - confirmation.ts: Transaction confirmation strategies
 * - transaction.ts: Transaction building and submission
 * - accounts.ts: Account operations (balances, etc.)
 */

// Re-export everything from submodules
export * from './config';
export * from './errors';
export * from './confirmation';
export * from './transaction';
export * from './accounts';

// For backwards compatibility, re-export commonly used items
export {
  horizonServer as server,
  sorobanServer,
  NETWORK_CONFIG as networkConfig,
} from './config';
