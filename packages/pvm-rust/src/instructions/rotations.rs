//! Rotate right by immediate: ROT_R_64_IMM, ROT_R_64_IMM_ALT, ROT_R_32_IMM, ROT_R_32_IMM_ALT.

use crate::config::{
    OPCODE_ROT_R_32_IMM, OPCODE_ROT_R_32_IMM_ALT, OPCODE_ROT_R_64_IMM, OPCODE_ROT_R_64_IMM_ALT,
};
use crate::instructions::base::{
    parse_two_registers_and_immediate, sign_extend, InstructionHandler,
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

fn set_register_32(registers: &mut [u64; 13], index: u8, value: u64) {
    let extended = sign_extend(value & 0xffff_ffff, 4);
    if (index as usize) < 13 {
        registers[index as usize] = extended;
    }
}

fn rot_right_64(value: u64, amount: u32) -> u64 {
    let amount = amount % 64;
    if amount == 0 {
        return value;
    }
    let mask = 0xffff_ffff_ffff_ffffu64;
    let right = value >> amount;
    let left = (value << (64 - amount)) & mask;
    right | left
}

fn rot_right_32(value: u64, amount: u32) -> u64 {
    let value = value & 0xffff_ffff;
    let amount = amount % 32;
    if amount == 0 {
        return value;
    }
    let mask = 0xffff_ffffu64;
    let right = value >> amount;
    let left = (value << (32 - amount)) & mask;
    right | left
}

// ROT_R_64_IMM: rotate reg_B right by immed_X, store in reg_A
pub struct RotR64ImmInstruction;
impl RotR64ImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR64ImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_64_IMM)
    }
    fn name(&self) -> &'static str {
        "ROT_R_64_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let value = get_register(context.registers, p.register_b);
        let amount = (p.immediate_x as u64) % 64;
        let result = rot_right_64(value, amount as u32);
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// ROT_R_64_IMM_ALT: rotate immed_X right by reg_B, store in reg_A
pub struct RotR64ImmAltInstruction;
impl RotR64ImmAltInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR64ImmAltInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_64_IMM_ALT)
    }
    fn name(&self) -> &'static str {
        "ROT_R_64_IMM_ALT"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let value = p.immediate_x as u64;
        let amount = (get_register(context.registers, p.register_b) % 64) as u32;
        let result = rot_right_64(value, amount);
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// ROT_R_32_IMM: rotate reg_B (32-bit) right by immed_X, store in reg_A (sext)
pub struct RotR32ImmInstruction;
impl RotR32ImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR32ImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_32_IMM)
    }
    fn name(&self) -> &'static str {
        "ROT_R_32_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let value = get_register(context.registers, p.register_b) & 0xffff_ffff;
        let amount = (p.immediate_x as u64) % 32;
        let result = rot_right_32(value, amount as u32);
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// ROT_R_32_IMM_ALT: rotate immed_X (32-bit) right by reg_B, store in reg_A (sext)
pub struct RotR32ImmAltInstruction;
impl RotR32ImmAltInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR32ImmAltInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_32_IMM_ALT)
    }
    fn name(&self) -> &'static str {
        "ROT_R_32_IMM_ALT"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let value = (p.immediate_x as u64) & 0xffff_ffff;
        let amount = (get_register(context.registers, p.register_b) % 32) as u32;
        let result = rot_right_32(value, amount);
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
