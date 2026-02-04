//! Register ops: COUNT_SET_BITS, LEADING_ZERO_BITS, TRAILING_ZERO_BITS, SIGN_EXTEND, ZERO_EXTEND, REVERSE_BYTES.

use crate::config::{
    OPCODE_COUNT_SET_BITS_32, OPCODE_COUNT_SET_BITS_64, OPCODE_LEADING_ZERO_BITS_32,
    OPCODE_LEADING_ZERO_BITS_64, OPCODE_REVERSE_BYTES, OPCODE_SIGN_EXTEND_16, OPCODE_SIGN_EXTEND_8,
    OPCODE_TRAILING_ZERO_BITS_32, OPCODE_TRAILING_ZERO_BITS_64, OPCODE_ZERO_EXTEND_16,
};
use crate::instructions::base::{parse_two_registers, InstructionHandler};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

pub struct CountSetBits64Instruction;
impl CountSetBits64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for CountSetBits64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_COUNT_SET_BITS_64)
    }
    fn name(&self) -> &'static str {
        "COUNT_SET_BITS_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let count = value.count_ones() as u64;
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct CountSetBits32Instruction;
impl CountSetBits32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for CountSetBits32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_COUNT_SET_BITS_32)
    }
    fn name(&self) -> &'static str {
        "COUNT_SET_BITS_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let count = value.count_ones() as u64;
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct LeadingZeroBits64Instruction;
impl LeadingZeroBits64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LeadingZeroBits64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LEADING_ZERO_BITS_64)
    }
    fn name(&self) -> &'static str {
        "LEADING_ZERO_BITS_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let count = if value == 0 {
            64u64
        } else {
            value.leading_zeros() as u64
        };
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct LeadingZeroBits32Instruction;
impl LeadingZeroBits32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LeadingZeroBits32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LEADING_ZERO_BITS_32)
    }
    fn name(&self) -> &'static str {
        "LEADING_ZERO_BITS_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff_ffff;
        // Count leading zeros in the low 32 bits only (Gray Paper: reg_A mod 2^32).
        // Using u64::leading_zeros() would count zeros in the full 64 bits (e.g. 1 → 63); use u32.
        let value32 = value as u32;
        let count = if value32 == 0 {
            32u64
        } else {
            value32.leading_zeros() as u64
        };
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct TrailingZeroBits64Instruction;
impl TrailingZeroBits64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for TrailingZeroBits64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_TRAILING_ZERO_BITS_64)
    }
    fn name(&self) -> &'static str {
        "TRAILING_ZERO_BITS_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let count = if value == 0 {
            64u64
        } else {
            value.trailing_zeros() as u64
        };
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct TrailingZeroBits32Instruction;
impl TrailingZeroBits32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for TrailingZeroBits32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_TRAILING_ZERO_BITS_32)
    }
    fn name(&self) -> &'static str {
        "TRAILING_ZERO_BITS_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff_ffff;
        let count = if value == 0 {
            32u64
        } else {
            value.trailing_zeros() as u64
        };
        set_register(context.registers, p.register_d, count);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct SignExtend8Instruction;
impl SignExtend8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SignExtend8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SIGN_EXTEND_8)
    }
    fn name(&self) -> &'static str {
        "SIGN_EXTEND_8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xff;
        let sign_bit = value & 0x80;
        let result = if sign_bit != 0 {
            value | 0xffff_ffff_ffff_ff00
        } else {
            value
        };
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct SignExtend16Instruction;
impl SignExtend16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for SignExtend16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SIGN_EXTEND_16)
    }
    fn name(&self) -> &'static str {
        "SIGN_EXTEND_16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff;
        let signed = if value >= 0x8000 {
            (value as i64) - 0x10000
        } else {
            value as i64
        };
        set_register(context.registers, p.register_d, signed as u64);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct ZeroExtend16Instruction;
impl ZeroExtend16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ZeroExtend16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ZERO_EXTEND_16)
    }
    fn name(&self) -> &'static str {
        "ZERO_EXTEND_16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a) & 0xffff;
        set_register(context.registers, p.register_d, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct ReverseBytesInstruction;
impl ReverseBytesInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for ReverseBytesInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_REVERSE_BYTES)
    }
    fn name(&self) -> &'static str {
        "REVERSE_BYTES"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_two_registers(context.operands);
        let value = get_register(context.registers, p.register_a);
        let result = value.swap_bytes();
        set_register(context.registers, p.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
