/**
 * Add initial liquidity to XLM/ASTRO pair
 *
 * This enables swapping on the DEX
 */

import {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Horizon,
  BASE_FEE,
  Contract,
  SorobanRpc,
  xdr,
  Address,
  nativeToScVal,
  scValToNative
} from '@stellar/stellar-sdk';

// Configuration
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const SOROBAN_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Contract addresses
const ROUTER_CONTRACT = 'CA5AE63U6ZWRZWAPIIFTQSKDM45EQAYYWOIKN7MEQIJBYQAFAOPWLYYJ';
const XLM_SAC = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
const ASTRO_SAC = 'CCHNAJAEDXSLXO4MBMSEX4ERTPDU2RC3JEQ25GGSXMGIIWMFZ3KWU2AS';
const PAIR_CONTRACT = 'CCNPSWYZ3UVEY5UBK26EJKNWZO4YNJE25RPLCRNHWJMYZ4ZOA2H2SKJF';

// User account
const userSecret = 'SCNYRRCYBGTVB2MP3DGYWFUUQNUCDLYKSFNNFBS5GCG6YNMCW2ECUN6F';
const userKeypair = Keypair.fromSecret(userSecret);
const userPublic = userKeypair.publicKey();

// ASTRO issuer (for transfers)
const issuerSecret = 'SCECRMDS65VXLVKBYNIGKRJF6KKASS2DM3WELZMS7HTSX4NMHKYUPZK2';
const issuerKeypair = Keypair.fromSecret(issuerSecret);
const issuerPublic = issuerKeypair.publicKey();

const server = new Horizon.Server(HORIZON_URL);
const soroban = new SorobanRpc.Server(SOROBAN_URL);

console.log('='.repeat(50));
console.log('Adding Liquidity to XLM/ASTRO Pool');
console.log('='.repeat(50));
console.log('User:', userPublic);
console.log('Router:', ROUTER_CONTRACT);
console.log('Pair:', PAIR_CONTRACT);

// Amounts to add (in stroops - 1 XLM = 10^7 stroops)
const XLM_AMOUNT = 1000_0000000n; // 1000 XLM
const ASTRO_AMOUNT = 10000_0000000n; // 10000 ASTRO (1:10 ratio)

console.log('\nAmounts:');
console.log('  XLM:', Number(XLM_AMOUNT) / 10000000, 'XLM');
console.log('  ASTRO:', Number(ASTRO_AMOUNT) / 10000000, 'ASTRO');

async function addLiquidity() {
  try {
    // Get account
    const account = await soroban.getAccount(userPublic);

    // Build the add_liquidity call
    const router = new Contract(ROUTER_CONTRACT);

    // add_liquidity(
    //   e: Env,
    //   token_a: Address,
    //   token_b: Address,
    //   amount_a_desired: i128,
    //   amount_b_desired: i128,
    //   amount_a_min: i128,
    //   amount_b_min: i128,
    //   to: Address,
    //   deadline: u64
    // )

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour from now

    // add_liquidity(
    //   user: Address,        <-- First!
    //   token_a: Address,
    //   token_b: Address,
    //   amount_a_desired: i128,
    //   amount_b_desired: i128,
    //   amount_a_min: i128,
    //   amount_b_min: i128,
    //   deadline: u64
    // )

    const tx = new TransactionBuilder(account, {
      fee: '10000000', // 1 XLM fee for complex tx
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(router.call(
        'add_liquidity',
        nativeToScVal(userPublic, { type: 'address' }),
        nativeToScVal(XLM_SAC, { type: 'address' }),
        nativeToScVal(ASTRO_SAC, { type: 'address' }),
        nativeToScVal(XLM_AMOUNT, { type: 'i128' }),
        nativeToScVal(ASTRO_AMOUNT, { type: 'i128' }),
        nativeToScVal(XLM_AMOUNT * 95n / 100n, { type: 'i128' }), // 5% slippage
        nativeToScVal(ASTRO_AMOUNT * 95n / 100n, { type: 'i128' }),
        nativeToScVal(deadline, { type: 'u64' })
      ))
      .setTimeout(180)
      .build();

    console.log('\n1. Preparing transaction...');
    const preparedTx = await soroban.prepareTransaction(tx);

    console.log('2. Signing transaction...');
    preparedTx.sign(userKeypair);

    console.log('3. Submitting transaction...');
    const result = await soroban.sendTransaction(preparedTx);
    console.log('   Status:', result.status);
    console.log('   Hash:', result.hash);

    if (result.status === 'PENDING') {
      console.log('\n4. Waiting for confirmation...');
      let getResult;
      let attempts = 0;

      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        getResult = await soroban.getTransaction(result.hash);

        if (getResult.status !== 'NOT_FOUND') {
          break;
        }
        attempts++;
        process.stdout.write('.');
      }

      console.log('\n   Final status:', getResult.status);

      if (getResult.status === 'SUCCESS') {
        console.log('\n' + '='.repeat(50));
        console.log('SUCCESS! Liquidity Added');
        console.log('='.repeat(50));

        // Try to parse the result
        if (getResult.resultMetaXdr) {
          console.log('\nLP tokens received (check your balance)');
        }
      } else if (getResult.status === 'FAILED') {
        console.log('\n❌ Transaction failed');
        if (getResult.resultXdr) {
          console.log('Result:', getResult.resultXdr);
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

addLiquidity();
