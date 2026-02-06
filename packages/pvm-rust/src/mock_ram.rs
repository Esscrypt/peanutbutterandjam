//! Mock RAM for tests (mirrors assembly/mock-ram.ts).
//! No-op implementation that satisfies the RAM interface.

use crate::config;
use crate::types::{FaultCheckResult, MemoryAccessType, Ram, ReadResult, WriteResult};

/// Mock RAM: no-op memory, always succeeds / returns zeros.
#[derive(Default)]
pub struct MockRam {
    current_heap_pointer: u32,
    last_load_address: u32,
    last_load_value: u64,
    last_store_address: u32,
    last_store_value: u64,
}

impl MockRam {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            current_heap_pointer: 0,
            last_load_address: 0,
            last_load_value: 0,
            last_store_address: 0,
            last_store_value: 0,
        }
    }
}

impl Ram for MockRam {
    fn read_octets(&mut self, _address: u32, count: u32) -> ReadResult {
        ReadResult::new(Some(vec![0u8; count as usize]), 0)
    }

    fn write_octets(&mut self, _address: u32, _values: &[u8]) -> WriteResult {
        WriteResult::new(false, 0)
    }

    fn current_heap_pointer(&self) -> u32 {
        self.current_heap_pointer
    }

    fn set_current_heap_pointer(&mut self, value: u32) {
        self.current_heap_pointer = value;
    }

    fn allocate_pages(&mut self, _start_page: u32, _count: u32) {}

    fn is_readable_with_fault(&self, _address: u32, _size: u32) -> FaultCheckResult {
        FaultCheckResult::new(true, 0)
    }

    fn initialize_memory_layout(
        &mut self,
        _argument_data: &[u8],
        _read_only_data: &[u8],
        _read_write_data: &[u8],
        _stack_size: u32,
        _heap_zero_padding_size: u32,
    ) {
    }

    fn is_writable_with_fault(&self, _address: u32, _size: u32) -> FaultCheckResult {
        FaultCheckResult::new(true, 0)
    }

    fn set_page_access_rights(&mut self, _address: u32, _length: u32, _access_type: MemoryAccessType) {
    }

    fn init_page(&mut self, _address: u32, _length: u32, _access_type: MemoryAccessType) {}

    fn write_octets_during_initialization(&mut self, _address: u32, _values: &[u8]) {}

    fn get_page_dump(&self, _page_index: u32) -> Vec<u8> {
        vec![0u8; config::PAGE_SIZE as usize]
    }

    fn reset(&mut self) {
        self.current_heap_pointer = 0;
        self.last_load_address = 0;
        self.last_load_value = 0;
        self.last_store_address = 0;
        self.last_store_value = 0;
    }

    fn last_load_address(&self) -> u32 {
        self.last_load_address
    }

    fn last_load_value(&self) -> u64 {
        self.last_load_value
    }

    fn last_store_address(&self) -> u32 {
        self.last_store_address
    }

    fn last_store_value(&self) -> u64 {
        self.last_store_value
    }

    fn clear_last_memory_op(&mut self) {
        self.last_load_address = 0;
        self.last_load_value = 0;
        self.last_store_address = 0;
        self.last_store_value = 0;
    }
}
