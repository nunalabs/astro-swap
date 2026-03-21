import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { Modal } from '../Modal';

// Mock framer-motion to avoid animation complexity
vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef(({ children, onClick, ...props }: any, ref: any) => (
      <div ref={ref} onClick={onClick} {...props}>
        {children}
      </div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Modal', () => {
  let originalBodyOverflow: string;

  beforeEach(() => {
    originalBodyOverflow = document.body.style.overflow;
  });

  afterEach(() => {
    document.body.style.overflow = originalBodyOverflow;
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()}>
          <div>Modal content</div>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Modal content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('should render with title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Test Modal' })).toBeInTheDocument();
    });

    it('should render without title', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('should render close button by default', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
    });

    it('should hide close button when showClose is false', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} showClose={false}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('should apply small size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="sm">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('should apply medium size class by default', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-lg');
    });

    it('should apply large size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="lg">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-2xl');
    });

    it('should apply extra large size class', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="xl">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-4xl');
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: 'Close modal' });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key pressed', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when backdrop clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { container } = render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      // Find the backdrop (first motion.div)
      const backdrop = container.querySelector('.fixed.inset-0.bg-black\\/80');
      expect(backdrop).toBeInTheDocument();

      await user.click(backdrop!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not close when clicking modal content', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Modal content</div>
        </Modal>
      );

      await user.click(screen.getByText('Modal content'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have role="dialog"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have aria-modal="true"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-labelledby when title is provided', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('should not have aria-labelledby when title is not provided', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('should have aria-describedby when provided', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} aria-describedby="modal-description">
          <div id="modal-description">Modal description</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'modal-description');
    });

    it('should have tabIndex -1', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('tabIndex', '-1');
    });

    it('should have accessible close button label', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      const closeButton = screen.getByRole('button', { name: 'Close modal' });
      expect(closeButton).toHaveAccessibleName('Close modal');
    });
  });

  describe('Body Scroll Lock', () => {
    it('should lock body scroll when opened', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should restore body scroll when closed', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('unset');
    });

    it('should restore body scroll on unmount', () => {
      const { unmount } = render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Focus Management', () => {
    it('should have focusable elements within modal', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <input type="text" placeholder="First input" />
          <button>Action</button>
        </Modal>
      );

      // Verify focusable elements exist
      expect(screen.getByPlaceholderText('First input')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close modal' })).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
    });

    it('should restore focus to previously focused element when closed', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <>
          <button data-testid="trigger">Open Modal</button>
          <Modal isOpen={false} onClose={vi.fn()}>
            <div>Content</div>
          </Modal>
        </>
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      // Open modal
      rerender(
        <>
          <button data-testid="trigger">Open Modal</button>
          <Modal isOpen={true} onClose={vi.fn()}>
            <div>Content</div>
          </Modal>
        </>
      );

      // Wait for modal to be rendered
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close modal
      rerender(
        <>
          <button data-testid="trigger">Open Modal</button>
          <Modal isOpen={false} onClose={vi.fn()}>
            <div>Content</div>
          </Modal>
        </>
      );

      // Focus should be restored to trigger button
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should not respond to non-Escape keys', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <Modal isOpen={true} onClose={onClose}>
          <div>Content</div>
        </Modal>
      );

      await user.keyboard('{Enter}');
      await user.keyboard('{Space}');
      await user.keyboard('{ArrowDown}');

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should handle Tab when no focusable elements', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} showClose={false}>
          <div>No focusable elements</div>
        </Modal>
      );

      // Should not throw error
      await user.tab();
      await user.tab({ shift: true });
    });

    it('should trap focus with Tab - cycle from last to first element', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <input data-testid="first" type="text" />
          <button data-testid="second">Button</button>
        </Modal>
      );

      // Focus on the close button (last focusable element)
      const closeButton = screen.getByRole('button', { name: 'Close modal' });
      closeButton.focus();
      expect(closeButton).toHaveFocus();

      // Tab should cycle to first input
      await user.tab();

      await waitFor(() => {
        expect(screen.getByTestId('first')).toHaveFocus();
      });
    });

    it('should trap focus with Shift+Tab - cycle from first to last element', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <input data-testid="first" type="text" />
          <button data-testid="second">Button</button>
        </Modal>
      );

      // Focus on the first input
      const firstInput = screen.getByTestId('first');
      firstInput.focus();
      expect(firstInput).toHaveFocus();

      // Shift+Tab should cycle to close button (last element)
      await user.tab({ shift: true });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Close modal' })).toHaveFocus();
      });
    });

    it('should allow normal Tab navigation between elements', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <input data-testid="first" type="text" />
          <input data-testid="second" type="text" />
          <button data-testid="third">Button</button>
        </Modal>
      );

      const firstInput = screen.getByTestId('first');
      firstInput.focus();

      // Tab to second input
      await user.tab();
      expect(screen.getByTestId('second')).toHaveFocus();

      // Tab to third button
      await user.tab();
      expect(screen.getByTestId('third')).toHaveFocus();
    });

    it('should allow normal Shift+Tab navigation backwards', async () => {
      const user = userEvent.setup();

      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test">
          <input data-testid="first" type="text" />
          <input data-testid="second" type="text" />
          <button data-testid="third">Button</button>
        </Modal>
      );

      const thirdButton = screen.getByTestId('third');
      thirdButton.focus();

      // Shift+Tab to second input
      await user.tab({ shift: true });
      expect(screen.getByTestId('second')).toHaveFocus();

      // Shift+Tab to first input
      await user.tab({ shift: true });
      expect(screen.getByTestId('first')).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid open/close', async () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      // Rapidly toggle
      rerender(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );
      rerender(
        <Modal isOpen={false} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );
      rerender(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>Content</div>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle long content with scroll', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div style={{ height: '2000px' }}>Very long content</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('should handle content with special characters', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title={'<Test> & "Modal"'}>
          <div>Content with &lt;special&gt; characters</div>
        </Modal>
      );

      expect(screen.getByText(/Test/)).toBeInTheDocument();
      expect(screen.getByText(/special/)).toBeInTheDocument();
    });

    it('should handle disabled focusable elements', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <button disabled>Disabled Button</button>
          <input disabled />
          <button>Enabled Button</button>
        </Modal>
      );

      // Disabled elements should not be in focus trap
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should handle elements with tabindex="-1"', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <button tabIndex={-1}>Not Focusable</button>
          <button>Focusable</button>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('should render children content', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div data-testid="custom-content">
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </div>
        </Modal>
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 1')).toBeInTheDocument();
      expect(screen.getByText('Paragraph 2')).toBeInTheDocument();
    });

    it('should render complex JSX children', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>
            <h3>Heading</h3>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
            <button>Action</button>
          </div>
        </Modal>
      );

      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });
  });

  describe('Header Rendering', () => {
    it('should render header when title is provided', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test" showClose={false}>
          <div>Content</div>
        </Modal>
      );

      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });

    it('should render header when showClose is true', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} showClose={true}>
          <div>Content</div>
        </Modal>
      );

      const header = container.querySelector('.border-b');
      expect(header).toBeInTheDocument();
    });

    it('should not render header when no title and showClose is false', () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} showClose={false}>
          <div>Content</div>
        </Modal>
      );

      const header = container.querySelector('.border-b');
      expect(header).not.toBeInTheDocument();
    });
  });

  describe('Stable onClose Reference', () => {
    it('should use latest onClose callback', async () => {
      const user = userEvent.setup();
      let closeCount = 0;
      const onClose1 = vi.fn(() => closeCount++);
      const onClose2 = vi.fn(() => closeCount++);

      const { rerender } = render(
        <Modal isOpen={true} onClose={onClose1}>
          <div>Content</div>
        </Modal>
      );

      // Update onClose
      rerender(
        <Modal isOpen={true} onClose={onClose2}>
          <div>Content</div>
        </Modal>
      );

      await user.keyboard('{Escape}');

      // Should call the latest onClose (onClose2)
      expect(onClose2).toHaveBeenCalled();
      expect(closeCount).toBe(1);
    });
  });
});
