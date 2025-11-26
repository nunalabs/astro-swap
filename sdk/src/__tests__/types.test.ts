/**
 * Unit tests for AstroSwap SDK Types
 */

import { describe, it, expect } from 'vitest';
import {
  // Network types
  NETWORKS,
  NetworkType,
  NetworkConfig,
  // Error types
  AstroSwapError,
  AstroSwapErrorCode,
  // Enums
  Protocol,
} from '../types';

// ==================== Network Configuration Tests ====================

describe('Network Configuration', () => {
  describe('NETWORKS', () => {
    it('should have testnet configuration', () => {
      const testnet = NETWORKS.testnet;

      expect(testnet).toBeDefined();
      expect(testnet.network).toBe('testnet');
      expect(testnet.rpcUrl).toBe('https://soroban-testnet.stellar.org');
      expect(testnet.networkPassphrase).toBe('Test SDF Network ; September 2015');
      expect(testnet.friendbotUrl).toBe('https://friendbot.stellar.org');
    });

    it('should have mainnet configuration', () => {
      const mainnet = NETWORKS.mainnet;

      expect(mainnet).toBeDefined();
      expect(mainnet.network).toBe('mainnet');
      expect(mainnet.rpcUrl).toBe('https://soroban-rpc.stellar.org');
      expect(mainnet.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
      expect(mainnet.friendbotUrl).toBeUndefined();
    });

    it('should have futurenet configuration', () => {
      const futurenet = NETWORKS.futurenet;

      expect(futurenet).toBeDefined();
      expect(futurenet.network).toBe('futurenet');
      expect(futurenet.rpcUrl).toBe('https://rpc-futurenet.stellar.org');
      expect(futurenet.networkPassphrase).toBe('Test SDF Future Network ; October 2022');
      expect(futurenet.friendbotUrl).toBe('https://friendbot-futurenet.stellar.org');
    });

    it('should have standalone configuration', () => {
      const standalone = NETWORKS.standalone;

      expect(standalone).toBeDefined();
      expect(standalone.network).toBe('standalone');
      expect(standalone.rpcUrl).toBe('http://localhost:8000/soroban/rpc');
      expect(standalone.networkPassphrase).toBe('Standalone Network ; February 2017');
      expect(standalone.friendbotUrl).toBe('http://localhost:8000/friendbot');
    });

    it('should have all required network types', () => {
      expect(NETWORKS).toHaveProperty('testnet');
      expect(NETWORKS).toHaveProperty('mainnet');
      expect(NETWORKS).toHaveProperty('futurenet');
      expect(NETWORKS).toHaveProperty('standalone');
    });

    it('should have unique RPC URLs for each network', () => {
      const rpcUrls = Object.values(NETWORKS).map((n) => n.rpcUrl);
      const uniqueUrls = new Set(rpcUrls);

      expect(uniqueUrls.size).toBe(rpcUrls.length);
    });

    it('should have unique network passphrases', () => {
      const passphrases = Object.values(NETWORKS).map((n) => n.networkPassphrase);
      const uniquePassphrases = new Set(passphrases);

      expect(uniquePassphrases.size).toBe(passphrases.length);
    });

    it('should only provide friendbot for test networks', () => {
      expect(NETWORKS.testnet.friendbotUrl).toBeDefined();
      expect(NETWORKS.futurenet.friendbotUrl).toBeDefined();
      expect(NETWORKS.standalone.friendbotUrl).toBeDefined();
      expect(NETWORKS.mainnet.friendbotUrl).toBeUndefined();
    });
  });
});

// ==================== Error Types Tests ====================

describe('Error Types', () => {
  describe('AstroSwapError', () => {
    it('should create error with code and message', () => {
      const error = new AstroSwapError(
        AstroSwapErrorCode.InvalidAmount,
        'Invalid amount provided'
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AstroSwapError);
      expect(error.name).toBe('AstroSwapError');
      expect(error.code).toBe(AstroSwapErrorCode.InvalidAmount);
      expect(error.message).toBe('Invalid amount provided');
    });

    it('should have correct error code values', () => {
      expect(AstroSwapErrorCode.NotInitialized).toBe(1);
      expect(AstroSwapErrorCode.AlreadyInitialized).toBe(2);
      expect(AstroSwapErrorCode.Unauthorized).toBe(3);
      expect(AstroSwapErrorCode.InvalidAmount).toBe(4);
      expect(AstroSwapErrorCode.InsufficientLiquidity).toBe(5);
      expect(AstroSwapErrorCode.InsufficientBalance).toBe(6);
      expect(AstroSwapErrorCode.SlippageExceeded).toBe(7);
      expect(AstroSwapErrorCode.DeadlineExpired).toBe(8);
    });
  });

  describe('AstroSwapError.fromCode', () => {
    it('should create error from code 1 (NotInitialized)', () => {
      const error = AstroSwapError.fromCode(1);

      expect(error.code).toBe(AstroSwapErrorCode.NotInitialized);
      expect(error.message).toBe('Contract not initialized');
    });

    it('should create error from code 2 (AlreadyInitialized)', () => {
      const error = AstroSwapError.fromCode(2);

      expect(error.code).toBe(AstroSwapErrorCode.AlreadyInitialized);
      expect(error.message).toBe('Contract already initialized');
    });

    it('should create error from code 3 (Unauthorized)', () => {
      const error = AstroSwapError.fromCode(3);

      expect(error.code).toBe(AstroSwapErrorCode.Unauthorized);
      expect(error.message).toBe('Unauthorized access');
    });

    it('should create error from code 4 (InvalidAmount)', () => {
      const error = AstroSwapError.fromCode(4);

      expect(error.code).toBe(AstroSwapErrorCode.InvalidAmount);
      expect(error.message).toBe('Invalid amount');
    });

    it('should create error from code 5 (InsufficientLiquidity)', () => {
      const error = AstroSwapError.fromCode(5);

      expect(error.code).toBe(AstroSwapErrorCode.InsufficientLiquidity);
      expect(error.message).toBe('Insufficient liquidity');
    });

    it('should create error from code 6 (InsufficientBalance)', () => {
      const error = AstroSwapError.fromCode(6);

      expect(error.code).toBe(AstroSwapErrorCode.InsufficientBalance);
      expect(error.message).toBe('Insufficient balance');
    });

    it('should create error from code 7 (SlippageExceeded)', () => {
      const error = AstroSwapError.fromCode(7);

      expect(error.code).toBe(AstroSwapErrorCode.SlippageExceeded);
      expect(error.message).toBe('Slippage tolerance exceeded');
    });

    it('should create error from code 8 (DeadlineExpired)', () => {
      const error = AstroSwapError.fromCode(8);

      expect(error.code).toBe(AstroSwapErrorCode.DeadlineExpired);
      expect(error.message).toBe('Transaction deadline expired');
    });

    it('should create error from code 9 (IdenticalTokens)', () => {
      const error = AstroSwapError.fromCode(9);

      expect(error.code).toBe(AstroSwapErrorCode.IdenticalTokens);
      expect(error.message).toBe('Identical tokens provided');
    });

    it('should create error from code 10 (PairExists)', () => {
      const error = AstroSwapError.fromCode(10);

      expect(error.code).toBe(AstroSwapErrorCode.PairExists);
      expect(error.message).toBe('Pair already exists');
    });

    it('should create error from code 11 (PairNotFound)', () => {
      const error = AstroSwapError.fromCode(11);

      expect(error.code).toBe(AstroSwapErrorCode.PairNotFound);
      expect(error.message).toBe('Pair not found');
    });

    it('should create error from code 12 (PoolNotFound)', () => {
      const error = AstroSwapError.fromCode(12);

      expect(error.code).toBe(AstroSwapErrorCode.PoolNotFound);
      expect(error.message).toBe('Pool not found');
    });

    it('should create error from code 13 (InvalidPath)', () => {
      const error = AstroSwapError.fromCode(13);

      expect(error.code).toBe(AstroSwapErrorCode.InvalidPath);
      expect(error.message).toBe('Invalid swap path');
    });

    it('should create error from code 14 (Overflow)', () => {
      const error = AstroSwapError.fromCode(14);

      expect(error.code).toBe(AstroSwapErrorCode.Overflow);
      expect(error.message).toBe('Arithmetic overflow');
    });

    it('should create error from code 15 (Underflow)', () => {
      const error = AstroSwapError.fromCode(15);

      expect(error.code).toBe(AstroSwapErrorCode.Underflow);
      expect(error.message).toBe('Arithmetic underflow');
    });

    it('should create error from code 16 (DivisionByZero)', () => {
      const error = AstroSwapError.fromCode(16);

      expect(error.code).toBe(AstroSwapErrorCode.DivisionByZero);
      expect(error.message).toBe('Division by zero');
    });

    it('should create error from code 17 (ContractPaused)', () => {
      const error = AstroSwapError.fromCode(17);

      expect(error.code).toBe(AstroSwapErrorCode.ContractPaused);
      expect(error.message).toBe('Contract is paused');
    });

    it('should create error from code 18 (ReentrancyDetected)', () => {
      const error = AstroSwapError.fromCode(18);

      expect(error.code).toBe(AstroSwapErrorCode.ReentrancyDetected);
      expect(error.message).toBe('Reentrancy detected');
    });

    it('should create error from code 19 (InvalidFee)', () => {
      const error = AstroSwapError.fromCode(19);

      expect(error.code).toBe(AstroSwapErrorCode.InvalidFee);
      expect(error.message).toBe('Invalid fee configuration');
    });

    it('should create error from code 20 (InsufficientOutputAmount)', () => {
      const error = AstroSwapError.fromCode(20);

      expect(error.code).toBe(AstroSwapErrorCode.InsufficientOutputAmount);
      expect(error.message).toBe('Insufficient output amount');
    });

    it('should create error from code 21 (ExcessiveInputAmount)', () => {
      const error = AstroSwapError.fromCode(21);

      expect(error.code).toBe(AstroSwapErrorCode.ExcessiveInputAmount);
      expect(error.message).toBe('Excessive input amount');
    });

    it('should create error from code 22 (ProtocolNotFound)', () => {
      const error = AstroSwapError.fromCode(22);

      expect(error.code).toBe(AstroSwapErrorCode.ProtocolNotFound);
      expect(error.message).toBe('Protocol not found');
    });

    it('should create error from code 23 (NoRouteFound)', () => {
      const error = AstroSwapError.fromCode(23);

      expect(error.code).toBe(AstroSwapErrorCode.NoRouteFound);
      expect(error.message).toBe('No route found for swap');
    });

    it('should create error from code 24 (TokenNotGraduated)', () => {
      const error = AstroSwapError.fromCode(24);

      expect(error.code).toBe(AstroSwapErrorCode.TokenNotGraduated);
      expect(error.message).toBe('Token not graduated');
    });

    it('should create error from code 25 (AlreadyGraduated)', () => {
      const error = AstroSwapError.fromCode(25);

      expect(error.code).toBe(AstroSwapErrorCode.AlreadyGraduated);
      expect(error.message).toBe('Token already graduated');
    });

    it('should create error from code 26 (InvalidLaunchpad)', () => {
      const error = AstroSwapError.fromCode(26);

      expect(error.code).toBe(AstroSwapErrorCode.InvalidLaunchpad);
      expect(error.message).toBe('Invalid launchpad address');
    });

    it('should create error from code 27 (GraduationThresholdNotMet)', () => {
      const error = AstroSwapError.fromCode(27);

      expect(error.code).toBe(AstroSwapErrorCode.GraduationThresholdNotMet);
      expect(error.message).toBe('Graduation threshold not met');
    });

    it('should handle unknown error codes', () => {
      const error = AstroSwapError.fromCode(999);

      expect(error.code).toBe(999);
      expect(error.message).toBe('Unknown error (code: 999)');
    });

    it('should handle error code 0', () => {
      const error = AstroSwapError.fromCode(0);

      expect(error.code).toBe(0);
      expect(error.message).toBe('Unknown error (code: 0)');
    });

    it('should handle negative error codes', () => {
      const error = AstroSwapError.fromCode(-1);

      expect(error.code).toBe(-1);
      expect(error.message).toBe('Unknown error (code: -1)');
    });

    it('should create throwable errors', () => {
      const error = AstroSwapError.fromCode(7);

      expect(() => {
        throw error;
      }).toThrow(AstroSwapError);

      expect(() => {
        throw error;
      }).toThrow('Slippage tolerance exceeded');
    });

    it('should have correct error hierarchy', () => {
      const error = AstroSwapError.fromCode(5);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AstroSwapError).toBe(true);
    });

    it('should preserve error code when creating from code', () => {
      for (let code = 1; code <= 27; code++) {
        const error = AstroSwapError.fromCode(code);
        expect(error.code).toBe(code);
      }
    });

    it('should have unique error messages', () => {
      const messages = new Set<string>();

      for (let code = 1; code <= 27; code++) {
        const error = AstroSwapError.fromCode(code);
        messages.add(error.message);
      }

      // All error messages should be unique
      expect(messages.size).toBe(27);
    });
  });

  describe('Error Code Mapping', () => {
    it('should have all error codes mapped to messages', () => {
      const errorCodes = [
        AstroSwapErrorCode.NotInitialized,
        AstroSwapErrorCode.AlreadyInitialized,
        AstroSwapErrorCode.Unauthorized,
        AstroSwapErrorCode.InvalidAmount,
        AstroSwapErrorCode.InsufficientLiquidity,
        AstroSwapErrorCode.InsufficientBalance,
        AstroSwapErrorCode.SlippageExceeded,
        AstroSwapErrorCode.DeadlineExpired,
        AstroSwapErrorCode.IdenticalTokens,
        AstroSwapErrorCode.PairExists,
        AstroSwapErrorCode.PairNotFound,
        AstroSwapErrorCode.PoolNotFound,
        AstroSwapErrorCode.InvalidPath,
        AstroSwapErrorCode.Overflow,
        AstroSwapErrorCode.Underflow,
        AstroSwapErrorCode.DivisionByZero,
        AstroSwapErrorCode.ContractPaused,
        AstroSwapErrorCode.ReentrancyDetected,
        AstroSwapErrorCode.InvalidFee,
        AstroSwapErrorCode.InsufficientOutputAmount,
        AstroSwapErrorCode.ExcessiveInputAmount,
        AstroSwapErrorCode.ProtocolNotFound,
        AstroSwapErrorCode.NoRouteFound,
        AstroSwapErrorCode.TokenNotGraduated,
        AstroSwapErrorCode.AlreadyGraduated,
        AstroSwapErrorCode.InvalidLaunchpad,
        AstroSwapErrorCode.GraduationThresholdNotMet,
      ];

      errorCodes.forEach((code) => {
        const error = AstroSwapError.fromCode(code);
        expect(error.message).not.toContain('Unknown error');
      });
    });
  });
});

