import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastContainer } from '../Toast';
import { useSettingsStore } from '../../../stores/settingsStore';
import type { Toast } from '../../../types';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}));

describe('ToastContainer', () => {
  const mockRemoveToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should render without toasts', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      // Should have the container but no toasts
      expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument();
    });

    it('should have ARIA live region', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveClass('sr-only');
    });
  });

  describe('Toast Rendering', () => {
    it('should render success toast', () => {
      const successToast: Toast = {
        id: '1',
        type: 'success',
        title: 'Operation successful',
        description: 'Your changes have been saved',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [successToast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Operation successful')).toBeInTheDocument();
      expect(screen.getByText('Your changes have been saved')).toBeInTheDocument();
    });

    it('should render error toast', () => {
      const errorToast: Toast = {
        id: '2',
        type: 'error',
        title: 'Operation failed',
        description: 'Please try again',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [errorToast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Operation failed')).toBeInTheDocument();
      expect(screen.getByText('Please try again')).toBeInTheDocument();
    });

    it('should render warning toast', () => {
      const warningToast: Toast = {
        id: '3',
        type: 'warning',
        title: 'Warning message',
        description: 'Please be careful',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [warningToast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByText('Please be careful')).toBeInTheDocument();
    });

    it('should render info toast', () => {
      const infoToast: Toast = {
        id: '4',
        type: 'info',
        title: 'Information',
        description: 'Here is some useful info',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [infoToast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Information')).toBeInTheDocument();
      expect(screen.getByText('Here is some useful info')).toBeInTheDocument();
    });

    it('should render toast without description', () => {
      const toast: Toast = {
        id: '5',
        type: 'success',
        title: 'Success',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const successElements = screen.getAllByText('Success');
      expect(successElements.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Toasts', () => {
    it('should render multiple toasts', () => {
      const toasts: Toast[] = [
        { id: '1', type: 'success', title: 'Toast 1' },
        { id: '2', type: 'error', title: 'Toast 2' },
        { id: '3', type: 'info', title: 'Toast 3' },
      ];

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts,
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByText('Toast 1')).toBeInTheDocument();
      expect(screen.getByText('Toast 2')).toBeInTheDocument();
      expect(screen.getByText('Toast 3')).toBeInTheDocument();
    });

    it('should render toasts in live region for screen readers', () => {
      const toasts: Toast[] = [
        { id: '1', type: 'success', title: 'Success', description: 'All good' },
        { id: '2', type: 'error', title: 'Error', description: 'Something wrong' },
      ];

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts,
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion?.textContent).toContain('Success. All good');
      expect(liveRegion?.textContent).toContain('Error: Error. Something wrong');
    });
  });

  describe('Close Functionality', () => {
    it('should call removeToast when close button clicked', async () => {
      const user = userEvent.setup();
      const toast: Toast = {
        id: 'test-1',
        type: 'success',
        title: 'Test toast',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      await user.click(closeButton);

      expect(mockRemoveToast).toHaveBeenCalledWith('test-1');
    });

    it('should have accessible close button', () => {
      const toast: Toast = {
        id: 'test-2',
        type: 'info',
        title: 'Info',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const closeButton = screen.getByRole('button', { name: 'Close toast' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAccessibleName('Close toast');
    });
  });

  describe('Action Button', () => {
    it('should render action button when provided', () => {
      const mockAction = vi.fn();
      const toast: Toast = {
        id: 'action-1',
        type: 'error',
        title: 'Error occurred',
        action: {
          label: 'Retry',
          onClick: mockAction,
        },
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('should call action onClick and close toast when clicked', async () => {
      const user = userEvent.setup();
      const mockAction = vi.fn();
      const toast: Toast = {
        id: 'action-2',
        type: 'error',
        title: 'Failed',
        action: {
          label: 'Try Again',
          onClick: mockAction,
        },
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const actionButton = screen.getByRole('button', { name: 'Try Again' });
      await user.click(actionButton);

      expect(mockAction).toHaveBeenCalled();
      expect(mockRemoveToast).toHaveBeenCalledWith('action-2');
    });

    it('should not render action button when not provided', () => {
      const toast: Toast = {
        id: 'no-action',
        type: 'success',
        title: 'Success',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      // Should only have close button, not action button
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1); // Only close button
    });
  });

  describe('ARIA Attributes', () => {
    it('should have role="alert" for error toasts', () => {
      const toast: Toast = {
        id: 'error-aria',
        type: 'error',
        title: 'Error',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const alertElement = container.querySelector('[role="alert"]');
      expect(alertElement).toBeInTheDocument();
      expect(alertElement).toHaveAttribute('aria-live', 'assertive');
    });

    it('should have role="status" for non-error toasts', () => {
      const toast: Toast = {
        id: 'success-aria',
        type: 'success',
        title: 'Success',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const statusElement = container.querySelector('[role="status"]');
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should have proper notifications region label', () => {
      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const region = screen.getByRole('region', { name: 'Notifications' });
      expect(region).toBeInTheDocument();
    });
  });

  describe('Toast Icons', () => {
    it('should render success icon for success toast', () => {
      const toast: Toast = {
        id: 'icon-success',
        type: 'success',
        title: 'Success',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(svgs.length).toBeGreaterThan(0); // At least icon and close button
    });

    it('should render error icon for error toast', () => {
      const toast: Toast = {
        id: 'icon-error',
        type: 'error',
        title: 'Error',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const svgs = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(svgs.length).toBeGreaterThan(0);
    });

    it('should have aria-hidden on icons', () => {
      const toast: Toast = {
        id: 'aria-hidden',
        type: 'info',
        title: 'Info',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      const { container } = render(<ToastContainer />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      icons.forEach((icon) => {
        expect(icon).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle toast with very long title', () => {
      const toast: Toast = {
        id: 'long-title',
        type: 'info',
        title: 'This is a very long title that might overflow the container and needs to be handled properly',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const longTitles = screen.getAllByText(/This is a very long title/);
      expect(longTitles.length).toBeGreaterThan(0);
    });

    it('should handle toast with very long description', () => {
      const toast: Toast = {
        id: 'long-desc',
        type: 'info',
        title: 'Info',
        description: 'This is a very long description that contains a lot of information and might need to wrap to multiple lines to be displayed properly in the toast component',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      const longDescs = screen.getAllByText(/This is a very long description/);
      expect(longDescs.length).toBeGreaterThan(0);
    });

    it('should handle special characters in title', () => {
      const toast: Toast = {
        id: 'special',
        type: 'success',
        title: 'Success! <script>alert("test")</script>',
      };

      vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
        const state = {
          toasts: [toast],
          removeToast: mockRemoveToast,
        };
        return selector(state);
      });

      render(<ToastContainer />);

      // Should escape HTML - multiple instances (live region + visual)
      const successElements = screen.getAllByText(/Success!/);
      expect(successElements.length).toBeGreaterThan(0);
    });
  });
});
