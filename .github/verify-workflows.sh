#!/bin/bash
# verify-workflows.sh - Verify GitHub Actions workflows are configured correctly

set -e

echo "🔍 Verifying AstroSwap CI/CD Workflows"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# 1. Check workflow files exist
echo "1. Checking workflow files..."
REQUIRED_WORKFLOWS=("test.yml" "lint.yml" "build.yml" "sdk.yml" "deploy-testnet.yml")

for workflow in "${REQUIRED_WORKFLOWS[@]}"; do
    if [ -f ".github/workflows/$workflow" ]; then
        check_pass "Workflow file exists: $workflow"
    else
        check_fail "Missing workflow file: $workflow"
    fi
done
echo ""

# 2. Check documentation files
echo "2. Checking documentation files..."
REQUIRED_DOCS=("workflows/README.md" "WORKFLOWS_GUIDE.md" "WORKFLOWS_QUICKSTART.md" "CICD_SUMMARY.md")

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f ".github/$doc" ]; then
        check_pass "Documentation exists: $doc"
    else
        check_fail "Missing documentation: $doc"
    fi
done
echo ""

# 3. Check YAML syntax (basic)
echo "3. Checking YAML syntax..."
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        # Check for basic YAML structure
        if grep -q "^name:" "$workflow" && grep -q "^on:" "$workflow" && grep -q "^jobs:" "$workflow"; then
            check_pass "Valid YAML structure: $(basename $workflow)"
        else
            check_fail "Invalid YAML structure: $(basename $workflow)"
        fi
    fi
done
echo ""

# 4. Check for required secrets documentation
echo "4. Checking secret documentation..."
if grep -q "DEPLOYER_SECRET_KEY" .github/WORKFLOWS_GUIDE.md; then
    check_pass "DEPLOYER_SECRET_KEY documented"
else
    check_fail "DEPLOYER_SECRET_KEY not documented"
fi

if grep -q "CODECOV_TOKEN" .github/WORKFLOWS_GUIDE.md; then
    check_pass "CODECOV_TOKEN documented"
else
    check_warn "CODECOV_TOKEN not documented (optional)"
fi
echo ""

# 5. Check workflow triggers
echo "5. Checking workflow triggers..."

# test.yml should trigger on push and PR
if grep -A5 "^on:" .github/workflows/test.yml | grep -q "push:" && \
   grep -A5 "^on:" .github/workflows/test.yml | grep -q "pull_request:"; then
    check_pass "test.yml: triggers on push and PR"
else
    check_fail "test.yml: incorrect triggers"
fi

# lint.yml should only trigger on PR
if grep -A5 "^on:" .github/workflows/lint.yml | grep -q "pull_request:" && \
   ! grep -A5 "^on:" .github/workflows/lint.yml | grep -q "push:"; then
    check_pass "lint.yml: triggers on PR only"
else
    check_fail "lint.yml: should only trigger on PR"
fi

# deploy-testnet.yml should be manual
if grep -A2 "^on:" .github/workflows/deploy-testnet.yml | grep -q "workflow_dispatch:"; then
    check_pass "deploy-testnet.yml: manual trigger configured"
else
    check_fail "deploy-testnet.yml: should be manual trigger"
fi
echo ""

# 6. Check for caching
echo "6. Checking caching configuration..."
for workflow in .github/workflows/*.yml; do
    if [ -f "$workflow" ]; then
        if grep -q "actions/cache@v4" "$workflow"; then
            check_pass "Caching enabled: $(basename $workflow)"
        else
            check_warn "No caching in: $(basename $workflow)"
        fi
    fi
done
echo ""

# 7. Check for contract size validation
echo "7. Checking contract size validation..."
if grep -q "MAX_CONTRACT_SIZE" .github/workflows/build.yml && \
   grep -q "262144" .github/workflows/build.yml; then
    check_pass "Contract size limit configured (256KB)"
else
    check_fail "Contract size limit not properly configured"
fi
echo ""

# 8. Check for matrix builds
echo "8. Checking matrix build configuration..."
if grep -A10 "strategy:" .github/workflows/build.yml | grep -q "matrix:"; then
    check_pass "Matrix build configured in build.yml"
else
    check_warn "Matrix build not configured in build.yml"
fi
echo ""

# 9. Check for Rust setup
echo "9. Checking Rust toolchain setup..."
for workflow in .github/workflows/{test,lint,build}.yml; do
    if grep -q "dtolnay/rust-toolchain" "$workflow" || grep -q "actions/setup-rust" "$workflow"; then
        check_pass "Rust toolchain setup in $(basename $workflow)"
    else
        check_fail "Missing Rust setup in $(basename $workflow)"
    fi
done
echo ""

# 10. Check for Node.js setup (SDK)
echo "10. Checking Node.js setup..."
if grep -q "actions/setup-node@v4" .github/workflows/sdk.yml && \
   grep -q "node-version: '20'" .github/workflows/sdk.yml; then
    check_pass "Node.js 20 configured in sdk.yml"
else
    check_fail "Node.js not properly configured in sdk.yml"
fi
echo ""

# 11. Check for artifact uploads
echo "11. Checking artifact uploads..."
for workflow in .github/workflows/{build,sdk,deploy-testnet}.yml; do
    if grep -q "actions/upload-artifact@v4" "$workflow"; then
        check_pass "Artifacts configured in $(basename $workflow)"
    else
        check_warn "No artifacts in $(basename $workflow)"
    fi
done
echo ""

# 12. Check for deployment inputs
echo "12. Checking deployment workflow inputs..."
if grep -A10 "workflow_dispatch:" .github/workflows/deploy-testnet.yml | grep -q "contracts:" && \
   grep -A10 "workflow_dispatch:" .github/workflows/deploy-testnet.yml | grep -q "network:"; then
    check_pass "Deployment inputs configured (contracts, network)"
else
    check_fail "Deployment inputs not properly configured"
fi
echo ""

# 13. Check for summaries
echo "13. Checking workflow summaries..."
for workflow in .github/workflows/*.yml; do
    if grep -q "GITHUB_STEP_SUMMARY" "$workflow"; then
        check_pass "Summary generation in $(basename $workflow)"
    else
        check_warn "No summary in $(basename $workflow)"
    fi
done
echo ""

# 14. Check file sizes
echo "14. Checking file sizes..."
for workflow in .github/workflows/*.yml; do
    SIZE=$(wc -c < "$workflow")
    if [ $SIZE -gt 0 ] && [ $SIZE -lt 50000 ]; then
        check_pass "Reasonable size: $(basename $workflow) ($(($SIZE / 1024))KB)"
    else
        check_warn "Unusual size: $(basename $workflow) ($(($SIZE / 1024))KB)"
    fi
done
echo ""

# Summary
echo "========================================"
echo "📊 Verification Summary"
echo "========================================"
echo -e "${GREEN}Checks passed:${NC} $CHECKS_PASSED"
echo -e "${RED}Checks failed:${NC} $CHECKS_FAILED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Add DEPLOYER_SECRET_KEY secret in GitHub settings"
    echo "2. Fund deployer account with XLM"
    echo "3. Push workflows to repository"
    echo "4. Test by creating a PR"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review and fix.${NC}"
    exit 1
fi
