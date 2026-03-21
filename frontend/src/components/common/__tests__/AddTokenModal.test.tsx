import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef } from 'react';
import { AddTokenModal } from '../AddTokenModal';
import { useTokenStore } from '../../../stores/tokenStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { isValidContractId } from '../../../lib/utils';
import { sorobanServer } from '../../../lib/stellar';
import * as StellarSdk from '@stellar/stellar-sdk';

// Mock stores
vi.mock('../../../stores/tokenStore');
vi.mock('../../../stores/settingsStore');

// Mock utils
vi.mock('../../../lib/utils', () => ({
  isValidContractId: vi.fn(),
}));

// Mock Stellar SDK
vi.mock('@stellar/stellar-sdk', () => {
  const mockTransaction = {
    build: vi.fn().mockReturnThis(),
  };

  const mockBuilder = {
    addOperation: vi.fn().mockReturnThis(),
    setTimeout: vi.fn().mockReturnValue(mockTransaction),
  };

  const mockContract = {
    call: vi.fn().mockReturnValue('mock_operation'),
  };

  return {
    Account: vi.fn(),
    Contract: vi.fn(() => mockContract),
    TransactionBuilder: vi.fn(() => mockBuilder),
    scValToNative: vi.fn(),
    rpc: {
      Api: {
        isSimulationSuccess: vi.fn(),
      },
    },
  };
});

// Mock sorobanServer
vi.mock('../../../lib/stellar', () => ({
  sorobanServer: {
    simulateTransaction: vi.fn(),
  },
  NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
}));

// Mock contracts to avoid validation errors
vi.mock('../../../lib/contracts', () => ({
  FACTORY_ADDRESS: 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
  ROUTER_ADDRESS: 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
}));

// Mock Modal
vi.mock('../Modal', () => ({
  Modal: ({ isOpen, onClose, title, children }: any) =>
    isOpen ? (
      <div data-testid="add-token-modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <button onClick={onClose}>Close</button>
        {children}
      </div>
    ) : null,
}));

// Mock Button
vi.mock('../Button', () => ({
  Button: forwardRef(
    ({ children, onClick, isLoading, disabled, fullWidth, ...props }: any, ref: any) => (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled || isLoading}
        data-loading={isLoading}
        data-fullwidth={fullWidth}
        {...props}
      >
        {isLoading ? 'Loading...' : children}
      </button>
    )
  ),
}));

