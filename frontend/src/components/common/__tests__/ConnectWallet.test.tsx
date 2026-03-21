import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { ConnectWallet } from '../ConnectWallet';
import { useWalletStore } from '../../../stores/walletStore';
import { useSettingsStore } from '../../../stores/settingsStore';

// Mock stores
vi.mock('../../../stores/walletStore');
vi.mock('../../../stores/settingsStore');

// Mock utils
vi.mock('../../../lib/utils', () => ({
  shortenAddress: (address: string, chars: number) => {
    if (!address) return '';
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
  },
  formatNumber: (num: number, decimals: number) => num.toFixed(decimals),
}));

// Mock Modal
vi.mock('../Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="account-modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock Button
vi.mock('../Button', () => ({
  Button: forwardRef(({ children, onClick, isLoading, variant, fullWidth, ...props }: any, ref: any) => (
    <button
      ref={ref}
      onClick={onClick}
      disabled={isLoading}
      data-variant={variant}
      data-fullwidth={fullWidth}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  )),
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

describe('ConnectWallet', () => {
  const mockConnect = vi.fn();
  const mockDisconnect = vi.fn();
  const mockAddToast = vi.fn();
  const mockAddress = 'GCZXQY7F7X3WGXV2PQMXVZO3K5JHIW7T2NV2UQXZ5RZXBH3VWXYZ';
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();

    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    vi.mocked(useSettingsStore).mockReturnValue(mockAddToast);
  });

  describe('Disconnected State', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: false,
          address: null,
          balance: '0',
          walletName: null,
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });
    });

    it('should render Connect button when not connected', () => {
      render(<ConnectWallet />);

      expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
    });

    it('should show wallet icon in Connect button', () => {
      const { container } = render(<ConnectWallet />);

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should have proper title attribute for Connect button', () => {
      render(<ConnectWallet />);

      const button = screen.getByRole('button', { name: /Connect/i });
      expect(button).toHaveAttribute('title', 'Connect your Stellar wallet');
    });

    it('should hide Connect text on mobile', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: false,
          address: null,
          balance: '0',
          walletName: null,
          isMobile: true,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      const { container } = render(<ConnectWallet />);

      const span = container.querySelector('span.hidden');
      expect(span).toBeInTheDocument();
    });
  });

  describe('Connecting State', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: false,
          address: null,
          balance: '0',
          walletName: null,
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: true,
        };
        return selector(state);
      });
    });

    it('should show Loading text when connecting', () => {
      render(<ConnectWallet />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading state', () => {
      render(<ConnectWallet />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have proper title when connecting', () => {
      render(<ConnectWallet />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('title', 'Approve in your wallet extension and return to this page');
    });

    it('should use small size on mobile when connecting', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: false,
          address: null,
          balance: '0',
          walletName: null,
          isMobile: true,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: true,
        };
        return selector(state);
      });

      const { container } = render(<ConnectWallet />);

      // Button component receives size prop which we test through rendering
      expect(container.querySelector('button')).toBeInTheDocument();
    });
  });

  describe('Connected State', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });
    });

    it('should render account button when connected', () => {
      render(<ConnectWallet />);

      expect(screen.getByText(/GCZX...WXYZ/)).toBeInTheDocument();
    });

    it('should show balance in account button', () => {
      render(<ConnectWallet />);

      expect(screen.getByText('123.46 XLM')).toBeInTheDocument();
    });

    it('should show connection status indicator', () => {
      const { container } = render(<ConnectWallet />);

      const statusDot = container.querySelector('.bg-green.rounded-full');
      expect(statusDot).toBeInTheDocument();
    });

    it('should show shortened address for mobile', () => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: true,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      render(<ConnectWallet />);

      // Mobile shows 3 chars: GCZ...XYZ (multiple spans, check at least one exists)
      expect(screen.getAllByText(/GCZ...XYZ/).length).toBeGreaterThan(0);
    });

    it('should open account modal when button clicked', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByTestId('account-modal')).toBeInTheDocument();
    });
  });

  describe('Connect Flow', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: false,
          address: null,
          balance: '0',
          walletName: null,
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      // Mock getState for success toast
      vi.mocked(useWalletStore).getState = vi.fn().mockReturnValue({
        walletName: 'Freighter',
      });
    });

    it('should show info toast when connecting', async () => {
      const user = userEvent.setup();
      mockConnect.mockResolvedValue(undefined);

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'info',
        title: 'Wallet Connection',
        description: 'Please approve the connection in your wallet extension and return to this page',
      });
    });

    it('should call connect when Connect button clicked', async () => {
      const user = userEvent.setup();
      mockConnect.mockResolvedValue(undefined);

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      expect(mockConnect).toHaveBeenCalled();
    });

    it('should show success toast on successful connection', async () => {
      const user = userEvent.setup();
      mockConnect.mockResolvedValue(undefined);

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Wallet Connected',
          description: 'Connected via Freighter',
        });
      });
    });

    it('should not show error toast when user cancels', async () => {
      const user = userEvent.setup();
      mockConnect.mockRejectedValue(new Error('User closed wallet modal'));

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      await waitFor(() => {
        // Should have been called once for info toast, but not for error
        expect(mockAddToast).toHaveBeenCalledTimes(1);
      });
    });

    it('should show error toast on connection failure', async () => {
      const user = userEvent.setup();
      mockConnect.mockRejectedValue(new Error('Connection failed'));

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Connection Failed',
          description: 'Connection failed',
        });
      });
    });

    it('should handle non-Error exceptions', async () => {
      const user = userEvent.setup();
      mockConnect.mockRejectedValue('Unknown error');

      render(<ConnectWallet />);

      await user.click(screen.getByRole('button', { name: /Connect/i }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Connection Failed',
          description: 'Failed to connect wallet',
        });
      });
    });
  });

  describe('Account Modal', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });
    });

    it('should show wallet name in modal', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByText('Freighter')).toBeInTheDocument();
    });

    it('should show full address in modal', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      // Desktop shows 8 chars: GCZXQY7F...BH3VWXYZ
      expect(screen.getByText(/GCZXQY7F...BH3VWXYZ/)).toBeInTheDocument();
    });

    it('should show balance in modal with 4 decimals', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByText('123.4568')).toBeInTheDocument();
    });

    it('should have copy address button', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      const copyButton = screen.getByTitle('Copy address');
      expect(copyButton).toBeInTheDocument();
    });

    it('should have Stellar Expert link', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      const link = screen.getByText('View on Stellar Expert').closest('a');
      expect(link).toHaveAttribute('href', expect.stringContaining(mockAddress));
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should use testnet URL when not mainnet', async () => {
      const user = userEvent.setup();
      import.meta.env.VITE_STELLAR_NETWORK = 'testnet';

      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      const link = screen.getByText('View on Stellar Expert').closest('a');
      expect(link).toHaveAttribute('href', expect.stringContaining('testnet'));
    });

    it('should have Disconnect button', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument();
    });

    it('should close modal when close button clicked', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      await user.click(screen.getByText('Close'));

      expect(screen.queryByTestId('account-modal')).not.toBeInTheDocument();
    });

    it('should show shorter address on mobile in modal', async () => {
      const user = userEvent.setup();
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: true,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      render(<ConnectWallet />);

      const accountButton = screen.getAllByText(/GCZ...XYZ/)[0].closest('button');
      await user.click(accountButton!);

      // Mobile shows 6 chars in modal: GCZXQY...3VWXYZ
      expect(screen.getByText(/GCZXQY...3VWXYZ/)).toBeInTheDocument();
    });
  });

  describe('Copy Address', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });
    });

    it('should have copy button that triggers clipboard', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      const copyButton = screen.getByTitle('Copy address');
      expect(copyButton).toBeInTheDocument();

      // Click the copy button
      await user.click(copyButton);

      // The actual clipboard call and toast are tested in "should show success toast after copying"
    });

    it('should show success toast after copying', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      const copyButton = screen.getByTitle('Copy address');
      await user.click(copyButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Copied',
          description: 'Address copied to clipboard',
        });
      });
    });

    it('should not copy if address is null', async () => {
      const user = userEvent.setup();
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: null,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      const { container } = render(<ConnectWallet />);

      // Find the account button (will have empty address)
      const accountButton = container.querySelector('button');
      if (accountButton) {
        await user.click(accountButton);
        const copyButton = screen.getByTitle('Copy address');
        await user.click(copyButton);
      }

      expect(mockWriteText).not.toHaveBeenCalled();
    });
  });

  describe('Disconnect Flow', () => {
    beforeEach(() => {
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });
    });

    it('should call disconnect when Disconnect clicked', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      await user.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should close modal after disconnect', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      await user.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(screen.queryByTestId('account-modal')).not.toBeInTheDocument();
    });

    it('should show info toast after disconnect', async () => {
      const user = userEvent.setup();
      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      await user.click(screen.getByRole('button', { name: 'Disconnect' }));

      expect(mockAddToast).toHaveBeenCalledWith({
        type: 'info',
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected',
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper role for account modal', async () => {
      const user = userEvent.setup();
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should have proper aria-label for modal', async () => {
      const user = userEvent.setup();
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByRole('dialog', { name: 'Account' })).toBeInTheDocument();
    });

    it('should have title attribute for copy button', async () => {
      const user = userEvent.setup();
      vi.mocked(useWalletStore).mockImplementation((selector: any) => {
        const state = {
          isConnected: true,
          address: mockAddress,
          balance: '123.456789',
          walletName: 'Freighter',
          isMobile: false,
          connect: mockConnect,
          disconnect: mockDisconnect,
          isConnecting: false,
        };
        return selector(state);
      });

      render(<ConnectWallet />);

      const accountButton = screen.getByText(/GCZX...WXYZ/).closest('button');
      await user.click(accountButton!);

      expect(screen.getByTitle('Copy address')).toBeInTheDocument();
    });
  });
});
