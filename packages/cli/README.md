# PeanutButterAndJam CLI

A command-line interface for the PeanutButterAndJam node, implementing the JAM (Just Another Machine) protocol.

## Features

- ✅ **JAM Protocol Compliance** - Full implementation of JAM standard CLI arguments
- ✅ **Standalone Binary** - Self-contained executable for easy deployment
- ✅ **Multi-Platform Support** - macOS, Linux, and Windows binaries
- ✅ **Validator Management** - Generate and manage cryptographic keys
- ✅ **Network Configuration** - Flexible network and RPC settings
- ✅ **Development Tools** - Testing and validation utilities

## Quick Start

### Option 1: Download Pre-built Binary

```bash
# Download the appropriate binary for your platform
# macOS: bundle-macos
# Linux: bundle-linux  
# Windows: bundle-win.exe

# Make executable (macOS/Linux)
chmod +x ./bundle-macos

# Generate keys and start node
./bundle-macos gen-keys
./bundle-macos run
```

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/peanutbutterandjam/peanutbutterandjam.git
cd peanutbutterandjam/packages/cli

# Install dependencies
bun install

# Build standalone binary
bun run build:all

# Install globally (optional)
bun run install:binary
```

## Available Commands

| Command | Description |
|---------|-------------|
| `gen-keys` | Generate cryptographic keys for validators |
| `list-keys` | Display public keys for all validators |
| `gen-spec` | Generate chain specification from config |
| `print-spec` | Display chain specification contents |
| `run` | Start a PeanutButterAndJam node |
| `test-stf` | Run State Transition Function validation |
| `test-refine` | Run refine test for validation |

## JAM Standard Arguments

The CLI implements all JAM standard arguments for compatibility:

### Cryptographic Seeds (Development)
- `--bandersnatch <hex>` - Bandersnatch seed
- `--bls <hex>` - BLS seed  
- `--ed25519 <hex>` - Ed25519 seed

### Configuration
- `--genesis <path>` - Genesis state JSON file
- `--metadata <string>` - Node metadata (default: "Alice")
- `--ts <int>` - Epoch0 Unix timestamp
- `--datadir <string>` - Data directory (JAM standard alias)
- `--validatorindex <int>` - Validator index (JAM standard alias)

### Network
- `--port <int>` - Network listening port (default: 40000)
- `--rpc-port <int>` - RPC listening port (default: 19800)
- `--listen-ip <string>` - Listen IP address
- `--external-ip <string>` - External IP address

## Common Use Cases

### Development Node
```bash
./bundle-macos gen-keys
./bundle-macos run --dev-validator 0
```

### Custom Network
```bash
./bundle-macos gen-spec config/dev-config.json my-chainspec.json
./bundle-macos run --chain my-chainspec.json --port 40001
```

### Multi-Validator Setup
```bash
# Terminal 1
./bundle-macos run --dev-validator 0 --port 40000

# Terminal 2  
./bundle-macos run --dev-validator 1 --port 40001
```

## Build Scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Build TypeScript to JavaScript |
| `bun run build:bundle` | Create bundled JavaScript file |
| `bun run build:binary` | Create standalone binaries |
| `bun run build:all` | Complete build process (recommended) |
| `bun run install:binary` | Install binary globally |

## File Structure

```
packages/cli/
├── src/
│   ├── commands/          # Command implementations
│   ├── utils/             # Utility functions
│   └── index.ts           # Main entry point
├── dist/
│   ├── bin/               # Standalone binaries
│   │   ├── bundle-macos
│   │   ├── bundle-linux
│   │   └── bundle-win.exe
│   └── bundle.js          # Bundled JavaScript
├── build.sh               # Build automation script
├── install.sh             # Installation script
├── USAGE_GUIDE.md         # Comprehensive usage guide
└── JAM_CLI_IMPLEMENTATION.md # JAM compliance documentation
```

## Configuration

### Environment Variables
```bash
export LOG_LEVEL=info
export DATA_PATH=/custom/path
export PORT=40000
```

## Testing

```bash
# Run all tests
bun run test

# Run specific test
bun run test src/__tests__/cli-args.test.ts

# Watch mode
bun run test:watch
```

## Troubleshooting

### Common Issues

1. **"Binary not found"**
   - Ensure you're using the standalone binary
   - Check file permissions: `chmod +x ./bundle-macos`

2. **"Invalid hex string"**
   - Use valid hexadecimal characters (0-9, a-f, A-F)
   - Ensure even length (complete Uint8Array)

3. **"Port already in use"**
   - Change port: `--port 40001`
   - Check for other running instances

### Log Levels
```bash
./bundle-macos run --log-level debug
# Available: trace, debug, info, warn, error
```

## Documentation

- **[Usage Guide](USAGE_GUIDE.md)** - Comprehensive usage examples
- **[JAM Implementation](JAM_CLI_IMPLEMENTATION.md)** - JAM standard compliance details
- **[JAM Protocol](https://graypaper.com)** - Official JAM specification
- **[JAM Documentation](https://docs.jamcha.in)** - Community documentation

## Development

### Prerequisites
- [Bun](https://bun.sh/) - JavaScript runtime
- [Node.js](https://nodejs.org/) - For pkg bundling
- [TypeScript](https://www.typescriptlang.org/) - Development

### Development Workflow
```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Build and test
bun run build:all
bun run test
```

## License

This project is licensed under the same license as the main PeanutButterAndJam project.

## Support

- **Issues**: [GitHub Issues](https://github.com/peanutbutterandjam/peanutbutterandjam/issues)
- **Documentation**: [JAM Documentation](https://docs.jamcha.in)
- **Protocol**: [JAM Gray Paper](https://graypaper.com) 