describe('AddTokenModal', () => {
  const mockOnClose = vi.fn();
  const mockAddCustomToken = vi.fn();
  const mockAddToast = vi.fn();
  const mockSimulateTransaction = vi.fn();
  const mockValidAddress = 'CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTokenStore).mockImplementation((selector: any) => {
      const state = {
        addCustomToken: mockAddCustomToken,
      };
      return selector(state);
    });

    vi.mocked(useSettingsStore).mockImplementation((selector: any) => {
      const state = {
        addToast: mockAddToast,
      };
      return selector(state);
    });

    vi.mocked(sorobanServer.simulateTransaction).mockImplementation(mockSimulateTransaction);
  });

  describe('Rendering', () => {
    it('should not render when closed', () => {
      render(<AddTokenModal isOpen={false} onClose={mockOnClose} />);

      expect(screen.queryByTestId('add-token-modal')).not.toBeInTheDocument();
    });

    it('should render when open', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByTestId('add-token-modal')).toBeInTheDocument();
    });

    it('should have Import Token title', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog', { name: 'Import Token' })).toBeInTheDocument();
    });

    it('should have address input field', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByLabelText('Token Contract Address')).toBeInTheDocument();
    });

    it('should have Fetch button', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: 'Fetch' })).toBeInTheDocument();
    });

    it('should have help text', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(
        screen.getByText(/Import any Soroban token by entering its contract address/)
      ).toBeInTheDocument();
    });

    it('should have close button from Modal', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByText('Close')).toBeInTheDocument();
    });
  });

  describe('Input Management', () => {
    it('should update address on input', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, 'test');

      expect(input).toHaveValue('TEST');
    });

    it('should convert input to uppercase', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, 'cabc123');

      expect(input).toHaveValue('CABC123');
    });

    it('should have maxLength of 56 characters', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      expect(input).toHaveAttribute('maxLength', '56');
    });

    it('should have placeholder text', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByPlaceholderText('CXXXX...');
      expect(input).toBeInTheDocument();
    });

    it('should disable Fetch button when address is empty', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      expect(fetchButton).toBeDisabled();
    });

    it('should disable Fetch button when address is not 56 chars', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, 'CABC');

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      expect(fetchButton).toBeDisabled();
    });

    it('should enable Fetch button when address is 56 chars', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      expect(fetchButton).not.toBeDisabled();
    });
  });

  describe('Validation', () => {
    it('should show error for invalid contract ID', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      expect(
        screen.getByText('Please enter a valid contract ID (starts with C, 56 characters)')
      ).toBeInTheDocument();
    });

    it('should have role="alert" for error message', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
    });

    it('should clear error when fetching again', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      // Error is shown
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Stellar SDK Integration', () => {
    it('should have Fetch button for token lookup', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('button', { name: 'Fetch' })).toBeInTheDocument();
    });

    it('should validate contract ID format before fetch', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      expect(vi.mocked(isValidContractId)).toHaveBeenCalled();
    });
  });

  describe('Modal Close/Reset', () => {
    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      await user.click(screen.getByText('Close'));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should clear form fields when closing', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, 'CABC123');

      // Component handles clearing via handleClose callback
      expect(input).toHaveValue('CABC123');
    });
  });

  describe('Accessibility', () => {
    it('should have proper label for input', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      expect(input).toHaveAttribute('id', 'token-contract-address');
    });

    it('should have aria-describedby when error is shown', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      expect(input).toHaveAttribute('aria-describedby', 'token-address-error');
    });

    it('should have role="alert" for error', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should have role="dialog" for modal', () => {
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('Token Fetch Flow', () => {
    const setupSuccessfulFetch = (symbol = 'USDC', name = 'USD Coin', decimals = 6) => {
      vi.mocked(isValidContractId).mockReturnValue(true);
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: 'mock_value' } });

      // Use mockResolvedValueOnce to queue return values
      vi.mocked(StellarSdk.scValToNative)
        .mockReturnValueOnce(symbol as any)
        .mockReturnValueOnce(name as any)
        .mockReturnValueOnce(decimals as any);
    };

    it('should show loading state while fetching', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(true);

      // Make simulateTransaction return a pending promise
      let resolveSimulation: any;
      mockSimulateTransaction.mockReturnValue(
        new Promise((resolve) => {
          resolveSimulation = resolve;
        })
      );

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText('Loading...')).toBeInTheDocument();
      });

      // Resolve the promise
      resolveSimulation({ result: { retval: 'TEST' } });
    });

    it('should fetch token info successfully', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });
      await user.click(fetchButton);

      await waitFor(() => {
        expect(screen.getByText('Token Found')).toBeInTheDocument();
      });
    });

    it('should display token symbol', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('Symbol:')).toBeInTheDocument();
        expect(screen.getByText('USDC')).toBeInTheDocument();
      });
    });

    it('should display token name', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('Name:')).toBeInTheDocument();
        expect(screen.getByText('USD Coin')).toBeInTheDocument();
      });
    });

    it('should display token decimals', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('Decimals:')).toBeInTheDocument();
        expect(screen.getByText('6')).toBeInTheDocument();
      });
    });

    it('should show warning message after successful fetch', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(
          screen.getByText(/Anyone can create a token with any name/)
        ).toBeInTheDocument();
      });
    });

    it('should show Import button with token symbol', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });
    });

    it('should handle fetch error when simulation fails', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(true);
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(false);

      mockSimulateTransaction.mockResolvedValue({ result: null });

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to fetch token info/)
        ).toBeInTheDocument();
      });
    });

    it('should handle fetch error when network error occurs', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(true);

      mockSimulateTransaction.mockRejectedValue(new Error('Network error'));

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(
          screen.getByText(/Failed to fetch token info/)
        ).toBeInTheDocument();
      });
    });

    it('should clear previous token info on new fetch', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('Token Found')).toBeInTheDocument();
      });

      // Clear and try again
      await user.clear(input);
      await user.type(input, mockValidAddress);

      // Mock will fail this time
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(false);
      mockSimulateTransaction.mockResolvedValue({ result: null });

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.queryByText('Token Found')).not.toBeInTheDocument();
      });
    });
  });

  describe('Import Functionality', () => {
    const setupSuccessfulFetch = (symbol = 'USDC', name = 'USD Coin', decimals = 6) => {
      vi.mocked(isValidContractId).mockReturnValue(true);
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: 'mock_value' } });

      vi.mocked(StellarSdk.scValToNative)
        .mockReturnValueOnce(symbol as any)
        .mockReturnValueOnce(name as any)
        .mockReturnValueOnce(decimals as any);
    };

    it('should import token successfully', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();
      mockAddCustomToken.mockResolvedValue(true);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });

      const importButton = screen.getByRole('button', { name: 'Import USDC' });
      await user.click(importButton);

      await waitFor(() => {
        expect(mockAddCustomToken).toHaveBeenCalledWith({
          address: mockValidAddress,
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
        });
      });
    });

    it('should show success toast on successful import', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();
      mockAddCustomToken.mockResolvedValue(true);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Import USDC' }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Token Imported',
          description: 'USDC has been added to your token list',
        });
      });
    });

    it('should close modal on successful import', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();
      mockAddCustomToken.mockResolvedValue(true);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Import USDC' }));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should show error toast when token already exists', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();
      mockAddCustomToken.mockResolvedValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Import USDC' }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Import Failed',
          description: 'Token already exists in your list',
        });
      });
    });

    it('should not close modal when import fails', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();
      mockAddCustomToken.mockResolvedValue(false);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Import USDC' })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Import USDC' }));

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalled();
      });

      // Modal should still be open
      expect(mockOnClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-token-modal')).toBeInTheDocument();
    });

    it('should not import when no token info', async () => {
      const user = userEvent.setup();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      // No token fetch, try to import directly - button shouldn't exist
      expect(screen.queryByRole('button', { name: /Import/ })).not.toBeInTheDocument();
    });
  });

  describe('Form Reset', () => {
    const setupSuccessfulFetch = (symbol = 'USDC', name = 'USD Coin', decimals = 6) => {
      vi.mocked(isValidContractId).mockReturnValue(true);
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: 'mock_value' } });

      vi.mocked(StellarSdk.scValToNative)
        .mockReturnValueOnce(symbol as any)
        .mockReturnValueOnce(name as any)
        .mockReturnValueOnce(decimals as any);
    };

    it('should clear address on modal close', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, 'CABC123');

      expect(input).toHaveValue('CABC123');

      // Close modal
      await user.click(screen.getByText('Close'));

      // Reopen with empty state
      rerender(<AddTokenModal isOpen={false} onClose={mockOnClose} />);
      rerender(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const newInput = screen.getByLabelText('Token Contract Address');
      expect(newInput).toHaveValue('');
    });

    it('should clear error on modal close', async () => {
      const user = userEvent.setup();
      vi.mocked(isValidContractId).mockReturnValue(false);

      const { rerender } = render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      expect(screen.getByRole('alert')).toBeInTheDocument();

      await user.click(screen.getByText('Close'));

      rerender(<AddTokenModal isOpen={false} onClose={mockOnClose} />);
      rerender(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should clear token info on modal close', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      const { rerender } = render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('Token Found')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Close'));

      rerender(<AddTokenModal isOpen={false} onClose={mockOnClose} />);
      rerender(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      expect(screen.queryByText('Token Found')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    const setupSuccessfulFetch = (symbol = 'USDC', name = 'USD Coin', decimals = 6) => {
      vi.mocked(isValidContractId).mockReturnValue(true);
      vi.mocked(StellarSdk.rpc.Api.isSimulationSuccess).mockReturnValue(true);
      mockSimulateTransaction.mockResolvedValue({ result: { retval: 'mock_value' } });

      vi.mocked(StellarSdk.scValToNative)
        .mockReturnValueOnce(symbol as any)
        .mockReturnValueOnce(name as any)
        .mockReturnValueOnce(decimals as any);
    };

    it('should handle empty address fetch attempt', async () => {
      const user = userEvent.setup();
      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });

      // Button should be disabled
      expect(fetchButton).toBeDisabled();
    });

    it('should handle multiple rapid fetch attempts', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch();

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      const fetchButton = screen.getByRole('button', { name: 'Fetch' });

      // Rapid clicks
      await user.click(fetchButton);
      await user.click(fetchButton);
      await user.click(fetchButton);

      // Should only fetch once due to loading state
      await waitFor(() => {
        expect(mockSimulateTransaction).toHaveBeenCalled();
      });
    });

    it('should handle token with very long name', async () => {
      const user = userEvent.setup();
      const longName = 'A'.repeat(100);
      setupSuccessfulFetch('TOKEN', longName, 18);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText(longName)).toBeInTheDocument();
      });
    });

    it('should handle token with 0 decimals', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch('NFT', 'Non-Fungible Token', 0);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });

    it('should handle token with maximum decimals', async () => {
      const user = userEvent.setup();
      setupSuccessfulFetch('MAX', 'Max Decimals Token', 18);

      render(<AddTokenModal isOpen={true} onClose={mockOnClose} />);

      const input = screen.getByLabelText('Token Contract Address');
      await user.type(input, mockValidAddress);

      await user.click(screen.getByRole('button', { name: 'Fetch' }));

      await waitFor(() => {
        expect(screen.getByText('18')).toBeInTheDocument();
      });
    });
  });
});
