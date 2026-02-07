//! Shift by immediate (64-bit): SHLO_L, SHLO_R, SHAR_R, NEG_ADD.

use crate::config::{
    OPCODE_NEG_ADD_IMM_64, OPCODE_SHAR_R_IMM_64, OPCODE_SHLO_L_IMM_64, OPCODE_SHLO_R_IMM_64,
};
use crate::instructions::base::{
    arithmetic_shift_right_64, parse_two_registers_and_immediate, sign_extend, InstructionHandler,
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

fn set_register_64_sext(registers: &mut [u64; 13], index: u8, value: u64) {
    let v = sign_extend(value & 0xffff_ffff_ffff_ffff, 8);
    if (index as usize) < 13 {
        registers[index as usize] = v;
    }
}

// SHLO_L_IMM_64: reg'_A = sext{8}{(reg_B << (immed_X mod 64)) mod 2^64}
pub struct ShloLImm64Instruction;
impl ShloLImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloLImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_IMM_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b);
        let shift = (p.immediate_x as u64) % 64;
        let result = (reg_b << shift) & 0xffff_ffff_ffff_ffff;
        set_register_64_sext(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_IMM_64: reg'_A = sext{8}{floor(reg_B / 2^(immed_X mod 64))}
pub struct ShloRImm64Instruction;
impl ShloRImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloRImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_IMM_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b);
        let shift = (p.immediate_x as u64) % 64;
        let result = reg_b >> shift;
        set_register_64_sext(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_IMM_64: reg'_A = unsigned{floor(signed(reg_B) / 2^(immed_X mod 64))}
pub struct SharRImm64Instruction;
impl SharRImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharRImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_IMM_64)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b);
        let shift = (p.immediate_x as u64) % 64;
        let result = arithmetic_shift_right_64(reg_b, shift as u32);
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// NEG_ADD_IMM_64: reg'_A = (immed_X + 2^64 - reg_B) mod 2^64
pub struct NegAddImm64Instruction;
impl NegAddImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for NegAddImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_NEG_ADD_IMM_64)
    }
    fn name(&self) -> &'static str {
        "NEG_ADD_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, p.register_b);
        let imm = p.immediate_x as u64;
        let result = imm.wrapping_add((!reg_b).wrapping_add(1));
        set_register(context.registers, p.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
