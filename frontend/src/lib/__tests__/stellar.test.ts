import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NETWORK_PASSPHRASE,
  HORIZON_URL,
  SOROBAN_RPC_URL,
  server,
  sorobanServer,
  getAccountBalance,
  getTokenBalance,
  simulateTransaction,
  buildAndSubmitTransaction,
  callContract,
  signTransactionWithWallet,
} from '../stellar';
import * as StellarSdk from '@stellar/stellar-sdk';

// Mock wallet-kit module
vi.mock('../wallet-kit', () => ({
  signTransaction: vi.fn().mockResolvedValue('mock_signed_xdr'),
}));

// Mock rate-limiter
vi.mock('../rate-limiter', () => ({
  rpcLimiter: {
    execute: vi.fn((fn) => fn()),
  },
}));

describe('stellar configuration', () => {
  describe('exported constants', () => {
    it('should export NETWORK_PASSPHRASE', () => {
      expect(NETWORK_PASSPHRASE).toBeDefined();
      expect(typeof NETWORK_PASSPHRASE).toBe('string');
    });

    it('should have testnet or mainnet passphrase', () => {
      const isValidPassphrase =
        NETWORK_PASSPHRASE === StellarSdk.Networks.TESTNET ||
        NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC;
      expect(isValidPassphrase).toBe(true);
    });

    it('should export HORIZON_URL', () => {
      expect(HORIZON_URL).toBeDefined();
      expect(typeof HORIZON_URL).toBe('string');
      expect(HORIZON_URL).toMatch(/^https?:\/\//);
    });

    it('should have valid Horizon URL format', () => {
      expect(HORIZON_URL).toContain('horizon');
    });

    it('should export SOROBAN_RPC_URL', () => {
      expect(SOROBAN_RPC_URL).toBeDefined();
      expect(typeof SOROBAN_RPC_URL).toBe('string');
      expect(SOROBAN_RPC_URL).toMatch(/^https?:\/\//);
    });

    it('should have valid Soroban RPC URL format', () => {
      const hasValidFormat =
        SOROBAN_RPC_URL.includes('soroban') ||
        SOROBAN_RPC_URL.includes('stellar');
      expect(hasValidFormat).toBe(true);
    });
  });

  describe('exported instances', () => {
    it('should export server instance', () => {
      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(StellarSdk.Horizon.Server);
    });

    it('should export sorobanServer instance', () => {
      expect(sorobanServer).toBeDefined();
      expect(sorobanServer).toBeInstanceOf(StellarSdk.rpc.Server);
    });

    it('should initialize server with correct URL', () => {
      // Server should have serverURL property
      expect(server.serverURL).toBeDefined();
      expect(server.serverURL.toString()).toContain('horizon');
    });

    it('should initialize sorobanServer with correct URL', () => {
      // SorobanServer should have serverURL property
      expect(sorobanServer.serverURL).toBeDefined();
    });
  });

  describe('network configuration consistency', () => {
    it('should have matching network configuration', () => {
      // If using testnet passphrase, should use testnet URLs
      if (NETWORK_PASSPHRASE === StellarSdk.Networks.TESTNET) {
        expect(HORIZON_URL).toContain('testnet');
      }

      // If using mainnet passphrase, should use mainnet URLs
      if (NETWORK_PASSPHRASE === StellarSdk.Networks.PUBLIC) {
        const isMainnetURL =
          HORIZON_URL.includes('stellar.org') &&
          !HORIZON_URL.includes('testnet');
        expect(isMainnetURL).toBe(true);
      }
    });

    it('should use same network across all configs', () => {
      const isTestnet = NETWORK_PASSPHRASE === StellarSdk.Networks.TESTNET;
      const horizonIsTestnet = HORIZON_URL.includes('testnet');
      expect(isTestnet).toBe(horizonIsTestnet);
    });
  });
});

describe('stellar functions', () => {
  const mockAddress = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  const mockTokenAddress = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('signTransactionWithWallet', () => {
    it('should call wallet-kit signTransaction', async () => {
      const xdr = 'mock_xdr';
      const result = await signTransactionWithWallet(xdr);

      expect(result).toBe('mock_signed_xdr');
    });
  });

  describe('getAccountBalance', () => {
    it('should return native balance when account exists', async () => {
      const mockAccount = {
        balances: [
          { asset_type: 'native', balance: '100.5000000' },
          { asset_type: 'credit_alphanum4', balance: '50.0000000' },
        ],
      };

      vi.spyOn(server, 'loadAccount').mockResolvedValue(mockAccount as any);

      const balance = await getAccountBalance(mockAddress);

      expect(balance).toBe('100.5000000');
      expect(server.loadAccount).toHaveBeenCalledWith(mockAddress);
    });

    it('should return "0" when account has no native balance', async () => {
      const mockAccount = {
        balances: [
          { asset_type: 'credit_alphanum4', balance: '50.0000000' },
        ],
      };

      vi.spyOn(server, 'loadAccount').mockResolvedValue(mockAccount as any);

      const balance = await getAccountBalance(mockAddress);

      expect(balance).toBe('0');
    });

    it('should return "0" on error', async () => {
      vi.spyOn(server, 'loadAccount').mockRejectedValue(new Error('Account not found'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const balance = await getAccountBalance(mockAddress);

      expect(balance).toBe('0');
      expect(console.error).toHaveBeenCalledWith(
        'Error fetching account balance:',
        expect.any(Error)
      );
    });
  });

  describe('getTokenBalance', () => {
    it('should return "0" on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const balance = await getTokenBalance(mockAddress, 'INVALID_ADDRESS');

      expect(balance).toBe('0');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('simulateTransaction', () => {
    it('should handle load account errors', async () => {
      vi.spyOn(server, 'loadAccount').mockRejectedValue(new Error('Account not found'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await simulateTransaction(mockAddress, []);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('callContract', () => {
    it('should throw error on load account failure', async () => {
      vi.spyOn(server, 'loadAccount').mockRejectedValue(new Error('Account not found'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        callContract(mockTokenAddress, 'balance', [], mockAddress)
      ).rejects.toThrow('Account not found');
    });
  });

  describe('buildAndSubmitTransaction', () => {
    it('should throw error on load account failure', async () => {
      vi.spyOn(server, 'loadAccount').mockRejectedValue(new Error('Account not found'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        buildAndSubmitTransaction(mockAddress, [])
      ).rejects.toThrow('Account not found');
    });
  });
});
