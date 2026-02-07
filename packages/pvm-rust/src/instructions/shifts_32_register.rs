//! Shift by register (32-bit): SHLO_L_32, SHLO_R_32, SHAR_R_32.

use crate::config::{OPCODE_SHAR_R_32, OPCODE_SHLO_L_32, OPCODE_SHLO_R_32};
use crate::instructions::base::{
    arithmetic_shift_right_32, parse_three_registers, sign_extend, InstructionHandler,
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

// SHLO_L_32: reg'_D = sext{4}{(reg_A << (reg_B mod 32)) mod 2^32}
pub struct ShloL32Instruction;
impl ShloL32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloL32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let result = (a << shift) & 0xffff_ffff;
        set_register_32(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_32: reg'_D = sext{4}{floor((reg_A mod 2^32) / 2^(reg_B mod 32))}
pub struct ShloR32Instruction;
impl ShloR32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloR32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_32)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let result = if shift == 0 { a } else { a >> shift };
        set_register_32(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_32: reg'_D = unsigned{floor(signed_4(reg_A mod 2^32) / 2^(reg_B mod 32))}
pub struct SharR32Instruction;
impl SharR32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharR32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_32)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let shift = (get_register(context.registers, p.register_b) % 32) as u32;
        let result = arithmetic_shift_right_32(a, shift);
        set_register_32(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
