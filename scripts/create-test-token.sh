#!/bin/bash
# Create a test token on Stellar testnet for DEX testing
# Usage: ./scripts/create-test-token.sh YOUR_SECRET_KEY TOKEN_CODE

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

SECRET_KEY=${1:-""}
TOKEN_CODE=${2:-"TEST"}

echo ""
echo "=========================================="
echo "   Create Test Token on Stellar Testnet"
echo "=========================================="
echo ""

if [ -z "$SECRET_KEY" ]; then
    warn "Usage: ./scripts/create-test-token.sh YOUR_SECRET_KEY TOKEN_CODE"
    echo ""
    echo "This script will help you create a test token for DEX testing."
    echo ""
    echo "Steps to create a test token manually:"
    echo ""
    echo "1. Go to Stellar Laboratory: https://laboratory.stellar.org"
    echo ""
    echo "2. Build Transaction:"
    echo "   - Source Account: Your public key"
    echo "   - Add Operation: Manage Sell Offer"
    echo "   - Or use Change Trust + Payment to distribute"
    echo ""
    echo "3. For easier testing, use an existing testnet token or"
    echo "   deploy a Soroban token contract."
    echo ""
    exit 0
fi

# Get public key from secret
PUBLIC_KEY=$(stellar keys address --secret-key "${SECRET_KEY}" 2>/dev/null || echo "")

if [ -z "$PUBLIC_KEY" ]; then
    # If that doesn't work, try generating from key
    stellar keys generate temp-issuer --secret-key "${SECRET_KEY}" 2>/dev/null || true
    PUBLIC_KEY=$(stellar keys address temp-issuer 2>/dev/null || echo "")
fi

if [ -z "$PUBLIC_KEY" ]; then
    warn "Could not derive public key. Make sure the secret key is valid."
    exit 1
fi

info "Issuer Public Key: ${PUBLIC_KEY}"
info "Token Code: ${TOKEN_CODE}"

echo ""
echo "To create this token:"
echo ""
echo "1. Go to: https://laboratory.stellar.org/#txbuilder?network=test"
echo ""
echo "2. Enter Source Account: ${PUBLIC_KEY}"
echo ""
echo "3. Add Operation: Change Trust"
echo "   - Asset Code: ${TOKEN_CODE}"
echo "   - Issuer: ${PUBLIC_KEY}"
echo ""
echo "4. Sign with your secret key"
echo ""
echo "5. Submit transaction"
echo ""

# Get SAC contract ID for the token
SAC_ID=$(stellar contract id asset --asset "${TOKEN_CODE}:${PUBLIC_KEY}" --network testnet 2>/dev/null || echo "")

if [ -n "$SAC_ID" ]; then
    success "SAC Contract ID: ${SAC_ID}"
fi

echo ""
success "Instructions complete!"
