import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapSettings } from '../SwapSettings';
import { useSettingsStore } from '../../../stores/settingsStore';

// Mock store
vi.mock('../../../stores/settingsStore');

describe('SwapSettings', () => {
  const mockUpdateSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render slippage label', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByText('Slippage:')).toBeInTheDocument();
    });

    it('should render 0.5% option', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByRole('button', { name: '0.5%' })).toBeInTheDocument();
    });

    it('should render 1% option', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByRole('button', { name: '1%' })).toBeInTheDocument();
    });

    it('should have group role for buttons container', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByRole('group', { name: 'Slippage tolerance' })).toBeInTheDocument();
    });
  });

  describe('Active State', () => {
    it('should show 0.5% as active when selected', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '0.5%' });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show 1% as active when selected', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 1.0,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '1%' });
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show 0.5% as not active when 1% selected', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 1.0,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '0.5%' });
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should apply active styles to selected option', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '0.5%' });
      expect(button).toHaveClass('bg-primary', 'text-white');
    });

    it('should apply inactive styles to non-selected option', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '1%' });
      expect(button).toHaveClass('bg-neutral-800', 'text-neutral-300');
    });
  });

  describe('Tooltips', () => {
    it('should have "Recommended" tooltip for 0.5%', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '0.5%' });
      expect(button).toHaveAttribute('title', 'Recommended');
    });

    it('should have "Volatile pairs" tooltip for 1%', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button = screen.getByRole('button', { name: '1%' });
      expect(button).toHaveAttribute('title', 'Volatile pairs');
    });
  });

  describe('Interaction', () => {
    it('should call updateSettings when clicking 0.5%', async () => {
      const user = userEvent.setup();
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 1.0,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      await user.click(screen.getByRole('button', { name: '0.5%' }));

      expect(mockUpdateSettings).toHaveBeenCalledWith({ slippageTolerance: 0.5 });
    });

    it('should call updateSettings when clicking 1%', async () => {
      const user = userEvent.setup();
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      await user.click(screen.getByRole('button', { name: '1%' }));

      expect(mockUpdateSettings).toHaveBeenCalledWith({ slippageTolerance: 1.0 });
    });

    it('should allow clicking already selected option', async () => {
      const user = userEvent.setup();
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      await user.click(screen.getByRole('button', { name: '0.5%' }));

      expect(mockUpdateSettings).toHaveBeenCalledWith({ slippageTolerance: 0.5 });
    });

    it('should call updateSettings only once per click', async () => {
      const user = userEvent.setup();
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      await user.click(screen.getByRole('button', { name: '1%' }));

      expect(mockUpdateSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have aria-pressed attributes', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByRole('button', { name: '0.5%' })).toHaveAttribute('aria-pressed');
      expect(screen.getByRole('button', { name: '1%' })).toHaveAttribute('aria-pressed');
    });

    it('should have aria-label on group', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Slippage tolerance');
    });

    it('should have title attributes for tooltips', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const button05 = screen.getByRole('button', { name: '0.5%' });
      const button1 = screen.getByRole('button', { name: '1%' });

      expect(button05).toHaveAttribute('title');
      expect(button1).toHaveAttribute('title');
    });
  });

  describe('Layout', () => {
    it('should render both buttons in a flex container', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      const { container } = render(<SwapSettings />);

      const group = container.querySelector('[role="group"]');
      expect(group).toHaveClass('flex', 'gap-1');
    });

    it('should have consistent button styling', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          slippageTolerance: 0.5,
          updateSettings: mockUpdateSettings,
        };
        return selector(state);
      });

      render(<SwapSettings />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveClass('px-2', 'py-1', 'text-xs', 'rounded-lg', 'font-medium');
      });
    });
  });
});
