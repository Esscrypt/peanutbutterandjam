#!/bin/bash

# PeanutButterAndJam CLI Installation Script
# This script installs the CLI binary to a system directory

set -e

# Change to CLI directory
cd "$(dirname "$0")/../packages/cli"

# Configuration
BINARY_NAME="pbnj"
INSTALL_DIR="/usr/local/bin"
BACKUP_DIR="$HOME/.pbnj-backup"

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

echo "🚀 Installing PeanutButterAndJam CLI..."

# Determine binary name based on OS
case $OS in
    "darwin")
        SOURCE_BINARY="pbnj-macos"
        ;;
    "linux")
        SOURCE_BINARY="pbnj-linux"
        ;;
    *)
        echo "❌ Unsupported operating system: $OS"
        echo "   Please download the appropriate binary manually."
        exit 1
        ;;
esac

# Check if binary exists
if [ ! -f "dist/bin/$SOURCE_BINARY" ]; then
    echo "❌ Binary not found: dist/bin/$SOURCE_BINARY"
    echo "   Please run './scripts/cli-build.sh' first to build the binaries."
    exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if binary is already installed
if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    echo "⚠️  $BINARY_NAME is already installed."
    read -p "   Do you want to backup the existing installation? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Creating backup..."
        cp "$(which $BINARY_NAME)" "$BACKUP_DIR/$BINARY_NAME.backup.$(date +%Y%m%d_%H%M%S)"
        echo "   Backup created in: $BACKUP_DIR"
    fi
fi

# Install binary
echo "📦 Installing $BINARY_NAME to $INSTALL_DIR..."
sudo cp "dist/bin/$SOURCE_BINARY" "$INSTALL_DIR/$BINARY_NAME"
sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Verify installation
if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    echo "✅ Installation successful!"
    echo ""
    echo "🎉 $BINARY_NAME is now available globally."
    echo ""
    echo "📋 Quick start:"
    echo "   $BINARY_NAME --help"
    echo "   $BINARY_NAME gen-keys"
    echo "   $BINARY_NAME run"
    echo ""
    echo "📚 For more information, see USAGE_GUIDE.md"
else
    echo "❌ Installation failed. Please check permissions and try again."
    exit 1
fi 