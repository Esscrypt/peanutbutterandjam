# JAM Testnet Setup

This directory contains scripts to set up a JAM testnet with different configurations.

## Prerequisites

1. **Polkajam binaries**: Make sure you have the polkajam binaries in the `./polkajam/` directory
2. **PBNJ CLI**: The PBNJ CLI will be built automatically if needed
3. **Chain spec**: A chain specification file will be generated automatically if needed

## Available Testnet Scripts

### 1. Simple Testnet (`simple-testnet.sh`)
Runs a testnet using only the `polkajam-testnet` binary, which starts multiple validator nodes automatically.

```bash
./simple-testnet.sh
```

**Features:**
- Uses `polkajam-testnet` binary
- Starts multiple validator nodes automatically
- Simple setup with minimal configuration

### 2. Hybrid Testnet (`hybrid-testnet.sh`) ⭐ **Recommended**
Runs one Polkajam node and one PBNJ node together, allowing you to test interoperability between different JAM implementations.

```bash
./hybrid-testnet.sh
```

**Features:**
- One Polkajam node (port 40000)
- One PBNJ node (port 40001)
- Nodes connect via bootnode
- Tests interoperability between implementations

### 3. Custom Testnet (`testnet-setup.sh`)
More detailed setup with additional configuration options.

```bash
./testnet-setup.sh
```

## Network Configuration

### Default Ports
- **Base Port**: 40000 (JAM-NP protocol)
- **Base RPC Port**: 19800 (RPC interface)

### Node Configuration
- **Polkajam Node**: Port 40000, RPC 19800
- **PBNJ Node**: Port 40001, RPC 19801

## Monitoring

### Logs
- **Polkajam**: Check terminal output for logs
- **PBNJ**: Check terminal output for logs

### Data Directories
- **Polkajam**: `./testnet-data/polkajam/`
- **PBNJ**: `./testnet-data/pbnj/`

## Stopping the Testnet

Press `Ctrl+C` in the terminal where you started the testnet. The script will automatically clean up all running processes.

## Troubleshooting

### Common Issues

1. **Binary not found**: Make sure polkajam binaries are in `./polkajam/` directory
2. **Port already in use**: Change the base port in the script
3. **Chain spec issues**: The script will regenerate the chain spec automatically

### Manual Cleanup
If the automatic cleanup doesn't work:

```bash
pkill -f "polkajam"
pkill -f "pbnj-macos"
```

## JAM Networking Protocol

The nodes communicate using the JAM Simple Networking Protocol (JAMNP-S):

- **Protocol**: QUIC with TLS 1.3
- **Authentication**: X.509 certificates with Ed25519 keys
- **Stream Types**: Unique Persistent (UP) and Common Ephemeral (CE) streams
- **Block Announcement**: UP 0 stream for block propagation
- **Work Package Submission**: CE 133 for builders to guarantors

For more details, see the [JAM Networking Specification](../submodules/jam-docs/docs/knowledge/advanced/simple-networking/spec.md).

## Testing Interoperability

The hybrid testnet allows you to test:

1. **Block propagation** between Polkajam and PBNJ nodes
2. **Work package submission** and processing
3. **Validator communication** and consensus
4. **Network protocol compatibility**

## Next Steps

1. Run the hybrid testnet to verify basic connectivity
2. Monitor logs for any protocol mismatches
3. Test work package submission and processing
4. Verify block finalization across both implementations 