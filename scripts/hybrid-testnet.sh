#!/bin/bash

set -e

echo "🧪 Setting up Hybrid JAM Testnet (Polkajam + PBNJ)"
echo "=================================================="

# Configuration
POLKAJAM_BINARY="./polkajam/polkajam"
PBNJ_BINARY="./packages/cli/dist/bin/pbnj-macos"
CHAIN_SPEC="./config/generated-chain-spec.json"
BASE_PORT=40000
BASE_RPC_PORT=19800

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if binaries exist
print_status "Checking binaries..."

if [ ! -f "$POLKAJAM_BINARY" ]; then
    print_warning "Polkajam binary not found at $POLKAJAM_BINARY"
    print_status "You may need to download or build polkajam first"
    exit 1
fi

if [ ! -f "$PBNJ_BINARY" ]; then
    print_status "Building PBNJ CLI..."
    cd packages/cli && ./build-native.sh && cd ../..
fi

if [ ! -f "$CHAIN_SPEC" ]; then
    print_status "Generating chain spec..."
    ./packages/cli/dist/bin/pbnj-macos gen-spec config/chain-spec-config.json config/generated-chain-spec.json
fi

print_success "All binaries and chain spec found"

# Create data directories
print_status "Creating data directories..."
mkdir -p testnet-data/polkajam
mkdir -p testnet-data/pbnj

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    pkill -f "polkajam" || true
    pkill -f "pbnj-macos" || true
    print_success "Cleanup complete"
}

# Set up signal handlers
trap cleanup EXIT INT TERM

# Start Polkajam node
print_status "Starting Polkajam node..."
print_status "Polkajam will run on port $BASE_PORT and RPC port $BASE_RPC_PORT"

$POLKAJAM_BINARY \
    --chain "$CHAIN_SPEC" \
    --port $BASE_PORT \
    --rpc-port $BASE_RPC_PORT \
    --data-path "./testnet-data/polkajam" \
    --validator \
    --validatorindex 0 \
    --name "Polkajam-Node" &

POLKAJAM_PID=$!
print_success "Polkajam node started with PID $POLKAJAM_PID"

# Wait a moment for Polkajam to start
sleep 3

# Start PBNJ node
print_status "Starting PBNJ node..."
print_status "PBNJ will run on port $((BASE_PORT + 1)) and RPC port $((BASE_RPC_PORT + 1))"

$PBNJ_BINARY run \
    --chain "$CHAIN_SPEC" \
    --port $((BASE_PORT + 1)) \
    --rpc-port $((BASE_RPC_PORT + 1)) \
    --data-path "./testnet-data/pbnj" \
    --validator \
    --validatorindex 1 \
    --metadata "PBNJ-Node" \
    --bootnode "12D3KooWQYV9dGMFoRzNStwpXzXwdkptENkTWxG8JkTMn6Jkc2i4@127.0.0.1:$BASE_PORT" &

PBNJ_PID=$!
print_success "PBNJ node started with PID $PBNJ_PID"

print_success "Hybrid testnet setup complete!"
echo ""
echo "🌐 Network Information:"
echo "  Polkajam Node:"
echo "    - Port: $BASE_PORT"
echo "    - RPC Port: $BASE_RPC_PORT"
echo "    - Data: ./testnet-data/polkajam"
echo "    - PID: $POLKAJAM_PID"
echo ""
echo "  PBNJ Node:"
echo "    - Port: $((BASE_PORT + 1))"
echo "    - RPC Port: $((BASE_RPC_PORT + 1))"
echo "    - Data: ./testnet-data/pbnj"
echo "    - PID: $PBNJ_PID"
echo ""
echo "📊 Monitoring:"
echo "  - Polkajam logs: Check terminal output"
echo "  - PBNJ logs: Check terminal output"
echo ""
echo "🔗 The nodes should connect to each other via bootnode"
echo "🛑 To stop the testnet, press Ctrl+C"

# Wait for user to stop
wait 