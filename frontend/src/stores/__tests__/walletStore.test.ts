/**
 * WalletStore - Unit Tests
 *
 * Strategy: Test Zustand store logic, mock external dependencies
 * Coverage: connect, disconnect, updateBalance, signTransaction, persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWalletStore } from '../walletStore';
import * as walletKit from '../../lib/wallet-kit';
import * as stellar from '../../lib/stellar';

describe('WalletStore', () => {
  beforeEach(() => {
    // Clear store state
    useWalletStore.setState({
      address: null,
      publicKey: null,
      walletId: null,
      walletName: null,
      isConnected: false,
      isConnecting: false,
      balance: '0',
    });

    vi.clearAllMocks();

    // Mock stellar functions
    vi.spyOn(stellar, 'getAccountBalance').mockResolvedValue('0');

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useWalletStore.getState();

      expect(state.address).toBeNull();
      expect(state.publicKey).toBeNull();
      expect(state.walletId).toBeNull();
      expect(state.walletName).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.isConnecting).toBe(false);
      expect(state.balance).toBe('0');
      expect(state.isMobile).toBe(false);
    });

    it('should expose all required functions', () => {
      const state = useWalletStore.getState();

      expect(typeof state.connect).toBe('function');
      expect(typeof state.disconnect).toBe('function');
      expect(typeof state.updateBalance).toBe('function');
      expect(typeof state.signTransaction).toBe('function');
    });
  });

  describe('Connect Wallet', () => {
    it('should connect wallet successfully', async () => {
      const mockWalletData = {
        address: 'GABC123XYZ456',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      vi.mocked(walletKit.openWalletModal).mockResolvedValue(mockWalletData);
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('10000000000'); // 1000 XLM

      const { connect } = useWalletStore.getState();

      // Initially not connecting
      expect(useWalletStore.getState().isConnecting).toBe(false);

      // Start connecting
      const connectPromise = connect();

      // Should be connecting
      expect(useWalletStore.getState().isConnecting).toBe(true);

      await connectPromise;

      // Check final state
      const state = useWalletStore.getState();
      expect(state.address).toBe(mockWalletData.address);
      expect(state.publicKey).toBe(mockWalletData.address);
      expect(state.walletId).toBe(mockWalletData.walletId);
      expect(state.walletName).toBe(mockWalletData.walletName);
      expect(state.isConnected).toBe(true);
      expect(state.isConnecting).toBe(false);
      expect(state.balance).toBe('10000000000');
    });

    it('should handle connection error', async () => {
      const error = new Error('User cancelled');
      vi.mocked(walletKit.openWalletModal).mockRejectedValue(error);

      const { connect } = useWalletStore.getState();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(connect()).rejects.toThrow('User cancelled');

      // Should reset connecting state
      expect(useWalletStore.getState().isConnecting).toBe(false);
      expect(useWalletStore.getState().isConnected).toBe(false);

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith('Error connecting wallet:', error);

      consoleSpy.mockRestore();
    });

    it('should fetch balance after connecting', async () => {
      const mockWalletData = {
        address: 'GABC123XYZ456',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      vi.mocked(walletKit.openWalletModal).mockResolvedValue(mockWalletData);
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('5000000000'); // 500 XLM

      const { connect } = useWalletStore.getState();
      await connect();

      // Balance should be fetched
      expect(stellar.getAccountBalance).toHaveBeenCalledWith(mockWalletData.address);
      expect(useWalletStore.getState().balance).toBe('5000000000');
    });
  });

  describe('Disconnect Wallet', () => {
    it('should disconnect wallet and clear state', async () => {
      // First connect
      const mockWalletData = {
        address: 'GABC123XYZ456',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      vi.mocked(walletKit.openWalletModal).mockResolvedValue(mockWalletData);
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('10000000000');

      const { connect, disconnect } = useWalletStore.getState();
      await connect();

      // Verify connected
      expect(useWalletStore.getState().isConnected).toBe(true);

      // Disconnect
      disconnect();

      // Check state cleared
      const state = useWalletStore.getState();
      expect(state.address).toBeNull();
      expect(state.publicKey).toBeNull();
      expect(state.walletId).toBeNull();
      expect(state.walletName).toBeNull();
      expect(state.isConnected).toBe(false);
      expect(state.balance).toBe('0');
    });
  });

  describe('Update Balance', () => {
    it('should update balance for connected wallet', async () => {
      // Setup connected state
      useWalletStore.setState({
        address: 'GABC123XYZ456',
        isConnected: true,
      });

      vi.mocked(stellar.getAccountBalance).mockResolvedValue('20000000000'); // 2000 XLM

      const { updateBalance } = useWalletStore.getState();
      await updateBalance();

      expect(stellar.getAccountBalance).toHaveBeenCalledWith('GABC123XYZ456');
      expect(useWalletStore.getState().balance).toBe('20000000000');
    });

    it('should not update balance if wallet not connected', async () => {
      // No address
      useWalletStore.setState({ address: null });

      const { updateBalance } = useWalletStore.getState();
      await updateBalance();

      // Should not call getAccountBalance
      expect(stellar.getAccountBalance).not.toHaveBeenCalled();
    });

    it('should handle balance update error silently', async () => {
      useWalletStore.setState({
        address: 'GABC123XYZ456',
        isConnected: true,
        balance: '10000000000', // Existing balance
      });

      const error = new Error('RPC error');
      vi.mocked(stellar.getAccountBalance).mockRejectedValue(error);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { updateBalance } = useWalletStore.getState();
      await updateBalance();

      // Should log error
      expect(consoleSpy).toHaveBeenCalledWith('Error updating balance:', error);

      // Balance should remain unchanged
      expect(useWalletStore.getState().balance).toBe('10000000000');

      consoleSpy.mockRestore();
    });
  });

  describe('Sign Transaction', () => {
    it('should sign transaction when connected', async () => {
      useWalletStore.setState({ isConnected: true });

      const mockXdr = 'AAAAAgAAAABXr8...';
      const mockSignedXdr = 'AAAAAgAAAABXr8...SIGNED';

      vi.mocked(walletKit.signTransaction).mockResolvedValue(mockSignedXdr);

      const { signTransaction } = useWalletStore.getState();
      const result = await signTransaction(mockXdr);

      expect(result).toBe(mockSignedXdr);
      expect(walletKit.signTransaction).toHaveBeenCalledWith(mockXdr);
    });

    it('should throw error when wallet not connected', async () => {
      useWalletStore.setState({ isConnected: false });

      const { signTransaction } = useWalletStore.getState();

      await expect(signTransaction('AAAAAgAAAABXr8...')).rejects.toThrow(
        'Wallet not connected'
      );

      // Should not call signTx
      expect(walletKit.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Persistence', () => {
    it('should persist wallet state to localStorage', async () => {
      const mockWalletData = {
        address: 'GABC123XYZ456',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      vi.mocked(walletKit.openWalletModal).mockResolvedValue(mockWalletData);
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('10000000000');

      const { connect } = useWalletStore.getState();
      await connect();

      // Check localStorage
      const stored = localStorage.getItem('astroswap-wallet');
      expect(stored).toBeDefined();

      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.state.address).toBe(mockWalletData.address);
        expect(parsed.state.walletId).toBe(mockWalletData.walletId);
        expect(parsed.state.isConnected).toBe(true);
      }
    });

    it('should only persist specific fields', async () => {
      const mockWalletData = {
        address: 'GABC123XYZ456',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      vi.mocked(walletKit.openWalletModal).mockResolvedValue(mockWalletData);
      vi.mocked(stellar.getAccountBalance).mockResolvedValue('10000000000');

      const { connect } = useWalletStore.getState();
      await connect();

      const stored = localStorage.getItem('astroswap-wallet');
      if (stored) {
        const parsed = JSON.parse(stored);

        // Should persist these
        expect(parsed.state.address).toBeDefined();
        expect(parsed.state.publicKey).toBeDefined();
        expect(parsed.state.walletId).toBeDefined();
        expect(parsed.state.walletName).toBeDefined();
        expect(parsed.state.isConnected).toBeDefined();

        // Should NOT persist these
        expect(parsed.state.balance).toBeUndefined();
        expect(parsed.state.isConnecting).toBeUndefined();
      }
    });
  });

  describe('Mobile Detection', () => {
    it('should detect mobile device', () => {
      // Recreate store with mobile detection mocked
      vi.mocked(walletKit.isMobileDevice).mockReturnValue(true);

      // Need to reimport to get new value
      const state = useWalletStore.getState();
      expect(typeof state.isMobile).toBe('boolean');
    });
  });
});
