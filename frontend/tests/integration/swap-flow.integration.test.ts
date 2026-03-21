/**
 * Swap Flow - Integration Tests (Localnet)
 *
 * Based on: 57Blocks Best Practices
 * Environment: Soroban Localnet with REAL contracts
 * Strategy: Full end-to-end user flows, no mocks
 *
 * Prerequisites:
 * - Stellar CLI v25.2.0+ installed
 * - Run: stellar container start local
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as StellarSdk from '@stellar/stellar-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Localnet configuration
const LOCALNET_RPC = 'http://localhost:8000/soroban/rpc';
const LOCALNET_PASSPHRASE = 'Standalone Network ; February 2017';
const LOCALNET_NETWORK_ID = '0000000000000000000000000000000000000000000000000000000000000000';

// Contract IDs (deployed in setup)
let factoryId: string;
let routerId: string;
let xlmTokenId: string;
let astroTokenId: string;
let pairId: string;

// Test accounts
let adminAccount: StellarSdk.Keypair;
let userAccount: StellarSdk.Keypair;

// Server instance
let server: StellarSdk.SorobanRpc.Server;

// Helper: Execute shell command
async function sh(cmd: string): Promise<string> {
  const { stdout } = await execAsync(cmd);
  return stdout.trim();
}

// Helper: Deploy contract to localnet
async function deployContract(name: string): Promise<string> {
  console.log(`Deploying ${name}...`);
  const wasmPath = `../../target/wasm32v1-none/release/astroswap_${name}.wasm`;

  const contractId = await sh(
    `stellar contract deploy \
      --wasm ${wasmPath} \
      --source admin \
      --network local`
  );

  console.log(`✅ ${name} deployed: ${contractId}`);
  return contractId;
}

// Helper: Fund account with XLM
async function fundAccount(address: string): Promise<void> {
  await sh(`stellar keys fund ${address} --network local`);
}

// Helper: Create test token
async function createTestToken(
  name: string,
  symbol: string,
  admin: string
): Promise<string> {
  console.log(`Creating ${symbol} token...`);

  // Deploy SAC token contract
  const tokenId = await deployContract('token'); // Assuming we have a token contract

  // Initialize token
  await sh(
    `stellar contract invoke \
      --id ${tokenId} \
      --source admin \
      --network local \
      -- initialize \
      --admin ${admin} \
      --name "${name}" \
      --symbol "${symbol}" \
      --decimals 7`
  );

  console.log(`✅ ${symbol} created: ${tokenId}`);
  return tokenId;
}

// Helper: Mint tokens
async function mintTokens(
  tokenId: string,
  recipient: string,
  amount: string
): Promise<void> {
  await sh(
    `stellar contract invoke \
      --id ${tokenId} \
      --source admin \
      --network local \
      -- mint \
      --to ${recipient} \
      --amount ${amount}`
  );
}

// Helper: Get token balance
async function getBalance(tokenId: string, owner: string): Promise<bigint> {
  const result = await sh(
    `stellar contract invoke \
      --id ${tokenId} \
      --source admin \
      --network local \
      -- balance \
      --id ${owner}`
  );

  return BigInt(result);
}

// Helper: Approve token spending
async function approveToken(
  tokenId: string,
  spender: string,
  amount: string,
  from: string
): Promise<void> {
  const currentLedger = await server.getLatestLedger();
  const expirationLedger = currentLedger.sequence + 17280; // ~1 day

  await sh(
    `stellar contract invoke \
      --id ${tokenId} \
      --source ${from} \
      --network local \
      -- approve \
      --from ${from} \
      --spender ${spender} \
      --amount ${amount} \
      --expiration_ledger ${expirationLedger}`
  );
}

// Helper: Initialize router
async function initializeRouter(
  routerId: string,
  factoryId: string,
  admin: string
): Promise<void> {
  await sh(
    `stellar contract invoke \
      --id ${routerId} \
      --source admin \
      --network local \
      -- initialize \
      --factory ${factoryId} \
      --admin ${admin}`
  );
}

// Helper: Create pair
async function createPair(
  factoryId: string,
  token0: string,
  token1: string
): Promise<string> {
  const result = await sh(
    `stellar contract invoke \
      --id ${factoryId} \
      --source admin \
      --network local \
      -- create_pair \
      --caller ${adminAccount.publicKey()} \
      --token_a ${token0} \
      --token_b ${token1}`
  );

  return result;
}

describe('Swap Flow - Integration Tests (Localnet)', () => {
  beforeAll(async () => {
    console.log('\n🚀 Setting up Soroban Localnet Integration Tests...\n');

    // Initialize server
    server = new StellarSdk.SorobanRpc.Server(LOCALNET_RPC);

    // Create admin keypair
    adminAccount = StellarSdk.Keypair.random();
    console.log(`Admin: ${adminAccount.publicKey()}`);

    // Generate stellar keys
    await sh(`stellar keys generate admin --seed "${adminAccount.secret()}" --network local --overwrite`);

    // Fund admin
    await fundAccount(adminAccount.publicKey());

    // Deploy contracts
    console.log('\n📦 Deploying contracts...');
    factoryId = await deployContract('factory');
    routerId = await deployContract('router');

    // Initialize router
    await initializeRouter(routerId, factoryId, adminAccount.publicKey());

    // Create test tokens
    console.log('\n🪙 Creating test tokens...');
    xlmTokenId = await createTestToken('Stellar Lumens', 'XLM', adminAccount.publicKey());
    astroTokenId = await createTestToken('Astro Token', 'ASTRO', adminAccount.publicKey());

    // Create user account
    userAccount = StellarSdk.Keypair.random();
    await sh(`stellar keys generate user --seed "${userAccount.secret()}" --network local --overwrite`);
    await fundAccount(userAccount.publicKey());

    // Mint tokens to user
    console.log('\n💰 Minting tokens to user...');
    await mintTokens(xlmTokenId, userAccount.publicKey(), '100000000000'); // 10,000 XLM
    await mintTokens(astroTokenId, userAccount.publicKey(), '1000000000000'); // 100,000 ASTRO

    // Create pair
    console.log('\n🔗 Creating XLM/ASTRO pair...');
    pairId = await createPair(factoryId, xlmTokenId, astroTokenId);

    // Add initial liquidity as admin
    console.log('\n💧 Adding initial liquidity...');
    await approveToken(xlmTokenId, routerId, '10000000000', 'admin'); // 1000 XLM
    await approveToken(astroTokenId, routerId, '100000000000', 'admin'); // 10000 ASTRO

    const deadline = Math.floor(Date.now() / 1000) + 300;
    await sh(
      `stellar contract invoke \
        --id ${routerId} \
        --source admin \
        --network local \
        -- add_liquidity \
        --user ${adminAccount.publicKey()} \
        --token_a ${xlmTokenId} \
        --token_b ${astroTokenId} \
        --amount_a_desired 10000000000 \
        --amount_b_desired 100000000000 \
        --amount_a_min 9500000000 \
        --amount_b_min 95000000000 \
        --deadline ${deadline}`
    );

    console.log('\n✅ Setup complete!\n');
  }, 120000); // 2 minute timeout for full setup

  afterAll(async () => {
    console.log('\n🧹 Cleaning up...');
    // Localnet cleanup happens automatically on container stop
  });

  beforeEach(async () => {
    // Each test starts with known balances
    console.log('\n📊 Test starting...');
  });

  describe('Complete Swap Flow (Best Practice #2: Full E2E)', () => {
    it('should execute complete swap with token approval', async () => {
      // ARRANGE
      const swapAmount = '1000000000'; // 100 XLM
      const minAmountOut = '800000000'; // 80 ASTRO minimum
      const deadline = Math.floor(Date.now() / 1000) + 300;

      // Get initial balances
      const initialXLM = await getBalance(xlmTokenId, userAccount.publicKey());
      const initialASTRO = await getBalance(astroTokenId, userAccount.publicKey());

      console.log(`Initial XLM: ${initialXLM}`);
      console.log(`Initial ASTRO: ${initialASTRO}`);

      // ACT 1: Approve tokens
      console.log('Approving tokens...');
      await approveToken(xlmTokenId, routerId, swapAmount, 'user');

      // ACT 2: Execute swap
      console.log('Executing swap...');
      const result = await sh(
        `stellar contract invoke \
          --id ${routerId} \
          --source user \
          --network local \
          -- swap_exact_tokens_for_tokens \
          --user ${userAccount.publicKey()} \
          --amount_in ${swapAmount} \
          --amount_out_min ${minAmountOut} \
          --path '["${xlmTokenId}","${astroTokenId}"]' \
          --deadline ${deadline}`
      );

      console.log(`Swap result: ${result}`);

      // ASSERT
      const finalXLM = await getBalance(xlmTokenId, userAccount.publicKey());
      const finalASTRO = await getBalance(astroTokenId, userAccount.publicKey());

      console.log(`Final XLM: ${finalXLM}`);
      console.log(`Final ASTRO: ${finalASTRO}`);

      // Verify balance changes
      expect(finalXLM).toBe(initialXLM - BigInt(swapAmount));
      expect(finalASTRO).toBeGreaterThan(initialASTRO + BigInt(minAmountOut));

      console.log('✅ Swap successful!');
    }, 30000);
  });

  describe('Edge Cases (Best Practice #4: Failure Paths)', () => {
    it('should reject swap with expired deadline', async () => {
      // ARRANGE
      const pastDeadline = Math.floor(Date.now() / 1000) - 100;

      // ACT & ASSERT
      await expect(
        sh(
          `stellar contract invoke \
            --id ${routerId} \
            --source user \
            --network local \
            -- swap_exact_tokens_for_tokens \
            --user ${userAccount.publicKey()} \
            --amount_in 1000000000 \
            --amount_out_min 800000000 \
            --path '["${xlmTokenId}","${astroTokenId}"]' \
            --deadline ${pastDeadline}`
        )
      ).rejects.toThrow();

      console.log('✅ Correctly rejected expired deadline');
    }, 30000);

    it('should reject swap with insufficient balance', async () => {
      // ARRANGE
      const hugeAmount = '10000000000000'; // 1M XLM (more than balance)
      const deadline = Math.floor(Date.now() / 1000) + 300;

      // Approve huge amount
      await approveToken(xlmTokenId, routerId, hugeAmount, 'user');

      // ACT & ASSERT
      await expect(
        sh(
          `stellar contract invoke \
            --id ${routerId} \
            --source user \
            --network local \
            -- swap_exact_tokens_for_tokens \
            --user ${userAccount.publicKey()} \
            --amount_in ${hugeAmount} \
            --amount_out_min 1 \
            --path '["${xlmTokenId}","${astroTokenId}"]' \
            --deadline ${deadline}`
        )
      ).rejects.toThrow();

      console.log('✅ Correctly rejected insufficient balance');
    }, 30000);
  });

  describe('K Invariant Validation', () => {
    it('should increase K after swap (fees accumulate)', async () => {
      // ARRANGE
      // Get reserves before swap
      const reservesBefore = await sh(
        `stellar contract invoke \
          --id ${pairId} \
          --source user \
          --network local \
          -- get_reserves`
      );

      const [reserve0Before, reserve1Before] = JSON.parse(reservesBefore);
      const kBefore = BigInt(reserve0Before) * BigInt(reserve1Before);

      console.log(`K before: ${kBefore}`);

      // ACT: Execute swap
      const swapAmount = '1000000000';
      const minAmountOut = '800000000';
      const deadline = Math.floor(Date.now() / 1000) + 300;

      await approveToken(xlmTokenId, routerId, swapAmount, 'user');

      await sh(
        `stellar contract invoke \
          --id ${routerId} \
          --source user \
          --network local \
          -- swap_exact_tokens_for_tokens \
          --user ${userAccount.publicKey()} \
          --amount_in ${swapAmount} \
          --amount_out_min ${minAmountOut} \
          --path '["${xlmTokenId}","${astroTokenId}"]' \
          --deadline ${deadline}`
      );

      // ASSERT
      const reservesAfter = await sh(
        `stellar contract invoke \
          --id ${pairId} \
          --source user \
          --network local \
          -- get_reserves`
      );

      const [reserve0After, reserve1After] = JSON.parse(reservesAfter);
      const kAfter = BigInt(reserve0After) * BigInt(reserve1After);

      console.log(`K after: ${kAfter}`);

      // K should NEVER decrease (only increase due to fees)
      expect(kAfter).toBeGreaterThan(kBefore);

      console.log(`✅ K increased by ${((kAfter - kBefore) * 10000n / kBefore)}bps`);
    }, 30000);
  });
});
