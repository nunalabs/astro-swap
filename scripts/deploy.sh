#!/bin/bash
# AstroSwap Deployment Script
# Deploys all contracts to the specified network

set -e

# Configuration
NETWORK=${1:-testnet}
BUILD_DIR="target/wasm32v1-none/release"
CONTRACTS_DIR=".deployed"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions (redirect to stderr to not interfere with function returns)
info() { echo -e "${BLUE}[INFO]${NC} $1" >&2; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1" >&2; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $1" >&2; exit 1; }

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    if ! command -v stellar &> /dev/null; then
        error "Stellar CLI not found. Install with: cargo install stellar-cli"
    fi

    if [ ! -f "${BUILD_DIR}/astroswap_factory.optimized.wasm" ]; then
        warn "Optimized WASM files not found. Running build and optimize..."
        make build optimize
    fi

    success "Prerequisites check passed"
}

# Get or create deployer account
setup_deployer() {
    info "Setting up deployer account..."

    DEPLOYER_KEY="astroswap-deployer-${NETWORK}"

    # Check if key exists
    if ! stellar keys address "${DEPLOYER_KEY}" &> /dev/null; then
        info "Creating new deployer key..."
        stellar keys generate "${DEPLOYER_KEY}" --network "${NETWORK}"

        if [ "${NETWORK}" == "testnet" ]; then
            info "Funding deployer account from friendbot..."
            DEPLOYER_ADDRESS=$(stellar keys address "${DEPLOYER_KEY}")
            curl -s "https://friendbot.stellar.org?addr=${DEPLOYER_ADDRESS}" > /dev/null
            sleep 2
        else
            warn "Mainnet deployment - ensure account is funded!"
        fi
    fi

    DEPLOYER_ADDRESS=$(stellar keys address "${DEPLOYER_KEY}")
    success "Deployer address: ${DEPLOYER_ADDRESS}"
}

# Deploy a single contract
deploy_contract() {
    local contract_name=$1
    local wasm_file="${BUILD_DIR}/astroswap_${contract_name}.optimized.wasm"

    if [ ! -f "${wasm_file}" ]; then
        error "WASM file not found: ${wasm_file}"
    fi

    info "Deploying ${contract_name}..."

    # Install WASM to get hash
    WASM_HASH=$(stellar contract install \
        --wasm "${wasm_file}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" 2>&1 | tail -1)

    info "${contract_name} WASM hash: ${WASM_HASH}"

    # Deploy contract instance
    CONTRACT_ID=$(stellar contract deploy \
        --wasm-hash "${WASM_HASH}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" 2>&1 | tail -1)

    success "${contract_name} deployed: ${CONTRACT_ID}"

    # Save contract ID
    echo "${CONTRACT_ID}" > "${CONTRACTS_DIR}/${contract_name}.${NETWORK}.id"
    echo "${WASM_HASH}" > "${CONTRACTS_DIR}/${contract_name}.${NETWORK}.hash"

    echo "${CONTRACT_ID}"
}

# Initialize factory contract
initialize_factory() {
    local factory_id=$1
    local pair_hash=$2

    info "Initializing factory..."

    stellar contract invoke \
        --id "${factory_id}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        initialize \
        --admin "${DEPLOYER_ADDRESS}" \
        --pair_wasm_hash "${pair_hash}" \
        --protocol_fee_bps 30

    success "Factory initialized"
}

# Initialize router contract
initialize_router() {
    local router_id=$1
    local factory_id=$2

    info "Initializing router..."

    stellar contract invoke \
        --id "${router_id}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        initialize \
        --factory "${factory_id}" \
        --admin "${DEPLOYER_ADDRESS}"

    success "Router initialized"
}

# Initialize staking contract
initialize_staking() {
    local staking_id=$1
    local reward_token=$2

    info "Initializing staking..."

    stellar contract invoke \
        --id "${staking_id}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        initialize \
        --admin "${DEPLOYER_ADDRESS}" \
        --reward_token "${reward_token}"

    success "Staking initialized"
}

