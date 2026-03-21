#!/bin/bash
# AstroSwap Configuration Script
# Applies network-specific settings to deployed contracts

set -e

# Get script directory (works even if called from elsewhere)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"

# Configuration
NETWORK=${1:-testnet}
CONFIG_FILE="${PROJECT_ROOT}/configs/${NETWORK}.json"
DEPLOYMENT_FILE="${PROJECT_ROOT}/.deployed/deployment.${NETWORK}.json"
DEPLOYER_KEY="astroswap-deployer-${NETWORK}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

    if ! command -v jq &> /dev/null; then
        error "jq not found. Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    fi

    if [ ! -f "${CONFIG_FILE}" ]; then
        error "Config file not found: ${CONFIG_FILE}"
    fi

    if [ ! -f "${DEPLOYMENT_FILE}" ]; then
        error "Deployment file not found: ${DEPLOYMENT_FILE}. Run 'make deploy-${NETWORK}' first."
    fi

    # Check deployer key exists
    if ! stellar keys address "${DEPLOYER_KEY}" &> /dev/null; then
        error "Deployer key '${DEPLOYER_KEY}' not found. Run deployment first."
    fi

    success "Prerequisites check passed"
}

# Load contract addresses from deployment file
load_contracts() {
    info "Loading contract addresses..."

    FACTORY_ID=$(jq -r '.contracts.factory' "${DEPLOYMENT_FILE}")
    ROUTER_ID=$(jq -r '.contracts.router' "${DEPLOYMENT_FILE}")
    STAKING_ID=$(jq -r '.contracts.staking' "${DEPLOYMENT_FILE}")
    AGGREGATOR_ID=$(jq -r '.contracts.aggregator' "${DEPLOYMENT_FILE}")
    BRIDGE_ID=$(jq -r '.contracts.bridge' "${DEPLOYMENT_FILE}")

    info "Factory:    ${FACTORY_ID}"
    info "Router:     ${ROUTER_ID}"
    info "Staking:    ${STAKING_ID}"
    info "Aggregator: ${AGGREGATOR_ID}"
    info "Bridge:     ${BRIDGE_ID}"
}

# Configure Factory contract
configure_factory() {
    info "Configuring Factory contract..."

    local public_creation=$(jq -r '.factory.public_pair_creation' "${CONFIG_FILE}")
    local protocol_fee=$(jq -r '.factory.protocol_fee_bps' "${CONFIG_FILE}")
    local paused=$(jq -r '.factory.paused' "${CONFIG_FILE}")

    # Set public pair creation
    info "Setting public_pair_creation to ${public_creation}..."
    stellar contract invoke \
        --id "${FACTORY_ID}" \
        --source "${DEPLOYER_KEY}" \
        --network "${NETWORK}" \
        -- \
        set_public_pair_creation \
        --enabled "${public_creation}" 2>&1 | grep -v "^Transaction" || true

    success "public_pair_creation = ${public_creation}"

    # Note: protocol_fee_bps is set during initialization, can't change after
    info "Protocol fee (set during init): ${protocol_fee} bps"

    # Set paused state if needed
    if [ "${paused}" == "true" ]; then
        warn "Pausing Factory contract..."
        stellar contract invoke \
            --id "${FACTORY_ID}" \
            --source "${DEPLOYER_KEY}" \
            --network "${NETWORK}" \
            -- \
            set_paused \
            --paused true 2>&1 | grep -v "^Transaction" || true
        success "Factory paused"
    else
        info "Factory remains active (not paused)"
    fi

    success "Factory configured"
}

# Configure Router contract
configure_router() {
    info "Configuring Router contract..."

    local paused=$(jq -r '.router.paused' "${CONFIG_FILE}")

    # Set paused state if needed
    if [ "${paused}" == "true" ]; then
        warn "Pausing Router contract..."
        stellar contract invoke \
            --id "${ROUTER_ID}" \
            --source "${DEPLOYER_KEY}" \
            --network "${NETWORK}" \
            -- \
            set_paused \
            --paused true 2>&1 | grep -v "^Transaction" || true
        success "Router paused"
    else
        info "Router remains active (not paused)"
    fi

    success "Router configured"
}

# Configure Staking contract
configure_staking() {
    info "Configuring Staking contract..."

    local paused=$(jq -r '.staking.paused' "${CONFIG_FILE}")

    # Set paused state if needed
    if [ "${paused}" == "true" ]; then
        warn "Pausing Staking contract..."
        stellar contract invoke \
            --id "${STAKING_ID}" \
            --source "${DEPLOYER_KEY}" \
            --network "${NETWORK}" \
            -- \
            set_paused \
            --paused true 2>&1 | grep -v "^Transaction" || true
        success "Staking paused"
    else
        info "Staking remains active (not paused)"
    fi

    success "Staking configured"
}

# Verify configuration (optional - manual verification recommended)
verify_configuration() {
    info "Configuration applied successfully"
    info "To manually verify settings, run:"
    echo ""
    echo "  stellar contract invoke \\"
    echo "    --id ${FACTORY_ID} \\"
    echo "    --source ${DEPLOYER_KEY} \\"
    echo "    --network ${NETWORK} \\"
    echo "    -- \\"
    echo "    is_public_pair_creation_enabled"
    echo ""
    success "Verification commands displayed above"
}

# Print summary
print_summary() {
    local public_creation=$(jq -r '.factory.public_pair_creation' "${CONFIG_FILE}")
    local protocol_fee=$(jq -r '.factory.protocol_fee_bps' "${CONFIG_FILE}")

    echo ""
    echo "=========================================="
    echo "   Configuration Applied - ${NETWORK}"
    echo "=========================================="
    echo ""
    echo "Network: ${NETWORK}"
    echo "Config:  ${CONFIG_FILE}"
    echo ""
    echo "Factory Settings:"
    echo "  public_pair_creation: ${public_creation}"
    echo "  protocol_fee_bps:     ${protocol_fee}"
    echo ""

    if [ "${public_creation}" == "true" ]; then
        echo "✅ Anyone can create pools on ${NETWORK}"
    else
        echo "🔒 Only admin can create pools on ${NETWORK}"
    fi

    echo ""
    success "Configuration complete!"
}

# Main function
main() {
    echo ""
    echo "=========================================="
    echo "   AstroSwap Configuration - ${NETWORK}"
    echo "=========================================="
    echo ""

    check_prerequisites
    load_contracts
    configure_factory
    configure_router
    configure_staking
    verify_configuration
    print_summary
}

# Run main function
main "$@"
