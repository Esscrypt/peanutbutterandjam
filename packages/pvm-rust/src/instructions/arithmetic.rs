//! Arithmetic instructions (mirrors assembly/instructions/arithmetic.ts).
//! ADD_IMM_32, MUL_IMM_32, ADD_IMM_64, MUL_IMM_64.

use crate::config::{
    OPCODE_ADD_32, OPCODE_ADD_IMM_32, OPCODE_ADD_IMM_64, OPCODE_DIV_S_32, OPCODE_DIV_U_32,
    OPCODE_MUL_32, OPCODE_MUL_IMM_32, OPCODE_MUL_IMM_64, OPCODE_REM_S_32, OPCODE_REM_U_32,
    OPCODE_SUB_32,
};
use crate::instructions::base::{
    parse_three_registers, parse_two_registers_and_immediate, sign_extend, InstructionHandler,
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

/// Get register value as 32-bit sign-extended to 64 (for arithmetic).
fn get_register_as_32_signed(registers: &[u64; 13], index: u8) -> i64 {
    let low = get_register(registers, index) & 0xffff_ffff;
    sign_extend(low, 4) as i64
}

/// Set register with 32-bit result (low 32 bits of value, sign-extended to 64).
fn set_register_32_signed(registers: &mut [u64; 13], index: u8, value: i64) {
    let low = (value as u64) & 0xffff_ffff;
    let extended = sign_extend(low, 4);
    set_register(registers, index, extended);
}

/// Set register with 32-bit unsigned result (sign-extended to 64).
fn set_register_32_result(registers: &mut [u64; 13], index: u8, value: u64) {
    let low = value & 0xffff_ffff;
    let extended = sign_extend(low, 4);
    set_register(registers, index, extended);
}

// --- SUB_32 (191) ---
/// Gray Paper: reg'_D = sext{4}{(reg_A + 2^32 - (reg_B mod 2^32)) mod 2^32}
pub struct Sub32Instruction;

impl Sub32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Sub32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SUB_32)
    }
    fn name(&self) -> &'static str {
        "SUB_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let result = value_a.wrapping_sub(value_b) & 0xffff_ffff;
        set_register_32_result(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- MUL_32 (192) ---
/// Gray Paper: reg'_D = sext{4}{(reg_A · reg_B) mod 2^32}
pub struct Mul32Instruction;

impl Mul32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Mul32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_32)
    }
    fn name(&self) -> &'static str {
        "MUL_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let result = (value_a * value_b) & 0xffff_ffff;
        set_register_32_result(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- DIV_U_32 (193) ---
/// Gray Paper: reg'_D = 2^64-1 when reg_B mod 2^32 = 0, else sext{4}{floor((reg_A mod 2^32) ÷ (reg_B mod 2^32))}
pub struct DivU32Instruction;

impl DivU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for DivU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_DIV_U_32)
    }
    fn name(&self) -> &'static str {
        "DIV_U_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let result = if value_b == 0 {
            0xffff_ffff_ffff_ffff
        } else {
            sign_extend(value_a / value_b, 4)
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- DIV_S_32 (194) ---
/// Gray Paper: div by zero -> 2^64-1; a=-2^31 and b=-1 -> unsigned{a}; else rtz(a÷b)
pub struct DivS32Instruction;

impl DivS32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for DivS32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_DIV_S_32)
    }
    fn name(&self) -> &'static str {
        "DIV_S_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let signed_a = sign_extend(value_a, 4) as i64;
        let signed_b = sign_extend(value_b, 4) as i64;
        let result = if signed_b == 0 {
            0xffff_ffff_ffff_ffffu64
        } else if value_a == 0x8000_0000 && value_b == 0xffff_ffff {
            value_a
        } else {
            let q = signed_a / signed_b;
            ((q as u64).wrapping_add(if q < 0 { 0x1_0000_0000 } else { 0 })) & 0xffff_ffff
        };
        set_register_32_result(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- REM_U_32 (195) ---
/// Gray Paper: when B=0 result = sext(reg_A mod 2^32), else sext{(reg_A mod 2^32) mod (reg_B mod 2^32)}
pub struct RemU32Instruction;

impl RemU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for RemU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_REM_U_32)
    }
    fn name(&self) -> &'static str {
        "REM_U_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let result = if value_b == 0 {
            value_a
        } else {
            value_a % value_b
        };
        set_register_32_result(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- REM_S_32 (196) ---
/// Gray Paper: 0 when a=-2^31 and b=-1; else smod(a,b)
pub struct RemS32Instruction;

impl RemS32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for RemS32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_REM_S_32)
    }
    fn name(&self) -> &'static str {
        "REM_S_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register(context.registers, parsed.register_a) & 0xffff_ffff;
        let value_b = get_register(context.registers, parsed.register_b) & 0xffff_ffff;
        let signed_a = sign_extend(value_a, 4) as i64;
        let signed_b = sign_extend(value_b, 4) as i64;
        let result = if value_a == 0x8000_0000 && value_b == 0xffff_ffff {
            0u64
        } else if signed_b == 0 {
            (signed_a as u64).wrapping_add(if signed_a < 0 { 0x1_0000_0000 } else { 0 }) & 0xffff_ffff
        } else {
            let abs_a = signed_a.unsigned_abs() as u64;
            let abs_b = signed_b.unsigned_abs() as u64;
            let sign_a = if signed_a < 0 { -1i64 } else { 1 };
            let smod_val = sign_a * (abs_a as i64 % abs_b as i64);
            (smod_val as u64).wrapping_add(if smod_val < 0 { 0x1_0000_0000 } else { 0 }) & 0xffff_ffff
        };
        set_register_32_result(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- ADD_32 (190) ---
/// Gray Paper: reg'_D = sext{4}{(reg_A + reg_B) mod 2^32}
pub struct Add32Instruction;

impl Add32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for Add32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ADD_32)
    }
    fn name(&self) -> &'static str {
        "ADD_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let value_a = get_register_as_32_signed(context.registers, parsed.register_a);
        let value_b = get_register_as_32_signed(context.registers, parsed.register_b);
        let sum = (value_a as i64).wrapping_add(value_b) as u64 & 0xffff_ffff;
        let extended = sign_extend(sum, 4);
        set_register(context.registers, parsed.register_d, extended);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- ADD_IMM_32 (131) ---
