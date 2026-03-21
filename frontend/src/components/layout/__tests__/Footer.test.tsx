import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../Footer';

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render footer', () => {
      render(<Footer />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('should have border top', () => {
      const { container } = render(<Footer />);

      const footer = container.querySelector('footer');
      expect(footer).toHaveClass('border-t', 'border-neutral-800');
    });

    it('should have background color', () => {
      const { container } = render(<Footer />);

      const footer = container.querySelector('footer');
      expect(footer).toHaveClass('bg-card');
    });

    it('should push to bottom', () => {
      const { container } = render(<Footer />);

      const footer = container.querySelector('footer');
      expect(footer).toHaveClass('mt-auto');
    });
  });

  describe('Brand Section', () => {
    it('should render AstroSwap heading', () => {
      render(<Footer />);

      expect(screen.getByRole('heading', { name: 'AstroSwap' })).toBeInTheDocument();
    });

    it('should have gradient text on heading', () => {
      render(<Footer />);

      const heading = screen.getByRole('heading', { name: 'AstroSwap' });
      expect(heading).toHaveClass('gradient-text');
    });

    it('should render description', () => {
      render(<Footer />);

      expect(
        screen.getByText(/Professional AMM DEX on Stellar Network/)
      ).toBeInTheDocument();
    });

    it('should have logo icon', () => {
      const { container } = render(<Footer />);

      const brandSvg = container.querySelector('.bg-gradient-primary svg[aria-hidden="true"]');
      expect(brandSvg).toBeInTheDocument();
    });

    it('should have gradient background on logo', () => {
      const { container } = render(<Footer />);

      const logoBackground = container.querySelector('.bg-gradient-primary');
      expect(logoBackground).toBeInTheDocument();
    });
  });

  describe('Social Media Icons', () => {
    it('should render Twitter link', () => {
      render(<Footer />);

      const twitterLink = screen.getByLabelText('Twitter');
      expect(twitterLink).toBeInTheDocument();
      expect(twitterLink).toHaveAttribute('href', '#');
    });

    it('should render Discord link', () => {
      render(<Footer />);

      const discordLink = screen.getByLabelText('Discord');
      expect(discordLink).toBeInTheDocument();
      expect(discordLink).toHaveAttribute('href', '#');
    });

    it('should render GitHub link', () => {
      render(<Footer />);

      const githubLink = screen.getByLabelText('GitHub');
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveAttribute('href', '#');
    });

    it('should have hover styles on social links', () => {
      const { container } = render(<Footer />);

      const socialLinks = container.querySelectorAll('.bg-neutral-800');
      socialLinks.forEach((link) => {
        expect(link).toHaveClass('hover:bg-primary');
      });
    });

    it('should have icons inside social links', () => {
      const { container } = render(<Footer />);

      const socialIcons = container.querySelectorAll('.bg-neutral-800 svg[aria-hidden="true"]');
      expect(socialIcons.length).toBe(3); // Twitter, Discord, GitHub
    });
  });

  describe('Product Links', () => {
    it('should render Product heading', () => {
      render(<Footer />);

      expect(screen.getByRole('heading', { name: 'Product' })).toBeInTheDocument();
    });

    it('should render Swap link', () => {
      render(<Footer />);

      // Get all links with name "Swap" (there might be duplicates in header/footer)
      const swapLinks = screen.getAllByRole('link', { name: 'Swap' });
      expect(swapLinks.length).toBeGreaterThan(0);
      expect(swapLinks[0]).toHaveAttribute('href', '/swap');
    });

    it('should render Pool link', () => {
      render(<Footer />);

      const poolLinks = screen.getAllByRole('link', { name: 'Pool' });
      expect(poolLinks.length).toBeGreaterThan(0);
      expect(poolLinks[0]).toHaveAttribute('href', '/pool');
    });

    it('should render Staking link', () => {
      render(<Footer />);

      const stakingLinks = screen.getAllByRole('link', { name: 'Staking' });
      expect(stakingLinks.length).toBeGreaterThan(0);
      expect(stakingLinks[0]).toHaveAttribute('href', '/staking');
    });

    it('should render Bridge link', () => {
      render(<Footer />);

      const bridgeLinks = screen.getAllByRole('link', { name: 'Bridge' });
      expect(bridgeLinks.length).toBeGreaterThan(0);
      expect(bridgeLinks[0]).toHaveAttribute('href', '/bridge');
    });
  });

  describe('Resources Links', () => {
    it('should render Resources heading', () => {
      render(<Footer />);

      expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
    });

    it('should render Documentation link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Documentation' })).toBeInTheDocument();
    });

    it('should render GitHub link in resources', () => {
      render(<Footer />);

      // Note: There's also a GitHub social icon, so we just check it exists
      const githubLinks = screen.getAllByRole('link', { name: 'GitHub' });
      expect(githubLinks.length).toBeGreaterThan(0);
    });

    it('should render Analytics link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Analytics' })).toBeInTheDocument();
    });

    it('should render Bug Bounty link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Bug Bounty' })).toBeInTheDocument();
    });
  });

  describe('Community Links', () => {
    it('should render Community heading', () => {
      render(<Footer />);

      expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument();
    });

    it('should render Discord link in community', () => {
      render(<Footer />);

      const discordLinks = screen.getAllByRole('link', { name: 'Discord' });
      expect(discordLinks.length).toBeGreaterThan(0);
    });

    it('should render Twitter link in community', () => {
      render(<Footer />);

      const twitterLinks = screen.getAllByRole('link', { name: 'Twitter' });
      expect(twitterLinks.length).toBeGreaterThan(0);
    });

    it('should render Telegram link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Telegram' })).toBeInTheDocument();
    });

    it('should render Forum link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Forum' })).toBeInTheDocument();
    });
  });

  describe('Copyright', () => {
    it('should render copyright text', () => {
      render(<Footer />);

      expect(screen.getByText(/All rights reserved/)).toBeInTheDocument();
    });

    it('should include AstroSwap in copyright', () => {
      render(<Footer />);

      expect(screen.getByText(/AstroSwap\. All rights reserved/)).toBeInTheDocument();
    });

    it('should display current year', () => {
      render(<Footer />);

      const currentYear = new Date().getFullYear();
      expect(screen.getByText(new RegExp(currentYear.toString()))).toBeInTheDocument();
    });

    it('should use copyright symbol', () => {
      render(<Footer />);

      expect(screen.getByText(/©/)).toBeInTheDocument();
    });
  });

  describe('Legal Links', () => {
    it('should render Terms of Service link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Terms of Service' })).toBeInTheDocument();
    });

    it('should render Privacy Policy link', () => {
      render(<Footer />);

      expect(screen.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument();
    });

    it('should have hover styles on legal links', () => {
      render(<Footer />);

      const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });

      expect(termsLink).toHaveClass('hover:text-white');
      expect(privacyLink).toHaveClass('hover:text-white');
    });

    it('should have correct href for legal links', () => {
      render(<Footer />);

      const termsLink = screen.getByRole('link', { name: 'Terms of Service' });
      const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });

      expect(termsLink).toHaveAttribute('href', '#');
      expect(privacyLink).toHaveAttribute('href', '#');
    });
  });

  describe('Layout', () => {
    it('should have container with max width', () => {
      const { container } = render(<Footer />);

      const footerContainer = container.querySelector('.container.mx-auto');
      expect(footerContainer).toBeInTheDocument();
    });

    it('should have padding', () => {
      const { container } = render(<Footer />);

      const footerContainer = container.querySelector('.container.mx-auto');
      expect(footerContainer).toHaveClass('px-4', 'py-12');
    });

    it('should use grid layout', () => {
      const { container } = render(<Footer />);

      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should have responsive grid columns', () => {
      const { container } = render(<Footer />);

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4');
    });

    it('should have gap between grid items', () => {
      const { container } = render(<Footer />);

      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('gap-8');
    });

    it('should have border top on bottom section', () => {
      const { container } = render(<Footer />);

      const bottomSection = container.querySelector('.border-t.border-neutral-800.flex');
      expect(bottomSection).toBeInTheDocument();
    });

    it('should have responsive flex direction on bottom section', () => {
      const { container } = render(<Footer />);

      const bottomSection = container.querySelector('.flex-col.md\\:flex-row');
      expect(bottomSection).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have contentinfo role', () => {
      render(<Footer />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('should have accessible headings', () => {
      render(<Footer />);

      expect(screen.getByRole('heading', { name: 'AstroSwap' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Product' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Resources' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Community' })).toBeInTheDocument();
    });

    it('should have aria-labels on social links', () => {
      render(<Footer />);

      expect(screen.getByLabelText('Twitter')).toBeInTheDocument();
      expect(screen.getByLabelText('Discord')).toBeInTheDocument();
      expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    });

    it('should hide decorative icons from screen readers', () => {
      const { container } = render(<Footer />);

      const icons = container.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBeGreaterThan(0);
    });

    it('should have accessible links', () => {
      render(<Footer />);

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });
  });

  describe('Link Sections', () => {
    it('should have list structure for product links', () => {
      const { container } = render(<Footer />);

      const productSection = screen.getByRole('heading', { name: 'Product' }).closest('div');
      const list = productSection?.querySelector('ul');

      expect(list).toBeInTheDocument();
      expect(list).toHaveClass('space-y-2');
    });

    it('should have list structure for resources links', () => {
      const { container } = render(<Footer />);

      const resourcesSection = screen.getByRole('heading', { name: 'Resources' }).closest('div');
      const list = resourcesSection?.querySelector('ul');

      expect(list).toBeInTheDocument();
    });

    it('should have list structure for community links', () => {
      const { container } = render(<Footer />);

      const communitySection = screen.getByRole('heading', { name: 'Community' }).closest('div');
      const list = communitySection?.querySelector('ul');

      expect(list).toBeInTheDocument();
    });

    it('should have 4 product links', () => {
      const { container } = render(<Footer />);

      const productSection = screen.getByRole('heading', { name: 'Product' }).closest('div');
      const listItems = productSection?.querySelectorAll('li');

      expect(listItems?.length).toBe(4);
    });

    it('should have 4 resources links', () => {
      const { container } = render(<Footer />);

      const resourcesSection = screen.getByRole('heading', { name: 'Resources' }).closest('div');
      const listItems = resourcesSection?.querySelectorAll('li');

      expect(listItems?.length).toBe(4);
    });

    it('should have 4 community links', () => {
      const { container } = render(<Footer />);

      const communitySection = screen.getByRole('heading', { name: 'Community' }).closest('div');
      const listItems = communitySection?.querySelectorAll('li');

      expect(listItems?.length).toBe(4);
    });
  });
});
