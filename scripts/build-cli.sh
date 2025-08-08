#!/bin/bash

# PBNJ CLI Build Script
# Simple script that uses the npm build:binary command

set -e

echo "🚀 Building PBNJ CLI..."

# Change to CLI directory
cd "$(dirname "$0")/../packages/cli"

# Run the build
bun run build:binary

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "📁 Binaries created in dist/bin/:"
echo "   - pbnj-macos (macOS)"
echo "   - pbnj-linux (Linux)"
echo "   - pbnj-win.bat (Windows)"
echo ""
echo "📊 File sizes:"
ls -lh dist/bin/

echo ""
echo "🚀 Quick start:"
echo "   ./dist/bin/pbnj-macos --help"
echo "" 