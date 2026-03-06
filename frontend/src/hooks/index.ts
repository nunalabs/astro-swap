/**
 * Centralized hooks for AstroSwap
 *
 * Performance & UX focused hooks:
 * - useCallbackRef: Stable callback references (prevents re-renders)
 * - useDebouncedSearch: Debounced search with immediate UI updates
 * - useOptimizedState: Batched state updates (single render)
 * - useModalState: Stable modal state management
 * - useFormState: Form state with validation
 */

export { useCallbackRef } from './useCallbackRef';
export { useDebouncedSearch } from './useDebouncedSearch';
export { useOptimizedState, useModalState, useFormState } from './useOptimizedState';

// Domain hooks
export { usePool } from './usePool';
export { useSwap } from './useSwap';
export { useStaking } from './useStaking';
export { useTokenBalance, useAllTokenBalances } from './useTokenBalance';
export { useSwapSimulation, useAddLiquiditySimulation } from './useSimulation';
