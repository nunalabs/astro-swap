/**
 * Unit tests for AstroSwap SDK Client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AstroSwapClient, createAstroSwapClient } from '../client';
import { NETWORKS, NetworkType } from '../types';
import { Keypair } from '@stellar/stellar-sdk';

// ==================== Test Fixtures ====================

const TEST_SECRET = 'SB7B5LIH3FN6PQUNROJATOT7Z3RBB4QYXEUUCPYG6KSYZ4L3ZCXJTVXD';
const TEST_PUBLIC = 'GCOIVEM3DNR3YXYRV7UXARYZRGNRH57GDN7FAMTA44MK6USCE2ZCG2LY';

const MOCK_CONTRACTS = {
  factory: 'CCCKSUW7RBX5EJVV3QQV55KFFMBB4S5QAXS2EEJZQIGILBB6K7PWSWSI',
  router: 'CCYZHZGMESBVWU6G7L2FU4LHHB4L47IRPNRHRYNKYOX5R5UUIM57BNUX',
  staking: 'CAQM75ARRVKKEVANPHAXHBVP443WPNSESJAVBHUT5CEXO7I6CA7CKL6C',
  aggregator: 'CD5HK2NXF4NOU77VTL2VV5RXUWCIKB26HZHNOHWFDOIZYTQJAEHCQDS5',
  bridge: 'CAXL62ZL2UMGRM3NMHEDN7NWOUU2QVJ54VZ6YAUB6DZPLI4YWQY7KQ4D',
};

// ==================== Client Construction Tests ====================

describe('AstroSwapClient Construction', () => {
  describe('Network Resolution', () => {
    it('should accept network string', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.network).toEqual(NETWORKS.testnet);
      expect(client.network.network).toBe('testnet');
      expect(client.network.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    });

    it('should accept network config object', () => {
      const customNetwork = {
        network: 'testnet' as NetworkType,
        rpcUrl: 'https://custom-rpc.example.com',
        networkPassphrase: 'Custom Network',
      };

      const client = new AstroSwapClient({
        network: customNetwork,
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.network).toEqual(customNetwork);
      expect(client.network.rpcUrl).toBe('https://custom-rpc.example.com');
    });

    it('should resolve mainnet network', () => {
      const client = new AstroSwapClient({
        network: 'mainnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.network).toEqual(NETWORKS.mainnet);
      expect(client.network.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    it('should resolve futurenet network', () => {
      const client = new AstroSwapClient({
        network: 'futurenet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.network).toEqual(NETWORKS.futurenet);
    });

    it('should resolve standalone network config', () => {
      // Standalone uses HTTP which requires allowHttp flag in SorobanRpc.Server
      // We just test that the network config is resolved correctly without instantiating
      const standaloneConfig = NETWORKS.standalone;

      expect(standaloneConfig.network).toBe('standalone');
      expect(standaloneConfig.rpcUrl).toBe('http://localhost:8000/soroban/rpc');
      expect(standaloneConfig.networkPassphrase).toBe('Standalone Network ; February 2017');
      expect(standaloneConfig.friendbotUrl).toBe('http://localhost:8000/friendbot');
    });
  });

  describe('Contract Configuration', () => {
    it('should store contract addresses', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: MOCK_CONTRACTS,
      });

      expect(client.contracts.factory).toBe(MOCK_CONTRACTS.factory);
      expect(client.contracts.router).toBe(MOCK_CONTRACTS.router);
      expect(client.contracts.staking).toBe(MOCK_CONTRACTS.staking);
      expect(client.contracts.aggregator).toBe(MOCK_CONTRACTS.aggregator);
      expect(client.contracts.bridge).toBe(MOCK_CONTRACTS.bridge);
    });

    it('should work with minimal contracts', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: {
          factory: MOCK_CONTRACTS.factory,
          router: MOCK_CONTRACTS.router,
        },
      });

      expect(client.contracts.factory).toBe(MOCK_CONTRACTS.factory);
      expect(client.contracts.router).toBe(MOCK_CONTRACTS.router);
      expect(client.contracts.staking).toBeUndefined();
      expect(client.contracts.aggregator).toBeUndefined();
      expect(client.contracts.bridge).toBeUndefined();
    });
  });

  describe('Keypair Management', () => {
    it('should work without keypair', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.publicKey).toBeUndefined();
    });

    it('should accept keypair via secret key', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
        secretKey: TEST_SECRET,
      });

      expect(client.publicKey).toBe(TEST_PUBLIC);
    });

    it('should derive correct public key from secret', () => {
      const keypair = Keypair.fromSecret(TEST_SECRET);
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
        secretKey: TEST_SECRET,
      });

      expect(client.publicKey).toBe(keypair.publicKey());
    });
  });

  describe('Contract Client Initialization', () => {
    it('should initialize factory client', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.factory).toBeDefined();
      expect(client.factory.contractId).toBe(MOCK_CONTRACTS.factory);
    });

    it('should initialize router client', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      expect(client.router).toBeDefined();
      expect(client.router.contractId).toBe(MOCK_CONTRACTS.router);
    });

    it('should initialize optional staking client', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: {
          factory: MOCK_CONTRACTS.factory,
          router: MOCK_CONTRACTS.router,
          staking: MOCK_CONTRACTS.staking,
        },
      });

      expect(client.staking).toBeDefined();
      expect(client.staking?.contractId).toBe(MOCK_CONTRACTS.staking);
    });

    it('should initialize optional aggregator client', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: {
          factory: MOCK_CONTRACTS.factory,
          router: MOCK_CONTRACTS.router,
          aggregator: MOCK_CONTRACTS.aggregator,
        },
      });

      expect(client.aggregator).toBeDefined();
      expect(client.aggregator?.contractId).toBe(MOCK_CONTRACTS.aggregator);
    });

    it('should initialize optional bridge client', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: {
          factory: MOCK_CONTRACTS.factory,
          router: MOCK_CONTRACTS.router,
          bridge: MOCK_CONTRACTS.bridge,
        },
      });

      expect(client.bridge).toBeDefined();
      expect(client.bridge?.contractId).toBe(MOCK_CONTRACTS.bridge);
    });

    it('should not initialize optional clients when not provided', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: {
          factory: MOCK_CONTRACTS.factory,
          router: MOCK_CONTRACTS.router,
        },
      });

      expect(client.staking).toBeUndefined();
      expect(client.aggregator).toBeUndefined();
      expect(client.bridge).toBeUndefined();
    });

    it('should initialize all clients with full config', () => {
      const client = new AstroSwapClient({
        network: 'testnet',
        contracts: MOCK_CONTRACTS,
      });

      expect(client.factory).toBeDefined();
      expect(client.router).toBeDefined();
      expect(client.staking).toBeDefined();
      expect(client.aggregator).toBeDefined();
      expect(client.bridge).toBeDefined();
    });
  });
});

// ==================== Keypair Management Tests ====================

describe('Keypair Management', () => {
  let client: AstroSwapClient;

  beforeEach(() => {
    client = new AstroSwapClient({
      network: 'testnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });
  });

  describe('publicKey getter', () => {
    it('should return undefined when no keypair set', () => {
      expect(client.publicKey).toBeUndefined();
    });

    it('should return public key when keypair set', () => {
      client.setKeypair(TEST_SECRET);
      expect(client.publicKey).toBe(TEST_PUBLIC);
    });
  });

  describe('setKeypair', () => {
    it('should set keypair from secret key', () => {
      expect(client.publicKey).toBeUndefined();

      client.setKeypair(TEST_SECRET);

      expect(client.publicKey).toBe(TEST_PUBLIC);
    });

    it('should update existing keypair', () => {
      const secret1 = 'SCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4';
      const secret2 = 'SBW2N5EK5MZTKPQJZ6UYXEMCA63AO3AVUR6U5CUOIDFYCAR2X2IJIZAX';

      client.setKeypair(secret1);
      const publicKey1 = client.publicKey;

      client.setKeypair(secret2);
      const publicKey2 = client.publicKey;

      expect(publicKey1).not.toBe(publicKey2);
      expect(client.publicKey).toBe(Keypair.fromSecret(secret2).publicKey());
    });

    it('should throw on invalid secret key', () => {
      expect(() => client.setKeypair('invalid')).toThrow();
    });

    it('should propagate keypair to factory client', () => {
      const factorySpy = vi.spyOn(client.factory, 'setKeypair');

      client.setKeypair(TEST_SECRET);

      expect(factorySpy).toHaveBeenCalled();
    });

    it('should propagate keypair to router client', () => {
      const routerSpy = vi.spyOn(client.router, 'setKeypair');

      client.setKeypair(TEST_SECRET);

      expect(routerSpy).toHaveBeenCalled();
    });

    it('should propagate keypair to optional clients if present', () => {
      const clientWithAll = new AstroSwapClient({
        network: 'testnet',
        contracts: MOCK_CONTRACTS,
      });

      const stakingSpy = vi.spyOn(clientWithAll.staking!, 'setKeypair');
      const aggregatorSpy = vi.spyOn(clientWithAll.aggregator!, 'setKeypair');
      const bridgeSpy = vi.spyOn(clientWithAll.bridge!, 'setKeypair');

      clientWithAll.setKeypair(TEST_SECRET);

      expect(stakingSpy).toHaveBeenCalled();
      expect(aggregatorSpy).toHaveBeenCalled();
      expect(bridgeSpy).toHaveBeenCalled();
    });
  });
});

// ==================== Pair Client Management Tests ====================

describe('Pair Client Management', () => {
  let client: AstroSwapClient;
  const TOKEN_A = 'CAZUUCCU3UI4ZG7U2M2BOWYRIFWGZVOCLXSHABIXN3RFE43GWUIQVGYU';
  const TOKEN_B = 'CBR3WADG22POBUU6NPL4SSUK46HQ4H2O7Q3PSUJFGR2VCXJNHOXOAUQ7';
  const PAIR_ADDRESS = 'CCCKSUW7RBX5EJVV3QQV55KFFMBB4S5QAXS2EEJZQIGILBB6K7PWSWSI';

  beforeEach(() => {
    client = new AstroSwapClient({
      network: 'testnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });
  });

  describe('getPairClient', () => {
    it('should create and cache pair client', async () => {
      // Mock factory.getPairOrThrow
      vi.spyOn(client.factory, 'getPairOrThrow').mockResolvedValue(PAIR_ADDRESS);

      const pairClient = await client.getPairClient(TOKEN_A, TOKEN_B);

      expect(pairClient).toBeDefined();
      expect(pairClient.contractId).toBe(PAIR_ADDRESS);
      expect(client.factory.getPairOrThrow).toHaveBeenCalledWith(TOKEN_A, TOKEN_B);
    });

    it('should reuse cached pair client', async () => {
      vi.spyOn(client.factory, 'getPairOrThrow').mockResolvedValue(PAIR_ADDRESS);

      const pairClient1 = await client.getPairClient(TOKEN_A, TOKEN_B);
      const pairClient2 = await client.getPairClient(TOKEN_A, TOKEN_B);

      expect(pairClient1).toBe(pairClient2);
      expect(client.factory.getPairOrThrow).toHaveBeenCalledTimes(2); // Called each time, but cache is used for client
    });

    it('should propagate factory errors', async () => {
      vi.spyOn(client.factory, 'getPairOrThrow').mockRejectedValue(
        new Error('Pair not found')
      );

      await expect(client.getPairClient(TOKEN_A, TOKEN_B)).rejects.toThrow('Pair not found');
    });
  });

  describe('getPairClientByAddress', () => {
    it('should create pair client by address', () => {
      const pairClient = client.getPairClientByAddress(PAIR_ADDRESS);

      expect(pairClient).toBeDefined();
      expect(pairClient.contractId).toBe(PAIR_ADDRESS);
    });

    it('should cache pair client by address', () => {
      const pairClient1 = client.getPairClientByAddress(PAIR_ADDRESS);
      const pairClient2 = client.getPairClientByAddress(PAIR_ADDRESS);

      expect(pairClient1).toBe(pairClient2);
    });

    it('should create different clients for different addresses', () => {
      const address1 = 'CAZUUCCU3UI4ZG7U2M2BOWYRIFWGZVOCLXSHABIXN3RFE43GWUIQVGYU';
      const address2 = 'CBR3WADG22POBUU6NPL4SSUK46HQ4H2O7Q3PSUJFGR2VCXJNHOXOAUQ7';

      const pairClient1 = client.getPairClientByAddress(address1);
      const pairClient2 = client.getPairClientByAddress(address2);

      expect(pairClient1).not.toBe(pairClient2);
      expect(pairClient1.contractId).toBe(address1);
      expect(pairClient2.contractId).toBe(address2);
    });

    it('should propagate keypair to pair clients', () => {
      client.setKeypair(TEST_SECRET);

      const pairClient = client.getPairClientByAddress(PAIR_ADDRESS);
      const setKeypairSpy = vi.spyOn(pairClient, 'setKeypair');

      client.setKeypair(TEST_SECRET);

      expect(setKeypairSpy).toHaveBeenCalled();
    });
  });
});

// ==================== Convenience Methods Tests ====================

describe('Convenience Methods', () => {
  let client: AstroSwapClient;

  beforeEach(() => {
    client = new AstroSwapClient({
      network: 'testnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      secretKey: TEST_SECRET,
    });
  });

  describe('getAllPairs', () => {
    it('should delegate to factory', async () => {
      const mockPairs = ['PAIR1', 'PAIR2', 'PAIR3'];
      vi.spyOn(client.factory, 'getAllPairs').mockResolvedValue(mockPairs);

      const pairs = await client.getAllPairs();

      expect(pairs).toEqual(mockPairs);
      expect(client.factory.getAllPairs).toHaveBeenCalled();
    });
  });

  describe('pairExists', () => {
    it('should delegate to factory', async () => {
      vi.spyOn(client.factory, 'pairExists').mockResolvedValue(true);

      const exists = await client.pairExists('TOKENA', 'TOKENB');

      expect(exists).toBe(true);
      expect(client.factory.pairExists).toHaveBeenCalledWith('TOKENA', 'TOKENB');
    });
  });

  describe('swap', () => {
    it('should call router swapMultiHop', async () => {
      vi.spyOn(client.router, 'swapMultiHop').mockResolvedValue({
        status: 'success',
        hash: 'hash123',
      });

      const result = await client.swap('TOKENA', 'TOKENB', 1000n, 50);

      expect(client.router.swapMultiHop).toHaveBeenCalledWith(
        ['TOKENA', 'TOKENB'],
        1000n,
        50,
        TEST_PUBLIC
      );
    });

    it('should use default slippage', async () => {
      vi.spyOn(client.router, 'swapMultiHop').mockResolvedValue({
        status: 'success',
        hash: 'hash123',
      });

      await client.swap('TOKENA', 'TOKENB', 1000n);

      expect(client.router.swapMultiHop).toHaveBeenCalledWith(
        ['TOKENA', 'TOKENB'],
        1000n,
        50,
        TEST_PUBLIC
      );
    });

    it('should throw when no keypair set', async () => {
      const clientNoKey = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      await expect(clientNoKey.swap('TOKENA', 'TOKENB', 1000n)).rejects.toThrow(
        'No keypair set for signing'
      );
    });
  });

  describe('addLiquidity', () => {
    it('should call router addLiquiditySimple', async () => {
      vi.spyOn(client.router, 'addLiquiditySimple').mockResolvedValue({
        status: 'success',
        hash: 'hash123',
      });

      await client.addLiquidity('TOKENA', 'TOKENB', 1000n, 2000n, 50);

      expect(client.router.addLiquiditySimple).toHaveBeenCalledWith(
        'TOKENA',
        'TOKENB',
        1000n,
        2000n,
        TEST_PUBLIC,
        50
      );
    });

    it('should throw when no keypair set', async () => {
      const clientNoKey = new AstroSwapClient({
        network: 'testnet',
        contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
      });

      await expect(
        clientNoKey.addLiquidity('TOKENA', 'TOKENB', 1000n, 2000n)
      ).rejects.toThrow('No keypair set for signing');
    });
  });
});

// ==================== Factory Function Tests ====================

describe('createAstroSwapClient', () => {
  it('should create client instance', () => {
    const client = createAstroSwapClient({
      network: 'testnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });

    expect(client).toBeInstanceOf(AstroSwapClient);
  });

  it('should pass all config options', () => {
    const client = createAstroSwapClient({
      network: 'mainnet',
      contracts: MOCK_CONTRACTS,
      secretKey: TEST_SECRET,
    });

    expect(client.network.network).toBe('mainnet');
    expect(client.contracts).toEqual(MOCK_CONTRACTS);
    expect(client.publicKey).toBe(TEST_PUBLIC);
  });
});

// ==================== Integration Tests ====================

describe('Client Integration', () => {
  it('should work with testnet', () => {
    const client = new AstroSwapClient({
      network: 'testnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });

    expect(client.network.network).toBe('testnet');
    expect(client.network.rpcUrl).toContain('testnet');
    expect(client.network.friendbotUrl).toBeDefined();
  });

  it('should work with mainnet', () => {
    const client = new AstroSwapClient({
      network: 'mainnet',
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });

    expect(client.network.network).toBe('mainnet');
    expect(client.network.rpcUrl).not.toContain('testnet');
    expect(client.network.friendbotUrl).toBeUndefined();
  });

  it('should support custom network configuration', () => {
    const customConfig = {
      network: 'testnet' as NetworkType,
      rpcUrl: 'https://my-custom-rpc.example.com',
      networkPassphrase: 'My Custom Network',
      friendbotUrl: 'https://my-friendbot.example.com',
    };

    const client = new AstroSwapClient({
      network: customConfig,
      contracts: { factory: MOCK_CONTRACTS.factory, router: MOCK_CONTRACTS.router },
    });

    expect(client.network).toEqual(customConfig);
  });

  it('should handle all optional contracts', () => {
    const client = new AstroSwapClient({
      network: 'testnet',
      contracts: MOCK_CONTRACTS,
    });

    expect(client.factory).toBeDefined();
    expect(client.router).toBeDefined();
    expect(client.staking).toBeDefined();
    expect(client.aggregator).toBeDefined();
    expect(client.bridge).toBeDefined();
  });

  it('should work without optional contracts', () => {
    const client = new AstroSwapClient({
      network: 'testnet',
      contracts: {
        factory: MOCK_CONTRACTS.factory,
        router: MOCK_CONTRACTS.router,
      },
    });

    expect(client.factory).toBeDefined();
    expect(client.router).toBeDefined();
    expect(client.staking).toBeUndefined();
    expect(client.aggregator).toBeUndefined();
    expect(client.bridge).toBeUndefined();
  });
});
