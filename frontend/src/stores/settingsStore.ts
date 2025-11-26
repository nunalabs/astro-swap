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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  toasts: [],

  updateSettings: (settings: Partial<UserSettings>) => {
    set((state) => {
      const newSettings = { ...state, ...settings };

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

// Load settings from localStorage
const storedSettings = localStorage.getItem('astroswap_settings');
if (storedSettings) {
  try {
    const settings = JSON.parse(storedSettings);
    useSettingsStore.setState(settings);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}
