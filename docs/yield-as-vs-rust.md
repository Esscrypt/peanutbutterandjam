# How yield is set internally: AssemblyScript (AS) vs Rust

## AssemblyScript / TypeScript PVM (`packages/pvm`)

- **YIELD (host 25)**  
  - Reads 32-byte hash from memory at `r7`.  
  - Sets **imX.yield** only: `imX.yield = hashData`  
  - (`packages/pvm/src/host-functions/accumulate/yield.ts`)

- **CHECKPOINT (host 17)**  
  - **imY' = imX**: deep copy of current imX into imY (including `imX.yield` at that moment).  
  - So **imY.yield** is only updated at CHECKPOINT time; it is the yield that existed when the checkpoint was taken.  
  - (`packages/pvm/src/host-functions/accumulate/checkpoint.ts`)

- **Returned context**  
  - The implications pair `[imX, imY]` is returned as-is.  
  - imX has the current yield (from the last YIELD).  
  - imY has the snapshot yield (from the last CHECKPOINT).  
  - On PANIC/OOG, collapse uses **imY**; so the yield used is the checkpoint snapshot, not necessarily the latest YIELD.

## Rust PVM (`packages/pvm-rust`)

- **YIELD (host 25)**  
  - Reads 32-byte hash from memory; sets **state.yield_hash** (single global).  
  - (`host_functions/accumulate/yield_.rs`: `*context.yield_hash = Some(hash_data)`)

- **CHECKPOINT (host 17)**  
  - Sets `checkpoint_requested = true`.  
  - After the host returns, the step loop runs:  
    - `snapshot = build_current_regular_implications(state)` (includes `state.yield_hash` at that moment),  
    - `state.accumulation_implications_exceptional = Some(snapshot)`.  
  - So **imY** is correctly a snapshot of imX at checkpoint time (including yield at that time).  
  - (`state_wrapper.rs` ~776–780)

- **Returned context (`get_accumulation_context_encoded`)**  
  - **Bug**: both dimensions are overwritten with the **current** yield:
    - `regular.yield_hash = yield_hash` (correct),
    - `exceptional.yield_hash = yield_hash.clone()` (wrong).  
  - So imY is overwritten with the current `state.yield_hash` instead of keeping the snapshot’s yield.  
  - On PANIC/OOG, collapse uses imY; in Rust we were therefore returning the latest yield for imY, not the checkpoint yield, unlike AS.

## Fix (Rust)

In `get_accumulation_context_encoded`, do **not** set `exceptional.yield_hash = yield_hash`.  
Keep the exceptional dimension as the checkpoint snapshot (it already has the correct yield from when the snapshot was taken). Only set `regular.yield_hash = yield_hash` so imX has the current yield.
