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
export function formatTokenAmount(
  amount: string | number,
  decimals = 7,
  displayDecimals = 4
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) return '0';

  const value = num / Math.pow(10, decimals);

  if (value === 0) return '0';
  if (value < 0.0001) return '<0.0001';

  return formatNumber(value, displayDecimals);
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
export function calculatePriceImpact(
  inputReserve: string,
  outputReserve: string,
  inputAmount: string
): number {
  const input = parseFloat(inputAmount);
  const reserveIn = parseFloat(inputReserve);
  const reserveOut = parseFloat(outputReserve);

  if (input === 0 || reserveIn === 0 || reserveOut === 0) return 0;

  const priceBeforeTrade = reserveOut / reserveIn;
  const newReserveIn = reserveIn + input;
  const newReserveOut = (reserveIn * reserveOut) / newReserveIn;
  const priceAfterTrade = newReserveOut / newReserveIn;

  return ((priceBeforeTrade - priceAfterTrade) / priceBeforeTrade) * 100;
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
 * Parse token amount to raw units
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';

  const rawAmount = Math.floor(num * Math.pow(10, decimals));
  return rawAmount.toString();
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
