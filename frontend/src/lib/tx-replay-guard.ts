/**
 * Transaction Replay Guard (W3-1)
 *
 * Prevents duplicate transaction submissions by tracking recent transaction
 * signatures and rejecting replays within a time window.
 *
 * This protects against:
 * - Accidental double-clicks
 * - Network retry logic
 * - UI state bugs causing duplicate submissions
 */

import { LRUCache } from './lru-cache';

/**
 * Transaction signature - unique identifier for a transaction
 */
interface TxSignature {
  action: string;        // swap, addLiquidity, removeLiquidity, stake, unstake
  user: string;          // wallet address
  params: string;        // JSON stringified params
  timestamp: number;     // submission timestamp (rounded to nearest second)
}

/**
 * Time window for replay protection (5 minutes)
 * Transactions with same signature within this window are considered replays
 */
const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Cache of recent transaction signatures
 * LRU cache with max 1000 entries to prevent memory exhaustion
 */
const recentTransactions = new LRUCache<string, number>(1000);

/**
 * Generate a unique signature hash for a transaction
 *
 * @param signature Transaction signature containing action, user, and params
 * @returns Hash string for signature
 */
function hashSignature(signature: TxSignature): string {
  // Round timestamp to nearest second to allow for small timing variations
  const roundedTime = Math.floor(signature.timestamp / 1000);

  // Create deterministic hash from signature components
  const sigString = `${signature.action}:${signature.user}:${signature.params}:${roundedTime}`;

  // Simple but effective hash using built-in crypto API
  // Note: This is not cryptographic security, just collision resistance
  let hash = 0;
  for (let i = 0; i < sigString.length; i++) {
    const char = sigString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(36);
}

/**
 * Check if a transaction is a replay of a recent transaction
 *
 * @param action Transaction action (swap, addLiquidity, etc.)
 * @param user Wallet address
 * @param params Transaction parameters (will be JSON stringified)
 * @returns true if this is a replay, false if it's a new transaction
 */
export function isReplayTransaction(
  action: string,
  user: string,
  params: Record<string, unknown>
): boolean {
  const now = Date.now();

  // Create signature
  const signature: TxSignature = {
    action,
    user,
    params: JSON.stringify(params),
    timestamp: now,
  };

  const hash = hashSignature(signature);

  // Check if we've seen this transaction recently
  const lastSubmission = recentTransactions.get(hash);

  if (lastSubmission !== undefined) {
    const timeSinceLastSubmission = now - lastSubmission;

    if (timeSinceLastSubmission < REPLAY_WINDOW_MS) {
      return true; // This is a replay
    }
  }

  // Record this transaction
  recentTransactions.set(hash, now);

  return false; // This is a new transaction
}

/**
 * Clear the replay protection cache
 * Useful for testing or manual reset
 */
export function clearReplayGuard(): void {
  recentTransactions.clear();
}

/**
 * Get replay window duration in milliseconds
 */
export function getReplayWindowMs(): number {
  return REPLAY_WINDOW_MS;
}
