//! Register / index instructions (mirrors assembly/instructions/register.ts).
//! MOVE_REG (reg'_D = reg_A), SBRK (heap allocation).

use crate::config::{align_to_page, MAX_MEMORY_ADDRESS, PAGE_SIZE, OPCODE_MOVE_REG, OPCODE_SBRK};
use crate::instructions::base::{parse_two_registers, InstructionHandler};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

/// MOVE_REG (opcode 100). Gray Paper: reg'_D = reg_A.
pub struct MoveRegInstruction;

impl MoveRegInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for MoveRegInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MOVE_REG)
    }
    fn name(&self) -> &'static str {
        "MOVE_REG"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers(context.operands);
        let value = get_register(context.registers, parsed.register_a);
        set_register(context.registers, parsed.register_d, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

/// SBRK (opcode 101). Allocate memory. Gray Paper: reg'_D = previous heap; heap += reg_A.
/// If reg_A == 0, return current heap pointer (query). If overflow, reg_D = 0.
pub struct SbrkInstruction;

impl SbrkInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SbrkInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SBRK)
    }
    fn name(&self) -> &'static str {
        "SBRK"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let current = context.ram.current_heap_pointer();

        if value_a == 0 {
            set_register(context.registers, parsed.register_d, current as u64);
            return InstructionResult::new(InstructionResult::CONTINUE, 0);
        }

        let result = current as u64;
        let next_page_boundary = align_to_page(current);
        let size_u32 = value_a.min(u64::from(u32::MAX)) as u32;
        let new_heap_pointer = current.saturating_add(size_u32);

        if new_heap_pointer > MAX_MEMORY_ADDRESS {
            set_register(context.registers, parsed.register_d, 0);
            return InstructionResult::new(InstructionResult::CONTINUE, 0);
        }

        if new_heap_pointer > next_page_boundary {
            let final_boundary = align_to_page(new_heap_pointer);
            let idx_start = next_page_boundary / PAGE_SIZE;
            let idx_end = final_boundary / PAGE_SIZE;
            let page_count = idx_end.saturating_sub(idx_start);
            context.ram.allocate_pages(idx_start, page_count);
        }

        context.ram.set_current_heap_pointer(new_heap_pointer);
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for SbrkInstruction {
    fn default() -> Self {
        Self::new()
    }
}
