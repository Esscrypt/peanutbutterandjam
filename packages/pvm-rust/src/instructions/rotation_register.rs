//! Rotate by register: ROT_L_64, ROT_L_32, ROT_R_64, ROT_R_32.

use crate::config::{OPCODE_ROT_L_32, OPCODE_ROT_L_64, OPCODE_ROT_R_32, OPCODE_ROT_R_64};
use crate::instructions::base::{parse_three_registers, sign_extend, InstructionHandler};
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

fn rot_left_64(value: u64, amount: u32) -> u64 {
    let amount = amount % 64;
    if amount == 0 {
        return value;
    }
    let mask = 0xffff_ffff_ffff_ffffu64;
    let left = (value << amount) & mask;
    let right = value >> (64 - amount);
    left | right
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

fn rot_left_32(value: u64, amount: u32) -> u64 {
    let value = value & 0xffff_ffff;
    let amount = amount % 32;
    if amount == 0 {
        return value;
    }
    let mask = 0xffff_ffffu64;
    let left = (value << amount) & mask;
    let right = value >> (32 - amount);
    left | right
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

pub struct RotL64Instruction;
impl RotL64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotL64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_L_64)
    }
    fn name(&self) -> &'static str {
        "ROT_L_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let amount = (get_register(context.registers, p.register_b) % 64) as u32;
        set_register(context.registers, p.register_d, rot_left_64(value, amount));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct RotL32Instruction;
impl RotL32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotL32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_L_32)
    }
    fn name(&self) -> &'static str {
        "ROT_L_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let amount = (get_register(context.registers, p.register_b) % 32) as u32;
        set_register_32(context.registers, p.register_d, rot_left_32(value, amount));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct RotR64Instruction;
impl RotR64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_64)
    }
    fn name(&self) -> &'static str {
        "ROT_R_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let amount = (get_register(context.registers, p.register_b) % 64) as u32;
        set_register(context.registers, p.register_d, rot_right_64(value, amount));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct RotR32Instruction;
impl RotR32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for RotR32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ROT_R_32)
    }
    fn name(&self) -> &'static str {
        "ROT_R_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let amount = (get_register(context.registers, p.register_b) % 32) as u32;
        set_register_32(context.registers, p.register_d, rot_right_32(value, amount));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
