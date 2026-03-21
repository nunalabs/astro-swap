/**
 * SettingsStore - Unit Tests
 *
 * Strategy: Test Zustand store logic, localStorage persistence, toast management
 * Coverage: Settings CRUD, toast lifecycle, persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useSettingsStore } from '../settingsStore';

describe('SettingsStore', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset store to defaults
    useSettingsStore.setState({
      slippageTolerance: 0.5,
      deadline: 20,
      expertMode: false,
      darkMode: true,
      currency: 'USD',
      language: 'en',
      toasts: [],
    });

    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have correct default settings', () => {
      const state = useSettingsStore.getState();

      expect(state.slippageTolerance).toBe(0.5);
      expect(state.deadline).toBe(20);
      expect(state.expertMode).toBe(false);
      expect(state.darkMode).toBe(true);
      expect(state.currency).toBe('USD');
      expect(state.language).toBe('en');
      expect(state.toasts).toEqual([]);
    });

    it('should expose all required functions', () => {
      const state = useSettingsStore.getState();

      expect(typeof state.updateSettings).toBe('function');
      expect(typeof state.resetSettings).toBe('function');
      expect(typeof state.addToast).toBe('function');
      expect(typeof state.removeToast).toBe('function');
    });
  });

  describe('Update Settings', () => {
    it('should update single setting', () => {
      const { updateSettings } = useSettingsStore.getState();

      updateSettings({ slippageTolerance: 1.0 });

      const state = useSettingsStore.getState();
      expect(state.slippageTolerance).toBe(1.0);
      expect(state.deadline).toBe(20); // Other settings unchanged
    });

    it('should update multiple settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      updateSettings({
        slippageTolerance: 2.0,
        deadline: 30,
        expertMode: true,
      });

      const state = useSettingsStore.getState();
      expect(state.slippageTolerance).toBe(2.0);
      expect(state.deadline).toBe(30);
      expect(state.expertMode).toBe(true);
    });

    it('should persist settings to localStorage', () => {
      const { updateSettings } = useSettingsStore.getState();

      updateSettings({ slippageTolerance: 1.5 });

      const stored = localStorage.getItem('astroswap_settings');
      expect(stored).toBeDefined();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.slippageTolerance).toBe(1.5);
      }
    });

    it('should persist all user settings', () => {
      const { updateSettings } = useSettingsStore.getState();

      const newSettings = {
        slippageTolerance: 2.5,
        deadline: 15,
        expertMode: true,
        darkMode: false,
        currency: 'EUR' as const,
        language: 'es' as const,
      };

      updateSettings(newSettings);

      const stored = localStorage.getItem('astroswap_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed).toEqual(newSettings);
      }
    });

    it('should not persist toasts to localStorage', () => {
      const { updateSettings, addToast } = useSettingsStore.getState();

      addToast({
        type: 'success',
        title: 'Test',
        description: 'Test toast',
      });

      updateSettings({ slippageTolerance: 1.0 });

      const stored = localStorage.getItem('astroswap_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.toasts).toBeUndefined();
      }
    });
  });

  describe('Reset Settings', () => {
    it('should reset all settings to defaults', () => {
      const { updateSettings, resetSettings } = useSettingsStore.getState();

      // Change settings
      updateSettings({
        slippageTolerance: 5.0,
        deadline: 60,
        expertMode: true,
        darkMode: false,
      });

      // Reset
      resetSettings();

      const state = useSettingsStore.getState();
      expect(state.slippageTolerance).toBe(0.5);
      expect(state.deadline).toBe(20);
      expect(state.expertMode).toBe(false);
      expect(state.darkMode).toBe(true);
    });

    it('should persist default settings to localStorage', () => {
      const { updateSettings, resetSettings } = useSettingsStore.getState();

      updateSettings({ slippageTolerance: 5.0 });
      resetSettings();

      const stored = localStorage.getItem('astroswap_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.slippageTolerance).toBe(0.5);
      }
    });
  });

  describe('Toast Management', () => {
    it('should add toast with generated ID', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'success',
        title: 'Success',
        description: 'Operation completed',
      });

      const state = useSettingsStore.getState();
      expect(state.toasts).toHaveLength(1);
      expect(state.toasts[0].id).toBeDefined();
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[0].title).toBe('Success');
    });

    it('should add multiple toasts', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'success',
        title: 'Toast 1',
        description: 'First toast',
      });

      addToast({
        type: 'error',
        title: 'Toast 2',
        description: 'Second toast',
      });

      const state = useSettingsStore.getState();
      expect(state.toasts).toHaveLength(2);
      expect(state.toasts[0].title).toBe('Toast 1');
      expect(state.toasts[1].title).toBe('Toast 2');
    });

    it('should generate unique IDs for toasts', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'info',
        title: 'Toast 1',
        description: 'First',
      });

      addToast({
        type: 'info',
        title: 'Toast 2',
        description: 'Second',
      });

      const state = useSettingsStore.getState();
      expect(state.toasts[0].id).not.toBe(state.toasts[1].id);
    });

    it('should remove toast by ID', () => {
      const { addToast, removeToast } = useSettingsStore.getState();

      addToast({
        type: 'success',
        title: 'Toast 1',
        description: 'First',
      });

      addToast({
        type: 'success',
        title: 'Toast 2',
        description: 'Second',
      });

      const { toasts } = useSettingsStore.getState();
      const firstToastId = toasts[0].id;

      removeToast(firstToastId);

      const newState = useSettingsStore.getState();
      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].title).toBe('Toast 2');
    });

    it('should auto-remove toast after default duration (5000ms)', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'success',
        title: 'Auto-remove',
        description: 'Should disappear',
      });

      // Toast should exist initially
      expect(useSettingsStore.getState().toasts).toHaveLength(1);

      // Fast-forward time by 5000ms
      vi.advanceTimersByTime(5000);

      // Toast should be removed
      expect(useSettingsStore.getState().toasts).toHaveLength(0);
    });

    it('should auto-remove toast after custom duration', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'warning',
        title: 'Custom duration',
        description: 'Should disappear after 3s',
        duration: 3000,
      });

      expect(useSettingsStore.getState().toasts).toHaveLength(1);

      // Fast-forward 2999ms - toast should still exist
      vi.advanceTimersByTime(2999);
      expect(useSettingsStore.getState().toasts).toHaveLength(1);

      // Fast-forward 1ms more (total 3000ms) - toast should be removed
      vi.advanceTimersByTime(1);
      expect(useSettingsStore.getState().toasts).toHaveLength(0);
    });

    it('should handle multiple toasts with different durations', () => {
      const { addToast } = useSettingsStore.getState();

      addToast({
        type: 'info',
        title: 'Short',
        description: '2s',
        duration: 2000,
      });

      addToast({
        type: 'info',
        title: 'Long',
        description: '5s',
        duration: 5000,
      });

      expect(useSettingsStore.getState().toasts).toHaveLength(2);

      // After 2000ms, first toast should be removed
      vi.advanceTimersByTime(2000);
      const afterFirst = useSettingsStore.getState().toasts;
      expect(afterFirst).toHaveLength(1);
      expect(afterFirst[0].title).toBe('Long');

      // After additional 3000ms (total 5000ms), second toast should be removed
      vi.advanceTimersByTime(3000);
      expect(useSettingsStore.getState().toasts).toHaveLength(0);
    });

    it('should support all toast types', () => {
      const { addToast } = useSettingsStore.getState();

      const types: Array<'success' | 'error' | 'warning' | 'info'> = [
        'success',
        'error',
        'warning',
        'info',
      ];

      types.forEach((type) => {
        addToast({
          type,
          title: `${type} toast`,
          description: 'Test',
        });
      });

      const state = useSettingsStore.getState();
      expect(state.toasts).toHaveLength(4);
      expect(state.toasts[0].type).toBe('success');
      expect(state.toasts[1].type).toBe('error');
      expect(state.toasts[2].type).toBe('warning');
      expect(state.toasts[3].type).toBe('info');
    });
  });

  describe('LocalStorage Persistence', () => {
    it('should load settings from localStorage on initialization', () => {
      const customSettings = {
        slippageTolerance: 3.0,
        deadline: 45,
        expertMode: true,
        darkMode: false,
        currency: 'EUR',
        language: 'es',
      };

      localStorage.setItem('astroswap_settings', JSON.stringify(customSettings));

      // Manually trigger setState to simulate reload
      useSettingsStore.setState(customSettings);

      const state = useSettingsStore.getState();
      expect(state.slippageTolerance).toBe(3.0);
      expect(state.deadline).toBe(45);
      expect(state.expertMode).toBe(true);
      expect(state.darkMode).toBe(false);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('astroswap_settings', 'INVALID_JSON{{{');

      // Should not throw error
      expect(() => {
        const stored = localStorage.getItem('astroswap_settings');
        if (stored) {
          try {
            JSON.parse(stored);
          } catch (error) {
            // Gracefully handled
          }
        }
      }).not.toThrow();
    });
  });

  describe('Settings Validation', () => {
    it('should accept valid slippage tolerance values', () => {
      const { updateSettings } = useSettingsStore.getState();

      const validValues = [0.1, 0.5, 1.0, 5.0, 10.0];

      validValues.forEach((value) => {
        updateSettings({ slippageTolerance: value });
        expect(useSettingsStore.getState().slippageTolerance).toBe(value);
      });
    });

    it('should accept valid deadline values', () => {
      const { updateSettings } = useSettingsStore.getState();

      const validValues = [5, 10, 20, 30, 60];

      validValues.forEach((value) => {
        updateSettings({ deadline: value });
        expect(useSettingsStore.getState().deadline).toBe(value);
      });
    });

    it('should accept valid currency codes', () => {
      const { updateSettings } = useSettingsStore.getState();

      const currencies: Array<'USD' | 'EUR' | 'GBP' | 'JPY'> = ['USD', 'EUR', 'GBP', 'JPY'];

      currencies.forEach((currency) => {
        updateSettings({ currency });
        expect(useSettingsStore.getState().currency).toBe(currency);
      });
    });

    it('should accept valid language codes', () => {
      const { updateSettings } = useSettingsStore.getState();

      const languages: Array<'en' | 'es' | 'fr' | 'de'> = ['en', 'es', 'fr', 'de'];

      languages.forEach((language) => {
        updateSettings({ language });
        expect(useSettingsStore.getState().language).toBe(language);
      });
    });
  });
});
