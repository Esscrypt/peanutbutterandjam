//! Bitwise instructions (mirrors assembly/instructions/bitwise.ts and bitwise-register.ts).
//! AND_IMM, XOR_IMM, OR_IMM, AND, XOR, OR.

use crate::config::{OPCODE_AND_IMM, OPCODE_AND, OPCODE_OR_IMM, OPCODE_OR, OPCODE_XOR_IMM, OPCODE_XOR};
use crate::instructions::base::{
    parse_three_registers, parse_two_registers_and_immediate, InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

// --- AND (210) ---
pub struct AndInstruction;

impl AndInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for AndInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_AND)
    }
    fn name(&self) -> &'static str {
        "AND"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let a = get_register(context.registers, parsed.register_a);
        let b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, a & b);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- XOR (211) ---
pub struct XorInstruction;

impl XorInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for XorInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_XOR)
    }
    fn name(&self) -> &'static str {
        "XOR"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let a = get_register(context.registers, parsed.register_a);
        let b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, a ^ b);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- OR (212) ---
pub struct OrInstruction;

impl OrInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for OrInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_OR)
    }
    fn name(&self) -> &'static str {
        "OR"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let a = get_register(context.registers, parsed.register_a);
        let b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, a | b);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- AND_IMM (132) ---
pub struct AndImmInstruction;

impl AndImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for AndImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_AND_IMM)
    }
    fn name(&self) -> &'static str {
        "AND_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = reg_b & (parsed.immediate_x as u64);
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- XOR_IMM (133) ---
pub struct XorImmInstruction;

impl XorImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for XorImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_XOR_IMM)
    }
    fn name(&self) -> &'static str {
        "XOR_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = reg_b ^ (parsed.immediate_x as u64);
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- OR_IMM (134) ---
pub struct OrImmInstruction;

impl OrImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for OrImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_OR_IMM)
    }
    fn name(&self) -> &'static str {
        "OR_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = reg_b | (parsed.immediate_x as u64);
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
