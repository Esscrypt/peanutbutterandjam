# Host function equivalence: AssemblyScript vs Rust

This document tracks parity between `pvm-assemblyscript` and `pvm-rust` host function implementations.  
**AS** = `packages/pvm-assemblyscript/assembly/host-functions/`  
**Rust** = `packages/pvm-rust/src/host_functions/`

---

## General host functions

Each general host lives in its own file under `host_functions/general/`. Logic matches AS 1:1 for register layout and memory use. `HostFunctionContext` may carry optional params (`service_id`, `accounts`, `service_account`, `lookup_timeslot`); when absent (e.g. run_blob), Rust returns the same as AS with no params (NONE, PANIC).

| ID | Name        | AS path              | Rust path              | Equivalence notes |
|----|-------------|----------------------|------------------------|-------------------|
| 0  | gas         | general/gas.ts       | general/gas.rs         | 1:1: r7=gas, deduct 10. |
| 1  | fetch       | general/fetch.ts     | general/fetch.rs       | Selector 0 uses config (`FetchSystemConstantsConfig` + constants). Other selectors return NONE (no workPackage/params). |
| 2  | lookup      | general/lookup.ts    | general/lookup.rs      | Full 1:1 when `accounts`/`service_id` present: resolve account, preimage by hash (codec `get_preimage_value`), write slice, r7=len. No params → r7=NONE. |
| 3  | read        | general/read.ts      | general/read.rs        | Full 1:1 when `accounts`/`service_id` present: resolve account, key at r8..r9, storage via `get_storage_value`, write slice at r10 (from r11, length r12), r7=len. No params → r7=NONE. |
| 4  | write       | general/write.ts     | general/write.rs       | Full 1:1 when `service_account`/`service_id` present: key r7..r8, value r9..r10; deposit check (C_BASE_DEPOSIT/C_ITEM_DEPOSIT/C_BYTE_DEPOSIT); set/delete storage, update items/octets; r7=previous len or REG_FULL. No params → PANIC. |
| 5  | info        | general/info.ts      | general/info.rs        | Full 1:1 when `accounts`/`service_id` present: resolve account, encode 96-byte info (codehash, balance, minbalance, minaccgas, minmemogas, octets, items, gratis, created, lastacc, parent), write slice, r7=96. No params → PANIC. |
| 6  | historical_lookup | general/historical-lookup.ts | general/historical_lookup.rs | Full 1:1 when `accounts`/`service_id`/`lookup_timeslot` present: resolve account, hash at r8, histlookup (preimage + request timeslots + I(l,t)), write slice, r7=len. No params → PANIC. |
| 7  | export      | general/export.ts    | general/export.rs      | Full 1:1 when `refine_context` present: r7=offset, r8=length; read memory, zero-pad to SEGMENT_SIZE, push_export_segment; r7=segoff+len or REG_FULL. No refine → PANIC. |
| 8  | machine     | general/machine.ts   | general/machine.rs     | Full 1:1 when `refine_context` present: read program (r7, r8), initial_pc=r9; gas 10; add_machine; r7=machine_id. No refine → PANIC. |
| 9  | peek        | general/peek.ts      | general/peek.rs        | Full 1:1 when `refine_context` present: n=r7, dest=r8, source=r9, len=r10; copy machine RAM → current RAM; r7=WHO/OOB/OK. No refine → r7=WHO, PANIC. |
| 10 | poke        | general/poke.ts      | general/poke.rs        | Full 1:1 when `refine_context` present: n=r7, source=r8, dest=r9, len=r10; copy current RAM → machine RAM; r7=WHO/OOB/OK. No refine → r7=WHO, PANIC. |
| 11 | pages       | general/pages.ts     | general/pages.rs       | Full 1:1 when `refine_context` present: n=r7, p=r8, c=r9, r=r10; set_page_access; r7=WHO/HUH/OK. No refine → PANIC. |
| 12 | invoke      | general/invoke.ts    | general/invoke.rs      | Full 1:1 when `refine_context` present: n=r7, o=r8; read gas+regs from memory[o:112], invoke machine, write back; r7=result, r8=extra. No refine → PANIC. |
| 13 | expunge     | general/expunge.ts   | general/expunge.rs     | Full 1:1 when `refine_context` present: n=r7; remove_machine; r7=WHO and HALT if missing, else r7=pc. No refine → PANIC. |
| 100| log         | general/log.ts       | general/log.rs         | 1:1: level r7, target r8..r9, message r10..r11 from memory; UTF-8 lossy decode; format and log all levels; fault → continue. |

