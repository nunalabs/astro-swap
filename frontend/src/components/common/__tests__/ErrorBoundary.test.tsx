import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary';
import { captureError, addBreadcrumb } from '../../../lib/sentry';

// Mock Sentry
vi.mock('../../../lib/sentry', () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// Mock Button
vi.mock('../Button', () => ({
  Button: forwardRef(({ children, onClick, variant, ...props }: any, ref: any) => (
    <button ref={ref} onClick={onClick} data-variant={variant} {...props}>
      {children}
    </button>
  )),
}));

// Component that throws error on demand
function ThrowError({ shouldThrow, error }: { shouldThrow: boolean; error?: Error }) {
  if (shouldThrow) {
    throw error || new Error('Test error');
  }
  return <div>Working component</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('Normal Operation', () => {
    it('should render children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should not show error UI when working normally', () => {
      render(
        <ErrorBoundary>
          <div>Normal operation</div>
        </ErrorBoundary>
      );

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should pass through all children props', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child" className="test-class">
            Child
          </div>
        </ErrorBoundary>
      );

      const child = screen.getByTestId('child');
      expect(child).toHaveClass('test-class');
    });
  });

  describe('Error Catching', () => {
    it('should catch errors from children', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should display error UI when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="assertive" on error container', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should show error icon', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const icon = container.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should call captureError with error details', () => {
      const testError = new Error('Test error message');

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} error={testError} />
        </ErrorBoundary>
      );

      expect(captureError).toHaveBeenCalledWith(
        testError,
        expect.objectContaining({
          errorBoundary: true,
        })
      );
    });

    it('should call addBreadcrumb when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(addBreadcrumb).toHaveBeenCalledWith(
        'React error boundary triggered',
        'error',
        expect.any(Object)
      );
    });

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error UI', () => {
    it('should show error heading', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should show error description', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(
        screen.getByText(/An unexpected error occurred. Please try again or reload the page./)
      ).toBeInTheDocument();
    });

    it('should show Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    it('should show Reload Page button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();
    });

    it('should use secondary variant for Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
      expect(tryAgainButton).toHaveAttribute('data-variant', 'secondary');
    });

    it('should use primary variant for Reload Page button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByRole('button', { name: 'Reload Page' });
      expect(reloadButton).toHaveAttribute('data-variant', 'primary');
    });
  });

  describe('Technical Details', () => {
    it('should show technical details section', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error('Detailed error')} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Technical details')).toBeInTheDocument();
    });

    it('should show error message in details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} error={new Error('Custom error message')} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Custom error message/)).toBeInTheDocument();
    });

    it('should use details/summary for collapsible section', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const details = container.querySelector('details');
      const summary = container.querySelector('summary');

      expect(details).toBeInTheDocument();
      expect(summary).toBeInTheDocument();
    });

    it('should show component stack when available', () => {
      // Component stack is added by componentDidCatch
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show "Component Stack:" text
      expect(screen.getByText(/Component Stack:/)).toBeInTheDocument();
    });
  });

  describe('Recovery Actions', () => {
    it('should have Try Again button that resets state', async () => {
      const user = userEvent.setup();
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error UI is shown
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Try Again button exists and can be clicked
      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
      expect(tryAgainButton).toBeInTheDocument();

      // Click should not throw
      await user.click(tryAgainButton);
    });

    it('should reload page when Reload Page clicked', async () => {
      const user = userEvent.setup();
      const reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadSpy },
        writable: true,
      });

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      await user.click(screen.getByRole('button', { name: 'Reload Page' }));

      expect(reloadSpy).toHaveBeenCalled();
    });
  });

  describe('Custom Fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    it('should not show default UI when custom fallback provided', () => {
      const customFallback = <div>Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should render complex custom fallback', () => {
      const customFallback = (
        <div>
          <h1>Custom Title</h1>
          <p>Custom message</p>
          <button>Custom button</button>
        </div>
      );

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Title')).toBeInTheDocument();
      expect(screen.getByText('Custom message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom button' })).toBeInTheDocument();
    });
  });

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent = () => <div>Test Component</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent />);

      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const WrappedThrowError = withErrorBoundary(ThrowError);

      render(<WrappedThrowError shouldThrow={true} />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should pass props to wrapped component', () => {
      const TestComponent = ({ text }: { text: string }) => <div>{text}</div>;
      const WrappedComponent = withErrorBoundary(TestComponent);

      render(<WrappedComponent text="Passed prop" />);

      expect(screen.getByText('Passed prop')).toBeInTheDocument();
    });

    it('should support custom fallback in HOC', () => {
      const customFallback = <div>HOC custom fallback</div>;
      const WrappedThrowError = withErrorBoundary(ThrowError, customFallback);

      render(<WrappedThrowError shouldThrow={true} />);

      expect(screen.getByText('HOC custom fallback')).toBeInTheDocument();
    });

    it('should preserve component functionality when no error', () => {
      const TestComponent = ({ onClick }: { onClick: () => void }) => (
        <button onClick={onClick}>Click me</button>
      );
      const WrappedComponent = withErrorBoundary(TestComponent);
      const mockOnClick = vi.fn();

      render(<WrappedComponent onClick={mockOnClick} />);

      const button = screen.getByRole('button', { name: 'Click me' });
      button.click();

      expect(mockOnClick).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="alert" on error container', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have aria-live="assertive" for immediate announcement', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
    });

    it('should hide decorative icon from screen readers', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have accessible buttons', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reload Page' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without messages', () => {
      const errorWithoutMessage = new Error();
      errorWithoutMessage.message = '';

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} error={errorWithoutMessage} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should handle multiple child components', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('should catch error from any child in tree', () => {
      render(
        <ErrorBoundary>
          <div>
            <div>
              <ThrowError shouldThrow={true} />
            </div>
          </div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });
});
