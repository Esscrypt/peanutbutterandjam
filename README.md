# Peanut Butter AND JAM (PBNJ)

[![Tests](https://github.com/Esscrypt/peanutbutterandjam/actions/workflows/verify.yml/badge.svg)](https://github.com/Esscrypt/peanutbutterandjam/actions/workflows/verify.yml) [![Live site](https://img.shields.io/badge/Website-peanutbutterandjam.xyz-7b2cbf?style=for-the-badge&labelColor=2d1f17)](https://www.peanutbutterandjam.xyz/) [![Gray Paper](https://img.shields.io/badge/Gray_Paper-0.7.2-2d1f17?style=flat)](https://graypaper.com/) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**Production-grade TypeScript/JavaScript implementation of the [JAM](https://graypaper.com/) (Join-Accumulate Machine) protocol.** This monorepo delivers a full JAM node: Safrole consensus, PVM execution, JAMNP-S networking, block authoring and import, and CLI tooling—aligned with the [Gray Paper](https://github.com/gavofyork/graypaper) and validated by official test vectors.

**→ [Documentation & getting started](https://www.peanutbutterandjam.xyz/getting-started)**

### Highlights

- **Gray Paper–aligned** — Safrole consensus, PVM, codec, and networking per the authoritative spec (GP 0.7.2)
- **TypeScript everywhere** — One codebase for Node, Bun, and the browser; type-safe and toolable
- **Production-ready** — Full node services (validator, guarantor, builder, networking), JIP-2 RPC, and CLI
- **Verifiable** — Official [jamtestvectors](https://github.com/gavofyork/jamtestvectors) and erasure/assurance tooling

**Quick start:** `git clone https://github.com/Esscrypt/peanutbutterandjam.git && cd peanutbutterandjam && git submodule update --init --recursive && bun install && bun run build` — then run the node with `bun run infra/node/services/main-service.ts` or the fuzzer with `bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny`. See [Getting Started](#getting-started) and the [live docs](https://www.peanutbutterandjam.xyz/getting-started) for Docker and binaries.

---

## Table of Contents

- [Peanut Butter AND JAM (PBNJ)](#peanut-butter-and-jam-pbnj)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
  - [Building](#building)
    - [Build all workspace packages](#build-all-workspace-packages)
    - [Build the node binary (standalone executable)](#build-the-node-binary-standalone-executable)
    - [Build the fuzzer target (optional)](#build-the-fuzzer-target-optional)
  - [Running the Node](#running-the-node)
    - [Option 1: Run with Bun (development)](#option-1-run-with-bun-development)
  - [Running the Fuzzer](#running-the-fuzzer)
    - [Run with Bun (development)](#run-with-bun-development)
- [Running the Node](#running-the-node-1)
- [Running with RPC server](#running-with-rpc-server)
  - [Running Polkajam](#running-polkajam)
- [if not there already](#if-not-there-already)
  - [Packages](#packages)
  - [Specification Compliance](#specification-compliance)
  - [Documentation](#documentation)
  - [Scripts Reference](#scripts-reference)
  - [Contributing](#contributing)
  - [Repository guidelines](#repository-guidelines)
  - [License](#license)
  - [Support and references](#support-and-references)

---

## Prerequisites

- **[Bun](https://bun.sh/)** (v1.3.x recommended) — primary runtime and package manager
- **Git** — for cloning and submodules
- **[Rust](https://rustup.rs/)** (stable) — required for the Rust PVM native addon (`@pbnjam/pvm-rust-native`) and for building/running the fuzzer with the Rust executor

Initialize submodules (required for Gray Paper and test vectors):

```bash
git submodule update --init --recursive
```

---

## Getting Started

```bash
# Clone the repository
git clone https://github.com/Esscrypt/peanutbutterandjam.git
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

---

## Running the Fuzzer

The fuzzer target uses the **Rust PVM** by default. Ensure the Rust native addon is built (see [Build the fuzzer target](#build-the-fuzzer-target-optional)), then run from the repo root.

### Run with Bun (development)

```bash
# Build Rust PVM addon and fuzzer binary (one step)
bun run build

# Run the fuzzer (e.g. with a Unix socket for the conformance harness)
bun run infra/node/fuzzer-target.ts --socket /tmp/jam_target.sock --spec tiny
```

Or run the compiled binary:

```bash
./bin/fuzzer-target --socket /tmp/jam_target.sock --spec tiny
```

Common options:

- `--socket <path>` — Unix socket path for the fuzzer harness
- `--spec tiny` | `small` | `medium` — chain spec size

See [infra/node/FUZZER_TARGET_DOCKER_QUICKSTART.md](infra/node/FUZZER_TARGET_DOCKER_QUICKSTART.md) for Docker and conformance setup.

---

# Running the Node

```
bun run ./infra/node/services/main-service.ts --validator-index 0 --telemetry 127.0.0.1:9000 --chain config/spec-tiny.json
```

# Running with RPC server
```
bun run ./apis/rpc-server/src/index.ts --validator-index 0 --telemetry 127.0.0.1:9000 --chain config/spec-tiny.json | bunx pino-pretty
```

## Running Polkajam
```
./submodules/polkajam/polkajam --chain=config/spec-tiny.json run --dev-validator 0 --temp

# if not there already
cd submodules/polkajam

./polkajam --chain dev run --telemetry tart-backend:9000 --dev-validator 0 --temp

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

## Contributing

> **NOTE:** We are taking part in the JAM Prize. We do not accept external PRs unless the contributor waives any claims to the prize and copyright for the submitted code. By opening a PR you accept this requirement. See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up your environment, run tests, and submit pull requests. The [Gray Paper](https://graypaper.com/) and `.cursor/rules/` in this repo are the authoritative references for protocol and implementation decisions.

---

## Repository guidelines

This repository follows common open-source practices:

- **CI** — Lint, type-check, and tests run on every pull request ([`.github/workflows/verify.yml`](.github/workflows/verify.yml)).
- **Code style** — [Biome](https://biomejs.dev/) for formatting and linting; run `bun run format` and `bun run lint` before committing.
- **Submodules** — Gray Paper, test vectors, and some packages live in submodules; run `git submodule update --init --recursive` after clone.
- **Documentation** — In-repo docs are under [docs/](docs/README.md); live docs and getting started are at [peanutbutterandjam.xyz](https://www.peanutbutterandjam.xyz/getting-started).
- **Issues** — Use [GitHub Issues](https://github.com/Esscrypt/peanutbutterandjam/issues) for bugs and feature requests; use the [Bug report](.github/ISSUE_TEMPLATE/bug_report.md) or [Feature request](.github/ISSUE_TEMPLATE/feature_request.md) templates when opening an issue.
- **Pull requests** — Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md); ensure CI passes before requesting review.
- **Changelog** — User-facing changes are documented in [CHANGELOG.md](CHANGELOG.md).
- **Code of conduct** — [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) outlines community expectations.
- **Editor** — [.editorconfig](.editorconfig) keeps indentation and line endings consistent across editors.
- **Security** — See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## License

Licensed under the [Apache License 2.0](LICENSE). See [LICENSE](LICENSE) in the repository root.

## Support and references

- **JAM protocol**: [Gray Paper](https://graypaper.com), [community docs](https://docs.jamcha.in)
- **Issues and discussions**: [GitHub](https://github.com/Esscrypt/peanutbutterandjam/issues)
