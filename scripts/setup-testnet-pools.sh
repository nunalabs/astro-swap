#!/bin/bash
# Setup Testnet Liquidity Pools
# Creates pairs and adds initial liquidity for testing

set -e

# Configuration
NETWORK="testnet"
CONTRACTS_DIR=".deployed"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Load deployed contract IDs
load_contracts() {
    if [ ! -f "${CONTRACTS_DIR}/deployment.testnet.json" ]; then
        error "Deployment file not found. Run deploy.sh first."
    fi

    FACTORY_ID=$(cat "${CONTRACTS_DIR}/factory.testnet.id" 2>/dev/null || echo "")
    ROUTER_ID=$(cat "${CONTRACTS_DIR}/router.testnet.id" 2>/dev/null || echo "")

    if [ -z "$FACTORY_ID" ] || [ -z "$ROUTER_ID" ]; then
        error "Contract IDs not found. Run deploy.sh first."
    fi

    info "Factory: ${FACTORY_ID}"
    info "Router: ${ROUTER_ID}"
}

# Get deployer key
setup_deployer() {
    DEPLOYER_KEY="astroswap-deployer-testnet"

    if ! stellar keys address "${DEPLOYER_KEY}" &> /dev/null; then
        error "Deployer key not found. Run deploy.sh first."
    fi

    DEPLOYER_ADDRESS=$(stellar keys address "${DEPLOYER_KEY}")
    info "Deployer: ${DEPLOYER_ADDRESS}"
}

# Wrap XLM native asset to SAC
wrap_native_xlm() {
    info "Wrapping native XLM to SAC..."

    # The native XLM SAC address is deterministic
    # Use stellar asset deploy to get/create the SAC
    XLM_SAC=$(stellar contract id asset \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        --asset native 2>&1 | tail -1)

    success "XLM SAC: ${XLM_SAC}"
    echo "${XLM_SAC}" > "${CONTRACTS_DIR}/xlm-sac.testnet.id"
}

# Deploy test token for pool
deploy_test_token() {
    local name=$1
    local symbol=$2

    info "Creating test token: ${symbol}..."

    # For testnet, we'll create a simple SAC token
    # First, check if we have a token WASM
    if [ ! -f "contracts/test-token/target/wasm32-unknown-unknown/release/test_token.wasm" ]; then
        warn "Test token WASM not found. Using classic asset wrapping instead."
        return 1
    fi

    # Deploy test token contract
    TOKEN_ID=$(stellar contract deploy \
        --wasm "contracts/test-token/target/wasm32-unknown-unknown/release/test_token.wasm" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" 2>&1 | tail -1)

    # Initialize with mint
    stellar contract invoke \
        --id "${TOKEN_ID}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        initialize \
        --admin "${DEPLOYER_ADDRESS}" \
        --decimals 7 \
        --name "${name}" \
        --symbol "${symbol}"

    success "${symbol} token: ${TOKEN_ID}"
    echo "${TOKEN_ID}"
}

# Create a trading pair
create_pair() {
    local token_a=$1
    local token_b=$2
    local name=$3

    info "Creating pair: ${name}..."

    # Check if pair exists
    EXISTING_PAIR=$(stellar contract invoke \
        --id "${FACTORY_ID}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        get_pair \
        --token_a "${token_a}" \
        --token_b "${token_b}" 2>&1 | tail -1) || true

    if [ -n "$EXISTING_PAIR" ] && [ "$EXISTING_PAIR" != "null" ] && [ "$EXISTING_PAIR" != "" ]; then
        warn "Pair already exists: ${EXISTING_PAIR}"
        echo "${EXISTING_PAIR}"
        return 0
    fi

    # Create new pair
    PAIR_ID=$(stellar contract invoke \
        --id "${FACTORY_ID}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        create_pair \
        --token_a "${token_a}" \
        --token_b "${token_b}" 2>&1 | tail -1)

    success "Pair created: ${PAIR_ID}"
    echo "${PAIR_ID}" > "${CONTRACTS_DIR}/pair-${name}.testnet.id"
    echo "${PAIR_ID}"
}

# Add liquidity to a pair
add_liquidity() {
    local pair_id=$1
    local token_a=$2
    local token_b=$3
    local amount_a=$4
    local amount_b=$5

    info "Adding liquidity: ${amount_a} / ${amount_b}..."

    # First, transfer tokens to pair contract
    # Note: This requires token contracts to have transfer function

    # Transfer token_a
    stellar contract invoke \
        --id "${token_a}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        transfer \
        --from "${DEPLOYER_ADDRESS}" \
        --to "${pair_id}" \
        --amount "${amount_a}"

    # Transfer token_b
    stellar contract invoke \
        --id "${token_b}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        transfer \
        --from "${DEPLOYER_ADDRESS}" \
        --to "${pair_id}" \
        --amount "${amount_b}"

    # Mint LP tokens
    LP_MINTED=$(stellar contract invoke \
        --id "${pair_id}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        mint \
        --to "${DEPLOYER_ADDRESS}" 2>&1 | tail -1)

    success "LP tokens minted: ${LP_MINTED}"
}

# Main setup flow
main() {
    echo ""
    echo "=========================================="
    echo "   AstroSwap Testnet Pool Setup"
    echo "=========================================="
    echo ""

    # Load contracts and setup
    load_contracts
    setup_deployer

    # Wrap native XLM
    wrap_native_xlm

    # For testnet, we'll use the classic asset wrapping approach
    # Wrap yUSDC (testnet USDC)
    info "Wrapping yUSDC testnet asset..."
    YUSDC_ISSUER="GDGTVWSM4MGS4T7Z6W4RPWOCHE2I6RDFCIFZGS3DOA63LWQTRNZNTTFF"

    YUSDC_SAC=$(stellar contract id asset \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        --asset "yUSDC:${YUSDC_ISSUER}" 2>&1 | tail -1)

    success "yUSDC SAC: ${YUSDC_SAC}"
    echo "${YUSDC_SAC}" > "${CONTRACTS_DIR}/yusdc-sac.testnet.id"

    # Create XLM/yUSDC pair
    info "Setting up XLM/yUSDC pool..."
    XLM_YUSDC_PAIR=$(create_pair "${XLM_SAC}" "${YUSDC_SAC}" "xlm-yusdc")

    echo ""
    echo "=========================================="
    echo "   Pool Setup Summary"
    echo "=========================================="
    echo ""
    echo "Tokens:"
    echo "  XLM SAC:   ${XLM_SAC}"
    echo "  yUSDC SAC: ${YUSDC_SAC}"
    echo ""
    echo "Pairs:"
    echo "  XLM/yUSDC: ${XLM_YUSDC_PAIR}"
    echo ""
    echo "=========================================="
    echo ""
    info "To add liquidity, you need to:"
    echo "  1. Fund your account with XLM from Friendbot"
    echo "  2. Establish trustline for yUSDC"
    echo "  3. Get yUSDC from testnet faucet (if available)"
    echo "  4. Transfer tokens to pair and call mint"
    echo ""
    success "Pool setup complete!"
}

# Run main
main "$@"
