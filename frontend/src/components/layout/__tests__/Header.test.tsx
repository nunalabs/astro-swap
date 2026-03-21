import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';

// Mock react-router-dom
const mockLocation = { pathname: '/swap' };
vi.mock('react-router-dom', () => ({
  Link: ({ to, children, className }: any) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useLocation: () => mockLocation,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, layoutId }: any) => (
      <div className={className} data-layout-id={layoutId}>
        {children}
      </div>
    ),
  },
}));

// Mock ConnectWallet
vi.mock('../../common/ConnectWallet', () => ({
  ConnectWallet: () => <button>Connect Wallet</button>,
}));

// Mock cn utility
vi.mock('../../../lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.pathname = '/swap';
  });

  describe('Rendering', () => {
    it('should render header', () => {
      render(<Header />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should render sticky header with glass effect', () => {
      const { container } = render(<Header />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('sticky', 'top-0', 'glass');
    });

    it('should have border bottom', () => {
      const { container } = render(<Header />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('border-b', 'border-neutral-800');
    });

    it('should have z-index for stacking', () => {
      const { container } = render(<Header />);

      const header = container.querySelector('header');
      expect(header).toHaveClass('z-40');
    });
  });

  describe('Logo', () => {
    it('should render logo link to home', () => {
      render(<Header />);

      const logoLink = screen.getByRole('link', { name: /AstroSwap/i });
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('should render AstroSwap heading', () => {
      render(<Header />);

      expect(screen.getByRole('heading', { name: 'AstroSwap' })).toBeInTheDocument();
    });

    it('should have gradient text on heading', () => {
      render(<Header />);

      const heading = screen.getByRole('heading', { name: 'AstroSwap' });
      expect(heading).toHaveClass('gradient-text');
    });

    it('should render tagline', () => {
      render(<Header />);

      expect(screen.getByText('Professional AMM')).toBeInTheDocument();
    });

    it('should have logo icon', () => {
      const { container } = render(<Header />);

      const svg = container.querySelector('svg[aria-hidden="true"]');
      expect(svg).toBeInTheDocument();
    });

    it('should have gradient background on logo', () => {
      const { container } = render(<Header />);

      const logoBackground = container.querySelector('.bg-gradient-primary');
      expect(logoBackground).toBeInTheDocument();
    });

    it('should have hover scale effect on logo', () => {
      const { container } = render(<Header />);

      const logoBackground = container.querySelector('.bg-gradient-primary');
      expect(logoBackground).toHaveClass('group-hover:scale-110');
    });
  });

  describe('Desktop Navigation', () => {
    it('should render all navigation links', () => {
      render(<Header />);

      expect(screen.getAllByRole('link', { name: 'Swap' })).toHaveLength(2); // desktop + mobile
      expect(screen.getAllByRole('link', { name: 'Pool' })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: 'Staking' })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: 'Bridge' })).toHaveLength(2);
      expect(screen.getAllByRole('link', { name: 'Dashboard' })).toHaveLength(2);
    });

    it('should have correct hrefs for navigation links', () => {
      render(<Header />);

      const swapLinks = screen.getAllByRole('link', { name: 'Swap' });
      swapLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/swap');
      });
    });

    it('should hide desktop nav on mobile', () => {
      const { container } = render(<Header />);

      const desktopNav = container.querySelector('nav.hidden.md\\:flex');
      expect(desktopNav).toBeInTheDocument();
    });

    it('should have gap between nav items', () => {
      const { container } = render(<Header />);

      const desktopNav = container.querySelector('nav.hidden.md\\:flex');
      expect(desktopNav).toHaveClass('gap-1');
    });
  });

  describe('Mobile Navigation', () => {
    it('should render mobile navigation', () => {
      const { container } = render(<Header />);

      const mobileNav = container.querySelector('.md\\:hidden');
      expect(mobileNav).toBeInTheDocument();
    });

    it('should have horizontal scroll on mobile nav', () => {
      const { container } = render(<Header />);

      const mobileNavContent = container.querySelector('nav.overflow-x-auto');
      expect(mobileNavContent).toBeInTheDocument();
      expect(mobileNavContent).toHaveClass('no-scrollbar');
    });

    it('should have border top on mobile nav', () => {
      const { container } = render(<Header />);

      const mobileNav = container.querySelector('.md\\:hidden');
      expect(mobileNav).toHaveClass('border-t', 'border-neutral-800');
    });

    it('should not wrap mobile nav items', () => {
      const { container } = render(<Header />);

      const mobileNavLinks = container.querySelectorAll('nav.overflow-x-auto a');
      mobileNavLinks.forEach((link) => {
        expect(link).toHaveClass('whitespace-nowrap', 'flex-shrink-0');
      });
    });
  });

  describe('Active State', () => {
    it('should highlight active Swap link', () => {
      mockLocation.pathname = '/swap';
      render(<Header />);

      const swapLinks = screen.getAllByRole('link', { name: 'Swap' });
      swapLinks.forEach((link) => {
        expect(link).toHaveClass('text-white');
      });
    });

    it('should show active indicator for active tab', () => {
      mockLocation.pathname = '/swap';
      const { container } = render(<Header />);

      const activeIndicator = container.querySelector('[data-layout-id="activeTab"]');
      expect(activeIndicator).toBeInTheDocument();
    });

    it('should show mobile active indicator', () => {
      mockLocation.pathname = '/swap';
      const { container } = render(<Header />);

      const mobileActiveIndicator = container.querySelector('[data-layout-id="activeTabMobile"]');
      expect(mobileActiveIndicator).toBeInTheDocument();
    });

    it('should apply inactive styles to non-active links', () => {
      mockLocation.pathname = '/swap';
      render(<Header />);

      const poolLinks = screen.getAllByRole('link', { name: 'Pool' });
      poolLinks.forEach((link) => {
        expect(link).toHaveClass('text-neutral-400');
      });
    });

    it('should have hover styles on inactive links', () => {
      mockLocation.pathname = '/swap';
      render(<Header />);

      const poolLinks = screen.getAllByRole('link', { name: 'Pool' });
      poolLinks.forEach((link) => {
        expect(link).toHaveClass('hover:text-white', 'hover:bg-neutral-800');
      });
    });

    it('should highlight Pool when on pool page', () => {
      mockLocation.pathname = '/pool';
      render(<Header />);

      const poolLinks = screen.getAllByRole('link', { name: 'Pool' });
      poolLinks.forEach((link) => {
        expect(link).toHaveClass('text-white');
      });
    });

    it('should highlight Staking when on staking page', () => {
      mockLocation.pathname = '/staking';
      render(<Header />);

      const stakingLinks = screen.getAllByRole('link', { name: 'Staking' });
      stakingLinks.forEach((link) => {
        expect(link).toHaveClass('text-white');
      });
    });

    it('should highlight Bridge when on bridge page', () => {
      mockLocation.pathname = '/bridge';
      render(<Header />);

      const bridgeLinks = screen.getAllByRole('link', { name: 'Bridge' });
      bridgeLinks.forEach((link) => {
        expect(link).toHaveClass('text-white');
      });
    });

    it('should highlight Dashboard when on dashboard page', () => {
      mockLocation.pathname = '/dashboard';
      render(<Header />);

      const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
      dashboardLinks.forEach((link) => {
        expect(link).toHaveClass('text-white');
      });
    });

    it('should have gradient background on active indicator', () => {
      mockLocation.pathname = '/swap';
      const { container } = render(<Header />);

      const activeIndicator = container.querySelector('[data-layout-id="activeTab"]');
      expect(activeIndicator).toHaveClass('bg-gradient-primary', 'rounded-xl');
    });
  });

  describe('Connect Wallet', () => {
    it('should render connect wallet button', () => {
      render(<Header />);

      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    });

    it('should be in flex container with gap', () => {
      const { container } = render(<Header />);

      const walletContainer = container.querySelector('.flex.items-center.gap-3');
      expect(walletContainer).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('should have container with max width', () => {
      const { container } = render(<Header />);

      const containers = container.querySelectorAll('.container.mx-auto');
      expect(containers.length).toBeGreaterThan(0);
    });

    it('should have horizontal padding', () => {
      const { container } = render(<Header />);

      const containers = container.querySelectorAll('.px-4');
      expect(containers.length).toBeGreaterThan(0);
    });

    it('should have fixed header height', () => {
      const { container } = render(<Header />);

      const headerContent = container.querySelector('.h-16');
      expect(headerContent).toBeInTheDocument();
    });

    it('should use flexbox for layout', () => {
      const { container } = render(<Header />);

      const flexContainer = container.querySelector('.flex.items-center.justify-between');
      expect(flexContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper header role', () => {
      render(<Header />);

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should have accessible heading', () => {
      render(<Header />);

      expect(screen.getByRole('heading', { name: 'AstroSwap' })).toBeInTheDocument();
    });

    it('should hide decorative icon from screen readers', () => {
      const { container } = render(<Header />);

      const icon = container.querySelector('svg');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have accessible navigation links', () => {
      render(<Header />);

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });

    it('should have accessible button', () => {
      render(<Header />);

      expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive navigation classes', () => {
      const { container } = render(<Header />);

      const desktopNav = container.querySelector('nav.hidden.md\\:flex');
      const mobileNav = container.querySelector('.md\\:hidden');

      expect(desktopNav).toBeInTheDocument();
      expect(mobileNav).toBeInTheDocument();
    });

    it('should have smaller text on mobile nav', () => {
      const { container } = render(<Header />);

      const mobileNavLinks = container.querySelectorAll('nav.overflow-x-auto a');
      mobileNavLinks.forEach((link) => {
        expect(link).toHaveClass('text-sm');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle root path', () => {
      mockLocation.pathname = '/';
      render(<Header />);

      // None should be active
      const swapLinks = screen.getAllByRole('link', { name: 'Swap' });
      swapLinks.forEach((link) => {
        expect(link).toHaveClass('text-neutral-400');
      });
    });

    it('should handle unknown path', () => {
      mockLocation.pathname = '/unknown';
      render(<Header />);

      const swapLinks = screen.getAllByRole('link', { name: 'Swap' });
      swapLinks.forEach((link) => {
        expect(link).toHaveClass('text-neutral-400');
      });
    });

    it('should render all 5 navigation items', () => {
      render(<Header />);

      // Each item appears twice (desktop + mobile)
      expect(screen.getAllByText('Swap')).toHaveLength(2);
      expect(screen.getAllByText('Pool')).toHaveLength(2);
      expect(screen.getAllByText('Staking')).toHaveLength(2);
      expect(screen.getAllByText('Bridge')).toHaveLength(2);
      expect(screen.getAllByText('Dashboard')).toHaveLength(2);
    });
  });
});
