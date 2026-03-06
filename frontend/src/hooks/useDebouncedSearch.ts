import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for debounced search functionality.
 * Separates immediate UI updates from debounced API calls.
 *
 * @example
 * ```tsx
 * const {
 *   query,
 *   debouncedQuery,
 *   setQuery,
 *   isDebouncing,
 *   clear
 * } = useDebouncedSearch({
 *   debounceMs: 300,
 *   onSearch: async (q) => fetchResults(q)
 * });
 *
 * // Input updates immediately (no lag)
 * <input value={query} onChange={(e) => setQuery(e.target.value)} />
 *
 * // Results update after debounce
 * {results.map(...)}
 * ```
 */

interface UseDebouncedSearchOptions<T> {
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number;
  /** Minimum characters before triggering search (default: 2) */
  minLength?: number;
  /** Async search function called after debounce */
  onSearch?: (query: string) => Promise<T[]>;
  /** Initial query value */
  initialQuery?: string;
}

interface UseDebouncedSearchReturn<T> {
  /** Current input value (updates immediately) */
  query: string;
  /** Debounced value (updates after delay) */
  debouncedQuery: string;
  /** Set the query value */
  setQuery: (value: string) => void;
  /** Whether debounce is in progress */
  isDebouncing: boolean;
  /** Search results from onSearch callback */
  results: T[];
  /** Whether search is in progress */
  isSearching: boolean;
  /** Clear query and results */
  clear: () => void;
}

export function useDebouncedSearch<T = unknown>(
  options: UseDebouncedSearchOptions<T> = {}
): UseDebouncedSearchReturn<T> {
  const {
    debounceMs = 300,
    minLength = 2,
    onSearch,
    initialQuery = '',
  } = options;

  const [query, setQueryState] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [isDebouncing, setIsDebouncing] = useState(false);
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Stable setQuery function
  const setQuery = useCallback((value: string) => {
    setQueryState(value);
    setIsDebouncing(true);

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If query is too short, clear results immediately
    if (value.length < minLength) {
      setDebouncedQuery('');
      setResults([]);
      setIsDebouncing(false);
      return;
    }

    // Set new debounce timeout
    timeoutRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setIsDebouncing(false);
    }, debounceMs);
  }, [debounceMs, minLength]);

  // Execute search when debounced query changes
  useEffect(() => {
    if (!onSearch || debouncedQuery.length < minLength) {
      return;
    }

    // Cancel previous search
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }

    const abortController = new AbortController();
    searchAbortRef.current = abortController;

    const executeSearch = async () => {
      setIsSearching(true);
      try {
        const searchResults = await onSearch(debouncedQuery);
        if (!abortController.signal.aborted) {
          setResults(searchResults);
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Search error:', error);
          setResults([]);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsSearching(false);
        }
      }
    };

    executeSearch();

    return () => {
      abortController.abort();
    };
  }, [debouncedQuery, minLength, onSearch]);

  // Clear function
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    setQueryState('');
    setDebouncedQuery('');
    setResults([]);
    setIsDebouncing(false);
    setIsSearching(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    debouncedQuery,
    setQuery,
    isDebouncing,
    results,
    isSearching,
    clear,
  };
}
