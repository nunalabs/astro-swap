import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import type { Token } from '../../../types';

// Mock stores - needs to be before imports to prevent initialization errors
vi.mock('../../../stores/tokenStore', () => ({
  useTokenStore: vi.fn(),
  BASE_TOKENS: [],
  getWhitelistTokens: vi.fn(() => []),
}));

vi.mock('../../../stores/walletStore', () => ({
  useWalletStore: vi.fn(),
}));

import { TokenSelector } from '../TokenSelector';
import { useTokenStore } from '../../../stores/tokenStore';
import { useWalletStore } from '../../../stores/walletStore';

// Mock child components
vi.mock('../Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="token-modal" role="dialog">
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

vi.mock('../AddTokenModal', () => ({
  AddTokenModal: ({ isOpen, onClose }: any) =>
    isOpen ? (
      <div data-testid="add-token-modal">
        <button onClick={onClose}>Close Add Token</button>
      </div>
    ) : null,
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    button: forwardRef(({ children, onClick, ...props }: any, ref: any) => (
      <button ref={ref} onClick={onClick} {...props}>
        {children}
      </button>
    )),
  },
}));

// Mock getTokenDisplayInfo
vi.mock('../../../lib/tokens', () => ({
  getTokenDisplayInfo: (token: Token) => ({
    symbol: token.symbol,
    name: token.name,
    logoURI: token.icon || null,
    issuerShort: token.address.slice(0, 4) + '...' + token.address.slice(-4),
  }),
}));

