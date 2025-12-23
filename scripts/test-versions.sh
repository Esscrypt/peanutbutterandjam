#!/bin/bash
# Test different versions of jam-test-vectors and compare traces

set -e

WORKSPACE_ROOT="/Users/tanyageorgieva/Repos/peanutbutterandjam"
JAM_TEST_VECTORS_DIR="$WORKSPACE_ROOT/submodules/jam-test-vectors"
TEST_FILE="$WORKSPACE_ROOT/infra/node/__tests__/traces/preimages-light-all-blocks.test.ts"
COMPARE_SCRIPT="$WORKSPACE_ROOT/scripts/compare-traces.ts"
BLOCK_NUMBER=4

cd "$JAM_TEST_VECTORS_DIR"

# Save current version
CURRENT_VERSION=$(git describe --tags --exact-match HEAD 2>/dev/null || git rev-parse --short HEAD)
echo "Current version: $CURRENT_VERSION"
echo ""

# Versions to test
VERSIONS=("v0.7.0" "v0.7.1" "v0.7.2")

# Results storage
declare -A RESULTS

for VERSION in "${VERSIONS[@]}"; do
  echo "=========================================="
  echo "Testing version: $VERSION"
  echo "=========================================="
  
  # Checkout version
  echo "Checking out $VERSION..."
  git checkout "$VERSION" > /dev/null 2>&1
  
  # Clean up old traces
  echo "Cleaning old traces..."
  rm -f "$WORKSPACE_ROOT/pvm-traces/typescript-$BLOCK_NUMBER.log"
  rm -f "$WORKSPACE_ROOT/infra/node/pvm-traces/typescript-$BLOCK_NUMBER.log"
  
  # Run test (only for block 4, timeout after 5 minutes)
  echo "Running test for block 4..."
  cd "$WORKSPACE_ROOT"
  
  # Run test with timeout and capture output
  if timeout 300 bun test "$TEST_FILE" 2>&1 | grep -q "Block 4"; then
    echo "✓ Test completed"
  else
    echo "⚠ Test may have failed or timed out"
  fi
  
  # Wait a moment for file writes
  sleep 1
  
  # Check if trace was generated
  TRACE_FILE=""
  if [ -f "$WORKSPACE_ROOT/pvm-traces/typescript-$BLOCK_NUMBER.log" ]; then
    TRACE_FILE="$WORKSPACE_ROOT/pvm-traces/typescript-$BLOCK_NUMBER.log"
  elif [ -f "$WORKSPACE_ROOT/infra/node/pvm-traces/typescript-$BLOCK_NUMBER.log" ]; then
    TRACE_FILE="$WORKSPACE_ROOT/infra/node/pvm-traces/typescript-$BLOCK_NUMBER.log"
  fi
  
  if [ -z "$TRACE_FILE" ]; then
    echo "❌ No trace file generated for $VERSION"
    RESULTS["$VERSION"]="NO_TRACE"
    continue
  fi
  
  echo "Trace file: $TRACE_FILE"
  
  # Run comparison
  echo "Running comparison..."
  COMPARE_OUTPUT=$(cd "$WORKSPACE_ROOT" && bun run "$COMPARE_SCRIPT" "$BLOCK_NUMBER" typescript 2>&1)
  
  # Extract key metrics
  MATCH_RATE=$(echo "$COMPARE_OUTPUT" | grep -oP "Match rate: \K[0-9.]+" || echo "0")
  TOTAL_DIFFS=$(echo "$COMPARE_OUTPUT" | grep -oP "Differences:\s+\K[0-9]+" || echo "0")
  FIRST_DIFF_STEP=$(echo "$COMPARE_OUTPUT" | grep -oP "First Difference at Step \K[0-9]+" || echo "N/A")
  
  echo "  Match rate: $MATCH_RATE%"
  echo "  Total differences: $TOTAL_DIFFS"
  echo "  First difference at step: $FIRST_DIFF_STEP"
  
  # Store results
  RESULTS["$VERSION"]="$MATCH_RATE|$TOTAL_DIFFS|$FIRST_DIFF_STEP"
  
  echo ""
done

# Restore original version
echo "=========================================="
echo "Restoring original version: $CURRENT_VERSION"
echo "=========================================="
cd "$JAM_TEST_VECTORS_DIR"
git checkout "$CURRENT_VERSION" > /dev/null 2>&1

# Print summary
echo ""
echo "=========================================="
echo "SUMMARY"
echo "=========================================="
printf "%-10s %-12s %-18s %-20s\n" "Version" "Match Rate" "Differences" "First Diff Step"
echo "------------------------------------------------------------"
for VERSION in "${VERSIONS[@]}"; do
  if [ "${RESULTS[$VERSION]}" = "NO_TRACE" ]; then
    printf "%-10s %-12s %-18s %-20s\n" "$VERSION" "N/A" "NO_TRACE" "N/A"
  else
    IFS='|' read -r MATCH DIFFS STEP <<< "${RESULTS[$VERSION]}"
    printf "%-10s %-12s %-18s %-20s\n" "$VERSION" "$MATCH%" "$DIFFS" "$STEP"
  fi
done
echo ""