# Initialize aggregator contract
initialize_aggregator() {
    local aggregator_id=$1
    local factory_id=$2

    info "Initializing aggregator..."

    stellar contract invoke \
        --id "${aggregator_id}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        initialize \
        --admin "${DEPLOYER_ADDRESS}" \
        --astroswap_factory "${factory_id}"

    success "Aggregator initialized"
}

# Main deployment flow
main() {
    echo ""
    echo "=========================================="
    echo "   AstroSwap Deployment - ${NETWORK}"
    echo "=========================================="
    echo ""

    # Create contracts directory
    mkdir -p "${CONTRACTS_DIR}"

    # Check prerequisites
    check_prerequisites

    # Setup deployer
    setup_deployer

    # Deploy contracts in order
    info "Starting deployment..."

    # 1. Deploy pair first (needed for factory to get hash)
    PAIR_HASH=$(stellar contract install \
        --wasm "${BUILD_DIR}/astroswap_pair.optimized.wasm" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" 2>&1 | tail -1)
    echo "${PAIR_HASH}" > "${CONTRACTS_DIR}/pair.${NETWORK}.hash"
    info "Pair WASM hash: ${PAIR_HASH}"

    # 2. Deploy and initialize factory
    FACTORY_ID=$(deploy_contract "factory")
    initialize_factory "${FACTORY_ID}" "${PAIR_HASH}"

    # 3. Deploy and initialize router
    ROUTER_ID=$(deploy_contract "router")
    initialize_router "${ROUTER_ID}" "${FACTORY_ID}"

    # 4. Deploy and initialize staking
    STAKING_ID=$(deploy_contract "staking")
    # Note: reward_token should be set to actual token address
    # For testnet, using a placeholder
    if [ "${NETWORK}" == "testnet" ]; then
        # Use XLM native asset as placeholder
        REWARD_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    else
        warn "Set REWARD_TOKEN for mainnet deployment"
        REWARD_TOKEN="${REWARD_TOKEN:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
    fi
    initialize_staking "${STAKING_ID}" "${REWARD_TOKEN}"

    # 5. Deploy and initialize aggregator
    AGGREGATOR_ID=$(deploy_contract "aggregator")
    initialize_aggregator "${AGGREGATOR_ID}" "${FACTORY_ID}"

    # 6. Deploy bridge (optional, for Astro-Shiba integration)
    BRIDGE_ID=$(deploy_contract "bridge")
    # Bridge initialization requires launchpad address - skip for now
    info "Bridge deployed but not initialized (requires launchpad address)"

    # Print summary
    echo ""
    echo "=========================================="
    echo "   Deployment Summary"
    echo "=========================================="
    echo ""
    echo "Network: ${NETWORK}"
    echo "Deployer: ${DEPLOYER_ADDRESS}"
    echo ""
    echo "Contract IDs:"
    echo "  Factory:    ${FACTORY_ID}"
    echo "  Router:     ${ROUTER_ID}"
    echo "  Staking:    ${STAKING_ID}"
    echo "  Aggregator: ${AGGREGATOR_ID}"
    echo "  Bridge:     ${BRIDGE_ID}"
    echo ""
    echo "WASM Hashes:"
    echo "  Pair: ${PAIR_HASH}"
    echo ""

    # Save deployment info to JSON
    cat > "${CONTRACTS_DIR}/deployment.${NETWORK}.json" << EOF
{
  "network": "${NETWORK}",
  "deployer": "${DEPLOYER_ADDRESS}",
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "contracts": {
    "factory": "${FACTORY_ID}",
    "router": "${ROUTER_ID}",
    "staking": "${STAKING_ID}",
    "aggregator": "${AGGREGATOR_ID}",
    "bridge": "${BRIDGE_ID}"
  },
  "wasmHashes": {
    "pair": "${PAIR_HASH}"
  }
}
EOF

    success "Deployment complete! Contract IDs saved to ${CONTRACTS_DIR}/"
}

# Run main function
main "$@"