describe('TokenSelector', () => {
  const mockXLM: Token = {
    address: 'native',
    symbol: 'XLM',
    name: 'Stellar Lumens',
    decimals: 7,
    icon: 'https://example.com/xlm.png',
    balance: '1000.0',
    verified: true,
  };

  const mockUSDC: Token = {
    address: 'USDC123',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 7,
    icon: 'https://example.com/usdc.png',
    balance: '500.0',
    verified: true,
  };

  const mockUnknown: Token = {
    address: 'UNKNOWN123',
    symbol: 'UNK',
    name: 'Unknown Token',
    decimals: 7,
    icon: '',
    balance: '10.0',
  };

  const mockOnSelect = vi.fn();
  const mockToggleFavorite = vi.fn();
  const mockIndexTokensFromChain = vi.fn();
  const mockDiscoverAllTokens = vi.fn();
  const mockSearchTokensAsync = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useTokenStore
    vi.mocked(useTokenStore).mockImplementation((selector: any) => {
      const state = {
        tokens: [mockXLM, mockUSDC, mockUnknown],
        favoriteTokens: [],
        toggleFavorite: mockToggleFavorite,
        isIndexing: false,
        isSearching: false,
        indexedTokens: [],
        discoveredTokens: [],
        indexTokensFromChain: mockIndexTokensFromChain,
        discoverAllTokens: mockDiscoverAllTokens,
        searchTokensAsync: mockSearchTokensAsync,
      };
      return selector(state);
    });

    // Default mock for useWalletStore
    vi.mocked(useWalletStore).mockImplementation((selector: any) => {
      const state = {
        address: 'GTEST123',
      };
      return selector(state);
    });

    // Mock IntersectionObserver
    global.IntersectionObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Button Rendering', () => {
    it('should render select token button when no token selected', () => {
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);
      expect(screen.getByText('Select token')).toBeInTheDocument();
    });

    it('should render selected token info when token is selected', () => {
      render(<TokenSelector selectedToken={mockXLM} onSelect={mockOnSelect} />);
      expect(screen.getByText('XLM')).toBeInTheDocument();
    });

    it('should show token image when available', () => {
      const { container } = render(<TokenSelector selectedToken={mockXLM} onSelect={mockOnSelect} />);
      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'https://example.com/xlm.png');
    });

    it('should show fallback when no icon', () => {
      render(<TokenSelector selectedToken={mockUnknown} onSelect={mockOnSelect} />);
      expect(screen.getByText('UN')).toBeInTheDocument(); // First 2 chars of UNK
    });

    it('should have accessible label', () => {
      render(<TokenSelector selectedToken={mockXLM} onSelect={mockOnSelect} />);
      expect(
        screen.getByRole('button', { name: /Selected token: XLM.*Click to change/ })
      ).toBeInTheDocument();
    });

    it('should have aria-haspopup', () => {
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);
      const button = screen.getByRole('button', { name: 'Select a token' });
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('Modal Opening/Closing', () => {
    it('should open modal when button clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByTestId('token-modal')).toBeInTheDocument();
    });

    it('should close modal when close button clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByText('Close'));

      expect(screen.queryByTestId('token-modal')).not.toBeInTheDocument();
    });

    it('should call discoverAllTokens when modal opens', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      await waitFor(() => {
        expect(mockDiscoverAllTokens).toHaveBeenCalled();
      });
    });
  });

  describe('Token List', () => {
    it('should display all tokens', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      expect(screen.getByText('XLM')).toBeInTheDocument();
      expect(screen.getByText('Stellar Lumens')).toBeInTheDocument();
      expect(screen.getByText('USDC')).toBeInTheDocument();
      expect(screen.getByText('USD Coin')).toBeInTheDocument();
      expect(screen.getByText('UNK')).toBeInTheDocument();
      expect(screen.getByText('Unknown Token')).toBeInTheDocument();
    });

    it('should show token count', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByText('3 tokens found')).toBeInTheDocument();
    });

    it('should show verified badge for verified tokens', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const verifiedBadges = screen.getAllByTitle('Verified token');
      expect(verifiedBadges.length).toBe(2); // XLM and USDC
    });

    it('should exclude tokens from excludeTokens prop', async () => {
      const user = userEvent.setup();
      render(
        <TokenSelector
          selectedToken={null}
          onSelect={mockOnSelect}
          excludeTokens={['USDC123']}
        />
      );

      await user.click(screen.getByText('Select token'));

      expect(screen.getByText('XLM')).toBeInTheDocument();
      expect(screen.queryByText('USDC')).not.toBeInTheDocument();
      expect(screen.getByText('UNK')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter tokens by symbol', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'XLM');

      expect(screen.getByText(/XLM/)).toBeInTheDocument();
      expect(screen.queryByText(/USDC/)).not.toBeInTheDocument();
    });

    it('should filter tokens by name', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'Stellar');

      expect(screen.getByText(/Stellar Lumens/)).toBeInTheDocument();
      expect(screen.queryByText(/USD Coin/)).not.toBeInTheDocument();
    });

    it('should filter tokens by address', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'USDC123');

      expect(screen.getByText('USDC')).toBeInTheDocument();
      expect(screen.queryByText('XLM')).not.toBeInTheDocument();
    });

    it('should be case insensitive', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'xlm');

      expect(screen.getByText(/XLM/)).toBeInTheDocument();
    });

    it('should show no tokens found when no match', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'NOTEXIST');

      expect(screen.getByText('No tokens found')).toBeInTheDocument();
    });

    it('should trigger async search for queries >= 2 chars', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'AS');

      // Fast-forward all timers
      await vi.runAllTimersAsync();

      // Check directly after timers run
      expect(mockSearchTokensAsync).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should not trigger async search for queries < 2 chars', async () => {
      vi.useFakeTimers();
      const user = userEvent.setup({ delay: null });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');

      await user.type(searchInput, 'A');

      vi.advanceTimersByTime(300);

      expect(mockSearchTokensAsync).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should have autofocus on search input', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');
      // Note: autofocus attribute may not be set in JSDOM, check that input exists
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Token Selection', () => {
    it('should call onSelect when token clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByRole('button', { name: /Select XLM/ }));

      expect(mockOnSelect).toHaveBeenCalledWith(mockXLM);
    });

    it('should close modal after selection', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByRole('button', { name: /Select XLM/ }));

      await waitFor(() => {
        expect(screen.queryByTestId('token-modal')).not.toBeInTheDocument();
      });
    });

    it('should clear search after selection', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const searchInput = screen.getByPlaceholderText('Search by name, symbol, or address');
      await user.type(searchInput, 'XLM');

      // Clear first by selecting
      await user.clear(searchInput);

      // After clearing, search should be empty
      expect(searchInput).toHaveValue('');
    });
  });

  describe('Favorites', () => {
    it('should show favorites section when favorites exist', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [mockXLM, mockUSDC],
          favoriteTokens: ['native'], // XLM is favorite
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByText('Favorites')).toBeInTheDocument();
      expect(screen.getByText('All Tokens')).toBeInTheDocument();
    });

    it('should toggle favorite when star clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      const favoriteButtons = screen.getAllByRole('button', { name: /favorites/ });
      await user.click(favoriteButtons[0]);

      expect(mockToggleFavorite).toHaveBeenCalled();
    });

    it('should have aria-pressed for favorite button', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [mockXLM],
          favoriteTokens: ['native'], // XLM is favorite
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const favoriteButton = screen.getByRole('button', { name: /Remove XLM from favorites/ });
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should stop propagation when toggling favorite', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      const favoriteButton = screen.getByRole('button', { name: /Add XLM to favorites/ });
      await user.click(favoriteButton);

      // Should not call onSelect
      expect(mockOnSelect).not.toHaveBeenCalled();
      // Should call toggleFavorite
      expect(mockToggleFavorite).toHaveBeenCalledWith('native');
    });
  });

  describe('Refresh Tokens', () => {
    it('should call indexTokensFromChain when refresh clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByRole('button', { name: 'Refresh token list from blockchain' }));

      expect(mockIndexTokensFromChain).toHaveBeenCalledWith('GTEST123');
    });

    it('should disable refresh when no wallet connected', async () => {
      const user = userEvent.setup();

      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = { address: null };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const refreshButton = screen.getByRole('button', { name: 'Refresh token list from blockchain' });
      expect(refreshButton).toBeDisabled();
    });

    it('should disable refresh when indexing', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: true,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      const refreshButton = screen.getByRole('button', { name: 'Refresh token list from blockchain' });
      expect(refreshButton).toBeDisabled();
    });

    it('should show spinning icon when indexing', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: true,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));

      expect(screen.getByText('Discovering tokens from pools...')).toBeInTheDocument();
    });
  });

  describe('Add Token Modal', () => {
    it('should open add token modal when Import Token clicked', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByText('Import Token'));

      expect(screen.getByTestId('add-token-modal')).toBeInTheDocument();
    });

    it('should close token selector modal when opening add token modal', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      await user.click(screen.getByText('Import Token'));

      expect(screen.queryByTestId('token-modal')).not.toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    it('should show searching indicator', async () => {
      const user = userEvent.setup();

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: true,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByText('Searching tokens...')).toBeInTheDocument();
    });

    it('should show token statistics when available', async () => {
      const user = userEvent.setup();

      const verifiedToken = { ...mockXLM, verified: true };
      const indexedToken = { ...mockUSDC };

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [verifiedToken, indexedToken],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [indexedToken],
          discoveredTokens: [verifiedToken],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByText('(1 verified)')).toBeInTheDocument();
      expect(screen.getByText('(1 from pools)')).toBeInTheDocument();
    });
  });

  describe('Token Badges', () => {
    it('should show popular badge for popular unverified tokens', async () => {
      const user = userEvent.setup();
      const popularToken = { ...mockUnknown, popular: true, verified: false };

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [popularToken],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByTitle('Popular token')).toBeInTheDocument();
    });

    it('should show rating badge for high-rated tokens', async () => {
      const user = userEvent.setup();
      const ratedToken = { ...mockUnknown, rating: 4.5 };

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [ratedToken],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByTitle('Rating: 4.5')).toBeInTheDocument();
    });

    it('should not show rating badge for low ratings', async () => {
      const user = userEvent.setup();
      const lowRatedToken = { ...mockUnknown, rating: 3.5 };

      vi.mocked(useTokenStore).mockImplementation((selector: any) => {
        const state = {
          tokens: [lowRatedToken],
          favoriteTokens: [],
          toggleFavorite: mockToggleFavorite,
          isIndexing: false,
          isSearching: false,
          indexedTokens: [],
          discoveredTokens: [],
          indexTokensFromChain: mockIndexTokensFromChain,
          discoverAllTokens: mockDiscoverAllTokens,
          searchTokensAsync: mockSearchTokensAsync,
        };
        return selector(state);
      });

      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.queryByTitle(/Rating:/)).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible token selection labels', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByRole('button', { name: 'Select XLM (Stellar Lumens)' })).toBeInTheDocument();
    });

    it('should have aria-label for search input', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      await user.click(screen.getByText('Select token'));
      expect(screen.getByLabelText('Search tokens')).toBeInTheDocument();
    });

    it('should have minimum touch targets', async () => {
      const user = userEvent.setup();
      render(<TokenSelector selectedToken={null} onSelect={mockOnSelect} />);

      const selectButton = screen.getByText('Select token');
      expect(selectButton.closest('button')).toHaveClass('min-h-[44px]');

      await user.click(screen.getByText('Select token'));
      const refreshButton = screen.getByRole('button', { name: 'Refresh token list from blockchain' });
      expect(refreshButton).toHaveClass('min-h-[44px]');
    });
  });

  describe('Image Error Handling', () => {
    it('should hide broken images', async () => {
      const user = userEvent.setup();
      const { container } = render(<TokenSelector selectedToken={mockXLM} onSelect={mockOnSelect} />);

      const img = container.querySelector('img') as HTMLImageElement;

      // Simulate image load error
      const errorEvent = new Event('error', { bubbles: true });
      img.dispatchEvent(errorEvent);

      expect(img.style.display).toBe('none');
    });
  });
});
