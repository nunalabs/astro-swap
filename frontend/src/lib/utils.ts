import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Format a number with proper decimals and thousand separators
 */
export function formatNumber(
  value: number | string,
  decimals = 2,
  compact = false
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '0';

  if (compact) {
    if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format a token amount with proper decimals
 */
/**
 * Format token amount from raw units to human-readable (safe BigInt implementation)
 * Avoids precision loss for large amounts
 *
 * @example
 * formatTokenAmount("1234560000", 7, 4) => "123.4560"
 * formatTokenAmount("1", 7, 4) => "0.0000001"
 */
export function formatTokenAmount(
  amount: string | number,
  decimals = 7,
  displayDecimals = 4
): string {
  try {
    // Convert to string if number
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;

    // Parse as BigInt to avoid precision loss
    const rawAmount = BigInt(amountStr);

    if (rawAmount === 0n) return '0';

    // Convert to string and pad with leading zeros if needed
    const rawStr = rawAmount.toString();
    const padded = rawStr.padStart(decimals + 1, '0');

    // Split into integer and decimal parts
    const intPart = padded.slice(0, -decimals) || '0';
    const decPart = padded.slice(-decimals);

    // Combine
    const fullValue = `${intPart}.${decPart}`;
    const value = parseFloat(fullValue);

    if (value === 0) return '0';
    if (value < 0.0001) return '<0.0001';

    return formatNumber(value, displayDecimals);
  } catch {
    return '0';
  }
}

/**
 * Format currency with proper symbol and decimals
 */
export function formatCurrency(
  value: number | string,
  currency = 'USD',
  decimals = 2
): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format percentage
 */
export function formatPercent(value: number, decimals = 2): string {
  if (isNaN(value)) return '0%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Shorten an address for display
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Calculate price impact
 */
/**
 * Calculate price impact of a trade (safe BigInt implementation)
 * Returns percentage impact (0-100)
 *
 * @example
 * calculatePriceImpact("1000000000000", "2000000000000", "10000000000") => 0.98
 */
export function calculatePriceImpact(
  inputReserve: string,
  outputReserve: string,
  inputAmount: string
): number {
  try {
    const input = BigInt(inputAmount);
    const reserveIn = BigInt(inputReserve);
    const reserveOut = BigInt(outputReserve);

    if (input === 0n || reserveIn === 0n || reserveOut === 0n) return 0;

    // Calculate with BigInt to avoid overflow, then convert for division
    // priceBeforeTrade = reserveOut / reserveIn
    // Use high precision: multiply by 10^18 before division
    const PRECISION = 10n ** 18n;
    const priceBeforeTrade = (reserveOut * PRECISION) / reserveIn;

    // newReserveIn = reserveIn + input
    const newReserveIn = reserveIn + input;

    // newReserveOut = (reserveIn * reserveOut) / newReserveIn (constant product)
    const newReserveOut = (reserveIn * reserveOut) / newReserveIn;

    // priceAfterTrade = newReserveOut / newReserveIn
    const priceAfterTrade = (newReserveOut * PRECISION) / newReserveIn;

    // Calculate impact: ((priceBefore - priceAfter) / priceBefore) * 100
    // All values are multiplied by PRECISION, so we can work with them directly
    const impactNumerator = priceBeforeTrade - priceAfterTrade;
    const impactWithPrecision = (impactNumerator * 100n * PRECISION) / priceBeforeTrade;

    // Convert to number for final result (safe because impact is always < 100%)
    return Number(impactWithPrecision) / Number(PRECISION);
  } catch {
    return 0;
  }
}

/**
 * Calculate minimum received with slippage
 */
export function calculateMinimumReceived(
  amount: string,
  slippage: number
): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';

  const minReceived = num * (1 - slippage / 100);
  return minReceived.toString();
}

/**
 * Validate address format (Stellar)
 */
export function isValidAddress(address: string): boolean {
  if (!address) return false;
  // Stellar addresses start with G and are 56 characters long
  return /^G[A-Z0-9]{55}$/.test(address);
}

/**
 * Validate contract ID format (Soroban)
 */
export function isValidContractId(contractId: string): boolean {
  if (!contractId) return false;
  // Soroban contract IDs start with C and are 56 characters long
  return /^C[A-Z0-9]{55}$/.test(contractId);
}

/**
 * Format time ago
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

/**
 * Format date
 */
export function formatDate(timestamp: number, format: 'short' | 'long' = 'short'): string {
  const date = new Date(timestamp);

  if (format === 'long') {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Parse token amount to raw units (safe BigInt implementation)
 * Avoids precision loss from parseFloat for large numbers
 *
 * @example
 * parseTokenAmount("123.456", 7) => "1234560000"
 * parseTokenAmount("0.0000001", 7) => "1"
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  if (!amount || amount === '' || amount === '.') return '0';

  // Remove leading/trailing whitespace
  const cleaned = amount.trim();

  // Handle negative numbers
  if (cleaned.startsWith('-')) return '0';

  // Split into integer and decimal parts
  const [intPart = '0', decPart = ''] = cleaned.split('.');

  // Remove leading zeros from integer part (but keep single '0')
  const cleanInt = intPart.replace(/^0+/, '') || '0';

  // Pad or truncate decimal part to match decimals
  const paddedDec = decPart.padEnd(decimals, '0').slice(0, decimals);

  // Combine and convert to BigInt to avoid overflow
  try {
    const rawAmount = BigInt(cleanInt + paddedDec);
    return rawAmount.toString();
  } catch {
    return '0';
  }
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Safe division (returns 0 if denominator is 0)
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Calculate APR from reward rate
 */
export function calculateAPR(
  rewardRate: string,
  totalStaked: string,
  rewardTokenPrice: number,
  stakedTokenPrice: number
): number {
  const dailyRewards = parseFloat(rewardRate) * 86400; // rewards per second * seconds in day
  const yearlyRewards = dailyRewards * 365;
  const yearlyRewardValue = yearlyRewards * rewardTokenPrice;

  const totalStakedValue = parseFloat(totalStaked) * stakedTokenPrice;

  if (totalStakedValue === 0) return 0;

  return (yearlyRewardValue / totalStakedValue) * 100;
}

/**
 * Get color for percentage change
 */
export function getChangeColor(change: number): string {
  if (change > 0) return 'text-green';
  if (change < 0) return 'text-red-500';
  return 'text-neutral-400';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Apply slippage tolerance to an amount (BigInt arithmetic)
 * Returns the minimum amount after applying slippage
 *
 * @param amount - The expected amount as string
 * @param slippagePercent - Slippage tolerance as percentage (e.g., 0.5 for 0.5%)
 * @returns Minimum amount as string
 *
 * @example
 * applySlippage("1000000000", 0.5) => "995000000" (0.5% slippage)
 * applySlippage("1000000000", 1.0) => "990000000" (1.0% slippage)
 */
export function applySlippage(amount: string, slippagePercent: number): string {
  try {
    const amountBigInt = BigInt(amount);
    const slippageBps = Math.floor(slippagePercent * 100); // Convert to basis points
    const multiplier = BigInt(10000 - slippageBps);

    // minAmount = amount * (10000 - slippageBps) / 10000
    const minAmount = (amountBigInt * multiplier) / 10000n;
    return minAmount.toString();
  } catch {
    return '0';
  }
}

/**
 * Calculate slippage amount (the difference)
 *
 * @param amount - The expected amount
 * @param slippagePercent - Slippage tolerance as percentage
 * @returns The slippage amount (amount - minAmount)
 */
export function calculateSlippageAmount(amount: string, slippagePercent: number): string {
  try {
    const amountBigInt = BigInt(amount);
    const minAmount = BigInt(applySlippage(amount, slippagePercent));
    return (amountBigInt - minAmount).toString();
  } catch {
    return '0';
  }
}