---

## Read, Write, LOG: Rust vs TypeScript

- **READ (3)**  
  - **TypeScript** (`packages/pvm/src/host-functions/general/read.ts`): service from r7 or self, key at r8..r9, output at r10, slice from r11 length r12; storage via `getServiceStorageValue`; r7 = length or NONE.  
  - **Rust** (`general/read.rs`): Same register layout and logic; uses `get_storage_value` from codec; no params → r7=NONE.  
  - **Missing in Rust:** Nothing; behavior is 1:1 when `service_id`/`accounts` are provided.

- **WRITE (4)**  
  - **TypeScript** (`packages/pvm/src/host-functions/general/write.ts`): key r7..r8, value r9..r10; deposit/balance via `calculateMinBalance`; set/delete storage; r7 = previous length or FULL.  
  - **Rust** (`general/write.rs`): Same; uses `C_BASE_DEPOSIT`, `C_ITEM_DEPOSIT`, `C_BYTE_DEPOSIT`, `get_storage_value`/`set_storage_value`/`delete_storage_value`.  
  - **Missing in Rust:** Nothing; 1:1 when `service_account`/`service_id` are provided.

- **LOG (100)**  
  - **TypeScript** (`packages/pvm/src/host-functions/general/log.ts`): JIP-1; level r7, target r8..r9, message r10..r11; `TextDecoder` UTF-8 (fatal: false); logs all levels; calls `context.log('PVM Log', jsonLog)` for structured host logs.  
  - **Rust** (`general/log.rs`): Same semantics; UTF-8 via `String::from_utf8_lossy`; invalid memory → continue (no side effect); all levels printed. Rust has no `context.log` callback, so structured PVM Log entries are not appended to a host-log buffer (executor still records the host *call* in traceHostFunctionLogs when status=HOST).

---

## Accumulate host functions

Rust has no `AccumulateHostFunctionContext` (no implications, timeslot, etc.) in the current host context. Each accumulate host is in its own file under `host_functions/accumulate/`. They follow AS register/memory layout; memory faults → PANIC; when logic would need implications they set r7 to the same error code as AS (WHO, HUH, CORE, OOB, NONE) and continue.

| ID | Name       | AS path                | Rust path             | Equivalence notes |
|----|------------|------------------------|------------------------|-------------------|
| 14 | bless      | accumulate/bless.ts   | accumulate/bless.rs    | Read assigners/accessors; validate service IDs; no implications → HUH. |
| 15 | assign     | accumulate/assign.ts  | accumulate/assign.rs   | Read auth queue; check core/service; no implications → HUH (or CORE/WHO first). |
| 16 | designate  | accumulate/designate.ts | accumulate/designate.rs | Read validators; no implications → HUH. |
| 17 | checkpoint | accumulate/checkpoint.ts | accumulate/checkpoint.rs | r7 = gas counter; no imY copy. |
| 18 | new        | accumulate/new.ts     | accumulate/new.rs      | Read code hash; no implications → HUH. |
| 19 | upgrade    | accumulate/upgrade.ts | accumulate/upgrade.rs  | No implications → HUH. |
| 20 | transfer   | accumulate/transfer.ts | accumulate/transfer.rs | Read memo; no implications → HUH. |
| 21 | eject      | accumulate/eject.ts  | accumulate/eject.rs    | Read hash; no implications → WHO. |
| 22 | query      | accumulate/query.ts   | accumulate/query.rs    | Read hash; no implications → NONE, r8=0. |
| 23 | solicit    | accumulate/solicit.ts | accumulate/solicit.rs  | No implications → HUH. |
| 24 | forget     | accumulate/forget.ts  | accumulate/forget.rs   | No implications → HUH. |
| 25 | yield      | accumulate/yield.ts   | accumulate/yield_.rs   | No implications → HUH. |
| 26 | provide    | accumulate/provide.ts | accumulate/provide.rs  | No implications → HUH. |

