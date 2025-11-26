#!/bin/bash
#
# AstroSwap Comprehensive Stress Testing Script
# Runs all stress test scenarios sequentially

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "╔═══════════════════════════════════════════════════════╗"
echo "║      AstroSwap Comprehensive Stress Testing          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default parameters
DURATION=${DURATION:-120}
OUTPUT_DIR=${OUTPUT_DIR:-"$PROJECT_DIR/results"}

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Configuration:"
echo "  Duration per scenario: ${DURATION}s"
echo "  Output directory:      $OUTPUT_DIR"
echo ""

# Build the project
echo -e "${BLUE}Building stress test binary...${NC}"
cd "$PROJECT_DIR"
cargo build --release --bin stress-runner
echo ""

# Stress test scenarios
declare -a SCENARIOS=(
    "swap-load:Swap Load:100:50:10"          # scenario:name:tps:accounts:pairs
    "pool-stress:Pool Stress:80:40:10"
    "router-paths:Router Paths:60:30:8"
    "concurrent:Concurrent Ops:100:50:10"
)

RESULTS=()

for scenario_config in "${SCENARIOS[@]}"; do
    IFS=':' read -r scenario name tps accounts pairs <<< "$scenario_config"

    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Scenario: $name${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo ""

    START_TIME=$(date +%s)

    # Run the test
    if cargo run --release --bin stress-runner -- \
        --scenario "$scenario" \
        --duration "$DURATION" \
        --tps "$tps" \
        --accounts "$accounts" \
        --pairs "$pairs" \
        --workers 20 \
        --max-hops 4 \
        --output "$OUTPUT_DIR" \
        --format both; then
        STATUS="PASSED"
        STATUS_COLOR=$GREEN
    else
        STATUS="FAILED"
        STATUS_COLOR=$RED
    fi

    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))

    echo ""
    echo -e "${STATUS_COLOR}$name: $STATUS (${ELAPSED}s)${NC}"
    echo ""

    RESULTS+=("$name:$STATUS:${ELAPSED}s")

    # Short pause between scenarios
    sleep 2
done

# Final Summary
echo "╔═══════════════════════════════════════════════════════╗"
echo "║              Stress Testing Summary                   ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

TOTAL=0
PASSED=0
FAILED=0

for result in "${RESULTS[@]}"; do
    IFS=':' read -r name status elapsed <<< "$result"
    ((TOTAL++))

    if [ "$status" = "PASSED" ]; then
        echo -e "  ${GREEN}✓${NC} $name ($elapsed)"
        ((PASSED++))
    else
        echo -e "  ${RED}✗${NC} $name ($elapsed)"
        ((FAILED++))
    fi
done

echo ""
echo "  Total Scenarios: $TOTAL"
echo -e "  Passed:          ${GREEN}${PASSED}${NC}"
echo -e "  Failed:          ${RED}${FAILED}${NC}"
echo ""

# Create latest symlink
LATEST_RESULT=$(ls -t "$OUTPUT_DIR"/*.json 2>/dev/null | head -1)
if [ -n "$LATEST_RESULT" ]; then
    ln -sf "$LATEST_RESULT" "$OUTPUT_DIR/latest.json"
    echo "Latest result: $(basename $LATEST_RESULT)"
    echo ""

    # Show quick stats if available
    if command -v jq &> /dev/null; then
        echo "Quick Stats:"
        echo "  Total Ops:    $(jq '.summary.total_operations' "$LATEST_RESULT")"
        echo "  Success Rate: $(jq '.summary.overall_success_rate * 100' "$LATEST_RESULT")%"
        echo "  TPS:          $(jq '.summary.overall_tps' "$LATEST_RESULT")"
        echo "  Avg Latency:  $(jq '.summary.overall_latency_ms' "$LATEST_RESULT")ms"
        echo ""
    fi
fi

# Exit with appropriate code
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All stress tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some stress tests failed!${NC}"
    exit 1
fi
