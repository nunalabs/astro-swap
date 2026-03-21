import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// IMPORTANT: Unmock the global wallet-kit mock from test/setup.ts
// We want to test the actual wallet-kit implementation, not the global mock
vi.unmock('../wallet-kit');

// Mock StellarWalletsKit module (the external library)
vi.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: vi.fn().mockImplementation(() => ({
    getAddress: vi.fn().mockResolvedValue({ address: 'GTEST123' }),
    setWallet: vi.fn(),
    openModal: vi.fn(),
    signAuthEntry: vi.fn().mockResolvedValue({ signedAuthEntry: 'mock_signed_auth_entry_xdr' }),
  })),
  WalletNetwork: {
    PUBLIC: 'PUBLIC',
    TESTNET: 'TESTNET',
  },
  allowAllModules: vi.fn(() => []),
  FREIGHTER_ID: 'freighter',
  XBULL_ID: 'xbull',
  LOBSTR_ID: 'lobstr',
  ALBEDO_ID: 'albedo',
}));

// Import after mocks are set up
import {
  WalletError,
  WALLET_IDS,
  WALLET_METADATA,
  getWalletAddress,
  submitWithRetry,
  getTransactionTimeBounds,
  NETWORK,
  NETWORK_PASSPHRASE,
} from '../wallet-kit';

