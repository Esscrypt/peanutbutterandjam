# @pbnjam/pvm-rust

PVM implementation in Rust, exposed via NAPI. Same API surface as `@pbnjam/pvm-assemblyscript` (WASM), so it can be used as a drop-in native backend.

## Structure

Mirrors `packages/pvm-assemblyscript`:

- `src/config.rs` — constants (gas, memory, result codes)
- `src/types.rs` — ExecutionResult, RunProgramResult, AccumulateInvocationResult, MemoryAccessType
- `src/codec/` — codec (stub; to be ported from AssemblyScript)
- `src/crypto.rs` — crypto helpers (stub)
- `src/ram.rs`, `simple_ram.rs`, `mock_ram.rs` — RAM backends (stubs)
- `src/host_functions/` — general and accumulate host functions (stubs)
- `src/instructions/` — instruction set and registry (stubs)
- `src/parser.rs` — program parser (stub)
- `src/pvm.rs` — PVM core (stub)
- `src/state_wrapper.rs` — singleton state (RAMType, Status, PvmState)
- `src/lib.rs` — NAPI exports (init, reset, nextStep, getProgramCounter, etc.)

## Build

```bash
bun run build          # release native addon
bun run build:debug    # debug build
bun run artifacts      # emit napi artifacts
```

Requires Rust toolchain and `@napi-rs/cli` (via `bunx napi build`). Output goes to `native/` for the current platform.

## Usage

After building, the native addon is loaded from `./native` (e.g. `require('./native')`). Export names match the camelCase NAPI convention (e.g. `init`, `getProgramCounter`, `accumulateInvocation`). Use the same calling convention as the AssemblyScript WASM module; implementation is currently stubs for structure parity.

## NAPI

Uses `napi` v2 and `napi-derive` like `packages/bandersnatch-vrf/rust-ring-proof`. Supported triples: defaults plus `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`.
