/**
 * AstroSwap SDK Utilities
 *
 * Helper functions for calculations, conversions, and common operations
 */

import { Address, xdr, scValToBigInt, nativeToScVal } from '@stellar/stellar-sdk';

// ==================== Constants ====================

export const BPS_DENOMINATOR = 10_000n;
export const MINIMUM_LIQUIDITY = 1000n;
export const DEFAULT_DEADLINE_SECONDS = 30 * 60; // 30 minutes

// ==================== Safe Math Utilities ====================

/**
 * Multiply then divide with rounding down: (a * b) / c
 * Rounds DOWN (floor) - favors the protocol
 * Safe for BigInt as JavaScript BigInt handles arbitrary precision
 */
export function mulDivDown(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) throw new Error('Division by zero');
  if (a === 0n || b === 0n) return 0n;
  if (a < 0n || b < 0n || c < 0n) throw new Error('Negative values not allowed');
  return (a * b) / c;
}

/**
 * Multiply then divide with rounding up: ceil((a * b) / c)
 * Rounds UP (ceiling) - favors the user paying more
 */
export function mulDivUp(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) throw new Error('Division by zero');
  if (a === 0n || b === 0n) return 0n;
  if (a < 0n || b < 0n || c < 0n) throw new Error('Negative values not allowed');
  const product = a * b;
  // ceil(a/b) = floor((a + b - 1) / b)
  return (product + c - 1n) / c;
}

/**
 * Calculate k = reserve_0 * reserve_1
 * Used for constant product invariant verification
 */
export function calculateK(reserve0: bigint, reserve1: bigint): bigint {
  if (reserve0 < 0n || reserve1 < 0n) throw new Error('Negative reserves not allowed');
  return reserve0 * reserve1;
}

/**
 * Verify k invariant: k_new >= k_old
 */
export function verifyKInvariant(
  newReserve0: bigint,
  newReserve1: bigint,
  oldReserve0: bigint,
  oldReserve1: bigint
): boolean {
  const kNew = calculateK(newReserve0, newReserve1);
  const kOld = calculateK(oldReserve0, oldReserve1);
  return kNew >= kOld;
}

// ==================== AMM Math Utilities ====================

/**
 * Calculate the amount out for a swap using constant product formula
 * Formula: amount_out = (reserve_out * amount_in_with_fee) / (reserve_in + amount_in_with_fee)
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountIn <= 0n) throw new Error('Invalid amount in');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('Insufficient liquidity');

  const feeMultiplier = BigInt(BPS_DENOMINATOR) - BigInt(feeBps);
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * BPS_DENOMINATOR + amountInWithFee;

  return numerator / denominator;
}

/**
 * Calculate the amount in needed for a specific output
 * Formula: amount_in = (reserve_in * amount_out * 10000) / ((reserve_out - amount_out) * (10000 - fee)) + 1
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountOut <= 0n) throw new Error('Invalid amount out');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('Insufficient liquidity');
  if (amountOut >= reserveOut) throw new Error('Insufficient liquidity');

  const numerator = reserveIn * amountOut * BPS_DENOMINATOR;
  const feeMultiplier = BigInt(BPS_DENOMINATOR) - BigInt(feeBps);
  const denominator = (reserveOut - amountOut) * feeMultiplier;

  return numerator / denominator + 1n;
}

/**
 * Get amounts out for a multi-hop path
 */
export function getAmountsOut(
  amountIn: bigint,
  reserves: Array<{ reserveIn: bigint; reserveOut: bigint; feeBps: number }>
): bigint[] {
  const amounts: bigint[] = [amountIn];

  for (const { reserveIn, reserveOut, feeBps } of reserves) {
    const amountOut = getAmountOut(amounts[amounts.length - 1], reserveIn, reserveOut, feeBps);
    amounts.push(amountOut);
  }

  return amounts;
}

/**
 * Get amounts in for a multi-hop path (reverse)
 */
export function getAmountsIn(
  amountOut: bigint,
  reserves: Array<{ reserveIn: bigint; reserveOut: bigint; feeBps: number }>
): bigint[] {
  const amounts: bigint[] = new Array(reserves.length + 1);
  amounts[amounts.length - 1] = amountOut;

  for (let i = reserves.length - 1; i >= 0; i--) {
    const { reserveIn, reserveOut, feeBps } = reserves[i];
    amounts[i] = getAmountIn(amounts[i + 1], reserveIn, reserveOut, feeBps);
  }

  return amounts;
}

/**
 * Quote: given some amount of token A, how much of token B should be added
 * Uses mulDivDown for phantom overflow protection
 */
export function quote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (amountA <= 0n) throw new Error('Invalid amount');
  if (reserveA <= 0n || reserveB <= 0n) throw new Error('Insufficient liquidity');

  return mulDivDown(amountA, reserveB, reserveA);
}

/**
 * Integer square root using Newton's method
 */
export function sqrt(value: bigint): bigint {
  if (value < 0n) throw new Error('Cannot calculate square root of negative number');
  if (value === 0n) return 0n;

  let x = value;
  let y = (x + 1n) / 2n;

  while (y < x) {
    x = y;
    y = (x + value / x) / 2n;
  }

  return x;
}

/**
 * Calculate LP tokens for initial liquidity
 */
export function calculateInitialLiquidity(amount0: bigint, amount1: bigint): bigint {
  const liquidity = sqrt(amount0 * amount1);
  if (liquidity <= MINIMUM_LIQUIDITY) {
    throw new Error('Insufficient initial liquidity');
  }
  return liquidity - MINIMUM_LIQUIDITY;
}

/**
 * Calculate LP tokens for adding liquidity to existing pool
 * Uses mulDivDown for phantom overflow protection (rounds down, favors protocol)
 */
