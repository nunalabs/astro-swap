import { memo } from 'react';

interface SkipLink {
  href: string;
  label: string;
}

const DEFAULT_LINKS: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#navigation', label: 'Skip to navigation' },
];

interface SkipLinksProps {
  links?: SkipLink[];
}

/**
 * Skip links component for keyboard navigation accessibility
 * These links become visible when focused and allow users to skip to main content areas
 */
export const SkipLinks = memo(function SkipLinks({ links = DEFAULT_LINKS }: SkipLinksProps) {
  return (
    <nav aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="fixed top-0 left-0 z-[9999] flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="
                block px-4 py-2
                bg-primary text-white font-semibold
                focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary
                translate-y-[-100%] focus:translate-y-0
                transition-transform duration-200
              "
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
});
