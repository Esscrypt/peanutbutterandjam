#!/bin/bash

# Simple test for networking setup
# This script tests if we can start a single node with networking-only mode

set -e

echo "🧪 Simple Networking Test"
echo "Testing if we can start a single networking-only node"
echo ""

# Build the project first
echo "📦 Building project..."
cd "$(dirname "$0")/.."
bun run build
echo "✅ Build completed"

echo ""
echo "🌐 Starting networking-only node..."

# Start node with networking-only mode
bun run packages/cli/src/index.ts run \
    --networking-only \
    --validator-index 0 \
    --listen-port 30333 \
    --listen-address "127.0.0.1" \
    --chain "dev-test-chain" \
    --test-messages \
    --test-interval 5000 \
    --max-test-messages 5 &

NODE_PID=$!

echo "Node started with PID $NODE_PID"
echo "Will run for about 30 seconds..."

# Wait for the test to complete
sleep 30

# Clean up
echo ""
echo "🧹 Stopping node..."
kill $NODE_PID 2>/dev/null || true
wait 2>/dev/null || true

echo "✅ Simple test completed"
echo ""
echo "If you saw log messages about 'Sending test block announcement', the test was successful!"
