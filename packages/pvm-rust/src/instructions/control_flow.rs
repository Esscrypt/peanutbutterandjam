//! Control flow instructions (TRAP, FALLTHROUGH, JUMP, etc.). Mirrors assembly/instructions/control-flow.ts.

use crate::config::{
    HALT_ADDRESS, OPCODE_FALLTHROUGH, OPCODE_JUMP, OPCODE_JUMP_IND, OPCODE_LOAD_IMM_JUMP,
    OPCODE_LOAD_IMM_JUMP_IND, OPCODE_TRAP, RESULT_CODE_HALT, RESULT_CODE_PANIC,
};
use crate::instructions::base::{
    parse_one_offset, parse_one_register_and_immediate, parse_register_and_two_immediates,
    parse_two_registers_and_two_immediates, validate_branch_target, InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

/// TRAP (opcode 0): panic.
pub struct TrapInstruction;

impl TrapInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for TrapInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_TRAP)
    }

    fn name(&self) -> &'static str {
        "TRAP"
    }

    fn execute(&self, _context: &mut InstructionContext<'_>) -> InstructionResult {
        InstructionResult::new(RESULT_CODE_PANIC as i32, 0)
    }
}

impl Default for TrapInstruction {
    fn default() -> Self {
        Self::new()
    }
}

/// FALLTHROUGH (opcode 1): no-op, continue.
pub struct FallthroughInstruction;

impl FallthroughInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for FallthroughInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_FALLTHROUGH)
    }

    fn name(&self) -> &'static str {
        "FALLTHROUGH"
    }

    fn execute(&self, _context: &mut InstructionContext<'_>) -> InstructionResult {
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for FallthroughInstruction {
    fn default() -> Self {
        Self::new()
    }
}

/// JUMP (opcode 0x40): unconditional jump. Gray Paper one-offset format.
/// Format: One Offset. immed_X = ι + signfunc(offset). Mutation: branch(immed_X, ⊤).
/// Checks: target must be a valid basic block start (validate_branch_target).
pub struct JumpInstruction;

impl JumpInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for JumpInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_JUMP)
    }

    fn name(&self) -> &'static str {
        "JUMP"
    }

    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        // Gray Paper: target = ι + signfunc(offset); use instruction PC (current program_counter).
        let target = parse_one_offset(context.operands, context.fskip, context.program_counter);
        if let Some(panic_result) =
            validate_branch_target(target, context.code, context.bitmask)
        {
            return panic_result;
        }
        context.program_counter = target;
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for JumpInstruction {
    fn default() -> Self {
        Self::new()
    }
}

/// JUMP_IND (opcode 0x50): indirect jump. djump((reg_A + immed_X) mod 2^32).
/// Gray Paper djump(a): HALT when a = 2^32-2^16; PANIC when a=0 ∨ a>len(j)·2 ∨ a mod 2≠0 ∨ j_{(a/2)-1} ∉ basicblocks.
/// Checks: (1) a === HALT_ADDRESS → HALT, (2) a===0 || a>maxAddress || a%2!==0 → PANIC,
/// (3) index = (a/2)-1; index < 0 || index >= jumpTable.len() → PANIC, (4) validate_branch_target(target) → PANIC if invalid.
pub struct JumpIndInstruction;

impl JumpIndInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for JumpIndInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_JUMP_IND)
    }

    fn name(&self) -> &'static str {
        "JUMP_IND"
    }

    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_one_register_and_immediate(context.operands, context.fskip);
        let register_value = context.registers[parsed.register_a as usize];
        let a = (register_value.wrapping_add(parsed.immediate_x as u64)) & 0xffff_ffff;

        // Gray Paper: HALT when a = 2^32 - 2^16
        if a == u64::from(HALT_ADDRESS) {
            return InstructionResult::new(RESULT_CODE_HALT as i32, 0);
        }
        // Gray Paper: PANIC when a = 0 ∨ a > len(j)·2 ∨ a mod 2 ≠ 0
        let max_address = (context.jump_table.len() as u64) * 2;
        if a == 0 || a > max_address || (a % 2) != 0 {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        // index = (a/2) - 1; PANIC if index < 0 (i.e. a/2 < 1) or index >= len
        let half = a / 2;
        if half < 1 {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let index = (half - 1) as usize;
        if index >= context.jump_table.len() {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let target = context.jump_table[index];
        if let Some(panic_result) = validate_branch_target(target, context.code, context.bitmask) {
            return panic_result;
        }
        context.program_counter = target;
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for JumpIndInstruction {
    fn default() -> Self {
        Self::new()
    }
}

/// LOAD_IMM_JUMP (opcode 80): load immediate and jump. branch(immed_Y, ⊤), reg_A' = immed_X.
/// targetAddress = pc + signedOffset (immediateY sign-extended). Checks: validate_branch_target(target) → PANIC if invalid.
pub struct LoadImmJumpInstruction;

impl LoadImmJumpInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadImmJumpInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IMM_JUMP)
    }

    fn name(&self) -> &'static str {
        "LOAD_IMM_JUMP"
    }

    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_register_and_two_immediates(context.operands, context.fskip);
        // Gray Paper: target = ι + signfunc(immed_Y); immediate_y is already sign-extended from parser
        let target = (context.program_counter as i64).wrapping_add(parsed.immediate_y) as u32;
        if let Some(panic_result) = validate_branch_target(target, context.code, context.bitmask) {
            return panic_result;
        }
        context.registers[parsed.register_a as usize] = parsed.immediate_x as u64;
        context.program_counter = target;
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for LoadImmJumpInstruction {
    fn default() -> Self {
        Self::new()
    }
}

/// LOAD_IMM_JUMP_IND (opcode 180): djump((reg_B + immed_Y) mod 2^32), reg_A' = immed_X.
/// Order: read reg_B, set reg_A = immed_X, then djump. Same djump checks as JUMP_IND.
pub struct LoadImmJumpIndInstruction;

impl LoadImmJumpIndInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadImmJumpIndInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IMM_JUMP_IND)
    }

    fn name(&self) -> &'static str {
        "LOAD_IMM_JUMP_IND"
    }

    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let parsed = parse_two_registers_and_two_immediates(context.operands, context.fskip);
        // Gray Paper: read reg_B before overwriting reg_A
        let register_b_value = context.registers[parsed.register_b as usize];
        context.registers[parsed.register_a as usize] = parsed.immediate_x as u64;
        let a = (register_b_value.wrapping_add(parsed.immediate_y as u64)) & 0xffff_ffff;

        // Gray Paper: HALT when a = 2^32 - 2^16
        if a == u64::from(HALT_ADDRESS) {
            return InstructionResult::new(RESULT_CODE_HALT as i32, 0);
        }
        // Gray Paper: PANIC when a = 0 ∨ a > len(j)·2 ∨ a mod 2 ≠ 0
        let max_address = (context.jump_table.len() as u64) * 2;
        if a == 0 || a > max_address || (a % 2) != 0 {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        // index = (a/2) - 1; PANIC if index < 0 or index >= len
        let half = a / 2;
        if half < 1 {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let index = (half - 1) as usize;
        if index >= context.jump_table.len() {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let target = context.jump_table[index];
        if let Some(panic_result) = validate_branch_target(target, context.code, context.bitmask) {
            return panic_result;
        }
        context.program_counter = target;
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

impl Default for LoadImmJumpIndInstruction {
    fn default() -> Self {
        Self::new()
    }
}
