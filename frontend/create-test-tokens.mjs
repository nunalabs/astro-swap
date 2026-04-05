/**
 * Create Test Tokens (USDC, USDT) for AstroSwap Testing
 */

import { Keypair, Networks, TransactionBuilder, Operation, Asset, Horizon, BASE_FEE } from '@stellar/stellar-sdk';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

// Deployer account
const deployerSecret = 'SCXQ2BF6AAKCO3BBVMGRCGLCPKFC7EXDW4NF6GKYJRR2QPT4NDFFUZFD';
const deployerKeypair = Keypair.fromSecret(deployerSecret);
const deployerPublic = deployerKeypair.publicKey();

console.log('='.repeat(60));
console.log('Creating Test Tokens for AstroSwap');
console.log('='.repeat(60));
console.log('Deployer:', deployerPublic);
console.log('');

// Tokens to create
const tokens = [
  { code: 'USDC', amount: '1000000' },
  { code: 'USDT', amount: '1000000' },
];

const createdTokens = [];

for (const token of tokens) {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Creating ${token.code} Token`);
    console.log('='.repeat(60));

    // Step 1: Create issuer account
    console.log('\n1. Creating issuer account...');
    const issuerKeypair = Keypair.random();
    const issuerPublic = issuerKeypair.publicKey();
    const issuerSecret = issuerKeypair.secret();

    console.log(`   Issuer: ${issuerPublic}`);

    // Fund issuer via Friendbot
    console.log('   Funding via Friendbot...');
    const fundResponse = await fetch(`https://friendbot.stellar.org/?addr=${issuerPublic}`);
    await fundResponse.json();
    console.log('   ✅ Issuer funded');

    await new Promise(r => setTimeout(r, 3000));

    // Create asset
    const asset = new Asset(token.code, issuerPublic);

    // Step 2: Deployer creates trustline
    console.log(`\n2. Creating trustline for ${token.code}...`);
    const deployerAccount = await server.loadAccount(deployerPublic);
    const trustTx = new TransactionBuilder(deployerAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({
        asset: asset,
        limit: '100000000',
      }))
      .setTimeout(180)
      .build();

    trustTx.sign(deployerKeypair);
    const trustResult = await server.submitTransaction(trustTx);
    console.log(`   ✅ Trustline created: ${trustResult.hash.substring(0, 8)}...`);

    await new Promise(r => setTimeout(r, 2000));

    // Step 3: Issuer sends tokens to deployer
    console.log(`\n3. Minting ${token.amount} ${token.code}...`);
    const issuerAccount = await server.loadAccount(issuerPublic);
    const paymentTx = new TransactionBuilder(issuerAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({
        destination: deployerPublic,
        asset: asset,
        amount: token.amount,
      }))
      .setTimeout(180)
      .build();

    paymentTx.sign(issuerKeypair);
    const paymentResult = await server.submitTransaction(paymentTx);
    console.log(`   ✅ Tokens minted: ${paymentResult.hash.substring(0, 8)}...`);

    createdTokens.push({
      code: token.code,
      issuer: issuerPublic,
      issuerSecret: issuerSecret,
      asset: `${token.code}:${issuerPublic}`,
      amount: token.amount,
    });

    console.log(`\n✅ ${token.code} Token Created Successfully!`);

  } catch (error) {
    console.error(`\n❌ Error creating ${token.code}:`, error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Token Creation Summary');
console.log('='.repeat(60));
console.log(`Tokens Created: ${createdTokens.length}/${tokens.length}`);

if (createdTokens.length > 0) {
  console.log('\nCreated Tokens:');
  for (const token of createdTokens) {
    console.log(`\n  ${token.code}:`);
    console.log(`    Issuer: ${token.issuer}`);
    console.log(`    Asset: ${token.asset}`);
    console.log(`    Amount: ${token.amount}`);
    console.log(`    Secret: ${token.issuerSecret.substring(0, 10)}...`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Next: Create Pairs on Factory');
  console.log('='.repeat(60));
}

console.log('');
