import { xdr, scValToNative } from '@stellar/stellar-sdk';
import type { ParsedSorobanEvent, PriceCalculation } from './types';
import { EventParseError } from './types';
import { logger } from './logger';

// ============================================================================
// Event Parsing Utilities
// ============================================================================

/**
 * Parse Soroban event from XDR
 */
export function parseSorobanEvent(
  contractId: string,
  eventXdr: string,
  ledger: number,
  ledgerClosedAt: string,
  txHash: string
): ParsedSorobanEvent {
  try {
    const event = xdr.DiagnosticEvent.fromXDR(eventXdr, 'base64');
    const eventBody = event.event();

    if (eventBody.type().name !== 'contract') {
      throw new EventParseError('Not a contract event');
    }

    const body = eventBody.body().value();
    if (!body) {
      throw new EventParseError('No event body found');
    }

    // Parse topics
    const topics = body.topics().map((topic: any) => scValToNative(topic));
    const eventType = topics[0] as string;

    // Parse data
    const dataValue = body.data();
    const data = scValToNative(dataValue);

    return {
      contractId,
      type: eventType,
      ledger,
      ledgerClosedAt,
      txHash,
      data: parseEventData(eventType, topics, data),
    };
  } catch (error) {
    throw new EventParseError('Failed to parse event', {
      contractId,
      txHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Parse event data based on event type
 */
function parseEventData(
  eventType: string,
  topics: any[],
  data: any
): Record<string, any> {
  switch (eventType) {
    case 'pair_created':
      return {
        token0: topics[1],
        token1: topics[2],
        pair: data.pair,
        pairCount: BigInt(data.pair_count),
      };

    case 'swap':
      return {
        sender: topics[1],
        to: data.to,
        amount0In: BigInt(data.amount0_in || 0),
        amount1In: BigInt(data.amount1_in || 0),
        amount0Out: BigInt(data.amount0_out || 0),
        amount1Out: BigInt(data.amount1_out || 0),
      };

    case 'deposit':
    case 'mint':
      return {
        sender: topics[1],
        amount0: BigInt(data.amount0),
        amount1: BigInt(data.amount1),
        liquidity: BigInt(data.liquidity),
      };

    case 'withdraw':
    case 'burn':
      return {
        sender: topics[1],
        amount0: BigInt(data.amount0),
        amount1: BigInt(data.amount1),
        liquidity: BigInt(data.liquidity),
      };

    case 'sync':
      return {
        reserve0: BigInt(data.reserve0),
        reserve1: BigInt(data.reserve1),
      };

    default:
      logger.warn({ eventType }, 'Unknown event type');
      return data;
  }
}

// ============================================================================
// Price Calculation Utilities
// ============================================================================

/**
 * Calculate token prices from reserves
 */
export function calculatePrices(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number = 7,
  decimals1: number = 7
): PriceCalculation {
  if (reserve0 === 0n || reserve1 === 0n) {
    return {
      price0: '0',
      price1: '0',
      reserve0,
      reserve1,
    };
  }

  // Adjust for decimals
  const adjustedReserve0 = Number(reserve0) / Math.pow(10, decimals0);
  const adjustedReserve1 = Number(reserve1) / Math.pow(10, decimals1);

  // Price0 = reserve1 / reserve0 (how much token1 per token0)
  const price0 = adjustedReserve1 / adjustedReserve0;
  // Price1 = reserve0 / reserve1 (how much token0 per token1)
  const price1 = adjustedReserve0 / adjustedReserve1;

  return {
    price0: price0.toFixed(18),
    price1: price1.toFixed(18),
    reserve0,
    reserve1,
  };
}

/**
 * Calculate total value locked (TVL)
 * NOTE: This is a simplified calculation. In production, you'd fetch real prices from oracles
 */
export function calculateTVL(
  reserve0: bigint,
  reserve1: bigint,
  token0PriceUSD: number = 0,
  token1PriceUSD: number = 0,
  decimals0: number = 7,
  decimals1: number = 7
): string {
  const adjustedReserve0 = Number(reserve0) / Math.pow(10, decimals0);
  const adjustedReserve1 = Number(reserve1) / Math.pow(10, decimals1);

  const tvl0 = adjustedReserve0 * token0PriceUSD;
  const tvl1 = adjustedReserve1 * token1PriceUSD;

  return (tvl0 + tvl1).toFixed(8);
}

/**
 * Calculate volume in USD
 */
export function calculateVolumeUSD(
  amount: bigint,
  tokenPriceUSD: number,
  decimals: number = 7
): string {
  const adjustedAmount = Number(amount) / Math.pow(10, decimals);
  return (adjustedAmount * tokenPriceUSD).toFixed(8);
}

// ============================================================================
// BigInt Utilities
// ============================================================================

/**
 * Convert bigint to string for JSON serialization
 */
export function bigIntToString(value: bigint): string {
  return value.toString();
}

/**
 * Parse string to bigint safely
 */
export function stringToBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/**
 * Add two bigint values represented as strings
 */
export function addBigInts(a: string, b: string): string {
  return (stringToBigInt(a) + stringToBigInt(b)).toString();
}

/**
 * Subtract two bigint values represented as strings
 */
export function subtractBigInts(a: string, b: string): string {
  return (stringToBigInt(a) - stringToBigInt(b)).toString();
}

// ============================================================================
// Time Utilities
// ============================================================================

/**
 * Get timestamp interval for price history
 */
export function getIntervalTimestamp(
  timestamp: Date,
  interval: string
): Date {
  const date = new Date(timestamp);

  switch (interval) {
    case 'MINUTE_1':
      date.setSeconds(0, 0);
      break;
    case 'MINUTE_5':
      date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
      break;
    case 'MINUTE_15':
      date.setMinutes(Math.floor(date.getMinutes() / 15) * 15, 0, 0);
      break;
    case 'HOUR_1':
      date.setMinutes(0, 0, 0);
      break;
    case 'HOUR_4':
      date.setHours(Math.floor(date.getHours() / 4) * 4, 0, 0, 0);
      break;
    case 'DAY_1':
      date.setHours(0, 0, 0, 0);
      break;
  }

  return date;
}

/**
 * Get interval duration in milliseconds
 */
export function getIntervalDuration(interval: string): number {
  switch (interval) {
    case 'MINUTE_1':
      return 60 * 1000;
    case 'MINUTE_5':
      return 5 * 60 * 1000;
    case 'MINUTE_15':
      return 15 * 60 * 1000;
    case 'HOUR_1':
      return 60 * 60 * 1000;
    case 'HOUR_4':
      return 4 * 60 * 60 * 1000;
    case 'DAY_1':
      return 24 * 60 * 60 * 1000;
    default:
      return 60 * 1000;
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate Stellar address
 */
export function isValidStellarAddress(address: string): boolean {
  return /^[CG][A-Z0-9]{55}$/.test(address);
}

/**
 * Validate contract address
 */
export function isValidContractAddress(address: string): boolean {
  return /^C[A-Z0-9]{55}$/.test(address);
}

/**
 * Validate account address
 */
export function isValidAccountAddress(address: string): boolean {
  return /^G[A-Z0-9]{55}$/.test(address);
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format token amount with decimals
 */
export function formatTokenAmount(
  amount: bigint | string,
  decimals: number = 7
): string {
  const value = typeof amount === 'string' ? stringToBigInt(amount) : amount;
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === 0n) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${integerPart}.${fractionalStr}`.replace(/\.?0+$/, '');
}

/**
 * Parse token amount to bigint
 */
export function parseTokenAmount(amount: string, decimals: number = 7): bigint {
  const [integer, fraction = ''] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const fullAmount = integer + paddedFraction;
  return BigInt(fullAmount);
}

// ============================================================================
// Retry Utilities
// ============================================================================

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      logger.warn(
        { attempt: attempt + 1, maxRetries, delay, error: lastError.message },
        'Retrying after error'
      );

      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Error Utilities
// ============================================================================

/**
 * Check if error is a network error
 */
export function isNetworkError(error: any): boolean {
  const message = error?.message?.toLowerCase() || '';
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'ETIMEDOUT'
  );
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  return (
    isNetworkError(error) ||
    error?.status === 429 || // Rate limit
    error?.status === 503 || // Service unavailable
    error?.status === 504    // Gateway timeout
  );
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
