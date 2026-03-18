/**
 * Reserve Data Staleness Validator (W3-2)
 *
 * Validates that reserve data is fresh before using it in calculations
 * or displaying it to users. Prevents using stale data that could lead
 * to incorrect price impacts or misleading information.
 */

/**
 * Maximum age for reserve data in milliseconds (30 seconds)
 * Reserve data older than this is considered stale and should be refetched
 */
export const RESERVE_STALENESS_THRESHOLD_MS = 30 * 1000; // 30 seconds

/**
 * Check if reserve data is stale
 *
 * @param timestamp - Unix timestamp in milliseconds when reserve data was fetched
 * @param thresholdMs - Maximum age in milliseconds (default: 30s)
 * @returns true if data is stale, false if fresh
 */
export function isReserveDataStale(
  timestamp: number,
  thresholdMs: number = RESERVE_STALENESS_THRESHOLD_MS
): boolean {
  const age = Date.now() - timestamp;
  return age > thresholdMs;
}

/**
 * Get human-readable age description for reserve data
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns String like "5s ago", "30s ago", "2m ago"
 */
export function getReserveDataAge(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageSeconds = Math.floor(ageMs / 1000);

  if (ageSeconds < 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);
  return `${ageMinutes}m ago`;
}

/**
 * Reserve data with timestamp
 */
export interface ReserveData {
  reserve0?: string;
  reserve1?: string;
  reserveA?: string;
  reserveB?: string;
  timestamp: number;
}

/**
 * Validate reserve data freshness and return error message if stale
 *
 * @param data - Reserve data with timestamp
 * @param context - Context for error message (e.g., "swap", "liquidity")
 * @returns Error message if stale, null if fresh
 */
export function validateReserveFreshness(
  data: ReserveData | null | undefined,
  context: string = 'operation'
): string | null {
  if (!data) {
    return `No reserve data available for ${context}`;
  }

  if (!data.timestamp) {
    return `Reserve data missing timestamp for ${context}`;
  }

  if (isReserveDataStale(data.timestamp)) {
    const age = getReserveDataAge(data.timestamp);
    return `Reserve data is stale (${age}). Please refresh and try again.`;
  }

  return null; // Data is fresh
}
