#!/bin/bash

# Release script for PeanutButterAndJam CLI
# Usage: ./scripts/release.sh <version>

set -e

if [ $# -eq 0 ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.0.0"
    exit 1
fi

VERSION=$1

echo "🚀 Starting release process for version $VERSION"

# Update version in CLI package.json
echo "📝 Updating version in CLI package.json..."
cd packages/cli
# Use sed to update version in package.json
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json
cd ../..

# Update version in root package.json
echo "📝 Updating version in root package.json..."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json

# Build the project
echo "🔨 Building project..."
bun run build

# Build CLI binary
echo "🔨 Building CLI binary..."
cd packages/cli
bun run build:binary
cd ../..

# Create git tag
echo "🏷️  Creating git tag v$VERSION..."
git add .
git commit -m "chore: release version $VERSION"
git tag -a "v$VERSION" -m "Release version $VERSION"

echo "✅ Release preparation complete!"
echo ""
echo "Next steps:"
echo "1. Push the tag: git push origin v$VERSION"
echo "2. This will trigger the GitHub Actions release workflow"
echo "3. Check the Actions tab to monitor the release process"
echo ""
echo "Or run: git push origin main --tags" 