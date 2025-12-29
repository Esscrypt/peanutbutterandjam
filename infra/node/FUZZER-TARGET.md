# JAM Fuzzer Target

This document describes how to run the JAM fuzzer target for conformance testing.

## Overview

The `fuzzer-target.ts` implements a fuzzer target that listens on a Unix domain socket and handles fuzzer protocol messages according to the [JAM Conformance Testing Protocol](https://github.com/gavofyork/graypaper/blob/main/fuzz/fuzz-v1.asn).

## Prerequisites

- Bun runtime installed
- Python 3 installed (for minifuzz)
- JAM conformance submodule initialized (`git submodule update --init`)

## Running the Fuzzer Target

### Step 1: Start the Fuzzer Target

In one terminal, start the fuzzer target:

```bash
cd /path/to/peanutbutterandjam
bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
```

**Options:**
- `--socket <path>`: Unix socket path (default: `/tmp/jam_target.sock`)
- `--spec <spec>`: Chain spec to use: `tiny` or `full` (default: `tiny`)
- `--help, -h`: Show help message

### Step 2: Run Minifuzz

In another terminal, run the minifuzz conformance tester:

```bash
cd /path/to/peanutbutterandjam/submodules/jam-conformance/fuzz-proto

# For targets NOT supporting forks:
python3 minifuzz/minifuzz.py -d examples/v1/no_forks --target-sock /tmp/jam_target.sock

# For targets supporting forks:
python3 minifuzz/minifuzz.py -d examples/v1/forks --target-sock /tmp/jam_target.sock
```

## Testing Requirements

According to the JAM Conformance Testing Protocol:

- **Targets supporting forks**: Must pass all fuzzer traces in `examples/v1/forks`
- **Targets not supporting forks**: Must pass all traces in `examples/v1/no_forks`

## Supported Features

The fuzzer target currently supports:
- `FEATURE_ANCESTRY` (0x01): Ancestry lookup for guarantees extrinsic validation
- `FEATURE_FORKS` (0x02): Simple fork handling

## Protocol Flow

```
          Fuzzer                    Target
             |                         |
         +---+--- HANDSHAKE -----------+---+
         |   |      PeerInfo           |   |
         |   | ----------------------> |   |
         |   |      PeerInfo           |   |
         |   | <---------------------- |   |
         +---+-------------------------+---+
             |                         |
         +---+--- INITIALIZATION ------+---+
         |   |       Initialize        |   |
         |   | ----------------------> |   | Initialize target
         |   |        StateRoot        |   |
         |   | <---------------------- |   | Return state root
         +---+-------------------------+---+
             |                         |
         +---+--- BLOCK PROCESSING ----+---+
         |   |      ImportBlock        |   |
         |   | ----------------------> |   | Process block
         |   |   StateRoot (or Error)  |   |
         |   | <---------------------- |   | Return state root
         +---+-------------------------+---+
```

## Troubleshooting

### Socket already in use

If you see "Socket is already in use", remove the existing socket:

```bash
rm /tmp/jam_target.sock
```

### Minifuzz not found

Make sure you're running the Python script, not the directory:

```bash
# Wrong:
python3 minifuzz

# Correct:
python3 minifuzz/minifuzz.py
```

## References

- [JAM Conformance Testing Protocol README](../../submodules/jam-conformance/fuzz-proto/README.md)
- [Fuzz Protocol Schema](../../submodules/jam-conformance/fuzz-proto/fuzz-v1.asn)
- [Gray Paper](https://graypaper.com/)


