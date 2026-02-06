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
bun run build            # release native addon (no extra logging)
bun run build:with-log-host  # eprintln when LOG host call (selector 100) runs
bun run build:with-logs  # eprintln for other host calls (SOLICIT, etc.)
bun run build:with-logs-errors  # eprintln only on error paths (PANIC, HUH, FULL)
bun run build:with-all-logs  # both features above
bun run build:debug      # debug build
bun run artifacts        # emit napi artifacts
```

Requires Rust toolchain and `@napi-rs/cli` (via `bunx napi build`). Output goes to `native/` for the current platform.

### Host-call logging (feature flags)

Logging is **compile-time removed** by default: no runtime cost when features are off.

- **`log_host_call_logging`** — eprintln when the LOG host function (selector 100) runs.  
  Script: `bun run build:with-log-host`.
- **`host_calls_logging`** — eprintln for all other host-call sites (SOLICIT, etc.) via the `host_log!` macro.  
  Script: `bun run build:with-logs`.
- **`host_calls_errors_only`** — eprintln only on error paths (PANIC, HUH, FULL) via the `host_log_error!` macro.  
  Script: `bun run build:with-logs-errors`.
- **Both (full + LOG):** `bun run build:with-all-logs` (or `--features log_host_call_logging,host_calls_logging`).

## Usage

After building, the native addon is loaded from `./native` (e.g. `require('./native')`). Export names match the camelCase NAPI convention (e.g. `init`, `getProgramCounter`, `accumulateInvocation`). Use the same calling convention as the AssemblyScript WASM module; implementation is currently stubs for structure parity.

## NAPI

Uses `napi` v2 and `napi-derive` like `packages/bandersnatch-vrf/rust-ring-proof`. Supported triples: defaults plus `aarch64-apple-darwin`, `x86_64-apple-darwin`, `x86_64-unknown-linux-gnu`, `aarch64-unknown-linux-gnu`.
