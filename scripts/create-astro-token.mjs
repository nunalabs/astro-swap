/**
 * Create ASTRO test token and fund user account
 */

import { Keypair, Networks, TransactionBuilder, Operation, Asset, Horizon, BASE_FEE } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

// User is the issuer
const userSecret = 'SCNYRRCYBGTVB2MP3DGYWFUUQNUCDLYKSFNNFBS5GCG6YNMCW2ECUN6F';
const userKeypair = Keypair.fromSecret(userSecret);
const userPublic = userKeypair.publicKey();

console.log('='.repeat(50));
console.log('Creating ASTRO Token');
console.log('='.repeat(50));
console.log('User/Issuer:', userPublic);

// Create distribution account
const distKeypair = Keypair.random();
const distPublic = distKeypair.publicKey();
const distSecret = distKeypair.secret();

console.log('Distribution Account:', distPublic);

// Fund distribution account
console.log('\n1. Funding distribution account...');
const fundResponse = await fetch(`https://friendbot.stellar.org/?addr=${distPublic}`);
const fundResult = await fundResponse.json();
console.log('   Funded:', fundResult.successful ? 'Yes' : 'Check manually');

// Wait a moment for the account to be created
await new Promise(r => setTimeout(r, 2000));

// Create asset
const asset = new Asset('ASTRO', userPublic);

// Step 2: Distribution account trusts ASTRO
console.log('\n2. Creating trustline on distribution account...');
const distAccount = await server.loadAccount(distPublic);
const trustTx = new TransactionBuilder(distAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.changeTrust({
    asset: asset,
    limit: '10000000',
  }))
  .setTimeout(180)
  .build();

trustTx.sign(distKeypair);
await server.submitTransaction(trustTx);
console.log('   ✅ Trustline created');

// Step 3: User (issuer) sends ASTRO to distribution
console.log('\n3. Issuing ASTRO tokens to distribution...');
const userAccount = await server.loadAccount(userPublic);
const issueTx = new TransactionBuilder(userAccount, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: distPublic,
    asset: asset,
    amount: '5000000',
  }))
  .setTimeout(180)
  .build();

issueTx.sign(userKeypair);
await server.submitTransaction(issueTx);
console.log('   ✅ Issued 5,000,000 ASTRO');

// Step 4: User creates trustline for ASTRO
console.log('\n4. Creating trustline on user account...');
const userAccount2 = await server.loadAccount(userPublic);
const userTrustTx = new TransactionBuilder(userAccount2, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.changeTrust({
    asset: asset,
    limit: '10000000',
  }))
  .setTimeout(180)
  .build();

userTrustTx.sign(userKeypair);
await server.submitTransaction(userTrustTx);
console.log('   ✅ User trustline created');

// Step 5: Distribution sends ASTRO to user
console.log('\n5. Sending ASTRO to user...');
const distAccount2 = await server.loadAccount(distPublic);
const sendTx = new TransactionBuilder(distAccount2, {
  fee: BASE_FEE,
  networkPassphrase: Networks.TESTNET,
})
  .addOperation(Operation.payment({
    destination: userPublic,
    asset: asset,
    amount: '1000000',
  }))
  .setTimeout(180)
  .build();

sendTx.sign(distKeypair);
await server.submitTransaction(sendTx);
console.log('   ✅ Sent 1,000,000 ASTRO to user');

// Final balances
const finalUser = await server.loadAccount(userPublic);
const astroBalance = finalUser.balances.find(b => b.asset_code === 'ASTRO');
const xlmBalance = finalUser.balances.find(b => b.asset_type === 'native');

console.log('\n' + '='.repeat(50));
console.log('SUCCESS! Token Created');
console.log('='.repeat(50));
console.log('\nUser Balances:');
console.log('  XLM:', xlmBalance?.balance);
console.log('  ASTRO:', astroBalance?.balance);
console.log('\nToken Info:');
console.log('  Code: ASTRO');
console.log('  Issuer:', userPublic);
console.log('\nDistribution Account (save for more minting):');
console.log('  Public:', distPublic);
console.log('  Secret:', distSecret);
