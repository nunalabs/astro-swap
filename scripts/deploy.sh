#!/bin/bash
# AstroSwap Deployment Script
# Deploys all contracts to the specified network

set -e

# Configuration
NETWORK=${1:-testnet}
BUILD_DIR="target/wasm32-unknown-unknown/release"
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

# Install WASM and get hash (no deployment yet)
install_wasm() {
    local contract_name=$1
    local wasm_file="${BUILD_DIR}/astroswap_${contract_name}.optimized.wasm"

    if [ ! -f "${wasm_file}" ]; then
        error "WASM file not found: ${wasm_file}"
    fi

    info "Installing ${contract_name} WASM..."

    WASM_HASH=$(stellar contract install \
        --wasm "${wasm_file}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" 2>&1 | tail -1)

    info "${contract_name} WASM hash: ${WASM_HASH}"
    echo "${WASM_HASH}" > "${CONTRACTS_DIR}/${contract_name}.${NETWORK}.hash"

    echo "${WASM_HASH}"
}

# Deploy contract with CAP-58 constructor (constructor args passed during deployment)
# Usage: deploy_with_constructor <contract_name> <wasm_hash> "<constructor_args>"
deploy_with_constructor() {
    local contract_name=$1
    local wasm_hash=$2
    shift 2
    local constructor_args=("$@")

    info "Deploying ${contract_name} with constructor..."

    # Deploy with constructor args
    CONTRACT_ID=$(stellar contract deploy \
        --wasm-hash "${wasm_hash}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        "${constructor_args[@]}" \
        2>&1 | tail -1)

    success "${contract_name} deployed and initialized: ${CONTRACT_ID}"

    # Save contract ID
    echo "${CONTRACT_ID}" > "${CONTRACTS_DIR}/${contract_name}.${NETWORK}.id"

    echo "${CONTRACT_ID}"
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

    # Deploy contracts in order using CAP-58 constructor pattern
    info "Starting deployment with CAP-58 constructors..."

    # 1. Install Pair WASM first (needed for factory constructor)
    PAIR_HASH=$(install_wasm "pair")

    # 2. Install and deploy Factory with constructor
    FACTORY_HASH=$(install_wasm "factory")
    FACTORY_ID=$(deploy_with_constructor "factory" "${FACTORY_HASH}" \
        --admin "${DEPLOYER_ADDRESS}" \
        --pair_wasm_hash "${PAIR_HASH}" \
        --protocol_fee_bps 30)

    # 3. Install and deploy Router with constructor
    ROUTER_HASH=$(install_wasm "router")
    ROUTER_ID=$(deploy_with_constructor "router" "${ROUTER_HASH}" \
        --factory "${FACTORY_ID}" \
        --admin "${DEPLOYER_ADDRESS}")

    # 4. Install and deploy Staking with constructor
    # Note: reward_token should be set to actual token address
    # For testnet, using XLM native as placeholder
    if [ "${NETWORK}" == "testnet" ]; then
        # Use XLM native asset as placeholder
        REWARD_TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
    else
        warn "Set REWARD_TOKEN for mainnet deployment"
        REWARD_TOKEN="${REWARD_TOKEN:-CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC}"
    fi

    STAKING_HASH=$(install_wasm "staking")
    STAKING_ID=$(deploy_with_constructor "staking" "${STAKING_HASH}" \
        --admin "${DEPLOYER_ADDRESS}" \
        --reward_token "${REWARD_TOKEN}")

    # 5. Install and deploy Aggregator with constructor
    AGGREGATOR_HASH=$(install_wasm "aggregator")
    AGGREGATOR_ID=$(deploy_with_constructor "aggregator" "${AGGREGATOR_HASH}" \
        --admin "${DEPLOYER_ADDRESS}" \
        --astroswap_factory "${FACTORY_ID}")

    # 6. Install Bridge (deployment requires launchpad address - install only for now)
    BRIDGE_HASH=$(install_wasm "bridge")
    info "Bridge WASM installed but not deployed (requires launchpad address)"
    BRIDGE_ID="(pending - requires launchpad)"

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
