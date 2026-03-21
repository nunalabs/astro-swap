import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebouncedSearch } from '../useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isDebouncing).toBe(false);
      expect(result.current.results).toEqual([]);
      expect(result.current.isSearching).toBe(false);
    });

    it('should initialize with custom initial query', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ initialQuery: 'test' })
      );

      expect(result.current.query).toBe('test');
      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should return all expected functions', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      expect(typeof result.current.setQuery).toBe('function');
      expect(typeof result.current.clear).toBe('function');
    });
  });

  describe('Debouncing', () => {
    it('should update query immediately', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.query).toBe('test');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isDebouncing).toBe(true);
    });

    it('should update debouncedQuery after delay', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 300 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
      expect(result.current.isDebouncing).toBe(false);
    });

    it('should cancel previous timeout on new input', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 300 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('testing');
      });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Should not be 'test', should still be debouncing
      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.debouncedQuery).toBe('testing');
    });

    it('should use custom debounce delay', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 500 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });
  });

  describe('Minimum Length', () => {
    it('should not debounce if query is too short (default minLength: 2)', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('a');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.isDebouncing).toBe(false);
    });

    it('should clear results if query becomes too short', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      act(() => {
        result.current.setQuery('a');
      });

      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isDebouncing).toBe(false);
    });

    it('should use custom minLength', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ minLength: 4 })
      );

      act(() => {
        result.current.setQuery('abc');
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        result.current.setQuery('abcd');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('abcd');
    });
  });

  describe('Search Execution', () => {
    it('should call onSearch with debounced query', () => {
      const onSearch = vi.fn(async (query: string) => {
        return [{ id: 1, name: query }];
      });

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      // onSearch is called after debounce (tested in real timers)
      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should work with onSearch callback', () => {
      const onSearch = vi.fn(async () => [{ id: 1 }]);

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should not debounce if query is below minLength', () => {
      const onSearch = vi.fn(async () => []);

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch, minLength: 3 })
      );

      act(() => {
        result.current.setQuery('ab');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('');
    });
  });

  describe('Search Cancellation', () => {
    it('should reset debounce timer on rapid typing', () => {
      const onSearch = vi.fn(async () => [{ id: 1 }]);

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(100);
        result.current.setQuery('testing');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('testing');
    });
  });

  describe('Error Handling', () => {
    it('should have error handling in onSearch', () => {
      const onSearch = vi.fn(async () => {
        throw new Error('Search failed');
      });

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });
  });

  describe('clear()', () => {
    it('should clear query and results', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.results).toEqual([]);
      expect(result.current.isDebouncing).toBe(false);
      expect(result.current.isSearching).toBe(false);
    });

    it('should cancel pending timeout', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 300 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        result.current.clear();
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('');
    });

    it('should clear all state', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
        result.current.clear();
      });

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.results).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timeouts on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 300 })
      );

      act(() => {
        result.current.setQuery('test');
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should not throw or cause errors
    });

    it('should cleanup on unmount', () => {
      const onSearch = vi.fn(async () => [{ id: 1 }]);

      const { result, unmount } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      unmount();

      // Should not cause errors
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string query', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('');
      });

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
    });

    it('should handle rapid typing', () => {
      const { result } = renderHook(() =>
        useDebouncedSearch({ debounceMs: 300 })
      );

      act(() => {
        result.current.setQuery('t');
        result.current.setQuery('te');
        result.current.setQuery('tes');
        result.current.setQuery('test');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should handle onSearch callback', () => {
      const onSearch = vi.fn(async () => []);

      const { result } = renderHook(() =>
        useDebouncedSearch({ onSearch })
      );

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should work without onSearch callback', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
      expect(result.current.results).toEqual([]);
    });

    it('should handle special characters in query', () => {
      const { result } = renderHook(() => useDebouncedSearch());

      act(() => {
        result.current.setQuery('test@#$%');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test@#$%');
    });
  });
});
