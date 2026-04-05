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

// Deployer account
const deployerSecret = 'SCXQ2BF6AAKCO3BBVMGRCGLCPKFC7EXDW4NF6GKYJRR2QPT4NDFFUZFD';
const deployerKeypair = Keypair.fromSecret(deployerSecret);
const deployerPublic = deployerKeypair.publicKey();

console.log('='.repeat(50));
console.log('Creating Test Tokens');
console.log('='.repeat(50));
console.log('Deployer:', deployerPublic);

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

// Create multiple test tokens
const tokens = [
  { code: 'USDC', amount: '1000000' },
  { code: 'USDT', amount: '1000000' },
];

for (const token of tokens) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Creating ${token.code} Token`);
  console.log('='.repeat(50));

  const tokenIssuerKeypair = Keypair.random();
  const tokenIssuerPublic = tokenIssuerKeypair.publicKey();

  console.log(`${token.code} Issuer:`, tokenIssuerPublic);

  // Fund issuer
  const tokenFundResponse = await fetch(`https://friendbot.stellar.org/?addr=${tokenIssuerPublic}`);
  await tokenFundResponse.json();
  console.log(`✅ ${token.code} Issuer funded`);

  await new Promise(r => setTimeout(r, 3000));

  // Create asset
  const asset = new Asset(token.code, tokenIssuerPublic);

  // Step 2: Deployer creates trustline
  console.log(`\n2. Creating trustline for ${token.code}...`);
  const deployerAccount = await server.loadAccount(deployerPublic);
  const trustTx = new TransactionBuilder(deployerAccount, {
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
