# PBNJ Scripts

```
# Compare TypeScript traces
bun scripts/compare-3way-traces.ts --2way --typescript --preimages-light 2 0 0

# Compare WASM traces
bun scripts/compare-3way-traces.ts --2way --wasm --preimages-light 2 0 0

# Defaults to TypeScript if executor not specified
bun scripts/compare-3way-traces.ts --2way --preimages-light 2 0 0

# Works with legacy text format too
bun scripts/compare-3way-traces.ts --2way --typescript 2
```

This directory contains various scripts for building, testing, and managing the PBNJ (PeanutButterAndJam) project.

## CLI Build Scripts

### `build-cli.sh` ⭐ **RECOMMENDED**
Simple CLI build script that uses the npm `build:binary` command. This creates standalone binaries using `pkg` that work without Bun NAPI crashes.

**Usage:**
```bash
./scripts/build-cli.sh
```

**What it does:**
- Builds TypeScript with `tsc`
- Creates a bundle with `esbuild`
- Packages with `pkg` to create standalone binaries
- Creates binaries for macOS, Linux, and Windows

**Output:**
- `packages/cli/dist/bin/pbnj-macos` - macOS binary
- `packages/cli/dist/bin/pbnj-linux` - Linux binary
- `packages/cli/dist/bin/pbnj-win.bat` - Windows binary

### `cli-install.sh`
Installs the CLI binary to `/usr/local/bin` for global access.

**Usage:**
```bash
./scripts/cli-install.sh
```

### `run-cli.sh`
Wrapper script that runs the CLI and handles Bun NAPI crashes gracefully. Useful for development when using Bun directly.

**Usage:**
```bash
./scripts/run-cli.sh gen-spec config/dev-config.json output.json
```

## Testnet Scripts

### `simple-testnet.sh`
Sets up a simple JAM testnet with polkajam and PBNJ nodes.

**Usage:**
```bash
./scripts/simple-testnet.sh
```

### `testnet-setup.sh`
Comprehensive testnet setup script.

### `start-nodes.sh`
Script to start individual nodes.

### `test-single-node.sh`
Script to test a single node.

### `hybrid-testnet.sh`
Script for hybrid testnet setup.

## Other Scripts

### `release.sh`
Release management script.

### `calculate-genesis-hash.ts`
TypeScript script for calculating genesis hashes.

## Bun NAPI Issue

The PBNJ CLI uses native modules (`@stablelib/*` packages and `@infisical/quic`) which can cause Bun to crash with NAPI cleanup errors. This is a known Bun issue.

**Solutions:**
1. **Use the pkg binary** (`build-cli.sh`) - This creates a Node.js-based distribution that avoids the Bun crash
2. **Use the run wrapper** (`run-cli.sh`) - This handles the crash gracefully when using Bun directly
3. **Use Node.js directly** - Run the CLI with Node.js instead of Bun

## Quick Start

1. **Build the CLI:**
   ```bash
   ./scripts/build-cli.sh
   ```

2. **Run the CLI:**
   ```bash
   ./packages/cli/dist/bin/pbnj-macos --help
   ```

3. **Generate a chain spec:**
   ```bash
   ./packages/cli/dist/bin/pbnj-macos gen-spec config/dev-config.json output.json
   ```

4. **Install globally (optional):**
   ```bash
   ./scripts/cli-install.sh
   ```

## Alternative: Direct npm commands

You can also use npm commands directly from the CLI directory:

```bash
cd packages/cli
bun run build:binary  # Build binaries
bun run install:binary  # Install globally
```

## File Organization

- **CLI scripts**: `build-cli.sh`, `cli-install.sh` - Build and install scripts for the CLI
- **Testnet scripts**: `*-testnet.sh`, `start-nodes.sh`, `test-single-node.sh` - Testnet management
- **Utility scripts**: `release.sh`, `calculate-genesis-hash.ts` - Other utilities
- **Wrapper scripts**: `run-cli.sh` - Development helpers 