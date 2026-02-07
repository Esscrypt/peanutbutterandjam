//! PVM type definitions (mirrors assembly/types.ts).


/// Register state: 13 × 64-bit registers (r0–r12).
pub type RegisterState = [u64; 13];

// ============================================================================
// Instruction execution result
// ============================================================================

/// Instruction execution result. -1 = continue; >= 0 = halt with result code.
#[derive(Clone, Debug, Default)]
pub struct InstructionResult {
    /// -1 = continue, >= 0 = halt/panic/fault/etc.
    pub result_code: i32,
    pub fault_address: u32,
    pub has_fault_address: bool,
}

impl InstructionResult {
    pub const CONTINUE: i32 = -1;

    #[must_use]
    pub const fn new(result_code: i32, fault_address: u32) -> Self {
        Self {
            result_code,
            fault_address,
            has_fault_address: fault_address != 0,
        }
    }

    #[must_use]
    pub const fn should_continue(&self) -> bool {
        self.result_code == Self::CONTINUE
    }

    #[must_use]
    pub const fn get_code(&self) -> i32 {
        self.result_code
    }
}

// ============================================================================
// RAM operation results
// ============================================================================

/// Read result for RAM operations.
#[derive(Clone, Debug)]
pub struct ReadResult {
    pub data: Option<Vec<u8>>,
    pub fault_address: u32,
}

impl ReadResult {
    #[must_use]
    pub fn new(data: Option<Vec<u8>>, fault_address: u32) -> Self {
        Self {
            data,
            fault_address,
        }
    }
}

/// Fault check result for RAM operations.
#[derive(Clone, Debug)]
pub struct FaultCheckResult {
    pub success: bool,
    pub fault_address: u32,
}

impl FaultCheckResult {
    #[must_use]
    pub const fn new(success: bool, fault_address: u32) -> Self {
        Self {
            success,
            fault_address,
        }
    }
}

/// Write result for RAM operations.
#[derive(Clone, Debug)]
pub struct WriteResult {
    pub has_fault: bool,
    pub fault_address: u32,
}

impl WriteResult {
    #[must_use]
    pub const fn new(has_fault: bool, fault_address: u32) -> Self {
        Self {
            has_fault,
            fault_address,
        }
    }
}

// ============================================================================
// Execution result (marshalling invocations)
// ============================================================================

/// Execution result: result_type 0 = data, 1 = PANIC, 2 = OOG.
#[derive(Clone, Debug)]
pub struct ExecutionResult {
    pub result_type: u8,
    pub data: Vec<u8>,
}

impl ExecutionResult {
    pub const TYPE_DATA: u8 = 0;
    pub const TYPE_PANIC: u8 = 1;
    pub const TYPE_OOG: u8 = 2;

    #[must_use]
    pub fn from_data(data: Vec<u8>) -> Self {
        Self {
            result_type: Self::TYPE_DATA,
            data,
        }
    }

    #[must_use]
    pub fn from_panic() -> Self {
        Self {
            result_type: Self::TYPE_PANIC,
            data: vec![],
        }
    }

    #[must_use]
    pub fn from_oog() -> Self {
        Self {
            result_type: Self::TYPE_OOG,
            data: vec![],
        }
    }

    #[must_use]
    pub const fn is_panic(&self) -> bool {
        self.result_type == Self::TYPE_PANIC
    }

    #[must_use]
    pub const fn is_oog(&self) -> bool {
        self.result_type == Self::TYPE_OOG
    }

    #[must_use]
    pub const fn is_data(&self) -> bool {
        self.result_type == Self::TYPE_DATA
    }
}

// ============================================================================
// Run program / accumulate results
// ============================================================================

/// Result of runProgram() (mirrors RunProgramResult).
#[derive(Clone, Debug)]
pub struct RunProgramResult {
    pub gas_consumed: u32,
    pub result: ExecutionResult,
}

/// Result of accumulateInvocation() (mirrors AccumulateInvocationResult).
#[derive(Clone, Debug)]
pub struct AccumulateInvocationResult {
    pub gas_consumed: u32,
    pub result: ExecutionResult,
    pub output: Vec<u8>,
}

// ============================================================================
// Memory access type
// ============================================================================

/// Memory access type (mirrors MemoryAccessType).
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MemoryAccessType {
    None = 0,
    Read = 1,
    Write = 2,
}

// ============================================================================
// RAM trait (interface for memory backends)
// ============================================================================

/// RAM interface for memory operations (mirrors assembly/types.ts RAM).
pub trait Ram: Send + Sync {
    fn read_octets(&mut self, address: u32, count: u32) -> ReadResult;
    fn write_octets(&mut self, address: u32, values: &[u8]) -> WriteResult;
    fn current_heap_pointer(&self) -> u32;
    /// Set heap pointer (used by SBRK). Gray Paper: advance heap for allocation.
    fn set_current_heap_pointer(&mut self, value: u32);
    fn allocate_pages(&mut self, start_page: u32, count: u32);
    fn is_readable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult;
    fn initialize_memory_layout(
        &mut self,
        argument_data: &[u8],
        read_only_data: &[u8],
        read_write_data: &[u8],
        stack_size: u32,
        heap_zero_padding_size: u32,
    );
    fn is_writable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult;
    fn set_page_access_rights(&mut self, address: u32, length: u32, access_type: MemoryAccessType);
    fn init_page(&mut self, address: u32, length: u32, access_type: MemoryAccessType);
    fn write_octets_during_initialization(&mut self, address: u32, values: &[u8]);
    fn get_page_dump(&self, page_index: u32) -> Vec<u8>;
    fn reset(&mut self);
    fn last_load_address(&self) -> u32;
    fn last_load_value(&self) -> u64;
    fn last_store_address(&self) -> u32;
    fn last_store_value(&self) -> u64;
    fn clear_last_memory_op(&mut self);
}

// ============================================================================
// Instruction context (code, bitmask, registers, PC, gas, operands, RAM)
// ============================================================================

/// Instruction execution context (mirrors InstructionContext).
/// When ECALLI runs, it may set the host call ID via `host_call_id_out`.
pub struct InstructionContext<'a> {
    pub code: &'a [u8],
    pub bitmask: &'a [u8],
    pub registers: &'a mut RegisterState,
    pub program_counter: u32,
    pub gas_remaining: u32,
    pub operands: &'a [u8],
    pub fskip: i32,
    pub jump_table: &'a [u32],
    pub ram: &'a mut dyn Ram,
    /// When Some, ECALLI writes the immediate (host function ID) here.
    pub host_call_id_out: Option<&'a mut u32>,
}

// ============================================================================
// VmOutput (runProgram result layout)
// ============================================================================

/// Chunk of memory for VmOutput (address + contents).
#[derive(Clone, Debug)]
pub struct InitialChunk {
    pub address: u32,
    pub contents: Vec<u8>,
}

/// VmOutput structure for runProgram result (mirrors VmOutput).
#[derive(Clone, Debug)]
pub struct VmOutput {
    pub status: i32,
    pub registers: Vec<u64>,
    pub pc: u32,
    pub memory: Vec<InitialChunk>,
    pub gas: i64,
    pub exit_code: u32,
}

// ============================================================================
// Helpers
// ============================================================================

/// Convert bytes to hex string (mirrors bytesToHex).
#[must_use]
pub fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        result.push_str(&format!("{:02x}", b));
    }
    result
}
