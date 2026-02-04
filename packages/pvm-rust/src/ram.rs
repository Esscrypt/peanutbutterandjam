//! PVM RAM (mirrors assembly/ram.ts). Page-based memory with regions per Gray Paper.

use crate::config::{self, align_to_page, align_to_zone};
use crate::types::{FaultCheckResult, MemoryAccessType, Ram, ReadResult, WriteResult};
use std::collections::HashMap;

/// Page map entry (address, length, writable, access type). Used for introspection.
#[derive(Clone, Debug)]
pub struct PageMapEntry {
    pub address: u64,
    pub length: i32,
    pub is_writable: bool,
    pub access_type: MemoryAccessType,
}

/// PVM RAM: page-based memory with regions (Gray Paper equation 770-802).
pub struct PvmRam {
    ro_data_address: u32,
    argument_data_address: u32,
    stack_address_end: u32,
    stack_address: u32,
    heap_start_address: u32,
    heap_end_address: u32,
    ro_data_address_end: u32,
    current_heap_pointer: u32,
    argument_data_end: u32,
    pages: HashMap<u32, Vec<u8>>,
    page_access: HashMap<u32, MemoryAccessType>,
    last_load_address: u32,
    last_load_value: u64,
    last_store_address: u32,
    last_store_value: u64,
}

impl Default for PvmRam {
    fn default() -> Self {
        Self {
            ro_data_address: config::ZONE_SIZE,
            argument_data_address: config::ARGS_SEGMENT_START,
            stack_address_end: config::STACK_SEGMENT_END,
            stack_address: 0,
            heap_start_address: 0,
            heap_end_address: 0,
            ro_data_address_end: 0,
            current_heap_pointer: 0,
            argument_data_end: 0,
            pages: HashMap::new(),
            page_access: HashMap::new(),
            last_load_address: 0,
            last_load_value: 0,
            last_store_address: 0,
            last_store_value: 0,
        }
    }
}

impl PvmRam {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    fn get_page_index(&self, address: u32) -> u32 {
        address / config::PAGE_SIZE
    }

    fn get_page_offset(&self, address: u32) -> u32 {
        address % config::PAGE_SIZE
    }

    fn get_or_create_page(&mut self, page_index: u32) -> &mut Vec<u8> {
        self.pages
            .entry(page_index)
            .or_insert_with(|| vec![0u8; config::PAGE_SIZE as usize])
    }

    fn get_page(&self, page_index: u32) -> Option<&Vec<u8>> {
        self.pages.get(&page_index)
    }
}

impl Ram for PvmRam {
    fn read_octets(&mut self, address: u32, count: u32) -> ReadResult {
        let check = self.is_readable_with_fault(address, count);
        if !check.success {
            return ReadResult::new(None, check.fault_address);
        }
        let mut result = vec![0u8; count as usize];
        let mut result_offset = 0usize;
        let mut current_addr = address;
        let end_addr = address + count;

        while current_addr < end_addr {
            let page_index = self.get_page_index(current_addr);
            let page_offset = self.get_page_offset(current_addr) as usize;
            let Some(page) = self.get_page(page_index) else {
                return ReadResult::new(None, page_index * config::PAGE_SIZE);
            };
            let bytes_in_page = (count as usize - result_offset)
                .min(config::PAGE_SIZE as usize - page_offset);
            let page_end = page_offset + bytes_in_page;
            result[result_offset..result_offset + bytes_in_page]
                .copy_from_slice(&page[page_offset..page_end]);
            result_offset += bytes_in_page;
            current_addr += bytes_in_page as u32;
        }

        self.last_load_address = address;
        self.last_load_value = result
            .iter()
            .take(8)
            .enumerate()
            .fold(0u64, |acc, (i, &b)| acc | (u64::from(b) << (i * 8)));
        ReadResult::new(Some(result), 0)
    }

