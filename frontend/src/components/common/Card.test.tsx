import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../test/utils';
import { Card } from './Card';

describe('Card', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('renders with default variant', () => {
      render(<Card data-testid="card">Default</Card>);
      // The text is direct child of the Card, so the element with the text has the classes
      const card = screen.getByText('Default');
      expect(card).toHaveClass('bg-card');
    });

    it('renders gradient variant', () => {
      render(<Card variant="gradient">Gradient</Card>);
      const card = screen.getByText('Gradient');
      expect(card).toHaveClass('bg-gradient-card');
    });

    it('renders glass variant', () => {
      render(<Card variant="glass">Glass</Card>);
      const card = screen.getByText('Glass');
      expect(card).toHaveClass('glass');
    });
  });

  describe('padding', () => {
    it('applies no padding', () => {
      render(<Card padding="none">No Padding</Card>);
      const card = screen.getByText('No Padding');
      expect(card).not.toHaveClass('p-4', 'p-6', 'p-8');
    });

    it('applies small padding', () => {
      render(<Card padding="sm">Small</Card>);
      const card = screen.getByText('Small');
      expect(card).toHaveClass('p-4');
    });

    it('applies medium padding (default)', () => {
      render(<Card>Medium</Card>);
      const card = screen.getByText('Medium');
      expect(card).toHaveClass('p-6');
    });

    it('applies large padding', () => {
      render(<Card padding="lg">Large</Card>);
      const card = screen.getByText('Large');
      expect(card).toHaveClass('p-8');
    });
  });

  describe('hover', () => {
    it('renders static card when hover is false', () => {
      render(<Card hover={false}>Static</Card>);
      const card = screen.getByText('Static');
      expect(card).not.toHaveClass('cursor-pointer');
    });

    it('renders motion card with cursor pointer when hover is true', () => {
      render(<Card hover>Hoverable</Card>);
      const card = screen.getByText('Hoverable');
      expect(card).toHaveClass('cursor-pointer');
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<Card onClick={handleClick}>Clickable</Card>);

      fireEvent.click(screen.getByText('Clickable'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling', () => {
    it('applies base styles', () => {
      render(<Card>Base Styles</Card>);
      const card = screen.getByText('Base Styles');
      expect(card).toHaveClass('rounded-xl', 'border', 'shadow-card');
    });

    it('supports custom className', () => {
      render(<Card className="custom-class">Custom</Card>);
      const card = screen.getByText('Custom');
      expect(card).toHaveClass('custom-class');
    });
  });
});
