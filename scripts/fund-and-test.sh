#!/bin/bash
# Fund account and setup testnet for DEX testing
# Usage: ./scripts/fund-and-test.sh YOUR_PUBLIC_KEY

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

USER_ADDRESS=${1:-""}
NETWORK="testnet"

# Contract addresses
FACTORY_ID="CBIGOVXEBBJRFYONNS5ZJUTGT4UIJJRYW2YCEFD6OJGLH4GRZW4PWG4T"
ROUTER_ID="CA5AE63U6ZWRZWAPIIFTQSKDM45EQAYYWOIKN7MEQIJBYQAFAOPWLYYJ"
PAIR_ID="CDEUG7PREQ37OTXNRJU6JEUD4XCCDDJKRNY5VDFY57GNBKHLTXKGTP5S"
XLM_SAC="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
YUSDC_SAC="CABWYQLGOQ5Y3RIYUVYJZVA355YVX4SPAMN6ORDAVJZQBPPHLHRRLNMS"

# yUSDC issuer (testnet)
YUSDC_ISSUER="GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"

echo ""
echo "=========================================="
echo "   AstroSwap Testnet Testing Setup"
echo "=========================================="
echo ""

if [ -z "$USER_ADDRESS" ]; then
    warn "No address provided. Showing instructions only."
    echo ""
    echo "Usage: ./scripts/fund-and-test.sh YOUR_PUBLIC_KEY"
    echo ""
fi

echo "============================================"
echo "STEP 1: Get Testnet XLM from Friendbot"
echo "============================================"
echo ""
echo "Visit this URL in your browser (replace with your address):"
echo ""
echo "  https://friendbot.stellar.org/?addr=${USER_ADDRESS:-YOUR_PUBLIC_KEY}"
echo ""

if [ -n "$USER_ADDRESS" ]; then
    info "Funding $USER_ADDRESS with Friendbot..."
    RESULT=$(curl -s "https://friendbot.stellar.org/?addr=${USER_ADDRESS}")
    if echo "$RESULT" | grep -q "successful"; then
        success "Account funded with 10,000 XLM!"
    else
        warn "Account may already be funded or error occurred"
    fi
fi

echo ""
echo "============================================"
echo "STEP 2: Establish Trustline for yUSDC"
echo "============================================"
echo ""
echo "To receive yUSDC, you need to establish a trustline first."
echo ""
echo "Using Stellar Laboratory:"
echo "  1. Go to: https://laboratory.stellar.org/#txbuilder?network=test"
echo "  2. Enter your public key as Source Account"
echo "  3. Add operation: Change Trust"
echo "  4. Asset Code: yUSDC"
echo "  5. Issuer: ${YUSDC_ISSUER}"
echo "  6. Sign and submit"
echo ""

echo "============================================"
echo "STEP 3: Get yUSDC Testnet Tokens"
echo "============================================"
echo ""
echo "Option A - Stellar Laboratory Payment:"
echo "  If you have access to the issuer account, send yourself yUSDC"
echo ""
echo "Option B - Use Stellar Expert Faucet (if available):"
echo "  https://stellar.expert/explorer/testnet/asset/yUSDC-${YUSDC_ISSUER}"
echo ""

echo "============================================"
echo "STEP 4: Wrap XLM for Soroban (SAC)"
echo "============================================"
echo ""
echo "Your XLM needs to be wrapped for Soroban contracts."
echo ""
echo "XLM SAC Contract: ${XLM_SAC}"
echo "yUSDC SAC Contract: ${YUSDC_SAC}"
echo ""
echo "To wrap XLM, you can use the stellar CLI:"
echo "  stellar contract invoke --id ${XLM_SAC} --network testnet -- mint --to YOUR_ADDRESS --amount 10000000000"
echo ""

echo "============================================"
echo "Contract Addresses (for reference)"
echo "============================================"
echo ""
echo "Factory:     ${FACTORY_ID}"
echo "Router:      ${ROUTER_ID}"
echo "XLM/yUSDC:   ${PAIR_ID}"
echo "XLM SAC:     ${XLM_SAC}"
echo "yUSDC SAC:   ${YUSDC_SAC}"
echo ""

echo "============================================"
echo "TESTING YOUR DEX"
echo "============================================"
echo ""
echo "1. Open: https://astro-swap-bay.vercel.app"
echo "2. Connect your wallet (Freighter recommended)"
echo "3. Make sure you have testnet XLM"
echo "4. Try selecting tokens in the Swap interface"
echo "5. The XLM/yUSDC pool needs liquidity before swapping"
echo ""

success "Setup instructions complete!"