    fn write_octets(&mut self, address: u32, values: &[u8]) -> WriteResult {
        let size = values.len() as u32;
        let check = self.is_writable_with_fault(address, size);
        if !check.success {
            return WriteResult::new(
                true,
                if check.fault_address != 0 {
                    check.fault_address
                } else {
                    0xFFFF_FFFF
                },
            );
        }
        let mut values_offset = 0usize;
        let mut current_addr = address;
        let end_addr = address + size;

        while current_addr < end_addr {
            let page_index = self.get_page_index(current_addr);
            let page_offset = self.get_page_offset(current_addr) as usize;
            let page = self.get_or_create_page(page_index);
            let bytes_in_page =
                (values.len() - values_offset).min(config::PAGE_SIZE as usize - page_offset);
            let page_end = page_offset + bytes_in_page;
            page[page_offset..page_end]
                .copy_from_slice(&values[values_offset..values_offset + bytes_in_page]);
            values_offset += bytes_in_page;
            current_addr += bytes_in_page as u32;
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
        let end_page = start_page + count;
        for page_index in start_page..end_page {
            self.get_or_create_page(page_index);
            self.page_access.insert(page_index, MemoryAccessType::Write);
        }
        let end_address = end_page * config::PAGE_SIZE;
        if end_address > self.current_heap_pointer {
            self.current_heap_pointer = end_address;
        }
    }

    fn is_readable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult {
        if size == 0 {
            return FaultCheckResult::new(true, 0);
        }
        let end_address = address + size;
        let start_page = self.get_page_index(address);
        let end_page = self.get_page_index(end_address.saturating_sub(1));
        for page_index in start_page..=end_page {
            let access = *self.page_access.get(&page_index).unwrap_or(&MemoryAccessType::None);
            if access == MemoryAccessType::None {
                return FaultCheckResult::new(false, page_index * config::PAGE_SIZE);
            }
        }
        FaultCheckResult::new(true, 0)
    }

    fn initialize_memory_layout(
        &mut self,
        argument_data: &[u8],
        read_only_data: &[u8],
        read_write_data: &[u8],
        stack_size: u32,
        heap_zero_padding_size: u32,
    ) {
        let ro_len = read_only_data.len() as u32;
        let heap_size = read_write_data.len() as u32;
        let args_len = argument_data.len() as u32;

        let heap_start = 2 * config::ZONE_SIZE + align_to_zone(ro_len);
        let heap_end = heap_start + align_to_page(heap_size);
        let heap_zeros_end = heap_end + heap_zero_padding_size * config::PAGE_SIZE;

        let args_start = self.argument_data_address;
        let args_end = args_start + align_to_page(args_len);
        let args_zero_padding_end = args_end + align_to_page(args_len);

        let stack_end = self.stack_address_end;
        let stack_start = stack_end - align_to_page(stack_size);

        let ro_start = self.ro_data_address;
        let ro_end = ro_start + align_to_page(ro_len);

        if !argument_data.is_empty() {
            self.write_octets_during_initialization(args_start, argument_data);
        }
        if !read_only_data.is_empty() {
            self.write_octets_during_initialization(ro_start, read_only_data);
        }
        if !read_write_data.is_empty() {
            self.write_octets_during_initialization(heap_start, read_write_data);
        }

        self.argument_data_end = args_zero_padding_end;
        self.ro_data_address_end = ro_end;
        self.stack_address = stack_start;
        self.heap_start_address = heap_start;
        self.heap_end_address = heap_end;
        self.current_heap_pointer = heap_zeros_end;

        if ro_len > 0 {
            self.init_page(ro_start, ro_end - ro_start, MemoryAccessType::Read);
        }
        if args_len > 0 {
            self.init_page(args_start, args_zero_padding_end - args_start, MemoryAccessType::Read);
        }
        if stack_start < stack_end {
            self.init_page(stack_start, stack_end - stack_start, MemoryAccessType::Write);
        }
        if heap_size > 0 {
            self.init_page(heap_start, heap_end - heap_start, MemoryAccessType::Write);
        }
        if heap_end < heap_zeros_end {
            self.init_page(heap_end, heap_zeros_end - heap_end, MemoryAccessType::Write);
        }
    }

    fn is_writable_with_fault(&self, address: u32, size: u32) -> FaultCheckResult {
        if size == 0 {
            return FaultCheckResult::new(true, 0);
        }
        let end_address = address + size;
        let start_page = self.get_page_index(address);
        let end_page = self.get_page_index(end_address.saturating_sub(1));
        for page_index in start_page..=end_page {
            let access = *self.page_access.get(&page_index).unwrap_or(&MemoryAccessType::None);
            if access != MemoryAccessType::Write {
                return FaultCheckResult::new(false, page_index * config::PAGE_SIZE);
            }
        }
        FaultCheckResult::new(true, 0)
    }

    fn set_page_access_rights(&mut self, address: u32, length: u32, access_type: MemoryAccessType) {
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
        let start_page = self.get_page_index(address);
        let end_page = self.get_page_index(address + length - 1);
        for page_index in start_page..=end_page {
            self.get_or_create_page(page_index);
            self.page_access.insert(page_index, access_type);
        }
    }

    fn write_octets_during_initialization(&mut self, address: u32, values: &[u8]) {
        let mut values_offset = 0usize;
        let mut current_addr = address;
        let end_addr = address + values.len() as u32;

        while current_addr < end_addr {
            let page_index = self.get_page_index(current_addr);
            let page_offset = self.get_page_offset(current_addr) as usize;
            let page = self.get_or_create_page(page_index);
            let bytes_in_page =
                (values.len() - values_offset).min(config::PAGE_SIZE as usize - page_offset);
            let page_end = page_offset + bytes_in_page;
            page[page_offset..page_end]
                .copy_from_slice(&values[values_offset..values_offset + bytes_in_page]);
            values_offset += bytes_in_page;
            current_addr += bytes_in_page as u32;
        }
    }

    fn get_page_dump(&self, page_index: u32) -> Vec<u8> {
        self.get_page(page_index)
            .map(|p| p.clone())
            .unwrap_or_else(|| vec![0u8; config::PAGE_SIZE as usize])
    }

    fn reset(&mut self) {
        self.pages.clear();
        self.page_access.clear();
        self.stack_address = 0;
        self.heap_start_address = 0;
        self.heap_end_address = 0;
        self.ro_data_address_end = 0;
        self.current_heap_pointer = 0;
        self.argument_data_end = 0;
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
