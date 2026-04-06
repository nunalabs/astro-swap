/**
 * Smart Order Router (SOR)
 *
 * Compares quotes from Soroban AMM (AstroSwap) vs Stellar Classic
 * (SDEX orderbook + P18 AMM) and selects the best execution venue.
 *
 * Pure function - no side effects, no RPC calls.
 */

export type SwapVenue = 'soroban' | 'classic';

export interface SORResult {
  /** Selected execution venue */
  venue: SwapVenue;
  /** Output amount (raw bigint string) */
  amountOut: string;
  /** Improvement over the other venue in bps (0 if selected is worse) */
  improvementBps: number;
  /** Soroban AMM quote (null if unavailable) */
  sorobanAmountOut: string | null;
  /** Horizon classic quote (null if unavailable) */
  classicAmountOut: string | null;
}

/**
 * Minimum improvement required to switch venues (10 bps = 0.1%).
 * Prevents switching for negligible differences that might be
 * offset by execution uncertainty.
 */
const MIN_VENUE_SWITCH_BPS = 10;

/**
 * Compare Soroban AMM vs Horizon Classic quotes and select best venue.
 *
 * @param sorobanAmountOut - Raw output from Soroban AMM (null if no route)
 * @param classicAmountOut - Raw output from Horizon path (null if unavailable)
 * @param preferredVenue - Default venue when quotes are similar (default: soroban)
 */
export function selectBestVenue(
  sorobanAmountOut: string | null,
  classicAmountOut: string | null,
  preferredVenue: SwapVenue = 'soroban'
): SORResult {
  const soroban = sorobanAmountOut ? BigInt(sorobanAmountOut) : null;
  const classic = classicAmountOut ? BigInt(classicAmountOut) : null;

  // Only one venue available
  if (!soroban && !classic) {
    return {
      venue: preferredVenue,
      amountOut: '0',
      improvementBps: 0,
      sorobanAmountOut: null,
      classicAmountOut: null,
    };
  }

  if (!classic) {
    return {
      venue: 'soroban',
      amountOut: sorobanAmountOut!,
      improvementBps: 0,
      sorobanAmountOut,
      classicAmountOut: null,
    };
  }

  if (!soroban) {
    return {
      venue: 'classic',
      amountOut: classicAmountOut!,
      improvementBps: 0,
      sorobanAmountOut: null,
      classicAmountOut,
    };
  }

  // Both venues available - compare
  const diff = soroban > classic
    ? soroban - classic
    : classic - soroban;

  const base = soroban > classic ? classic : soroban;
  const improvementBps = base > 0n ? Number((diff * 10000n) / base) : 0;

  // Select venue with threshold
  let venue: SwapVenue;
  let amountOut: string;

  if (soroban >= classic) {
    // Soroban is better or equal
    venue = 'soroban';
    amountOut = sorobanAmountOut!;
  } else if (improvementBps >= MIN_VENUE_SWITCH_BPS) {
    // Classic is meaningfully better
    venue = 'classic';
    amountOut = classicAmountOut!;
  } else {
    // Classic is marginally better but within threshold - stay with preferred
    venue = preferredVenue;
    amountOut = preferredVenue === 'soroban' ? sorobanAmountOut! : classicAmountOut!;
  }

  return {
    venue,
    amountOut,
    improvementBps: venue === preferredVenue ? 0 : improvementBps,
    sorobanAmountOut,
    classicAmountOut,
  };
}
