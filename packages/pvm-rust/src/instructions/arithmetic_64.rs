//! 64-bit register arithmetic (mirrors assembly/instructions/arithmetic-64.ts).
//! ADD_64, SUB_64, MUL_64, DIV_U_64, DIV_S_64, REM_U_64, REM_S_64.

use crate::config::{
    OPCODE_ADD_64, OPCODE_DIV_S_64, OPCODE_DIV_U_64, OPCODE_MUL_64, OPCODE_REM_S_64,
    OPCODE_REM_U_64, OPCODE_SUB_64,
};
use crate::instructions::base::{parse_three_registers, InstructionHandler};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

fn to_signed64(x: u64) -> i64 {
    x as i64
}

// --- ADD_64 (200) ---
pub struct Add64Instruction;

impl Add64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Add64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ADD_64)
    }
    fn name(&self) -> &'static str {
        "ADD_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, value_a.wrapping_add(value_b));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SUB_64 (201) ---
pub struct Sub64Instruction;

impl Sub64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Sub64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SUB_64)
    }
    fn name(&self) -> &'static str {
        "SUB_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, value_a.wrapping_sub(value_b));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- MUL_64 (202) ---
pub struct Mul64Instruction;

impl Mul64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Mul64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_64)
    }
    fn name(&self) -> &'static str {
        "MUL_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, value_a.wrapping_mul(value_b));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- DIV_U_64 (203) ---
pub struct DivU64Instruction;

impl DivU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for DivU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_DIV_U_64)
    }
    fn name(&self) -> &'static str {
        "DIV_U_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        let result = if value_b == 0 {
            0xffff_ffff_ffff_ffff
        } else {
            value_a / value_b
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- DIV_S_64 (204) ---
pub struct DivS64Instruction;

impl DivS64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for DivS64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_DIV_S_64)
    }
    fn name(&self) -> &'static str {
        "DIV_S_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        let signed_a = to_signed64(value_a);
        let signed_b = to_signed64(value_b);
        let result = if signed_b == 0 {
            0xffff_ffff_ffff_ffffu64
        } else if signed_a == i64::MIN && signed_b == -1 {
            value_a
        } else {
            let q = signed_a / signed_b;
            q as u64
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- REM_U_64 (205) ---
pub struct RemU64Instruction;

impl RemU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for RemU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_REM_U_64)
    }
    fn name(&self) -> &'static str {
        "REM_U_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        let result = if value_b == 0 {
            value_a
        } else {
            value_a % value_b
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- REM_S_64 (206) ---
pub struct RemS64Instruction;

impl RemS64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for RemS64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_REM_S_64)
    }
    fn name(&self) -> &'static str {
        "REM_S_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a);
        let value_b = get_register(context.registers, parsed.register_b);
        let signed_a = to_signed64(value_a);
        let signed_b = to_signed64(value_b);
        let result = if signed_a == i64::MIN && signed_b == -1 {
            0u64
        } else if signed_b == 0 {
            value_a
        } else {
            let abs_a = signed_a.unsigned_abs();
            let abs_b = signed_b.unsigned_abs();
            let sign = if signed_a < 0 { -1i64 } else { 1 };
            let signed_rem = sign * (abs_a as i64 % abs_b as i64);
            signed_rem as u64
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
