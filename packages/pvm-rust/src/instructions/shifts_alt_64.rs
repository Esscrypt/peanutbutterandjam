//! Alternative shift by immediate (64-bit): immed_X << reg_B or immed_X >> reg_B.

use crate::config::{
    OPCODE_SHAR_R_IMM_ALT_64, OPCODE_SHLO_L_IMM_ALT_64, OPCODE_SHLO_R_IMM_ALT_64,
};
use crate::instructions::base::{
    arithmetic_shift_right_64, parse_two_registers_and_immediate, InstructionHandler,
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

// SHLO_L_IMM_ALT_64: reg'_A = (immed_X << (reg_B mod 64)) mod 2^64
pub struct ShloLImmAlt64Instruction;
impl ShloLImmAlt64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloLImmAlt64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_IMM_ALT_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_IMM_ALT_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = get_register(context.registers, p.register_b) % 64;
        let imm = p.immediate_x as u64;
        let result = (imm << shift) & 0xffff_ffff_ffff_ffff;
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_IMM_ALT_64: reg'_A = floor(immed_X / 2^(reg_B mod 64))
pub struct ShloRImmAlt64Instruction;
impl ShloRImmAlt64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloRImmAlt64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_IMM_ALT_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_IMM_ALT_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = get_register(context.registers, p.register_b) % 64;
        let imm = p.immediate_x as u64;
        let result = imm >> shift;
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_IMM_ALT_64: reg'_A = unsigned{floor(signed_64(immed_X) / 2^(reg_B mod 64))}
pub struct SharRImmAlt64Instruction;
impl SharRImmAlt64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharRImmAlt64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_IMM_ALT_64)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_IMM_ALT_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = (get_register(context.registers, p.register_b) % 64) as u32;
        let imm = p.immediate_x as u64;
        let result = arithmetic_shift_right_64(imm, shift);
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
