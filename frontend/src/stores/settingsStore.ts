import { create } from 'zustand';
import type { UserSettings, Toast } from '../types';

interface SettingsState extends UserSettings {
  toasts: Toast[];
  updateSettings: (settings: Partial<UserSettings>) => void;
  resetSettings: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const DEFAULT_SETTINGS: UserSettings = {
  slippageTolerance: 0.5, // 0.5%
  deadline: 20, // 20 minutes
  expertMode: false,
  darkMode: true,
  currency: 'USD',
  language: 'en',
};

// M-3: Validation constants
const MIN_SLIPPAGE = 0;
const MAX_SLIPPAGE = 50; // Maximum 50% slippage
const MIN_DEADLINE = 1;
const MAX_DEADLINE = 180; // Maximum 3 hours

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  toasts: [],

  updateSettings: (settings: Partial<UserSettings>) => {
    set((state) => {
      // M-3: Validate settings before applying
      const validatedSettings = { ...settings };

      // Validate slippage tolerance
      if (validatedSettings.slippageTolerance !== undefined) {
        const slippage = validatedSettings.slippageTolerance;
        if (slippage < MIN_SLIPPAGE || slippage > MAX_SLIPPAGE) {
          console.warn(
            `Invalid slippage ${slippage}%, must be between ${MIN_SLIPPAGE} and ${MAX_SLIPPAGE}. Using default.`
          );
          validatedSettings.slippageTolerance = DEFAULT_SETTINGS.slippageTolerance;
        }
      }

      // Validate deadline
      if (validatedSettings.deadline !== undefined) {
        const deadline = validatedSettings.deadline;
        if (deadline < MIN_DEADLINE || deadline > MAX_DEADLINE) {
          console.warn(
            `Invalid deadline ${deadline}min, must be between ${MIN_DEADLINE} and ${MAX_DEADLINE}. Using default.`
          );
          validatedSettings.deadline = DEFAULT_SETTINGS.deadline;
        }
      }

      const newSettings = { ...state, ...validatedSettings };

      // Save to localStorage
      const settingsToSave: UserSettings = {
        slippageTolerance: newSettings.slippageTolerance,
        deadline: newSettings.deadline,
        expertMode: newSettings.expertMode,
        darkMode: newSettings.darkMode,
        currency: newSettings.currency,
        language: newSettings.language,
      };

      localStorage.setItem('astroswap_settings', JSON.stringify(settingsToSave));

      return newSettings;
    });
  },

  resetSettings: () => {
    set(DEFAULT_SETTINGS);
    localStorage.setItem('astroswap_settings', JSON.stringify(DEFAULT_SETTINGS));
  },

  addToast: (toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-remove toast after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Load settings from localStorage (with SSR guard)
if (typeof window !== 'undefined') {
  const storedSettings = localStorage.getItem('astroswap_settings');
  if (storedSettings) {
    try {
      const settings = JSON.parse(storedSettings) as Partial<UserSettings>;

      // M-3: Validate loaded settings
      const validatedSettings: Partial<UserSettings> = { ...settings };

      // Validate slippage
      if (
        validatedSettings.slippageTolerance !== undefined &&
        (validatedSettings.slippageTolerance < MIN_SLIPPAGE ||
          validatedSettings.slippageTolerance > MAX_SLIPPAGE)
      ) {
        console.warn('Invalid stored slippage, using default');
        validatedSettings.slippageTolerance = DEFAULT_SETTINGS.slippageTolerance;
      }

      // Validate deadline
      if (
        validatedSettings.deadline !== undefined &&
        (validatedSettings.deadline < MIN_DEADLINE || validatedSettings.deadline > MAX_DEADLINE)
      ) {
        console.warn('Invalid stored deadline, using default');
        validatedSettings.deadline = DEFAULT_SETTINGS.deadline;
      }

      useSettingsStore.setState(validatedSettings);
    } catch (error) {
      // M-6: Full recovery from corrupted localStorage
      console.error('Error loading settings:', error);
      console.warn('Resetting to default settings due to corrupted data');

      // Clear corrupted entry
      localStorage.removeItem('astroswap_settings');

      // Reset to defaults
      useSettingsStore.setState(DEFAULT_SETTINGS);

      // Save fresh defaults
      localStorage.setItem('astroswap_settings', JSON.stringify(DEFAULT_SETTINGS));
    }
  }
}
