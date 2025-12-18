#!/bin/bash
# Run duna_fuzzer_linux against our fuzzer target
# This script handles running the Linux binary via Docker (if available) or provides instructions

set -e

WORKSPACE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUZZER_BINARY="$WORKSPACE_ROOT/submodules/duna_fuzzer_linux"
SOCKET_PATH="/tmp/jam_target.sock"
TARGET_SOCKET_PATH="/tmp/jam_target.sock" # Path inside container

# Check if Docker is available
if command -v docker &> /dev/null; then
  echo "🐳 Docker detected - will run fuzzer in Docker container"
  
  # Check if socket exists
  if [ ! -S "$SOCKET_PATH" ]; then
    echo "❌ Error: Fuzzer target socket not found at $SOCKET_PATH"
    echo "   Please start the fuzzer target first:"
    echo "   bun run infra/node/fuzzer-target.ts --socket $SOCKET_PATH --spec tiny"
    exit 1
  fi
  
  echo "✅ Fuzzer target socket found at $SOCKET_PATH"
  echo "🚀 Starting duna_fuzzer_linux in Docker container..."
  echo ""
  
  # Run the Linux binary in Docker, mounting the socket
  # We need to use a Linux container and mount the socket
  # Use -i only if stdin is a TTY, otherwise run non-interactively
  if [ -t 0 ]; then
    DOCKER_FLAGS="-it"
  else
    DOCKER_FLAGS="-i"
  fi
  
  docker run --rm $DOCKER_FLAGS \
    -v "$SOCKET_PATH:$TARGET_SOCKET_PATH" \
    -v "$FUZZER_BINARY:/fuzzer:ro" \
    --entrypoint /fuzzer \
    ubuntu:22.04 \
    --target "$TARGET_SOCKET_PATH" \
    "$@"
  
elif [ "$(uname)" = "Linux" ]; then
  echo "🐧 Running on Linux - executing fuzzer directly"
  
  if [ ! -S "$SOCKET_PATH" ]; then
    echo "❌ Error: Fuzzer target socket not found at $SOCKET_PATH"
    echo "   Please start the fuzzer target first:"
    echo "   bun run infra/node/fuzzer-target.ts --socket $SOCKET_PATH --spec tiny"
    exit 1
  fi
  
  if [ ! -x "$FUZZER_BINARY" ]; then
    chmod +x "$FUZZER_BINARY"
  fi
  
  echo "✅ Fuzzer target socket found at $SOCKET_PATH"
  echo "🚀 Starting duna_fuzzer_linux..."
  echo ""
  
  "$FUZZER_BINARY" --target "$SOCKET_PATH" "$@"
  
else
  echo "❌ Error: Cannot run Linux binary on $(uname)"
  echo ""
  echo "Options:"
  echo "  1. Install Docker and run: ./scripts/run-fuzzer.sh"
  echo "  2. Use a Linux VM or machine"
  echo "  3. Build a macOS version of the fuzzer"
  echo ""
  echo "The fuzzer target is running and listening on: $SOCKET_PATH"
  echo "You can connect to it from a Linux machine using:"
  echo "  ./duna_fuzzer_linux --target $SOCKET_PATH"
  exit 1
fi

