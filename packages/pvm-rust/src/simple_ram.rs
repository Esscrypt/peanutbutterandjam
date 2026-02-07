//! Simple flat RAM (mirrors assembly/simple-ram.ts).
//! Flat memory with per-page access rights for runBlob and test vectors.

use crate::config;
use crate::types::{FaultCheckResult, MemoryAccessType, Ram, ReadResult, WriteResult};
use std::collections::HashMap;

/// Simple RAM: single contiguous memory with page access rights.
#[derive(Default)]
pub struct SimpleRam {
    memory: Vec<u8>,
    page_access: HashMap<u32, MemoryAccessType>,
    current_heap_pointer: u32,
    last_load_address: u32,
    last_load_value: u64,
    last_store_address: u32,
    last_store_value: u64,
}

impl SimpleRam {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn get_page_index(&self, address: u32) -> u32 {
        address / config::PAGE_SIZE
    }

    fn ensure_memory_size(&mut self, required_size: u32) {
        let len = self.memory.len() as u32;
        if len >= required_size {
            return;
        }
        let aligned = ((required_size / config::PAGE_SIZE) + 1) * config::PAGE_SIZE;
        self.memory.resize(aligned as usize, 0);
    }

    fn get_page_access(&self, page_index: u32) -> MemoryAccessType {
        *self.page_access.get(&page_index).unwrap_or(&MemoryAccessType::None)
    }

    fn check_access(&self, address: u32, size: u32, required: MemoryAccessType) -> u32 {
        let start_page = self.get_page_index(address);
        let end_addr = address.saturating_add(size).saturating_sub(1);
        let end_page = self.get_page_index(end_addr);
        for page_index in start_page..=end_page {
            let access = self.get_page_access(page_index);
            match required {
                MemoryAccessType::Read => {
                    if access == MemoryAccessType::None {
                        return page_index * config::PAGE_SIZE;
                    }
                }
                MemoryAccessType::Write => {
                    if access != MemoryAccessType::Write {
                        return page_index * config::PAGE_SIZE;
                    }
                }
                MemoryAccessType::None => {}
            }
        }
        0
    }
}

impl Ram for SimpleRam {
    fn read_octets(&mut self, address: u32, count: u32) -> ReadResult {
        if count == 0 {
            return ReadResult::new(Some(vec![]), 0);
        }
        let fault = self.check_access(address, count, MemoryAccessType::Read);
        if fault != 0 {
            return ReadResult::new(None, fault);
        }
        self.ensure_memory_size(address + count);
        let end = (address as usize + count as usize).min(self.memory.len());
        let data = self.memory[address as usize..end].to_vec();
        self.last_load_address = address;
        self.last_load_value = data
            .iter()
            .take(8)
            .enumerate()
            .fold(0u64, |acc, (i, &b)| acc | (u64::from(b) << (i * 8)));
        ReadResult::new(Some(data), 0)
    }

    fn write_octets(&mut self, address: u32, values: &[u8]) -> WriteResult {
        if values.is_empty() {
            return WriteResult::new(false, 0);
        }
        let size = values.len() as u32;
        let writable = self.is_writable_with_fault(address, size);
        if !writable.success {
            return WriteResult::new(
                true,
                if writable.fault_address != 0 {
                    writable.fault_address
                } else {
                    0xFFFF_FFFF
                },
            );
        }
        self.ensure_memory_size(address + size);
        let start = address as usize;
        let end = start + values.len();
        if end <= self.memory.len() {
            self.memory[start..end].copy_from_slice(values);
        }
        if address + size > self.current_heap_pointer {
            self.current_heap_pointer = address + size;
        }
        self.last_store_address = address;
        self.last_store_value = values
            .iter()
            .take(8)
            .enumerate()
            .fold(0u64, |acc, (i, &b)| acc | (u64::from(b) << (i * 8)));
        WriteResult::new(false, 0)
    }

    fn current_heap_pointer(&self) -> u32 {
        self.current_heap_pointer
    }

    fn set_current_heap_pointer(&mut self, value: u32) {
        self.current_heap_pointer = value;
    }

    fn allocate_pages(&mut self, start_page: u32, count: u32) {
        let _start_addr = start_page * config::PAGE_SIZE;
        let end_addr = (start_page + count) * config::PAGE_SIZE;
        self.ensure_memory_size(end_addr);
        if end_addr > self.current_heap_pointer {
            self.current_heap_pointer = end_addr;
        }
    }

    fn is_readable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult {
        let fault = self.check_access(address, size, MemoryAccessType::Read);
        FaultCheckResult::new(fault == 0, fault)
    }

    fn initialize_memory_layout(
        &mut self,
        _argument_data: &[u8],
        _read_only_data: &[u8],
        read_write_data: &[u8],
        _stack_size: u32,
        _heap_zero_padding_size: u32,
    ) {
        if !read_write_data.is_empty() {
            let heap_start = 2 * 65_536u32;
            self.write_octets(heap_start, read_write_data);
        }
    }

    fn is_writable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult {
        let end = address.saturating_add(size);
        let mut min_inaccessible = 0xFFFF_FFFFu32;
        for addr in address..end {
            let page_index = self.get_page_index(addr);
            if self.get_page_access(page_index) != MemoryAccessType::Write {
                min_inaccessible = addr;
                break;
            }
        }
        if min_inaccessible != 0xFFFF_FFFF {
            let fault = self.get_page_index(min_inaccessible) * config::PAGE_SIZE;
            return FaultCheckResult::new(false, fault);
        }
        FaultCheckResult::new(true, 0)
    }

    fn set_page_access_rights(&mut self, address: u32, length: u32, access_type: MemoryAccessType) {
        if length == 0 {
            return;
        }
        let start_page = self.get_page_index(address);
        let end_page = self.get_page_index(address + length - 1);
        for page_index in start_page..=end_page {
            self.page_access.insert(page_index, access_type);
        }
    }

    fn init_page(&mut self, address: u32, length: u32, access_type: MemoryAccessType) {
        if length == 0 {
            return;
        }
        self.ensure_memory_size(address + length);
        let start_page = self.get_page_index(address);
        let end_page = self.get_page_index(address + length - 1);
        for page_index in start_page..=end_page {
            self.page_access.insert(page_index, access_type);
        }
    }

    fn write_octets_during_initialization(&mut self, address: u32, values: &[u8]) {
        if values.is_empty() {
            return;
        }
        self.ensure_memory_size(address + values.len() as u32);
        let start = address as usize;
        let end = start + values.len();
        if end <= self.memory.len() {
            self.memory[start..end].copy_from_slice(values);
        }
        if address + values.len() as u32 > self.current_heap_pointer {
            self.current_heap_pointer = address + values.len() as u32;
        }
    }

    fn get_page_dump(&self, page_index: u32) -> Vec<u8> {
        let mut page = vec![0u8; config::PAGE_SIZE as usize];
        let start = (page_index * config::PAGE_SIZE) as usize;
        let _end = start + config::PAGE_SIZE as usize;
        if start < self.memory.len() {
            let copy_len = (self.memory.len() - start).min(config::PAGE_SIZE as usize);
            page[..copy_len].copy_from_slice(&self.memory[start..start + copy_len]);
        }
        page
    }

    fn reset(&mut self) {
        self.memory.clear();
        self.page_access.clear();
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
