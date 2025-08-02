# Release Process

This document explains how to release the PeanutButterAndJam CLI.

## Prerequisites

- GitHub repository with Actions enabled
- Write permissions to the repository
- Bun installed locally

## Release Process

### 1. Automated Release (Recommended)

The easiest way to create a release is using the provided script:

```bash
# Make the script executable (if not already done)
chmod +x scripts/release.sh

# Create a release for version 0.0.1
./scripts/release.sh 0.0.1
```

This script will:
- Update version numbers in package.json files
- Build the project
- Create a git tag
- Commit the changes

After running the script, push the tag to trigger the GitHub Actions workflow:

```bash
git push origin main --tags
```

### 2. Manual Release

If you prefer to do it manually:

1. **Update versions**:
   ```bash
   cd packages/cli
   npm version 0.0.1 --no-git-tag-version
   cd ../..
   npm version 0.0.1 --no-git-tag-version
   ```

2. **Build the project**:
   ```bash
   bun run build
   ```

3. **Create and push a tag**:
   ```bash
   git add .
   git commit -m "chore: release version 0.0.1"
   git tag -a "v0.0.1" -m "Release version 0.0.1"
   git push origin main --tags
   ```

### 3. GitHub Actions Workflow

When you push a tag starting with `v`, the GitHub Actions workflow will automatically:

1. Build the CLI for multiple platforms (Linux, macOS, Windows)
2. Create a GitHub Release
3. Upload the binaries as release assets
4. Generate and upload SHA256 checksums

## Release Assets

Each release includes:

- `pbnj-linux-x64` - Linux binary
- `pbnj-macos-x64` - macOS binary  
- `pbnj-win-x64.exe` - Windows binary
- `pbnj-*-x64.sha256` - SHA256 checksums for verification

## Manual Workflow Trigger

You can also trigger the release workflow manually from the GitHub Actions tab:

1. Go to the Actions tab in your repository
2. Select the "Release CLI" workflow
3. Click "Run workflow"
4. Enter the version number
5. Click "Run workflow"

## Installation

Users can download the binaries from the GitHub Releases page and install them:

### Linux/macOS
```bash
# Download the appropriate binary
curl -L -o pbnj https://github.com/your-repo/releases/latest/download/pbnj-linux-x64

# Make it executable
chmod +x pbnj

# Move to a directory in PATH
sudo mv pbnj /usr/local/bin/
```

### Windows
Download the `pbnj-win-x64.exe` file and add it to your PATH.

## Verification

You can verify the integrity of downloaded binaries using the provided checksums:

```bash
# Linux/macOS
sha256sum -c pbnj-linux-x64.sha256

# Windows (PowerShell)
Get-FileHash pbnj-win-x64.exe -Algorithm SHA256
```

## Troubleshooting

### Build Issues
- Ensure all dependencies are installed: `bun install`
- Check that TypeScript compilation passes: `bun run check`
- Verify the CLI builds locally: `cd packages/cli && bun run build:binary`

### GitHub Actions Issues
- Check the Actions tab for detailed error logs
- Ensure the repository has the necessary permissions
- Verify that the `GITHUB_TOKEN` secret is available

### Binary Issues
- Test the binary locally before releasing
- Ensure the shebang line is correct in `src/index.ts`
- Check that all dependencies are properly bundled 