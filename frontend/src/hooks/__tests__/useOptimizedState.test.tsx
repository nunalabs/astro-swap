import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimizedState, useModalState, useFormState } from '../useOptimizedState';

describe('useOptimizedState', () => {
  describe('Initialization', () => {
    it('should initialize with initial state', () => {
      const initialState = { count: 0, name: 'test' };
      const { result } = renderHook(() => useOptimizedState(initialState));

      const [state] = result.current;
      expect(state).toEqual(initialState);
    });

    it('should return tuple with 4 functions', () => {
      const { result } = renderHook(() => useOptimizedState({ value: 0 }));

      expect(result.current).toHaveLength(4);
      expect(typeof result.current[1]).toBe('function'); // setField
      expect(typeof result.current[2]).toBe('function'); // batchUpdate
      expect(typeof result.current[3]).toBe('function'); // reset
    });
  });

  describe('setField', () => {
    it('should update single field', () => {
      const { result } = renderHook(() =>
        useOptimizedState({ count: 0, name: 'test' })
      );

      act(() => {
        const [, setField] = result.current;
        setField('count', 42);
      });

      const [state] = result.current;
      expect(state.count).toBe(42);
      expect(state.name).toBe('test');
    });

    it('should update different types of values', () => {
      const { result } = renderHook(() =>
        useOptimizedState({
          string: 'hello',
          number: 0,
          boolean: false,
          object: { nested: 'value' },
        })
      );

      act(() => {
        const [, setField] = result.current;
        setField('string', 'world');
        setField('number', 42);
        setField('boolean', true);
        setField('object', { nested: 'updated' });
      });

      const [state] = result.current;
      expect(state.string).toBe('world');
      expect(state.number).toBe(42);
      expect(state.boolean).toBe(true);
      expect(state.object).toEqual({ nested: 'updated' });
    });

    it('should preserve other fields when updating one', () => {
      const { result } = renderHook(() =>
        useOptimizedState({ a: 1, b: 2, c: 3 })
      );

      act(() => {
        const [, setField] = result.current;
        setField('b', 20);
      });

      const [state] = result.current;
      expect(state).toEqual({ a: 1, b: 20, c: 3 });
    });
  });

  describe('batchUpdate', () => {
    it('should update multiple fields at once', () => {
      const { result } = renderHook(() =>
        useOptimizedState({ a: 1, b: 2, c: 3 })
      );

      act(() => {
        const [, , batchUpdate] = result.current;
        batchUpdate({ a: 10, c: 30 });
      });

      const [state] = result.current;
      expect(state).toEqual({ a: 10, b: 2, c: 30 });
    });

    it('should handle empty update object', () => {
      const { result } = renderHook(() =>
        useOptimizedState({ a: 1, b: 2 })
      );

      const initialState = result.current[0];

      act(() => {
        const [, , batchUpdate] = result.current;
        batchUpdate({});
      });

      expect(result.current[0]).toEqual(initialState);
    });

    it('should update all fields', () => {
      const { result } = renderHook(() =>
        useOptimizedState({ a: 1, b: 2, c: 3 })
      );

      act(() => {
        const [, , batchUpdate] = result.current;
        batchUpdate({ a: 10, b: 20, c: 30 });
      });

      const [state] = result.current;
      expect(state).toEqual({ a: 10, b: 20, c: 30 });
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      const initialState = { count: 0, name: 'test' };
      const { result } = renderHook(() => useOptimizedState(initialState));

      act(() => {
        const [, setField] = result.current;
        setField('count', 42);
        setField('name', 'updated');
      });

      act(() => {
        const [, , , reset] = result.current;
        reset();
      });

      const [state] = result.current;
      expect(state).toEqual(initialState);
    });

    it('should reset after multiple updates', () => {
      const initialState = { a: 1, b: 2 };
      const { result } = renderHook(() => useOptimizedState(initialState));

      act(() => {
        const [, , batchUpdate] = result.current;
        batchUpdate({ a: 10, b: 20 });
      });

      act(() => {
        const [, setField] = result.current;
        setField('a', 100);
      });

      act(() => {
        const [, , , reset] = result.current;
        reset();
      });

      expect(result.current[0]).toEqual(initialState);
    });
  });
});