---

## Config alignment (FETCH selector 0)

Rust uses:

- **Constants** in `config.rs`: `C_ITEM_DEPOSIT`, `C_BYTE_DEPOSIT`, `C_BASE_DEPOSIT`, `C_REPORT_ACC_GAS`, `C_MAX_REPORT_DEPS`, `C_MAX_REPORT_VAR_SIZE`, `C_AUTH_POOL_SIZE`, `C_AUTH_QUEUE_SIZE`, `PACKAGE_AUTH_GAS`, `MAX_AUTH_CODE_SIZE`, `C_MAX_PACKAGE_*`, `C_ROTATION_PERIOD`, `C_ASSURANCE_TIMEOUT_PERIOD`, `C_MEMO_SIZE`, `C_MAX_BUNDLE_SIZE`, `MAX_SERVICE_CODE_SIZE`, `C_MAX_PACKAGE_IMPORTS`, `C_MAX_PACKAGE_EXPORTS`, etc.
- **Runtime config**: `FetchSystemConstantsConfig` (num_cores, preimage_expunge_period, epoch_duration, max_refine_gas, max_block_gas, max_tickets_per_extrinsic, max_lookup_anchorage, tickets_per_validator, slot_duration, rotation_period, num_validators, ec_piece_size, num_ec_pieces_per_segment, contest_duration) with `Default` matching AS-style defaults.

AS uses `pvmInstance` (config*) and `DEPOSIT_CONSTANTS`, `WORK_REPORT_CONSTANTS`, etc. from `pbnj-types-compat`. Rust mirrors these via config constants and `FetchSystemConstantsConfig`.

---

## Register / error code mapping

- **Continue**: result_code 255.
- **r7 error codes (u64)**: `REG_NONE` = u64::MAX, `REG_FULL` = 2^64-5, `REG_WHO` = 2^64-4, `REG_OOB` = 2^64-3, `REG_HUH` = 2^64-9, `REG_OK` = 0 (in `config.rs`).

---

---

## Refine context (host functions 7–13)

When running with a refine invocation (e.g. package refine step), the executor sets `HostFunctionContext.refine_context` to an implementation of the `RefineContext` trait (`host_functions/refine.rs`). This provides:

- **Export segments** and **segment_offset** for EXPORT (7).
- **Machines** map for MACHINE (8), PEEK (9), POKE (10), PAGES (11), INVOKE (12), EXPUNGE (13).

Traits:

- `RefineContext`: `segment_offset`, `push_export_segment`, `add_machine`, `with_machine`, `remove_machine`.
- `RefineMachine`: `ram_read`, `ram_write`, `ram_is_readable`, `ram_is_writable`, `set_page_access`, `invoke`, `get_pc`.

When `refine_context` is `None` (e.g. `run_blob`), export/machine/pages/invoke/expunge return PANIC; peek/poke set r7=WHO and return PANIC.

---

*Last updated: LOOKUP, READ, WRITE, INFO, HISTORICAL_LOOKUP implemented 1:1 with AS when context provides service_id/accounts/service_account/lookup_timeslot. Export, machine, peek, poke, pages, invoke, expunge implemented 1:1 when context provides refine_context (RefineContext/RefineMachine traits).*
