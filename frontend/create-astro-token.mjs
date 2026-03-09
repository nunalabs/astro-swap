/**
 * Create ASTRO test token with separate issuer
 *
 * Flow:
 * 1. Create issuer account (funded by friendbot)
 * 2. User creates trustline for ASTRO
 * 3. Issuer sends ASTRO to user
 */

import { Keypair, Networks, TransactionBuilder, Operation, Asset, Horizon, BASE_FEE } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

// User account
const userSecret = 'SCNYRRCYBGTVB2MP3DGYWFUUQNUCDLYKSFNNFBS5GCG6YNMCW2ECUN6F';
const userKeypair = Keypair.fromSecret(userSecret);
const userPublic = userKeypair.publicKey();

console.log('='.repeat(50));
console.log('Creating ASTRO Token');
console.log('='.repeat(50));
console.log('User:', userPublic);

// Step 1: Create issuer account
console.log('\n1. Creating issuer account...');
const issuerKeypair = Keypair.random();
const issuerPublic = issuerKeypair.publicKey();
const issuerSecret = issuerKeypair.secret();

console.log('   Issuer:', issuerPublic);

// Fund issuer
const fundResponse = await fetch(`https://friendbot.stellar.org/?addr=${issuerPublic}`);
await fundResponse.json();
console.log('   ✅ Issuer funded');

await new Promise(r => setTimeout(r, 3000));

// Create asset
const asset = new Asset('ASTRO', issuerPublic);

// Step 2: User creates trustline for ASTRO
console.log('\n2. User creating trustline for ASTRO...');
const userAccount = await server.loadAccount(userPublic);
const trustTx = new TransactionBuilder(userAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.changeTrust({
    asset: asset,
    limit: '100000000', // 100 million
  }))
  .setTimeout(180)
  .build();

trustTx.sign(userKeypair);
await server.submitTransaction(trustTx);
console.log('   ✅ Trustline created');

// Step 3: Issuer sends ASTRO to user
console.log('\n3. Issuer sending ASTRO to user...');
const issuerAccount = await server.loadAccount(issuerPublic);
const paymentTx = new TransactionBuilder(issuerAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: userPublic,
    asset: asset,
    amount: '1000000', // 1 million ASTRO
  }))
  .setTimeout(180)
  .build();

paymentTx.sign(issuerKeypair);
await server.submitTransaction(paymentTx);
console.log('   ✅ Sent 1,000,000 ASTRO to user');

// Final check
const finalUser = await server.loadAccount(userPublic);
const astroBalance = finalUser.balances.find(b => b.asset_code === 'ASTRO');
const xlmBalance = finalUser.balances.find(b => b.asset_type === 'native');

console.log('\n' + '='.repeat(50));
console.log('SUCCESS! ASTRO Token Created');
console.log('='.repeat(50));
console.log('\nUser Balances:');
console.log('  XLM:', xlmBalance?.balance);
console.log('  ASTRO:', astroBalance?.balance);
console.log('\nToken Info:');
console.log('  Code: ASTRO');
console.log('  Issuer:', issuerPublic);
console.log('\nIssuer Account (SAVE THIS for more tokens):');
console.log('  Public:', issuerPublic);
console.log('  Secret:', issuerSecret);
console.log('\n' + '='.repeat(50));
