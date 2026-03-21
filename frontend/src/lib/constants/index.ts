/**
 * Centralized constants for the entire frontend
 * Single source of truth for all hardcoded values
 *
 * Import from here instead of scattered files:
 *
 * @example
 * import {
 *   createDummyAccount,
 *   NATIVE_XLM_SAC,
 *   DEFAULT_SWAP_PAIR,
 *   getExplorerLink,
 *   HORIZON_SYNC_DELAY,
 *   FEE_BPS
 * } from '@/lib/constants';
 */

export * from './stellar';
export * from './tokens';
export * from './network';
export * from './timing';
export * from './protocol';
export * from './queryKeys';
