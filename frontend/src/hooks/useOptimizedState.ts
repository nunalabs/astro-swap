import { useState, useCallback, useRef } from 'react';

/**
 * Hook for batching multiple state updates into a single render.
 * Prevents multiple re-renders when updating several related state values.
 *
 * @example
 * ```tsx
 * // Instead of:
 * setAmountIn(value);    // render 1
 * setAmountOut('');      // render 2
 * setPriceImpact(0);     // render 3
 *
 * // Use:
 * const [state, setState, batchUpdate] = useOptimizedState({
 *   amountIn: '',
 *   amountOut: '',
 *   priceImpact: 0,
 * });
 *
 * batchUpdate({ amountIn: value, amountOut: '', priceImpact: 0 }); // single render
 * ```
 */

export function useOptimizedState<T extends Record<string, unknown>>(
  initialState: T
): [
  T,
  (key: keyof T, value: T[keyof T]) => void,
  (updates: Partial<T>) => void,
  () => void
] {
  const [state, setState] = useState<T>(initialState);
  const initialRef = useRef(initialState);

  // Update single field
  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Batch update multiple fields in single render
  const batchUpdate = useCallback((updates: Partial<T>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    setState(initialRef.current);
  }, []);

  return [state, setField, batchUpdate, reset];
}

/**
 * Hook for managing modal state with stable callbacks.
 * Prevents modal re-renders due to callback changes.
 *
 * @example
 * ```tsx
 * const { isOpen, open, close, toggle } = useModalState();
 *
 * <Button onClick={open}>Open Modal</Button>
 * <Modal isOpen={isOpen} onClose={close}>...</Modal>
 * ```
 */
export function useModalState(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle, setIsOpen };
}

/**
 * Hook for managing form state with validation.
 * Combines state, validation, and dirty tracking.
 *
 * @example
 * ```tsx
 * const form = useFormState({
 *   initialValues: { email: '', password: '' },
 *   validate: (values) => ({
 *     email: values.email ? undefined : 'Required',
 *     password: values.password.length < 8 ? 'Too short' : undefined,
 *   }),
 * });
 *
 * <input
 *   value={form.values.email}
 *   onChange={(e) => form.setField('email', e.target.value)}
 * />
 * {form.errors.email && <span>{form.errors.email}</span>}
 * ```
 */
interface UseFormStateOptions<T> {
  initialValues: T;
  validate?: (values: T) => Partial<Record<keyof T, string | undefined>>;
}

export function useFormState<T extends Record<string, unknown>>({
  initialValues,
  validate,
}: UseFormStateOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | undefined>>>({});

  const initialRef = useRef(initialValues);

  // Validate all fields
  const validateAll = useCallback(() => {
    if (!validate) return {};
    const newErrors = validate(values);
    setErrors(newErrors);
    return newErrors;
  }, [validate, values]);

  // Set single field value
  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => {
      const newValues = { ...prev, [key]: value };
      // Validate on change if field was touched
      if (validate && touched[key]) {
        const newErrors = validate(newValues);
        setErrors(newErrors);
      }
      return newValues;
    });
  }, [validate, touched]);

  // Mark field as touched
  const touchField = useCallback(<K extends keyof T>(key: K) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  // Batch update multiple fields
  const setFields = useCallback((updates: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...updates }));
  }, []);

  // Reset form to initial values
  const reset = useCallback(() => {
    setValues(initialRef.current);
    setTouched({});
    setErrors({});
  }, []);

  // Check if form is dirty (values changed from initial)
  const isDirty = Object.keys(values).some(
    (key) => values[key as keyof T] !== initialRef.current[key as keyof T]
  );

  // Check if form is valid (no errors)
  const isValid = !Object.values(errors).some((error) => error !== undefined);

  return {
    values,
    errors,
    touched,
    isDirty,
    isValid,
    setField,
    setFields,
    touchField,
    validateAll,
    reset,
  };
}
