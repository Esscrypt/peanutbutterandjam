//! Conditional move instructions (mirrors assembly/instructions/conditional.ts and conditional-register.ts).
//! CMOV_IZ_IMM, CMOV_NZ_IMM, CMOV_IZ, CMOV_NZ.

use crate::config::{OPCODE_CMOV_IZ, OPCODE_CMOV_IZ_IMM, OPCODE_CMOV_NZ, OPCODE_CMOV_NZ_IMM};
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

// --- CMOV_IZ_IMM (147) ---
/// Gray Paper: reg'_A = immed_X when reg_B = 0, else reg_A.
pub struct CmovIzImmInstruction;

impl CmovIzImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for CmovIzImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_CMOV_IZ_IMM)
    }
    fn name(&self) -> &'static str {
        "CMOV_IZ_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = if reg_b == 0 {
            parsed.immediate_x as u64
        } else {
            get_register(context.registers, parsed.register_a)
        };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- CMOV_NZ_IMM (148) ---
/// Gray Paper: reg'_A = immed_X when reg_B ≠ 0, else reg_A.
pub struct CmovNzImmInstruction;

impl CmovNzImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for CmovNzImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_CMOV_NZ_IMM)
    }
    fn name(&self) -> &'static str {
        "CMOV_NZ_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = if reg_b != 0 {
            parsed.immediate_x as u64
        } else {
            get_register(context.registers, parsed.register_a)
        };
        set_register(context.registers, parsed.register_a, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- CMOV_IZ (218) ---
/// Gray Paper: reg'_D = reg_A when reg_B = 0, else reg_D.
pub struct CmovIzInstruction;

impl CmovIzInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for CmovIzInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_CMOV_IZ)
    }
    fn name(&self) -> &'static str {
        "CMOV_IZ"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = if reg_b == 0 {
            get_register(context.registers, parsed.register_a)
        } else {
            get_register(context.registers, parsed.register_d)
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- CMOV_NZ (219) ---
/// Gray Paper: reg'_D = reg_A when reg_B ≠ 0, else reg_D.
pub struct CmovNzInstruction;

impl CmovNzInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for CmovNzInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_CMOV_NZ)
    }
    fn name(&self) -> &'static str {
        "CMOV_NZ"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_three_registers(context.operands);
        let reg_b = get_register(context.registers, parsed.register_b);
        let result = if reg_b != 0 {
            get_register(context.registers, parsed.register_a)
        } else {
            get_register(context.registers, parsed.register_d)
        };
        set_register(context.registers, parsed.register_d, result);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