export function calculateLiquidity(
  amount0: bigint,
  amount1: bigint,
  reserve0: bigint,
  reserve1: bigint,
  totalSupply: bigint
): bigint {
  if (totalSupply === 0n) {
    return calculateInitialLiquidity(amount0, amount1);
  }

  const liquidity0 = mulDivDown(amount0, totalSupply, reserve0);
  const liquidity1 = mulDivDown(amount1, totalSupply, reserve1);

  return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
}

/**
 * Calculate price impact in basis points
 * Uses mulDivDown for phantom overflow protection
 */
export function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): number {
  const expectedOut = mulDivDown(amountIn, reserveOut, reserveIn);
  const actualOut = getAmountOut(amountIn, reserveIn, reserveOut, feeBps);

  if (expectedOut === 0n) return 0;

  const diff = expectedOut - actualOut;
  const impact = mulDivDown(diff, BPS_DENOMINATOR, expectedOut);
  return Number(impact);
}

/**
 * Calculate share of pool
 */
export function calculateShareOfPool(liquidity: bigint, totalSupply: bigint): number {
  if (totalSupply === 0n) return 100;
  return Number((liquidity * 10000n) / totalSupply) / 100;
}

// ==================== Address Utilities ====================

/**
 * Sort tokens to get consistent pair ordering
 */
export function sortTokens(tokenA: string, tokenB: string): [string, string] {
  if (tokenA === tokenB) throw new Error('Identical tokens');
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

/**
 * Validate Stellar address format
 */
export function isValidAddress(address: string): boolean {
  try {
    Address.fromString(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string, chars: number = 4): string {
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

// ==================== Amount Utilities ====================

/**
 * Convert human-readable amount to contract amount (with decimals)
 */
export function toContractAmount(amount: number | string, decimals: number = 7): bigint {
  const [whole, fraction = ''] = String(amount).split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Convert contract amount to human-readable (with decimals)
 */
export function fromContractAmount(amount: bigint, decimals: number = 7): string {
  const str = amount.toString().padStart(decimals + 1, '0');
  const whole = str.slice(0, -decimals) || '0';
  const fraction = str.slice(-decimals).replace(/0+$/, '');

  return fraction ? `${whole}.${fraction}` : whole;
}

/**
 * Format amount with thousand separators
 */
export function formatAmount(
  amount: bigint,
  decimals: number = 7,
  displayDecimals: number = 4
): string {
  const value = fromContractAmount(amount, decimals);
  const num = parseFloat(value);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: displayDecimals,
  }).format(num);
}

// ==================== Time Utilities ====================

/**
 * Get deadline timestamp (seconds from now)
 */
export function getDeadline(secondsFromNow: number = DEFAULT_DEADLINE_SECONDS): number {
  return Math.floor(Date.now() / 1000) + secondsFromNow;
}

/**
 * Check if deadline has passed
 */
export function isDeadlineExpired(deadline: number): boolean {
  return Math.floor(Date.now() / 1000) > deadline;
}

// ==================== ScVal Conversion ====================

/**
 * Convert ScVal to JavaScript value
 */
export function scValToNative(val: xdr.ScVal): unknown {
  switch (val.switch()) {
    case xdr.ScValType.scvBool():
      return val.b();
    case xdr.ScValType.scvVoid():
      return undefined;
    case xdr.ScValType.scvU32():
      return val.u32();
    case xdr.ScValType.scvI32():
      return val.i32();
    case xdr.ScValType.scvU64():
      return scValToBigInt(val);
    case xdr.ScValType.scvI64():
      return scValToBigInt(val);
    case xdr.ScValType.scvU128():
      return scValToBigInt(val);
    case xdr.ScValType.scvI128():
      return scValToBigInt(val);
    case xdr.ScValType.scvBytes():
      return val.bytes();
    case xdr.ScValType.scvString():
      return val.str().toString();
    case xdr.ScValType.scvSymbol():
      return val.sym().toString();
    case xdr.ScValType.scvAddress():
      return Address.fromScVal(val).toString();
    case xdr.ScValType.scvVec(): {
      const vec = val.vec();
      return vec ? vec.map(scValToNative) : [];
    }
    case xdr.ScValType.scvMap(): {
      const map = val.map();
      if (!map) return {};
      const obj: Record<string, unknown> = {};
      for (const entry of map) {
        const key = scValToNative(entry.key());
        const value = scValToNative(entry.val());
        obj[String(key)] = value;
      }
      return obj;
    }
    default:
      return val;
  }
}

/**
 * Convert native value to ScVal
 */
export function nativeToScValTyped(
  val: unknown,
  type: 'address' | 'i128' | 'u128' | 'u64' | 'i64' | 'u32' | 'i32' | 'symbol' | 'string'
): xdr.ScVal {
  switch (type) {
    case 'address':
      return Address.fromString(val as string).toScVal();
    case 'i128':
    case 'u128':
    case 'i64':
    case 'u64':
    case 'i32':
    case 'u32':
      return nativeToScVal(val, { type });
    case 'symbol':
      return xdr.ScVal.scvSymbol(val as string);
    case 'string':
      return xdr.ScVal.scvString(val as string);
    default:
      return nativeToScVal(val);
  }
}

// ==================== Slippage Utilities ====================

/**
 * Calculate minimum amount out with slippage
 */
export function withSlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(BPS_DENOMINATOR - BigInt(slippageBps))) / BPS_DENOMINATOR;
}

/**
 * Calculate maximum amount in with slippage
 */
export function withSlippageUp(amount: bigint, slippageBps: number): bigint {
  return (amount * BigInt(BPS_DENOMINATOR + BigInt(slippageBps))) / BPS_DENOMINATOR;
}

// ==================== Retry Utilities ====================

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries - 1) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
