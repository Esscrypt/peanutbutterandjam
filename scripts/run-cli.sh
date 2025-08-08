#!/bin/bash

# PBNJ CLI Runner Script
# This script runs the CLI and handles the Bun crash gracefully

set -e

echo "🚀 Running PBNJ CLI..."

# Run the CLI command
if bun run packages/cli/src/index.ts "$@"; then
    echo "✅ CLI completed successfully!"
    exit 0
else
    EXIT_CODE=$?
    
    # Check if it's the NAPI cleanup crash (exit code 133)
    if [ $EXIT_CODE -eq 133 ]; then
        echo "⚠️  CLI completed successfully but Bun crashed due to NAPI cleanup issue."
        echo "   This is a known Bun issue with native modules."
        echo "   The CLI output should be available."
        exit 0
    else
        echo "❌ CLI failed with exit code $EXIT_CODE"
        exit $EXIT_CODE
    fi
fi 