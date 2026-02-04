//! Alternative shift by immediate (32-bit): immed_X << reg_B or immed_X >> reg_B.

use crate::config::{
    OPCODE_SHAR_R_IMM_ALT_32, OPCODE_SHLO_L_IMM_ALT_32, OPCODE_SHLO_R_IMM_ALT_32,
};
use crate::instructions::base::{
    arithmetic_shift_right_32, parse_two_registers_and_immediate, sign_extend, InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

fn set_register_32(registers: &mut [u64; 13], index: u8, value: u64) {
    let extended = sign_extend(value & 0xffff_ffff, 4);
    if (index as usize) < 13 {
        registers[index as usize] = extended;
    }
}

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

// SHLO_L_IMM_ALT_32: reg'_A = sext{4}{(immed_X << (reg_B mod 32)) mod 2^32}
pub struct ShloLImmAlt32Instruction;
impl ShloLImmAlt32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloLImmAlt32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_IMM_ALT_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_IMM_ALT_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let imm = (p.immediate_x as u64) & 0xffff_ffff;
        let result = (imm << shift) & 0xffff_ffff;
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_IMM_ALT_32: reg'_A = sext{4}{floor((immed_X mod 2^32) / 2^(reg_B mod 32))}
pub struct ShloRImmAlt32Instruction;
impl ShloRImmAlt32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloRImmAlt32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_IMM_ALT_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_IMM_ALT_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let imm = (p.immediate_x as u64) & 0xffff_ffff;
        let result = if shift == 0 { imm } else { imm >> shift };
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_IMM_ALT_32: reg'_A = unsigned{floor(signed_32(immed_X mod 2^32) / 2^(reg_B mod 32))}
pub struct SharRImmAlt32Instruction;
impl SharRImmAlt32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharRImmAlt32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_IMM_ALT_32)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_IMM_ALT_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let imm = (p.immediate_x as u64) & 0xffff_ffff;
        let result = arithmetic_shift_right_32(imm, shift);
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