describe('useModalState', () => {
  describe('Initialization', () => {
    it('should initialize with default closed state', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current.isOpen).toBe(false);
    });

    it('should initialize with provided state', () => {
      const { result } = renderHook(() => useModalState(true));

      expect(result.current.isOpen).toBe(true);
    });

    it('should return all expected functions', () => {
      const { result } = renderHook(() => useModalState());

      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('open');
      expect(result.current).toHaveProperty('close');
      expect(result.current).toHaveProperty('toggle');
      expect(result.current).toHaveProperty('setIsOpen');
    });
  });

  describe('open', () => {
    it('should open modal', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should keep modal open if already open', () => {
      const { result } = renderHook(() => useModalState(true));

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('close', () => {
    it('should close modal', () => {
      const { result } = renderHook(() => useModalState(true));

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should keep modal closed if already closed', () => {
      const { result } = renderHook(() => useModalState(false));

      act(() => {
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle from closed to open', () => {
      const { result } = renderHook(() => useModalState(false));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('should toggle from open to closed', () => {
      const { result } = renderHook(() => useModalState(true));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('should toggle multiple times', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        result.current.toggle();
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('setIsOpen', () => {
    it('should set modal state directly', () => {
      const { result } = renderHook(() => useModalState());

      act(() => {
        result.current.setIsOpen(true);
      });

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.setIsOpen(false);
      });

      expect(result.current.isOpen).toBe(false);
    });
  });

  describe('Stable Callbacks', () => {
    it('should maintain stable callback references', () => {
      const { result, rerender } = renderHook(() => useModalState());

      const callbacks1 = {
        open: result.current.open,
        close: result.current.close,
        toggle: result.current.toggle,
      };

      rerender();

      const callbacks2 = {
        open: result.current.open,
        close: result.current.close,
        toggle: result.current.toggle,
      };

      expect(callbacks1.open).toBe(callbacks2.open);
      expect(callbacks1.close).toBe(callbacks2.close);
      expect(callbacks1.toggle).toBe(callbacks2.toggle);
    });
  });
});

describe('useFormState', () => {
  describe('Initialization', () => {
    it('should initialize with initial values', () => {
      const initialValues = { email: '', password: '' };
      const { result } = renderHook(() =>
        useFormState({ initialValues })
      );

      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isDirty).toBe(false);
      expect(result.current.isValid).toBe(true);
    });

    it('should return all expected functions', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { field: '' } })
      );

      expect(typeof result.current.setField).toBe('function');
      expect(typeof result.current.setFields).toBe('function');
      expect(typeof result.current.touchField).toBe('function');
      expect(typeof result.current.validateAll).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('setField', () => {
    it('should update field value', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '', password: '' } })
      );

      act(() => {
        result.current.setField('email', 'test@example.com');
      });

      expect(result.current.values.email).toBe('test@example.com');
      expect(result.current.values.password).toBe('');
    });

    it('should validate on change if field was touched', () => {
      const validate = vi.fn((values: { email: string }) => ({
        email: values.email ? undefined : 'Required',
      }));

      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' }, validate })
      );

      act(() => {
        result.current.touchField('email');
      });

      act(() => {
        result.current.setField('email', 'test@example.com');
      });

      expect(validate).toHaveBeenCalled();
    });

    it('should not validate if field was not touched', () => {
      const validate = vi.fn((values: { email: string }) => ({
        email: values.email ? undefined : 'Required',
      }));

      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' }, validate })
      );

      act(() => {
        result.current.setField('email', 'test');
      });

      expect(validate).not.toHaveBeenCalled();
    });
  });

  describe('setFields', () => {
    it('should update multiple fields', () => {
      const { result } = renderHook(() =>
        useFormState({
          initialValues: { email: '', password: '', name: '' },
        })
      );

      act(() => {
        result.current.setFields({ email: 'test@example.com', password: '12345' });
      });

      expect(result.current.values).toEqual({
        email: 'test@example.com',
        password: '12345',
        name: '',
      });
    });
  });

  describe('touchField', () => {
    it('should mark field as touched', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      act(() => {
        result.current.touchField('email');
      });

      expect(result.current.touched.email).toBe(true);
    });

    it('should track multiple touched fields', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '', password: '' } })
      );

      act(() => {
        result.current.touchField('email');
        result.current.touchField('password');
      });

      expect(result.current.touched.email).toBe(true);
      expect(result.current.touched.password).toBe(true);
    });
  });

  describe('Validation', () => {
    it('should validate all fields', () => {
      const validate = vi.fn((values: { email: string; password: string }) => ({
        email: values.email ? undefined : 'Email required',
        password: values.password.length >= 8 ? undefined : 'Password too short',
      }));

      const { result } = renderHook(() =>
        useFormState({
          initialValues: { email: '', password: '123' },
          validate,
        })
      );

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.errors).toEqual({
        email: 'Email required',
        password: 'Password too short',
      });
    });

    it('should return errors from validateAll', () => {
      const validate = (values: { email: string }) => ({
        email: values.email ? undefined : 'Required',
      });

      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' }, validate })
      );

      let errors;
      act(() => {
        errors = result.current.validateAll();
      });

      expect(errors).toEqual({ email: 'Required' });
    });

    it('should handle no validation function', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      let errors;
      act(() => {
        errors = result.current.validateAll();
      });

      expect(errors).toEqual({});
    });
  });

  describe('isDirty', () => {
    it('should be false initially', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      expect(result.current.isDirty).toBe(false);
    });

    it('should be true after field change', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      act(() => {
        result.current.setField('email', 'test');
      });

      expect(result.current.isDirty).toBe(true);
    });

    it('should be false after reset', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      act(() => {
        result.current.setField('email', 'test');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.isDirty).toBe(false);
    });
  });

  describe('isValid', () => {
    it('should be true when no errors', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: 'test@example.com' } })
      );

      expect(result.current.isValid).toBe(true);
    });

    it('should be false when errors exist', () => {
      const validate = (values: { email: string }) => ({
        email: values.email ? undefined : 'Required',
      });

      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' }, validate })
      );

      act(() => {
        result.current.validateAll();
      });

      expect(result.current.isValid).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset values to initial', () => {
      const initialValues = { email: '', password: '' };
      const { result } = renderHook(() =>
        useFormState({ initialValues })
      );

      act(() => {
        result.current.setFields({ email: 'test', password: '12345' });
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.values).toEqual(initialValues);
    });

    it('should clear touched fields', () => {
      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' } })
      );

      act(() => {
        result.current.touchField('email');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.touched).toEqual({});
    });

    it('should clear errors', () => {
      const validate = (values: { email: string }) => ({
        email: values.email ? undefined : 'Required',
      });

      const { result } = renderHook(() =>
        useFormState({ initialValues: { email: '' }, validate })
      );

      act(() => {
        result.current.validateAll();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.errors).toEqual({});
    });
  });
});
