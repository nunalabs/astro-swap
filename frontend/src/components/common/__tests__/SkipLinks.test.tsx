import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkipLinks } from '../SkipLinks';

describe('SkipLinks', () => {
  describe('Default Rendering', () => {
    it('should render with default links', () => {
      render(<SkipLinks />);

      expect(screen.getByRole('navigation', { name: 'Skip links' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip to main content' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip to navigation' })).toBeInTheDocument();
    });

    it('should render navigation element', () => {
      const { container } = render(<SkipLinks />);

      const nav = container.querySelector('nav');
      expect(nav).toBeInTheDocument();
      expect(nav).toHaveAttribute('aria-label', 'Skip links');
    });

    it('should render list of links', () => {
      render(<SkipLinks />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2); // Default: main content + navigation
    });
  });

  describe('Default Links', () => {
    it('should have correct href for main content link', () => {
      render(<SkipLinks />);

      const link = screen.getByRole('link', { name: 'Skip to main content' });
      expect(link).toHaveAttribute('href', '#main-content');
    });

    it('should have correct href for navigation link', () => {
      render(<SkipLinks />);

      const link = screen.getByRole('link', { name: 'Skip to navigation' });
      expect(link).toHaveAttribute('href', '#navigation');
    });

    it('should render both default links', () => {
      render(<SkipLinks />);

      expect(screen.getByText('Skip to main content')).toBeInTheDocument();
      expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
    });
  });

  describe('Custom Links', () => {
    it('should render custom links when provided', () => {
      const customLinks = [
        { href: '#header', label: 'Skip to header' },
        { href: '#footer', label: 'Skip to footer' },
        { href: '#sidebar', label: 'Skip to sidebar' },
      ];

      render(<SkipLinks links={customLinks} />);

      expect(screen.getByRole('link', { name: 'Skip to header' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip to footer' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Skip to sidebar' })).toBeInTheDocument();
    });

    it('should have correct hrefs for custom links', () => {
      const customLinks = [
        { href: '#custom1', label: 'Custom Link 1' },
        { href: '#custom2', label: 'Custom Link 2' },
      ];

      render(<SkipLinks links={customLinks} />);

      expect(screen.getByRole('link', { name: 'Custom Link 1' })).toHaveAttribute(
        'href',
        '#custom1'
      );
      expect(screen.getByRole('link', { name: 'Custom Link 2' })).toHaveAttribute(
        'href',
        '#custom2'
      );
    });

    it('should render correct number of custom links', () => {
      const customLinks = [
        { href: '#link1', label: 'Link 1' },
        { href: '#link2', label: 'Link 2' },
        { href: '#link3', label: 'Link 3' },
        { href: '#link4', label: 'Link 4' },
      ];

      render(<SkipLinks links={customLinks} />);

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(4);
    });

    it('should render single custom link', () => {
      const customLinks = [{ href: '#single', label: 'Single Link' }];

      render(<SkipLinks links={customLinks} />);

      expect(screen.getByRole('link', { name: 'Single Link' })).toBeInTheDocument();

      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(1);
    });

    it('should handle empty custom links array', () => {
      render(<SkipLinks links={[]} />);

      const nav = screen.getByRole('navigation', { name: 'Skip links' });
      expect(nav).toBeInTheDocument();

      const items = screen.queryAllByRole('listitem');
      expect(items).toHaveLength(0);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible name on navigation', () => {
      render(<SkipLinks />);

      const nav = screen.getByRole('navigation', { name: 'Skip links' });
      expect(nav).toHaveAccessibleName('Skip links');
    });

    it('should have sr-only class for screen readers', () => {
      const { container } = render(<SkipLinks />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('sr-only');
    });

    it('should have focus-within behavior class', () => {
      const { container } = render(<SkipLinks />);

      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('focus-within:not-sr-only');
    });

    it('should have high z-index for visibility', () => {
      const { container } = render(<SkipLinks />);

      const ul = container.querySelector('ul');
      expect(ul).toHaveClass('z-[9999]');
    });

    it('should have fixed positioning', () => {
      const { container } = render(<SkipLinks />);

      const ul = container.querySelector('ul');
      expect(ul).toHaveClass('fixed');
      expect(ul).toHaveClass('top-0');
      expect(ul).toHaveClass('left-0');
    });

    it('should render all links as anchor elements', () => {
      render(<SkipLinks />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link.tagName).toBe('A');
      });
    });
  });

  describe('Visual Styles', () => {
    it('should have translate transform on links', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('translate-y-[-100%]');
        expect(link).toHaveClass('focus:translate-y-0');
      });
    });

    it('should have transition classes', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('transition-transform');
        expect(link).toHaveClass('duration-200');
      });
    });

    it('should have focus ring styles', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('focus:ring-2');
        expect(link).toHaveClass('focus:ring-white');
      });
    });

    it('should have background and text colors', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('bg-primary');
        expect(link).toHaveClass('text-white');
      });
    });

    it('should have padding classes', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('px-4');
        expect(link).toHaveClass('py-2');
      });
    });

    it('should be a block element', () => {
      const { container } = render(<SkipLinks />);

      const links = container.querySelectorAll('a');
      links.forEach((link) => {
        expect(link).toHaveClass('block');
      });
    });
  });

  describe('Link Keys', () => {
    it('should use href as key for links', () => {
      const customLinks = [
        { href: '#link1', label: 'Link 1' },
        { href: '#link2', label: 'Link 2' },
      ];

      const { container } = render(<SkipLinks links={customLinks} />);

      const items = container.querySelectorAll('li');
      expect(items).toHaveLength(2);
    });

    it('should handle unique hrefs', () => {
      const customLinks = [
        { href: '#unique1', label: 'Label 1' },
        { href: '#unique2', label: 'Label 1' }, // Same label, different href
      ];

      render(<SkipLinks links={customLinks} />);

      const links = screen.getAllByText('Label 1');
      expect(links).toHaveLength(2);
    });
  });

  describe('Memoization', () => {
    it('should be a memoized component', () => {
      expect(SkipLinks).toBeDefined();
      // memo() returns an object, not a function
      expect(typeof SkipLinks).toBe('object');
    });

    it('should not re-render with same props', () => {
      const { rerender } = render(<SkipLinks />);

      const firstNav = screen.getByRole('navigation');

      rerender(<SkipLinks />);

      const secondNav = screen.getByRole('navigation');

      // Component should still be in document
      expect(firstNav).toBe(secondNav);
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in labels', () => {
      const customLinks = [
        { href: '#special', label: 'Skip to <main> & "content"' },
      ];

      render(<SkipLinks links={customLinks} />);

      expect(screen.getByText(/Skip to <main>/)).toBeInTheDocument();
    });

    it('should handle long labels', () => {
      const customLinks = [
        {
          href: '#long',
          label: 'This is a very long skip link label that should still render correctly',
        },
      ];

      render(<SkipLinks links={customLinks} />);

      expect(
        screen.getByText(/This is a very long skip link label/)
      ).toBeInTheDocument();
    });

    it('should handle absolute URLs', () => {
      const customLinks = [{ href: 'https://example.com', label: 'External Link' }];

      render(<SkipLinks links={customLinks} />);

      const link = screen.getByRole('link', { name: 'External Link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('should handle anchor fragments with slashes', () => {
      const customLinks = [{ href: '#main/content', label: 'Main Content' }];

      render(<SkipLinks links={customLinks} />);

      const link = screen.getByRole('link', { name: 'Main Content' });
      expect(link).toHaveAttribute('href', '#main/content');
    });
  });
});
