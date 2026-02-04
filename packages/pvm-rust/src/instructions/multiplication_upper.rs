//! MUL_UPPER_S_S, MUL_UPPER_U_U, MUL_UPPER_S_U - upper 64 bits of 64×64 multiply.

use crate::config::{OPCODE_MUL_UPPER_S_S, OPCODE_MUL_UPPER_S_U, OPCODE_MUL_UPPER_U_U};
use crate::instructions::base::{parse_three_registers, InstructionHandler};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

pub struct MulUpperSSInstruction;
impl MulUpperSSInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MulUpperSSInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_UPPER_S_S)
    }
    fn name(&self) -> &'static str {
        "MUL_UPPER_S_S"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let sa = a as i64;
        let sb = b as i64;
        let product = (sa as i128) * (sb as i128);
        let upper = (product >> 64) as i64;
        let result = upper as u64;
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct MulUpperUUInstruction;
impl MulUpperUUInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MulUpperUUInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_UPPER_U_U)
    }
    fn name(&self) -> &'static str {
        "MUL_UPPER_U_U"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let product = (a as u128) * (b as u128);
        let result = (product >> 64) as u64;
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct MulUpperSUInstruction;
impl MulUpperSUInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MulUpperSUInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_UPPER_S_U)
    }
    fn name(&self) -> &'static str {
        "MUL_UPPER_S_U"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let sa = a as i64;
        let product = (sa as i128) * (b as u128 as i128);
        let upper = (product >> 64) as i64;
        let result = upper as u64;
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
