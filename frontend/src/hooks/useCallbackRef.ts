import { useRef, useCallback } from 'react';

/**
 * Hook that returns a stable reference to a function that may change.
 * Useful for passing callbacks to memoized components without causing re-renders.
 *
 * @example
 * ```tsx
 * // Instead of:
 * <Modal onClose={() => setIsOpen(false)} />  // Creates new fn each render
 *
 * // Use:
 * const stableOnClose = useCallbackRef(() => setIsOpen(false));
 * <Modal onClose={stableOnClose} />  // Stable reference
 * ```
 */
export function useCallbackRef<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const ref = useRef(callback);

  // Always update the ref to latest callback
  ref.current = callback;

  // Return a stable function that delegates to ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((...args: unknown[]) => ref.current(...args)) as T, []);
}
