# PVM Rust tests

Tests copied from `packages/pvm-assemblyscript/tests` and adapted to use the Rust native binding (`@pbnjam/pvm-rust-native/native`) instead of WASM.

- **native-load.test.ts** – Smoke test: loads the native addon and calls `init` / `getProgramCounter`. Run with: `bun test packages/pvm-rust/tests/native-load.test.ts`
- **riscv-programs-rust.test.ts** – Same as `riscv-rust.test.ts` but loads all `riscv*.json` files explicitly; currently **skipped** (use `riscv-rust.test.ts` for RISC-V tests).
- **riscv-rust.test.ts** – RISC-V integration tests (migrated from `pvm/src/instructions/__tests__/riscv.test.ts`). Uses `loadTestVectorsByPrefix('riscv_')` and `executeTestVectorRust`.
- **all-programs-rust.test.ts** – All non-RISC-V program test vectors (migrated from `pvm/src/instructions/__tests__/all-programs.test.ts`).

## Prerequisites

1. Build the native addon: `cd packages/pvm-rust && bun run build`
2. For RISC-V tests: clone or ensure `submodules/pvm-test-vectors` exists at the repo root (same as pvm-assemblyscript tests).

## Running tests

From repo root:

```bash
bun test packages/pvm-rust/tests/native-load.test.ts
bun test packages/pvm-rust/tests/
```
