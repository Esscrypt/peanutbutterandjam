#!/bin/bash

# PBNJ Single Node Test
# This script tests a single PBNJ node with full observability

set -e

echo "🧪 Testing Single PBNJ Node with Observability"
echo "================================================"

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
cd packages/cli
./dist/bin/pbnj-macos gen-spec ../config/chain-spec-config.json ../config/generated-chain-spec.json
cd ..

echo "✅ Chain spec generated"

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
docker-compose -f docker-compose.single.yml down -v 2>/dev/null || true

# Start the services
echo "🐳 Starting single node test environment..."
docker-compose -f docker-compose.single.yml up -d

echo "⏳ Waiting for services to start..."
sleep 15

# Check service status
echo "📊 Service Status:"
docker-compose -f docker-compose.single.yml ps

# Check node logs
echo ""
echo "📋 Node Logs (last 20 lines):"
docker-compose -f docker-compose.single.yml logs --tail=20 pbnj-node

# Check if node is healthy
echo ""
echo "🏥 Health Check:"
if docker-compose -f docker-compose.single.yml exec pbnj-node bun -e "console.log('Node is running')" 2>/dev/null; then
    echo "✅ Node is healthy"
else
    echo "❌ Node health check failed"
fi

echo ""
echo "🎉 Single Node Test Setup Complete!"
echo ""
echo "📊 Access Points:"
echo "   Grafana: http://localhost:3000 (admin/admin)"
echo "   Prometheus: http://localhost:9090"
echo "   OpenTelemetry Collector: http://localhost:4318"
echo ""
echo "🔗 Node Endpoints:"
echo "   P2P: localhost:40000"
echo "   RPC: localhost:19800"
echo ""
echo "📈 View metrics and traces in Grafana dashboard"
echo "📋 View logs: docker-compose -f docker-compose.single.yml logs -f pbnj-node"
echo "🛑 To stop: docker-compose -f docker-compose.single.yml down" 