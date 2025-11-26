#!/bin/bash
#
# AstroSwap Load Testing Script
# Runs progressive load tests with increasing TPS

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║         AstroSwap Load Testing Suite                 ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default parameters
DURATION=${DURATION:-60}
OUTPUT_DIR=${OUTPUT_DIR:-"$PROJECT_DIR/results"}

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Configuration:"
echo "  Duration per test: ${DURATION}s"
echo "  Output directory:  $OUTPUT_DIR"
echo ""

# Build the project
echo "Building stress test binary..."
cd "$PROJECT_DIR"
cargo build --release --bin stress-runner
echo ""

# Test configurations
declare -a TESTS=(
    "light:10:30:5"      # name:tps:accounts:pairs
    "medium:50:50:10"
    "heavy:100:100:15"
)

PASSED=0
FAILED=0

for test_config in "${TESTS[@]}"; do
    IFS=':' read -r name tps accounts pairs <<< "$test_config"

    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Running: $name load test (${tps} TPS)${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Run the test
    if cargo run --release --bin stress-runner -- \
        --scenario all \
        --duration "$DURATION" \
        --tps "$tps" \
        --accounts "$accounts" \
        --pairs "$pairs" \
        --output "$OUTPUT_DIR"; then
        echo -e "${GREEN}✓ $name test PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $name test FAILED${NC}"
        ((FAILED++))
    fi
    echo ""
done

# Summary
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                  Testing Summary                      ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo -e "  Tests Passed: ${GREEN}${PASSED}${NC}"
echo -e "  Tests Failed: ${RED}${FAILED}${NC}"
echo "  Total Tests:  $((PASSED + FAILED))"
echo ""

# Create latest symlink
LATEST_RESULT=$(ls -t "$OUTPUT_DIR"/*.json 2>/dev/null | head -1)
if [ -n "$LATEST_RESULT" ]; then
    ln -sf "$LATEST_RESULT" "$OUTPUT_DIR/latest.json"
    echo "Latest result: $LATEST_RESULT"
fi

# Exit with appropriate code
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
