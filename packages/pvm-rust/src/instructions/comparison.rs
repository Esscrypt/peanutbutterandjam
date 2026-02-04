//! Comparison instructions (mirrors assembly/instructions/comparison.ts).
//! SET_LT_U_IMM, SET_LT_S_IMM, SET_GT_U_IMM, SET_GT_S_IMM.

use crate::config::{
    OPCODE_SET_GT_S_IMM, OPCODE_SET_GT_U_IMM, OPCODE_SET_LT_S, OPCODE_SET_LT_S_IMM,
    OPCODE_SET_LT_U, OPCODE_SET_LT_U_IMM,
};
use crate::instructions::base::{
    parse_three_registers, parse_two_registers_and_immediate, InstructionHandler,
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

// --- SET_LT_U (216) ---
pub struct SetLtUInstruction;

impl SetLtUInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetLtUInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_LT_U)
    }
    fn name(&self) -> &'static str {
        "SET_LT_U"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let a = get_register(context.registers, parsed.register_a);
        let b = get_register(context.registers, parsed.register_b);
        set_register(context.registers, parsed.register_d, if a < b { 1 } else { 0 });
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SET_LT_S (217) ---
pub struct SetLtSInstruction;

impl SetLtSInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetLtSInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_LT_S)
    }
    fn name(&self) -> &'static str {
        "SET_LT_S"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let a = get_register(context.registers, parsed.register_a) as i64;
        let b = get_register(context.registers, parsed.register_b) as i64;
        set_register(context.registers, parsed.register_d, if a < b { 1 } else { 0 });
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SET_LT_U_IMM (136) ---
/// Gray Paper: reg'_A = reg_B < immed_X (unsigned).
pub struct SetLtUImmInstruction;

impl SetLtUImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetLtUImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_LT_U_IMM)
    }
    fn name(&self) -> &'static str {
        "SET_LT_U_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let imm_u = parsed.immediate_x as u64;
        let result = if reg_b < imm_u { 1u64 } else { 0u64 };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SET_LT_S_IMM (137) ---
/// Gray Paper: reg'_A = signed(reg_B) < signed(immed_X).
pub struct SetLtSImmInstruction;

impl SetLtSImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetLtSImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_LT_S_IMM)
    }
    fn name(&self) -> &'static str {
        "SET_LT_S_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b) as i64;
        let result = if reg_b < parsed.immediate_x { 1u64 } else { 0u64 };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SET_GT_U_IMM (142) ---
/// Gray Paper: reg'_A = reg_B > immed_X (unsigned).
pub struct SetGtUImmInstruction;

impl SetGtUImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetGtUImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_GT_U_IMM)
    }
    fn name(&self) -> &'static str {
        "SET_GT_U_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let imm_u = parsed.immediate_x as u64;
        let result = if reg_b > imm_u { 1u64 } else { 0u64 };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- SET_GT_S_IMM (143) ---
/// Gray Paper: reg'_A = signed(reg_B) > signed(immed_X).
pub struct SetGtSImmInstruction;

impl SetGtSImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for SetGtSImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_SET_GT_S_IMM)
    }
    fn name(&self) -> &'static str {
        "SET_GT_S_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b) as i64;
        let result = if reg_b > parsed.immediate_x { 1u64 } else { 0u64 };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