// ==================== Protocol Enum Tests ====================

describe('Protocol Enum', () => {
  it('should have AstroSwap protocol', () => {
    expect(Protocol.AstroSwap).toBe(0);
  });

  it('should have Soroswap protocol', () => {
    expect(Protocol.Soroswap).toBe(1);
  });

  it('should have Phoenix protocol', () => {
    expect(Protocol.Phoenix).toBe(2);
  });

  it('should have Aqua protocol', () => {
    expect(Protocol.Aqua).toBe(3);
  });

  it('should have consecutive values', () => {
    expect(Protocol.AstroSwap).toBe(0);
    expect(Protocol.Soroswap).toBe(1);
    expect(Protocol.Phoenix).toBe(2);
    expect(Protocol.Aqua).toBe(3);
  });

  it('should be usable as array indices', () => {
    const protocolNames = ['AstroSwap', 'Soroswap', 'Phoenix', 'Aqua'];

    expect(protocolNames[Protocol.AstroSwap]).toBe('AstroSwap');
    expect(protocolNames[Protocol.Soroswap]).toBe('Soroswap');
    expect(protocolNames[Protocol.Phoenix]).toBe('Phoenix');
    expect(protocolNames[Protocol.Aqua]).toBe('Aqua');
  });
});

// ==================== Type Safety Tests ====================