/// Gray Paper: reg'_A = sext{4}{(\reg_B + \immed_X) mod 2^32}
pub struct AddImm32Instruction;

impl AddImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for AddImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ADD_IMM_32)
    }
    fn name(&self) -> &'static str {
        "ADD_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register_as_32_signed(context.registers, parsed.register_b);
        let sum = reg_b.wrapping_add(parsed.immediate_x);
        set_register_32_signed(context.registers, parsed.register_a, sum);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- MUL_IMM_32 (135) ---
/// Gray Paper: reg'_A = sext{4}((reg_B · immed_X) mod 2^32)
pub struct MulImm32Instruction;

impl MulImm32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for MulImm32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_IMM_32)
    }
    fn name(&self) -> &'static str {
        "MUL_IMM_32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register_as_32_signed(context.registers, parsed.register_b);
        let product = reg_b.wrapping_mul(parsed.immediate_x);
        set_register_32_signed(context.registers, parsed.register_a, product);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- ADD_IMM_64 (149) ---
/// Gray Paper: reg'_A = (reg_B + immed_X) mod 2^64
pub struct AddImm64Instruction;

impl AddImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for AddImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ADD_IMM_64)
    }
    fn name(&self) -> &'static str {
        "ADD_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let sum = reg_b.wrapping_add(parsed.immediate_x as u64);
        set_register(context.registers, parsed.register_a, sum);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- MUL_IMM_64 (150) ---
/// Gray Paper: reg'_A = (reg_B · immed_X) mod 2^64
pub struct MulImm64Instruction;

impl MulImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for MulImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_MUL_IMM_64)
    }
    fn name(&self) -> &'static str {
        "MUL_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let product = reg_b.wrapping_mul(parsed.immediate_x as u64);
        set_register(context.registers, parsed.register_a, product);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
