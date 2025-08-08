#!/bin/bash

set -e

echo "🧪 Setting up Simple JAM Testnet"
echo "================================"

# Configuration
POLKAJAM_TESTNET="./polkajam/polkajam-testnet"
PBNJ_BINARY="./packages/cli/dist/bin/pbnj-macos"
BASE_PORT=40000
BASE_RPC_PORT=19800

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if binaries exist
print_status "Checking binaries..."

if [ ! -f "$POLKAJAM_TESTNET" ]; then
    echo "Error: polkajam-testnet binary not found at $POLKAJAM_TESTNET"
    exit 1
fi

if [ ! -f "$PBNJ_BINARY" ]; then
    print_status "Building PBNJ CLI..."
    cd packages/cli && ./build-native.sh && cd ../..
fi

print_success "All binaries found"

# Create data directories
print_status "Creating data directories..."
mkdir -p testnet-data

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    pkill -f "polkajam-testnet" || true
    pkill -f "pbnj-macos" || true
    print_success "Cleanup complete"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Start polkajam-testnet (this will start multiple nodes)
print_status "Starting polkajam-testnet with 2 validator nodes..."
print_status "This will start nodes on ports $BASE_PORT and $((BASE_PORT + 1))"

$POLKAJAM_TESTNET \
    --num-nonval-nodes 0 \
    --base-port $BASE_PORT \
    --base-rpc-port $BASE_RPC_PORT &

TESTNET_PID=$!
print_success "Polkajam testnet started with PID $TESTNET_PID"

# Wait for testnet to start
sleep 5

print_success "Testnet setup complete!"
echo ""
echo "🌐 Network Information:"
echo "  Polkajam Testnet:"
echo "    - Base Port: $BASE_PORT"
echo "    - Base RPC Port: $BASE_RPC_PORT"
echo "    - PID: $TESTNET_PID"
echo ""
echo "📊 The testnet is now running with multiple validator nodes"
echo "🛑 To stop the testnet, press Ctrl+C"

# Wait for user to stop
wait 