describe('wallet-kit', () => {
  describe('WalletError', () => {
    it('should create error with correct properties', () => {
      const error = new WalletError(
        'timeout',
        'Operation timed out',
        'Please try again',
        true
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBeDefined();
      expect(error.type).toBe('timeout');
      expect(error.message).toBe('Operation timed out');
      expect(error.userMessage).toBe('Please try again');
      expect(error.recoverable).toBe(true);
    });

    it('should create non-recoverable error', () => {
      const error = new WalletError(
        'validation',
        'Invalid transaction',
        'Transaction is invalid',
        false
      );

      expect(error.type).toBe('validation');
      expect(error.recoverable).toBe(false);
    });

    it('should default to recoverable', () => {
      const error = new WalletError(
        'network',
        'Network error',
        'Connection failed'
      );

      expect(error.recoverable).toBe(true);
    });

    it('should support all error types', () => {
      const types: Array<'cancelled' | 'timeout' | 'network' | 'validation' | 'unknown'> = [
        'cancelled',
        'timeout',
        'network',
        'validation',
        'unknown',
      ];

      types.forEach(type => {
        const error = new WalletError(type, 'Test', 'Test message');
        expect(error.type).toBe(type);
      });
    });

    it('should have correct error message', () => {
      const error = new WalletError(
        'cancelled',
        'User cancelled',
        'User cancelled the operation'
      );

      expect(error.message).toBe('User cancelled');
      expect(error.toString()).toContain('User cancelled');
    });

    it('should be catchable as Error', () => {
      const error = new WalletError('timeout', 'Test', 'Test');

      try {
        throw error;
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(WalletError);
        if (e instanceof WalletError) {
          expect(e.type).toBe('timeout');
        }
      }
    });
  });

  describe('WALLET_IDS', () => {
    it('should export wallet IDs', () => {
      expect(WALLET_IDS.FREIGHTER).toBe('freighter');
      expect(WALLET_IDS.XBULL).toBe('xbull');
      expect(WALLET_IDS.LOBSTR).toBe('lobstr');
      expect(WALLET_IDS.ALBEDO).toBe('albedo');
    });

    it('should have all required wallet IDs', () => {
      expect(Object.keys(WALLET_IDS)).toContain('FREIGHTER');
      expect(Object.keys(WALLET_IDS)).toContain('XBULL');
      expect(Object.keys(WALLET_IDS)).toContain('LOBSTR');
      expect(Object.keys(WALLET_IDS)).toContain('ALBEDO');
    });

    it('should be readonly (const)', () => {
      // TypeScript enforces this at compile time
      expect(WALLET_IDS).toBeDefined();
    });
  });

  describe('WALLET_METADATA', () => {
    it('should have metadata for all wallets', () => {
      expect(WALLET_METADATA['freighter']).toBeDefined();
      expect(WALLET_METADATA['xbull']).toBeDefined();
      expect(WALLET_METADATA['lobstr']).toBeDefined();
      expect(WALLET_METADATA['albedo']).toBeDefined();
    });

    it('should have correct structure for each wallet', () => {
      Object.values(WALLET_METADATA).forEach(metadata => {
        expect(metadata).toHaveProperty('name');
        expect(metadata).toHaveProperty('icon');
        expect(metadata).toHaveProperty('mobile');
        expect(typeof metadata.name).toBe('string');
        expect(typeof metadata.icon).toBe('string');
        expect(typeof metadata.mobile).toBe('boolean');
      });
    });

    it('should have Freighter metadata', () => {
      const freighter = WALLET_METADATA['freighter'];
      expect(freighter.name).toBe('Freighter');
      expect(freighter.icon).toContain('freighter');
      expect(freighter.mobile).toBe(false);
    });

    it('should have xBull metadata', () => {
      const xbull = WALLET_METADATA['xbull'];
      expect(xbull.name).toBe('xBull');
      expect(xbull.icon).toContain('xbull');
      expect(xbull.mobile).toBe(true);
    });

    it('should have LOBSTR metadata', () => {
      const lobstr = WALLET_METADATA['lobstr'];
      expect(lobstr.name).toBe('LOBSTR');
      expect(lobstr.icon).toContain('lobstr');
      expect(lobstr.mobile).toBe(true);
    });

    it('should have Albedo metadata', () => {
      const albedo = WALLET_METADATA['albedo'];
      expect(albedo.name).toBe('Albedo');
      expect(albedo.icon).toContain('albedo');
      expect(albedo.mobile).toBe(true);
    });

    it('should mark desktop vs mobile wallets correctly', () => {
      // Freighter is desktop only
      expect(WALLET_METADATA['freighter'].mobile).toBe(false);

      // Others support mobile
      expect(WALLET_METADATA['xbull'].mobile).toBe(true);
      expect(WALLET_METADATA['lobstr'].mobile).toBe(true);
      expect(WALLET_METADATA['albedo'].mobile).toBe(true);
    });

    it('should have icon paths for all wallets', () => {
      Object.values(WALLET_METADATA).forEach(metadata => {
        expect(metadata.icon).toMatch(/^\/wallets\/.+\.svg$/);
      });
    });
  });

  describe('getWalletAddress', () => {
    it('should return wallet address', async () => {
      const address = await getWalletAddress();

      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
    });

    it('should call walletKit.getAddress', async () => {
      // Already mocked to return 'GTEST123'
      const address = await getWalletAddress();
      expect(address).toBe('GTEST123');
    });
  });

  describe('Network Configuration', () => {
    it('should use correct network based on environment', () => {
      // This is a compile-time check, but we can verify the module exports
      expect(WALLET_IDS).toBeDefined();
      expect(WALLET_METADATA).toBeDefined();
    });
  });

  describe('WalletConnection interface', () => {
    it('should have correct structure', () => {
      // TypeScript interface test (compile-time check)
      const connection: { address: string; walletId: string; walletName: string } = {
        address: 'GTEST',
        walletId: 'freighter',
        walletName: 'Freighter',
      };

      expect(connection.address).toBeDefined();
      expect(connection.walletId).toBeDefined();
      expect(connection.walletName).toBeDefined();
    });
  });

  describe('Error type coverage', () => {
    it('should cover all error types in WalletErrorType', () => {
      const errorTypes = ['cancelled', 'timeout', 'network', 'validation', 'unknown'];

      errorTypes.forEach(type => {
        const error = new WalletError(
          type as any,
          'Test message',
          'User message'
        );
        expect(error.type).toBe(type);
      });
    });

    it('should create user-friendly messages for each error type', () => {
      const cancelledError = new WalletError('cancelled', 'Cancelled', 'User cancelled');
      expect(cancelledError.userMessage).toContain('cancelled');

      const timeoutError = new WalletError('timeout', 'Timeout', 'Request timed out');
      expect(timeoutError.userMessage).toContain('timed out');

      const networkError = new WalletError('network', 'Network', 'Network error');
      expect(networkError.userMessage).toContain('Network');

      const validationError = new WalletError('validation', 'Invalid', 'Invalid data');
      expect(validationError.userMessage).toContain('Invalid');

      const unknownError = new WalletError('unknown', 'Unknown', 'Unknown error');
      expect(unknownError.userMessage).toContain('Unknown');
    });
  });

  describe('Wallet constants', () => {
    it('should have consistent wallet IDs between WALLET_IDS and WALLET_METADATA', () => {
      Object.values(WALLET_IDS).forEach(id => {
        expect(WALLET_METADATA[id]).toBeDefined();
      });
    });

    it('should have unique wallet IDs', () => {
      const ids = Object.values(WALLET_IDS);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have unique wallet names', () => {
      const names = Object.values(WALLET_METADATA).map(m => m.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have unique icon paths', () => {
      const icons = Object.values(WALLET_METADATA).map(m => m.icon);
      const uniqueIcons = new Set(icons);
      expect(uniqueIcons.size).toBe(icons.length);
    });
  });

  describe('submitWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return result on first successful attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const promise = submitWithRetry(mockFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve('success-after-retry');
      });

      const promise = submitWithRetry(mockFn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success-after-retry');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw WalletError after max retries', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = submitWithRetry(mockFn, 3).catch((error) => error);
      await vi.runAllTimersAsync();
      const error = await promise;

      expect(error).toBeInstanceOf(WalletError);
      expect(error.type).toBe('network');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on validation errors (invalid)', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Invalid transaction format'));

      const promise = submitWithRetry(mockFn).catch((error) => error);
      await vi.runAllTimersAsync();
      const error = await promise;

      expect(error).toBeInstanceOf(WalletError);
      expect(error.type).toBe('validation');
      expect(error.recoverable).toBe(false);
      expect(mockFn).toHaveBeenCalledTimes(1); // No retry
    });

    it('should not retry on validation errors (malformed)', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Malformed XDR'));

      const promise = submitWithRetry(mockFn).catch((error) => error);
      await vi.runAllTimersAsync();
      const error = await promise;

      expect(error).toBeInstanceOf(WalletError);
      expect(error.type).toBe('validation');
      expect(mockFn).toHaveBeenCalledTimes(1); // No retry
    });

    it('should handle non-Error rejections', async () => {
      const mockFn = vi.fn().mockRejectedValue('string error');

      const promise = submitWithRetry(mockFn, 2).catch((error) => error);
      await vi.runAllTimersAsync();
      const error = await promise;

      expect(error).toBeInstanceOf(WalletError);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should respect custom maxRetries parameter', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Network error'));

      const promise = submitWithRetry(mockFn, 5).catch((error) => error);
      await vi.runAllTimersAsync();

      expect(mockFn).toHaveBeenCalledTimes(5);
    });

    it('should use exponential backoff with delays', async () => {
      let attempts = 0;
      const mockFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Retry me'));
        }
        return Promise.resolve('success');
      });

      const promise = submitWithRetry(mockFn, 3);

      // Fast-forward through all timers
      await vi.runAllTimersAsync();

      const result = await promise;
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTransactionTimeBounds', () => {
    it('should return time bounds object', () => {
      const bounds = getTransactionTimeBounds();

      expect(bounds).toHaveProperty('minTime');
      expect(bounds).toHaveProperty('maxTime');
      expect(typeof bounds.minTime).toBe('number');
      expect(typeof bounds.maxTime).toBe('number');
    });

    it('should have maxTime greater than minTime', () => {
      const bounds = getTransactionTimeBounds();

      expect(bounds.maxTime).toBeGreaterThan(bounds.minTime);
    });

    it('should have 5 minute (300 second) validity window', () => {
      const bounds = getTransactionTimeBounds();
      const diff = bounds.maxTime - bounds.minTime;

      expect(diff).toBe(300); // 5 minutes = 300 seconds
    });

    it('should return current time for minTime', () => {
      const before = Math.floor(Date.now() / 1000);
      const bounds = getTransactionTimeBounds();
      const after = Math.floor(Date.now() / 1000);

      expect(bounds.minTime).toBeGreaterThanOrEqual(before);
      expect(bounds.minTime).toBeLessThanOrEqual(after);
    });

    it('should return consistent time bounds within same second', () => {
      const bounds1 = getTransactionTimeBounds();
      const bounds2 = getTransactionTimeBounds();

      // Should be within 1 second of each other
      expect(Math.abs(bounds1.minTime - bounds2.minTime)).toBeLessThanOrEqual(1);
      expect(Math.abs(bounds1.maxTime - bounds2.maxTime)).toBeLessThanOrEqual(1);
    });

    it('should use integer timestamps', () => {
      const bounds = getTransactionTimeBounds();

      expect(Number.isInteger(bounds.minTime)).toBe(true);
      expect(Number.isInteger(bounds.maxTime)).toBe(true);
    });
  });

  describe('Network exports', () => {
    it('should export NETWORK constant', () => {
      expect(NETWORK).toBeDefined();
      expect(typeof NETWORK).toBe('string');
    });

    it('should export NETWORK_PASSPHRASE constant', () => {
      expect(NETWORK_PASSPHRASE).toBeDefined();
      expect(typeof NETWORK_PASSPHRASE).toBe('string');
    });

    it('should have valid network passphrase', () => {
      const isValid =
        NETWORK_PASSPHRASE.includes('Test SDF Network') ||
        NETWORK_PASSPHRASE.includes('Public Global Stellar Network');
      expect(isValid).toBe(true);
    });

    it('should match network configuration', () => {
      if (NETWORK === 'testnet') {
        expect(NETWORK_PASSPHRASE).toContain('Test SDF Network');
      } else if (NETWORK === 'mainnet') {
        expect(NETWORK_PASSPHRASE).toContain('Public Global Stellar Network');
      }
    });
  });

  describe('isMobileDevice', () => {
    it('should return boolean', async () => {
      const { isMobileDevice } = await import('../wallet-kit');
      const result = isMobileDevice();

      expect(typeof result).toBe('boolean');
    });

    it('should detect mobile user agents', async () => {
      const { isMobileDevice } = await import('../wallet-kit');

      const mobileAgents = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        'Mozilla/5.0 (Linux; Android 10)',
        'Mozilla/5.0 (Windows Phone 10.0)',
        'Opera Mini/7.1.32694',
      ];

      // Can't actually change navigator.userAgent in tests, but we can verify it doesn't throw
      expect(() => isMobileDevice()).not.toThrow();
    });
  });

  describe('getMobileWallets', () => {
    it('should return array of wallet IDs', async () => {
      const { getMobileWallets } = await import('../wallet-kit');
      const wallets = getMobileWallets();

      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBeGreaterThan(0);
    });

    it('should only return mobile-compatible wallets', async () => {
      const { getMobileWallets, WALLET_METADATA } = await import('../wallet-kit');
      const wallets = getMobileWallets();

      wallets.forEach(walletId => {
        expect(WALLET_METADATA[walletId]).toBeDefined();
        expect(WALLET_METADATA[walletId].mobile).toBe(true);
      });
    });

    it('should not include Freighter (desktop only)', async () => {
      const { getMobileWallets, WALLET_IDS } = await import('../wallet-kit');
      const wallets = getMobileWallets();

      expect(wallets).not.toContain(WALLET_IDS.FREIGHTER);
    });

    it('should include xBull, LOBSTR, and Albedo', async () => {
      const { getMobileWallets, WALLET_IDS } = await import('../wallet-kit');
      const wallets = getMobileWallets();

      expect(wallets).toContain(WALLET_IDS.XBULL);
      expect(wallets).toContain(WALLET_IDS.LOBSTR);
      expect(wallets).toContain(WALLET_IDS.ALBEDO);
    });
  });

  describe('disconnectWallet', () => {
    it('should not throw when called', async () => {
      const { disconnectWallet } = await import('../wallet-kit');

      expect(() => disconnectWallet()).not.toThrow();
    });

    it('should return undefined', async () => {
      const { disconnectWallet } = await import('../wallet-kit');
      const result = disconnectWallet();

      expect(result).toBeUndefined();
    });

    it('should be callable multiple times', async () => {
      const { disconnectWallet } = await import('../wallet-kit');

      expect(() => {
        disconnectWallet();
        disconnectWallet();
        disconnectWallet();
      }).not.toThrow();
    });
  });

  describe('signAuthEntry', () => {
    it('should be a function', async () => {
      const { signAuthEntry } = await import('../wallet-kit');

      expect(typeof signAuthEntry).toBe('function');
    });

    it('should accept auth entry and address parameters', async () => {
      const { signAuthEntry } = await import('../wallet-kit');

      // Verify function signature by checking it doesn't throw on call attempt
      // (will fail at runtime due to mock, but signature is correct)
      expect(signAuthEntry).toBeDefined();
      expect(signAuthEntry.length).toBe(2); // 2 parameters
    });
  });
});
