//! Shift by register (64-bit): SHLO_L_64, SHLO_R_64, SHAR_R_64.

use crate::config::{OPCODE_SHAR_R_64, OPCODE_SHLO_L_64, OPCODE_SHLO_R_64};
use crate::instructions::base::{
    arithmetic_shift_right_64, parse_three_registers, InstructionHandler,
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

// SHLO_L_64: reg'_D = (reg_A << (reg_B mod 64)) mod 2^64
pub struct ShloL64Instruction;
impl ShloL64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloL64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_L_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_L_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let shift = get_register(context.registers, p.register_b) % 64;
        let result = (a << shift) & 0xffff_ffff_ffff_ffff;
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHLO_R_64: reg'_D = floor(reg_A / 2^(reg_B mod 64))
pub struct ShloR64Instruction;
impl ShloR64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ShloR64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHLO_R_64)
    }
    fn name(&self) -> &'static str {
        "SHLO_R_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let shift = get_register(context.registers, p.register_b) % 64;
        let result = a >> shift;
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// SHAR_R_64: reg'_D = unsigned{floor(signed(reg_A) / 2^(reg_B mod 64))}
pub struct SharR64Instruction;
impl SharR64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SharR64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SHAR_R_64)
    }
    fn name(&self) -> &'static str {
        "SHAR_R_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let shift = (get_register(context.registers, p.register_b) % 64) as u32;
        let result = arithmetic_shift_right_64(a, shift);
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
