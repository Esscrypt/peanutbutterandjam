//! Refine invocation context (m, e): machines map and export segments.
//! Mirrors AssemblyScript RefineInvocationContext and PVMGuest for host functions 7–13.

use crate::config::{RESULT_CODE_FAULT, RESULT_CODE_HALT, RESULT_CODE_HOST, RESULT_CODE_OOG, RESULT_CODE_PANIC};
use crate::types::MemoryAccessType;

/// Result of invoking a refine machine (Ω_K). Gray Paper equation 636–652.
#[derive(Clone, Debug)]
pub struct InvokeResult {
    pub result_code: u8,
    /// For HOST: host call ID; for FAULT: fault address; otherwise 0.
    pub extra: u64,
    /// Gas remaining after run (write back to memory).
    pub gas_remaining: u32,
    /// Register state after run (write back to memory).
    pub registers: [u64; 13],
}

impl InvokeResult {
    #[must_use]
    pub const fn halt(gas_remaining: u32, registers: [u64; 13]) -> Self {
        Self {
            result_code: RESULT_CODE_HALT,
            extra: 0,
            gas_remaining,
            registers,
        }
    }
    #[must_use]
    pub const fn panic(gas_remaining: u32, registers: [u64; 13]) -> Self {
        Self {
            result_code: RESULT_CODE_PANIC,
            extra: 0,
            gas_remaining,
            registers,
        }
    }
    #[must_use]
    pub const fn fault(fault_address: u32, gas_remaining: u32, registers: [u64; 13]) -> Self {
        Self {
            result_code: RESULT_CODE_FAULT,
            extra: fault_address as u64,
            gas_remaining,
            registers,
        }
    }
    #[must_use]
    pub const fn oog(gas_remaining: u32, registers: [u64; 13]) -> Self {
        Self {
            result_code: RESULT_CODE_OOG,
            extra: 0,
            gas_remaining,
            registers,
        }
    }
    #[must_use]
    pub const fn host(host_call_id: u32, gas_remaining: u32, registers: [u64; 13]) -> Self {
        Self {
            result_code: RESULT_CODE_HOST,
            extra: host_call_id as u64,
            gas_remaining,
            registers,
        }
    }
}

/// A single PVM guest machine (mirrors PVMGuest). Used by peek, poke, pages, invoke, expunge.
pub trait RefineMachine: Send + Sync {
    /// Read octets from this machine's RAM.
    fn ram_read(&mut self, offset: u32, length: u32) -> Option<Vec<u8>>;
    /// Write octets to this machine's RAM. Returns false on fault.
    fn ram_write(&mut self, offset: u32, data: &[u8]) -> bool;
    /// True if [offset, offset+length) is readable.
    fn ram_is_readable(&self, offset: u32, length: u32) -> bool;
    /// True if [offset, offset+length) is writable.
    fn ram_is_writable(&self, offset: u32, length: u32) -> bool;
    /// Set page access (Gray Paper Ω_Z). page_start, page_count in pages; access 0–4.
    fn set_page_access(&mut self, page_start: u32, page_count: u32, access: u8);
    /// Run machine with gas_limit and initial registers; return result (Gray Paper Ψ).
    fn invoke(&mut self, gas_limit: u32, registers: &[u64; 13]) -> InvokeResult;
    /// Current program counter.
    fn get_pc(&self) -> u64;
}

/// Refine invocation context (m, e): machines and export segments. Gray Paper (m, e).
/// Object-safe: use FnMut callback for machine access (caller can use Cell/RefCell for return values).
pub trait RefineContext: Send + Sync {
    /// Segment offset (segoff) for export return value.
    fn segment_offset(&self) -> i64;
    /// Append a segment; returns Ok(segoff + len(export_segments)) or Err(()) when FULL.
    fn push_export_segment(&mut self, segment: Vec<u8>) -> Result<i64, ()>;
    /// Create a new machine with program and initial PC; returns machine ID.
    fn add_machine(&mut self, program: &[u8], initial_pc: u64) -> u64;
    /// Run closure with mutable reference to machine; returns true if machine existed.
    fn with_machine(&mut self, machine_id: u64, f: &mut dyn FnMut(&mut dyn RefineMachine)) -> bool;
    /// Remove machine; returns Some(pc) if existed, None otherwise (WHO).
    fn remove_machine(&mut self, machine_id: u64) -> Option<u64>;
}

/// Map access mode r (0–4) to MemoryAccessType for pages (Gray Paper 610–614).
#[must_use]
pub const fn pages_access_to_memory_type(r: u8) -> MemoryAccessType {
    match r {
        0 => MemoryAccessType::None,
        1 | 3 => MemoryAccessType::Read,
        2 | 4 => MemoryAccessType::Write,
        _ => MemoryAccessType::None,
    }
}
