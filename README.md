# PeanutButterAndJam (PBNJ)

A production-grade TypeScript/JavaScript implementation of the **JAM (Just Another Machine)** protocol as specified in the [Gray Paper](https://github.com/gavofyork/graypaper). This monorepo provides a full JAM node: consensus (Safrole), PVM execution, networking, block authoring and import, and CLI tooling.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Building](#building)
- [Running the Node](#running-the-node)
- [Packages](#packages)
- [Specification Compliance](#specification-compliance)
- [Documentation](#documentation)

---

## Prerequisites

- **[Bun](https://bun.sh/)** (v1.3.x recommended) — primary runtime and package manager
- **Git** — for cloning and submodules

Initialize submodules (required for Gray Paper and test vectors):

```bash
git submodule update --init --recursive
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/peanutbutterandjam/peanutbutterandjam.git
cd peanutbutterandjam

# Install dependencies (Bun)
bun install

# Initialize submodules
git submodule update --init --recursive

# Build all packages
bun run build
```

Copy environment defaults and adjust if needed:

```bash
cp .env.example .env
```

---

## Building

### Build all workspace packages

Builds every package in the monorepo:

```bash
bun run build
```

### Build the node binary (standalone executable)

Produces a single compiled binary for the JAM node:

```bash
bun run build:main
```

Output: `./bin/main-service` (Bun-compiled executable).

### Build the CLI binary (multi-platform)

Produces standalone CLI binaries for running the node, generating keys, and chain spec:

```bash
./scripts/build-cli.sh
```

Or from the CLI package:

```bash
cd packages/cli && bun run build:binary
```

Binaries are written to `packages/cli/dist/bin/` (e.g. `pbnj-macos`, `pbnj-linux`, `pbnj-win.exe`).

### Build the fuzzer target (optional)

For fuzz testing:

```bash
bun run build:fuzzer
```

Output: `./bin/fuzzer-target`.

The fuzzer uses the **Rust PVM** by default (`useRust: true`). The `build:fuzzer` script only compiles the fuzzer TypeScript; it does **not** build the Rust native addon. To avoid "Rust native module not available" when running the fuzzer, build the native module first:

```bash
cd packages/pvm-rust && bun run build
```

Then run the fuzzer from the repo root (e.g. `./bin/fuzzer-target` or `bun run infra/node/fuzzer-target.ts`) so `require('@pbnjam/pvm-rust-native/native')` can resolve to the built `.node` file in `packages/pvm-rust/native/`. To build both in one step: `bun run build:fuzzer:with-rust`.

---

## Running the Node

### Option 1: Run with Bun (development)

From repo root, run the main service entry point:

```bash
bun run infra/node/services/main-service.ts
```

Or use the compiled binary after `bun run build:main`:

```bash
./bin/main-service
```

### Option 2: Run via CLI binary

After building the CLI (`./scripts/build-cli.sh`):

```bash
# Generate validator keys (if needed)
./packages/cli/dist/bin/pbnj-macos gen-keys   # or pbnj-linux / pbnj-win.exe

# Run node (default: port 40000, RPC 19800)
./packages/cli/dist/bin/pbnj-macos run

# Run with a specific validator index (dev)
./packages/cli/dist/bin/pbnj-macos run --dev-validator 0

# Custom ports
./packages/cli/dist/bin/pbnj-macos run --port 40001 --rpc-port 19801
```

### Environment variables

- `LOG_LEVEL` — `trace` | `debug` | `info` | `warn` | `error`
- `DATA_PATH` / `--datadir` — Data directory for chain state
- `OTEL_EXPORTER_OTLP_ENDPOINT` — OpenTelemetry endpoint (optional)
- See `.env.example` and [packages/cli/README.md](packages/cli/README.md) for more.

---

## Packages

| Package | Purpose |
|---------|---------|
| **@pbnjam/core** | Shared utilities, hashing, crypto, logging |
| **@pbnjam/types** | Centralized JAM protocol types and interfaces |
| **@pbnjam/codec** | Gray Paper–compliant serialization (blocks, headers, state, PVM) |
| **@pbnjam/cli** | Command-line interface: `run`, `gen-keys`, `gen-spec`, `print-spec`, `test-stf`, `test-refine` |
| **@pbnjam/safrole** | Safrole consensus: tickets, fallback sealing, epoch markers, VRF-based block sealing |
| **@pbnjam/bandersnatch** | Bandersnatch curve primitives |
| **@pbnjam/bandersnatch-vrf** | Bandersnatch VRF (IETF, Pedersen, Ring) — provers/verifiers, WASM bindings |
| **@pbnjam/pvm** | PVM (Para Virtual Machine) host and execution orchestration |
| **@pbnjam/pvm-assemblyscript** | PVM implementation in AssemblyScript (compiles to WebAssembly) |
| **@pbnjam/pvm-invocations** | PVM invocations (accumulate, refine, etc.) and WASM/TS execution adapters |
| **@pbnjam/block-importer** | Block and header validation, seal and VRF verification |
| **@pbnjam/block-authoring** | Block authoring: entropy signature, ticket extrinsics |
| **@pbnjam/networking** | JAM Simple Networking Protocol (JAMNP-S) |
| **@pbnjam/genesis** | Genesis state and chain spec handling |
| **@pbnjam/events** | Event bus for node services |
| **@pbnjam/erasure-coding** | Erasure coding for JAM data availability |
| **@pbnjam/accumulate** | Accumulation logic for JAM protocol |
| **@pbnjam/assurance** | Assurance-related types and logic |
| **@pbnjam/audit** | Audit and audit-signature utilities |
| **@pbnjam/disputes** | Dispute handling and signatures |
| **@pbnjam/guarantor** | JAM Guarantor implementation |
| **@pbnjam/telemetry** | JIP-3 telemetry for JAM nodes |

Additional workspace roots: `config/*`, `apis/*`, `infra/*`, `scripts`. The runnable node and services live under **infra/node** (e.g. `main-service.ts`).

---

## Specification Compliance

This project follows the [JAM Gray Paper](https://graypaper.com/) and related specs:

- **Gray Paper** — `submodules/graypaper/` (authoritative protocol specification)
- **Test vectors** — `submodules/jamtestvectors/` (official validation)
- **Bandersnatch VRF** — `submodules/ark-vrf/`, `submodules/bandersnatch-vrf-spec/`
- **Implementation and adherence** — see `.cursor/rules/` (e.g. Gray Paper adherence, JAM implementation guide, Bandersnatch VRF guide)

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Development workflow and Gray Paper usage |
| [docs/TESTING.md](docs/TESTING.md) | Testing and test vectors |
| [docs/RELEASE.md](docs/RELEASE.md) | Release and CLI distribution |
| [packages/cli/README.md](packages/cli/README.md) | CLI usage, commands, and JAM arguments |

---

## Scripts Reference

| Command | Description |
|---------|-------------|
| `bun run build` | Build all workspace packages (Turbo) |
| `bun run build:main` | Compile node binary to `./bin/main-service` |
| `bun run build:fuzzer` | Compile fuzzer to `./bin/fuzzer-target` |
| `bun run test` | Run tests across packages |
| `bun run lint` | Run Biome lint |
| `bun run format` | Format code with Biome |
| `./scripts/build-cli.sh` | Build CLI binaries in `packages/cli/dist/bin/` |

---

## License

Same license as the root repository. See [LICENSE](LICENSE) if present.

## Support and references

- **JAM protocol**: [Gray Paper](https://graypaper.com), [community docs](https://docs.jamcha.in)
- **Issues**: [GitHub Issues](https://github.com/peanutbutterandjam/peanutbutterandjam/issues)
