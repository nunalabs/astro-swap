import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { Tooltip, InfoTooltip } from '../Tooltip';

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: forwardRef(({ children, ...props }: any, ref: any) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('Tooltip', () => {
  describe('Initialization', () => {
    it('should render children', () => {
      render(
        <Tooltip content="Tooltip content">
          <button>Trigger</button>
        </Tooltip>
      );

      expect(screen.getByRole('button', { name: 'Trigger' })).toBeInTheDocument();
    });

    it('should not show tooltip initially', () => {
      render(
        <Tooltip content="Tooltip content">
          <button>Trigger</button>
        </Tooltip>
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <Tooltip content="Content" className="custom-class">
          <button>Trigger</button>
        </Tooltip>
      );

      const wrapper = container.querySelector('.relative');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Show on Hover', () => {
    it('should show tooltip on mouse enter after delay', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      // Tooltip should not appear immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Wait for delay to pass
      await waitFor(
        () => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should hide tooltip on mouse leave', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should use custom delay', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={100}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      // Should not appear after 50ms
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Should appear after 100ms
      await waitFor(
        () => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });
  });

  describe('Show on Focus', () => {
    it('should show tooltip on focus after delay', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on blur', async () => {
      const user = userEvent.setup();

      render(
        <>
          <Tooltip content="Tooltip content" delay={50}>
            <button>Trigger</button>
          </Tooltip>
          <button>Other</button>
        </>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.tab(); // Move focus away

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Escape Key Dismissal', () => {
    it('should hide tooltip on Escape key', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should not dismiss on other keys', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      // Tooltip should still be visible
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  describe('Position', () => {
    it('should render with top position by default', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('bottom-full');
      });
    });

    it('should render with bottom position', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" position="bottom" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('top-full');
      });
    });

    it('should render with left position', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" position="left" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('right-full');
      });
    });

    it('should render with right position', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Tooltip content" position="right" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('left-full');
      });
    });
  });

  describe('Content Rendering', () => {
    it('should render text content', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="This is tooltip text" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText('This is tooltip text')).toBeInTheDocument();
      });
    });

    it('should render JSX content', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip
          content={
            <div>
              <strong>Bold text</strong>
              <span> and normal text</span>
            </div>
          }
          delay={50}
        >
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText('Bold text')).toBeInTheDocument();
        expect(screen.getByText(/and normal text/)).toBeInTheDocument();
      });
    });

    it('should render long content', async () => {
      const user = userEvent.setup();

      const longContent =
        'This is a very long tooltip content that should wrap properly and display correctly without breaking the layout or causing any issues';

      render(
        <Tooltip content={longContent} delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText(longContent)).toBeInTheDocument();
      });
    });
  });

  describe('Arrow', () => {
    it('should render arrow with aria-hidden', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const arrow = container.querySelector('[aria-hidden="true"]');
        expect(arrow).toBeInTheDocument();
      });
    });

    it('should have correct arrow classes for top position', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Tooltip content="Content" position="top" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const arrow = container.querySelector('[aria-hidden="true"]');
        expect(arrow).toHaveClass('border-t-neutral-800');
      });
    });

    it('should have correct arrow classes for bottom position', async () => {
      const user = userEvent.setup();

      const { container } = render(
        <Tooltip content="Content" position="bottom" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const arrow = container.querySelector('[aria-hidden="true"]');
        expect(arrow).toHaveClass('border-b-neutral-800');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have role="tooltip"', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should have z-50 for stacking context', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('z-50');
      });
    });

    it('should have max-w-xs for width constraint', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveClass('max-w-xs');
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup timeout on unmount', async () => {
      const user = userEvent.setup();

      const { unmount } = render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      // Unmount before timeout completes
      unmount();

      // Should not cause errors
    });

    it('should cleanup event listener on unmount', async () => {
      const user = userEvent.setup();

      const { unmount } = render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      unmount();

      // Should not cause errors when pressing Escape after unmount
      fireEvent.keyDown(document, { key: 'Escape' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid hover on/off', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Content" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      // Rapid hover on/off
      await user.hover(trigger);
      await user.unhover(trigger);
      await user.hover(trigger);

      // Should show tooltip after final hover
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should handle empty content', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should handle delay of 0', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Content" delay={0}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      // Should show immediately or very quickly
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should handle special characters in content', async () => {
      const user = userEvent.setup();

      render(
        <Tooltip content="Special: <>&quot;'`" delay={50}>
          <button>Trigger</button>
        </Tooltip>
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.hover(trigger);

      await waitFor(() => {
        expect(screen.getByText(/Special:/)).toBeInTheDocument();
      });
    });
  });
});

describe('InfoTooltip', () => {
  describe('Rendering', () => {
    it('should render info icon button', () => {
      render(<InfoTooltip content="Info content" />);

      expect(screen.getByRole('button', { name: 'More information' })).toBeInTheDocument();
    });

    it('should have accessible label', () => {
      render(<InfoTooltip content="Info content" />);

      const button = screen.getByRole('button', { name: 'More information' });
      expect(button).toHaveAccessibleName('More information');
    });

    it('should render SVG icon', () => {
      const { container } = render(<InfoTooltip content="Info content" />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('should accept custom className', () => {
      render(<InfoTooltip content="Info content" className="custom-class" />);

      const button = screen.getByRole('button', { name: 'More information' });
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Tooltip Functionality', () => {
    it('should show tooltip on hover', async () => {
      const user = userEvent.setup();

      render(<InfoTooltip content="Information text" />);

      const button = screen.getByRole('button', { name: 'More information' });

      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Information text')).toBeInTheDocument();
      });
    });

    it('should show tooltip on focus', async () => {
      const user = userEvent.setup();

      render(<InfoTooltip content="Information text" />);

      const button = screen.getByRole('button', { name: 'More information' });

      await user.click(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
    });

    it('should hide tooltip on unhover', async () => {
      const user = userEvent.setup();

      render(<InfoTooltip content="Information text" />);

      const button = screen.getByRole('button', { name: 'More information' });

      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });

      await user.unhover(button);

      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have type="button"', () => {
      render(<InfoTooltip content="Info" />);

      const button = screen.getByRole('button', { name: 'More information' });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should have focus ring classes', () => {
      render(<InfoTooltip content="Info" />);

      const button = screen.getByRole('button', { name: 'More information' });
      expect(button).toHaveClass('focus-visible:ring-2');
      expect(button).toHaveClass('focus-visible:ring-primary');
    });

    it('should have rounded appearance', () => {
      render(<InfoTooltip content="Info" />);

      const button = screen.getByRole('button', { name: 'More information' });
      expect(button).toHaveClass('rounded-full');
    });
  });
});
