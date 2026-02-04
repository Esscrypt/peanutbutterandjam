//! Shift by immediate (32-bit): SHLO_L, SHLO_R, SHAR_R, NEG_ADD. Gray Paper §7.4.9.

use crate::config::{
    OPCODE_NEG_ADD_IMM_32, OPCODE_SHAR_R_IMM_32, OPCODE_SHLO_L_IMM_32, OPCODE_SHLO_R_IMM_32,
};
use crate::instructions::base::{
    arithmetic_shift_right_32, parse_two_registers_and_immediate, sign_extend, InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register_32(registers: &mut [u64; 13], index: u8, value: u64) {
    let extended = sign_extend(value & 0xffff_ffff, 4);
    if (index as usize) < 13 {
        registers[index as usize] = extended;
    }
}

// SHLO_L_IMM_32: reg'_A = sext{4}{(reg_B << (immed_X mod 32)) mod 2^32}
pub struct ShloLImm32Instruction;
impl ShloLImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloLImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_IMM_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b) & 0xffff_ffff;
        let shift = (p.immediate_x as u64) & 0xffff_ffff;
        let shift = shift % 32;
        let result = (reg_b << shift) & 0xffff_ffff;
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_IMM_32: reg'_A = sext{4}{floor(reg_B mod 2^32 / 2^(immed_X mod 32))}
pub struct ShloRImm32Instruction;
impl ShloRImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloRImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_IMM_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b) & 0xffff_ffff;
        let shift = (p.immediate_x as u64) & 0xffff_ffff;
        let shift = (shift % 32) as u32;
        let result = if shift == 0 {
            reg_b
        } else {
            reg_b >> shift
        };
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_IMM_32: reg'_A = unsigned{floor(signed_4(reg_B mod 2^32) / 2^(immed_X mod 32))}
pub struct SharRImm32Instruction;
impl SharRImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharRImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_IMM_32)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b) & 0xffff_ffff;
        let shift = (p.immediate_x as u64) & 0xffff_ffff;
        let shift = (shift % 32) as u32;
        let result = arithmetic_shift_right_32(reg_b, shift);
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// NEG_ADD_IMM_32: reg'_A = sext{4}{(immed_X + 2^32 - reg_B) mod 2^32}
pub struct NegAddImm32Instruction;
impl NegAddImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for NegAddImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_NEG_ADD_IMM_32)
    }
    fn name(&self) -> &'static str {
        "NEG_ADD_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b) & 0xffff_ffff;
        let imm = (p.immediate_x as u64) & 0xffff_ffff;
        let result = (imm.wrapping_add(0x1_0000_0000).wrapping_sub(reg_b)) & 0xffff_ffff;
        set_register_32(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
