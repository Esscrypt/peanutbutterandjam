#!/bin/bash

# PBNJ Multi-Node Test Setup
# This script helps start multiple PBNJ nodes for testing communication

set -e

# Default configuration
NODE_COUNT=${NODE_COUNT:-4}
LOG_LEVEL=${LOG_LEVEL:-info}
BASE_P2P_PORT=${BASE_P2P_PORT:-40000}
BASE_RPC_PORT=${BASE_RPC_PORT:-19800}

echo "🚀 Starting PBNJ Multi-Node Test Setup"
echo "📊 Node Count: $NODE_COUNT"
echo "🔧 Log Level: $LOG_LEVEL"
echo "🌐 Base P2P Port: $BASE_P2P_PORT"
echo "🔌 Base RPC Port: $BASE_RPC_PORT"

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose is not installed. Please install it first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Create config directory if it doesn't exist
mkdir -p config/grafana/dashboards
mkdir -p config/grafana/datasources

echo "📁 Configuration directories created"

# Build the CLI first
echo "🔨 Building PBNJ CLI..."
cd packages/cli
bun run build
cd ../..

# Generate chain spec for testing
echo "📋 Generating test chain spec..."
./packages/cli/dist/bin/pbnj-macos gen-spec config/test-chain-spec.json config/generated-chain-spec.json

echo "✅ Chain spec generated"

# Start the services
echo "🐳 Starting Docker Compose services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🎉 PBNJ Multi-Node Test Setup Complete!"
echo ""
echo "📊 Access Points:"
echo "   Grafana: http://localhost:3000 (admin/admin)"
echo "   Prometheus: http://localhost:9090"
echo "   OpenTelemetry Collector: http://localhost:4318"
echo ""
echo "🔗 Node Endpoints:"
for i in $(seq 1 $NODE_COUNT); do
    p2p_port=$((BASE_P2P_PORT + i))
    rpc_port=$((BASE_RPC_PORT + i))
    echo "   Node $i: P2P:$p2p_port, RPC:$rpc_port"
done
echo ""
echo "📈 View metrics and traces in Grafana dashboard"
echo "🛑 To stop: docker-compose down" 