describe('Type Safety', () => {
  it('should enforce NetworkType union', () => {
    const validNetworks: NetworkType[] = ['testnet', 'mainnet', 'futurenet', 'standalone'];

    validNetworks.forEach((network) => {
      expect(NETWORKS[network]).toBeDefined();
    });
  });

  it('should have consistent NetworkConfig structure', () => {
    Object.values(NETWORKS).forEach((config) => {
      expect(config).toHaveProperty('network');
      expect(config).toHaveProperty('rpcUrl');
      expect(config).toHaveProperty('networkPassphrase');
      expect(typeof config.network).toBe('string');
      expect(typeof config.rpcUrl).toBe('string');
      expect(typeof config.networkPassphrase).toBe('string');
    });
  });

  it('should have proper RPC URL formats', () => {
    expect(NETWORKS.testnet.rpcUrl).toMatch(/^https?:\/\//);
    expect(NETWORKS.mainnet.rpcUrl).toMatch(/^https?:\/\//);
    expect(NETWORKS.futurenet.rpcUrl).toMatch(/^https?:\/\//);
    expect(NETWORKS.standalone.rpcUrl).toMatch(/^https?:\/\//);
  });

  it('should have proper friendbot URL formats where defined', () => {
    if (NETWORKS.testnet.friendbotUrl) {
      expect(NETWORKS.testnet.friendbotUrl).toMatch(/^https?:\/\//);
    }
    if (NETWORKS.futurenet.friendbotUrl) {
      expect(NETWORKS.futurenet.friendbotUrl).toMatch(/^https?:\/\//);
    }
    if (NETWORKS.standalone.friendbotUrl) {
      expect(NETWORKS.standalone.friendbotUrl).toMatch(/^https?:\/\//);
    }
  });
});
