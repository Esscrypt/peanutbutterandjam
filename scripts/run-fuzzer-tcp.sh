#!/bin/bash
# Run duna_fuzzer_linux against our fuzzer target via TCP proxy
# This works around Docker's inability to mount Unix sockets on macOS

set -e

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUZZER_BINARY="$WORKSPACE_ROOT/submodules/duna_fuzzer_linux"
SOCKET_PATH="/tmp/jam_target.sock"
TCP_PORT="${TCP_PORT:-9999}"
PROXY_SOCKET="/tmp/jam_target_proxy.sock"

# Check if socat is available
if ! command -v socat &> /dev/null; then
  echo "❌ Error: socat is required but not installed"
  echo ""
  echo "Install it with:"
  echo "  brew install socat"
  exit 1
fi

# Check if socket exists
if [ ! -S "$SOCKET_PATH" ]; then
  echo "❌ Error: Fuzzer target socket not found at $SOCKET_PATH"
  echo "   Please start the fuzzer target first:"
  echo "   bun run infra/node/fuzzer-target.ts --socket $SOCKET_PATH --spec tiny"
  exit 1
fi

echo "✅ Fuzzer target socket found at $SOCKET_PATH"
echo "🔌 Setting up TCP proxy on port $TCP_PORT..."

# Start socat proxy in background
socat TCP-LISTEN:$TCP_PORT,reuseaddr,fork UNIX-CONNECT:$SOCKET_PATH &
SOCAT_PID=$!

# Cleanup function
cleanup() {
  echo ""
  echo "🧹 Cleaning up..."
  kill $SOCAT_PID 2>/dev/null || true
  wait $SOCAT_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for proxy to be ready
sleep 1

# Check if Docker is available
if command -v docker &> /dev/null; then
  echo "🐳 Running fuzzer in Docker container (connecting via TCP)..."
  echo ""
  
  # Run the Linux binary in Docker, connecting via TCP
  docker run --rm -i \
    --network host \
    -v "$FUZZER_BINARY:/fuzzer:ro" \
    --entrypoint /fuzzer \
    ubuntu:22.04 \
    --target "tcp://localhost:$TCP_PORT" \
    "$@"
  
elif [ "$(uname)" = "Linux" ]; then
  echo "🐧 Running fuzzer directly (connecting via TCP)..."
  echo ""
  
  if [ ! -x "$FUZZER_BINARY" ]; then
    chmod +x "$FUZZER_BINARY"
  fi
  
  "$FUZZER_BINARY" --target "tcp://localhost:$TCP_PORT" "$@"
  
else
  echo "❌ Error: Cannot run Linux binary on $(uname)"
  echo ""
  echo "The TCP proxy is running on port $TCP_PORT"
  echo "You can connect from a Linux machine using:"
  echo "  ./duna_fuzzer_linux --target tcp://<host-ip>:$TCP_PORT"
  exit 1
fi








