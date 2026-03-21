import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCallbackRef } from '../useCallbackRef';

describe('useCallbackRef', () => {
  describe('Stable Reference', () => {
    it('should return a function', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCallbackRef(callback));

      expect(typeof result.current).toBe('function');
    });

    it('should maintain stable reference across renders', () => {
      const callback = vi.fn();
      const { result, rerender } = renderHook(() => useCallbackRef(callback));

      const firstRef = result.current;

      rerender();

      const secondRef = result.current;

      // Reference should be the same
      expect(firstRef).toBe(secondRef);
    });

    it('should maintain stable reference when callback changes', () => {
      const callback1 = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }) => useCallbackRef(cb),
        { initialProps: { cb: callback1 } }
      );

      const firstRef = result.current;

      const callback2 = vi.fn();
      rerender({ cb: callback2 });

      const secondRef = result.current;

      // Reference should still be the same
      expect(firstRef).toBe(secondRef);
    });
  });

  describe('Callback Execution', () => {
    it('should call the callback with arguments', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCallbackRef(callback));

      result.current('arg1', 'arg2', 'arg3');

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });

    it('should return the callback result', () => {
      const callback = vi.fn(() => 'test result');
      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current();

      expect(returnValue).toBe('test result');
    });

    it('should call the latest callback version', () => {
      const callback1 = vi.fn(() => 'result1');
      const callback2 = vi.fn(() => 'result2');

      const { result, rerender } = renderHook(
        ({ cb }) => useCallbackRef(cb),
        { initialProps: { cb: callback1 } }
      );

      // Call with first callback
      result.current();
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      // Update to second callback
      rerender({ cb: callback2 });

      // Call should now use second callback
      result.current();
      expect(callback2).toHaveBeenCalled();
    });

    it('should call callback with no arguments', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useCallbackRef(callback));

      result.current();

      expect(callback).toHaveBeenCalledWith();
    });

    it('should handle callback with multiple arguments', () => {
      const callback = vi.fn((a: number, b: string, c: boolean) => a + b + c);
      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current(1, 'test', true);

      expect(callback).toHaveBeenCalledWith(1, 'test', true);
      expect(returnValue).toBe('1testtrue');
    });
  });

  describe('TypeScript Compatibility', () => {
    it('should preserve callback type signature', () => {
      const callback = (a: number, b: string): string => {
        return `${a}-${b}`;
      };

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current(42, 'test');

      expect(returnValue).toBe('42-test');
    });

    it('should work with void callbacks', () => {
      const callback = vi.fn((): void => {
        // void function
      });

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current();

      expect(returnValue).toBeUndefined();
      expect(callback).toHaveBeenCalled();
    });

    it('should work with async callbacks', async () => {
      const callback = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });

      const { result } = renderHook(() => useCallbackRef(callback));

      const promise = result.current();

      expect(promise).toBeInstanceOf(Promise);

      const returnValue = await promise;
      expect(returnValue).toBe('async result');
    });
  });

  describe('Reference Updates', () => {
    it('should update internal ref on each render', () => {
      let callCount = 0;
      const callback1 = vi.fn(() => ++callCount);
      const callback2 = vi.fn(() => ++callCount);

      const { result, rerender } = renderHook(
        ({ cb }) => useCallbackRef(cb),
        { initialProps: { cb: callback1 } }
      );

      result.current();
      expect(callCount).toBe(1);

      rerender({ cb: callback2 });

      result.current();
      expect(callCount).toBe(2);

      // Both callbacks should have been used
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should always call the most recent callback', () => {
      const calls: string[] = [];

      const callback1 = () => calls.push('v1');
      const callback2 = () => calls.push('v2');
      const callback3 = () => calls.push('v3');

      const { result, rerender } = renderHook(
        ({ cb }) => useCallbackRef(cb),
        { initialProps: { cb: callback1 } }
      );

      result.current();
      expect(calls).toEqual(['v1']);

      rerender({ cb: callback2 });
      result.current();
      expect(calls).toEqual(['v1', 'v2']);

      rerender({ cb: callback3 });
      result.current();
      expect(calls).toEqual(['v1', 'v2', 'v3']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle callback that throws error', () => {
      const callback = vi.fn(() => {
        throw new Error('Test error');
      });

      const { result } = renderHook(() => useCallbackRef(callback));

      expect(() => result.current()).toThrow('Test error');
      expect(callback).toHaveBeenCalled();
    });

    it('should handle callback with this context', () => {
      const obj = {
        value: 42,
        getValue() {
          return this.value;
        },
      };

      const { result } = renderHook(() => useCallbackRef(obj.getValue.bind(obj)));

      const returnValue = result.current();

      expect(returnValue).toBe(42);
    });

    it('should handle callback with spread arguments', () => {
      const callback = vi.fn((...args: number[]) => args.reduce((a, b) => a + b, 0));

      const { result } = renderHook(() => useCallbackRef(callback));

      const sum = result.current(1, 2, 3, 4, 5);

      expect(sum).toBe(15);
      expect(callback).toHaveBeenCalledWith(1, 2, 3, 4, 5);
    });

    it('should handle callback returning undefined', () => {
      const callback = vi.fn();

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current();

      expect(returnValue).toBeUndefined();
    });

    it('should handle callback returning null', () => {
      const callback = vi.fn(() => null);

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current();

      expect(returnValue).toBeNull();
    });

    it('should handle callback returning object', () => {
      const obj = { foo: 'bar' };
      const callback = vi.fn(() => obj);

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current();

      expect(returnValue).toBe(obj);
    });

    it('should handle arrow function callbacks', () => {
      const callback = vi.fn((x: number) => x * 2);

      const { result } = renderHook(() => useCallbackRef(callback));

      const returnValue = result.current(5);

      expect(returnValue).toBe(10);
    });
  });

  describe('Real-World Usage', () => {
    it('should work as event handler', () => {
      const handleClick = vi.fn((event: { type: string }) => {
        console.log(event.type);
      });

      const { result } = renderHook(() => useCallbackRef(handleClick));

      result.current({ type: 'click' });

      expect(handleClick).toHaveBeenCalledWith({ type: 'click' });
    });

    it('should work with state setter pattern', () => {
      const setState = vi.fn((value: number) => value);

      const { result } = renderHook(() => useCallbackRef(setState));

      result.current(42);

      expect(setState).toHaveBeenCalledWith(42);
    });

    it('should prevent unnecessary re-renders in memoized components', () => {
      let renderCount = 0;
      const callback = () => {
        renderCount++;
      };

      const { result, rerender } = renderHook(() => useCallbackRef(callback));

      const ref1 = result.current;
      rerender();
      const ref2 = result.current;
      rerender();
      const ref3 = result.current;

      // All references should be the same
      expect(ref1).toBe(ref2);
      expect(ref2).toBe(ref3);
    });
  });
});
