#!/bin/bash

# Quick test script for JAM networking implementation
# Tests our implementation for basic functionality

set -e

echo "🚀 Quick JAM Networking Test"
echo "Testing basic networking functionality"
echo "====================================="
echo ""

# Configuration
NODE_PORT=30333
TEST_DURATION=30  # 30 seconds for quick test
LISTEN_ADDRESS="127.0.0.1"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cleanup function
cleanup() {
    if [ ! -z "$NODE_PID" ]; then
        kill $NODE_PID 2>/dev/null || true
        wait 2>/dev/null || true
    fi
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

trap cleanup EXIT INT TERM

echo -e "${BLUE}📦 Building project...${NC}"
if ! turbo run build > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Turbo build failed, trying with bun...${NC}"
    if ! bun run build > /dev/null 2>&1; then
        echo "❌ Build failed"
        exit 1
    fi
fi
echo -e "${GREEN}✅ Build successful${NC}"

echo -e "${BLUE}🌐 Starting JAM node...${NC}"
cd packages/cli && bun run src/index.ts run \
    --networking-only \
    --validator-index 0 \
    --listen-port $NODE_PORT \
    --listen-address $LISTEN_ADDRESS \
    --chain "quick-test-chain" \
    --test-messages \
    --test-interval 6000 \
    --max-test-messages 10 > ../../node.log 2>&1 &
NODE_PID=$!
cd ../..

echo -e "${GREEN}✅ Node started (PID: $NODE_PID)${NC}"
echo -e "${YELLOW}⏰ Running test for $TEST_DURATION seconds...${NC}"

sleep $TEST_DURATION

echo ""
echo -e "${BLUE}📊 Test Results:${NC}"

# Check if node is still running
if kill -0 $NODE_PID 2>/dev/null; then
    echo -e "${GREEN}✅ Node is running${NC}"
else
    echo "❌ Node stopped unexpectedly"
    exit 1
fi

# Check messages
MESSAGES=$(grep -c "Sending test block announcement" node.log 2>/dev/null || echo "0")
echo -e "${GREEN}✅ Messages sent: $MESSAGES${NC}"

# Check for errors
ERRORS=$(grep -c "ERROR\|Error\|error" node.log 2>/dev/null || echo "0")
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ No errors detected${NC}"
else
    echo -e "${YELLOW}⚠️  $ERRORS errors detected${NC}"
fi

# Check QUIC protocol
if grep -q "QUIC\|quic" node.log 2>/dev/null; then
    echo -e "${GREEN}✅ QUIC transport detected${NC}"
else
    echo -e "${YELLOW}⚠️  QUIC transport not explicitly detected${NC}"
fi

# Check networking activity
if grep -q "networking\|Networking" node.log 2>/dev/null; then
    echo -e "${GREEN}✅ Networking activity detected${NC}"
else
    echo -e "${YELLOW}⚠️  Limited networking activity${NC}"
fi

echo ""
echo -e "${BLUE}📁 Check node.log for detailed output${NC}"
echo ""

if [ $MESSAGES -gt 0 ] && [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}🎉 Quick test PASSED!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Quick test completed with issues${NC}"
    exit 1
fi
