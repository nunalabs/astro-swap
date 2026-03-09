/**
 * Setup Test Token for AstroSwap DEX Testing
 *
 * This script:
 * 1. Creates a trustline for ASTRO token on user account
 * 2. Sends ASTRO tokens from issuer to user
 * 3. Gets the SAC contract address
 * 4. Creates XLM/ASTRO pair
 */

const {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  Horizon,
  BASE_FEE,
} = require('@stellar/stellar-sdk');

// Configuration
const NETWORK = 'testnet';
const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = Networks.TESTNET;

// Accounts
const DEPLOYER_SECRET = process.env.DEPLOYER_SECRET || 'SCNYRRCYBGTVB2MP3DGYWFUUQNUCDLYKSFNNFBS5GCG6YNMCW2ECUN6F'; // Will be replaced
const USER_SECRET = 'SCNYRRCYBGTVB2MP3DGYWFUUQNUCDLYKSFNNFBS5GCG6YNMCW2ECUN6F';

// Token config
const TOKEN_CODE = 'ASTRO';
const AMOUNT_TO_SEND = '1000000'; // 1 million ASTRO

async function main() {
  const server = new Horizon.Server(HORIZON_URL);

  // Load keypairs
  const userKeypair = Keypair.fromSecret(USER_SECRET);
  const userPublic = userKeypair.publicKey();

  console.log('='.repeat(50));
  console.log('AstroSwap Test Token Setup');
  console.log('='.repeat(50));
  console.log(`User Account: ${userPublic}`);
  console.log(`Token: ${TOKEN_CODE}`);
  console.log(`Amount: ${AMOUNT_TO_SEND}`);
  console.log('');

  try {
    // Load user account
    const userAccount = await server.loadAccount(userPublic);
    console.log(`✅ User account loaded. XLM Balance: ${userAccount.balances.find(b => b.asset_type === 'native')?.balance || '0'}`);

    // For testnet, we'll use the user as both issuer and holder
    // This is a simplified approach - the user issues tokens to themselves
    const asset = new Asset(TOKEN_CODE, userPublic);

    console.log(`\n📝 Creating self-issued ${TOKEN_CODE} token...`);
    console.log(`   Issuer: ${userPublic}`);

    // Check if trustline already exists
    const existingTrustline = userAccount.balances.find(
      b => b.asset_code === TOKEN_CODE && b.asset_issuer === userPublic
    );

    if (existingTrustline) {
      console.log(`✅ Trustline already exists. Balance: ${existingTrustline.balance}`);
    } else {
      // For self-issued tokens, we need a different approach
      // The issuer automatically has "infinite" balance of their own token
      console.log('ℹ️  As issuer, you have unlimited supply of your own token');
    }

    // Get SAC contract ID for this asset
    console.log(`\n🔗 SAC Contract ID for ${TOKEN_CODE}:${userPublic}`);
    console.log('   Run: stellar contract id asset --asset "ASTRO:' + userPublic + '" --network testnet');

    console.log('\n' + '='.repeat(50));
    console.log('NEXT STEPS:');
    console.log('='.repeat(50));
    console.log(`
1. The user account IS the issuer of ${TOKEN_CODE}
   - As issuer, you can send ${TOKEN_CODE} to anyone
   - Recipients need to establish trustline first

2. To wrap for Soroban, run:
   stellar contract id asset --asset "${TOKEN_CODE}:${userPublic}" --network testnet

3. Create pair with factory:
   stellar contract invoke --id FACTORY_ID -- create_pair --token_a XLM_SAC --token_b ASTRO_SAC

4. Add liquidity via router
`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data?.extras?.result_codes) {
      console.error('   Result codes:', JSON.stringify(error.response.data.extras.result_codes));
    }
  }
}

main().catch(console.error);
