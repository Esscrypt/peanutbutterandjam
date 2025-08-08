# PeanutButterAndJAM Monorepo

A TypeScript implementation of the JAM (Just Another Machine) protocol as specified in the [Gray Paper](https://github.com/gavofyork/graypaper).

## Specification Compliance

This project strictly adheres to the [JAM Gray Paper](https://graypaper.com/) specification:

- **Gray Paper**: `submodules/graypaper/` submodule - The authoritative JAM protocol specification
- **Test Vectors**: `submodules/jamtestvectors/` submodule - Official test vectors for validation
- **Bandersnatch VRF**: `submodules/ark-vrf/` and `submodules/bandersnatch-vrf-spec/` - VRF implementation and specification
- **Implementation Guide**: [JAM Implementation Guide](.cursor/rules/jam-implementation-guide.mdc)
- **Adherence Rules**: [Gray Paper Adherence Rules](.cursor/rules/graypaper-adherence.mdc)
- **VRF Implementation**: [Bandersnatch VRF Implementation Guide](.cursor/rules/bandersnatch-vrf-implementation.mdc)

## 📚 Documentation

- **[Documentation Index](docs/README.md)** - Complete documentation overview
- **[Development Guide](docs/DEVELOPMENT.md)** - Development setup and guidelines
- **[Testing Guide](docs/TESTING.md)** - Testing against JAM test vectors
- **[Release Guide](docs/RELEASE.md)** - Release procedures and CLI downloads

## 🚀 Quick Start

### Testnet Setup
```bash
# Run hybrid testnet (Polkajam + PBNJ)
./scripts/hybrid-testnet.sh

# Or run simple testnet
./scripts/simple-testnet.sh
```

### Multi-Node Setup
```bash
# Start multiple nodes with observability
./scripts/start-nodes.sh

# Test single node
./scripts/test-single-node.sh
```

See **[Testnet Documentation](docs/TESTNET_README.md)** for detailed setup instructions.

## Packages

- `@pbnj/core` - Core types and utilities
- `@pbnj/cli` - Command-line interface
- `@pbnj/safrole` - Safrole consensus protocol implementation
- `@pbnj/bandersnatch-vrf` - Bandersnatch VRF implementation
- `@pbnj/pvm` - Polkadot Virtual Machine
- `@pbnj/rpc-server` - RPC server implementation
