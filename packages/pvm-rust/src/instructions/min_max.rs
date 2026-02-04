//! MIN, MIN_U, MAX, MAX_U (three-register: reg_D = min/max(reg_A, reg_B)).

use crate::config::{OPCODE_MAX, OPCODE_MAX_U, OPCODE_MIN, OPCODE_MIN_U};
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

pub struct MinInstruction;
impl MinInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MinInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MIN)
    }
    fn name(&self) -> &'static str {
        "MIN"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let sa = a as i64;
        let sb = b as i64;
        let result = if sa < sb { a } else { b };
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct MinUInstruction;
impl MinUInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MinUInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MIN_U)
    }
    fn name(&self) -> &'static str {
        "MIN_U"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let result = if a < b { a } else { b };
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct MaxInstruction;
impl MaxInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MaxInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MAX)
    }
    fn name(&self) -> &'static str {
        "MAX"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let sa = a as i64;
        let sb = b as i64;
        let result = if sa > sb { a } else { b };
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct MaxUInstruction;
impl MaxUInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for MaxUInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MAX_U)
    }
    fn name(&self) -> &'static str {
        "MAX_U"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        let result = if a > b { a } else { b };
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
