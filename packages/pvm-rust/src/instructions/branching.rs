//! Branching instructions (mirrors assembly/instructions/branching.ts).
//! BRANCH_*_IMM (reg vs immediate) and BRANCH_* (reg vs reg).

use crate::config::{
    OPCODE_BRANCH_EQ, OPCODE_BRANCH_EQ_IMM, OPCODE_BRANCH_GE_S, OPCODE_BRANCH_GE_S_IMM, OPCODE_BRANCH_GE_U, OPCODE_BRANCH_GE_U_IMM, OPCODE_BRANCH_GT_S_IMM, OPCODE_BRANCH_GT_U_IMM, OPCODE_BRANCH_LE_S_IMM, OPCODE_BRANCH_LE_U_IMM, OPCODE_BRANCH_LT_S, OPCODE_BRANCH_LT_S_IMM, OPCODE_BRANCH_LT_U, OPCODE_BRANCH_LT_U_IMM, OPCODE_BRANCH_NE, OPCODE_BRANCH_NE_IMM,
};
use crate::instructions::base::{
    parse_branch_operands, parse_register_branch_operands, validate_branch_target,
    InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

/// When condition is true, validate target then set PC; otherwise continue. Matches TS: validateBranchTarget before branch.
fn do_branch_imm(
    context: &mut InstructionContext<'_>,
    condition: bool,
    target_address: u32,
) -> InstructionResult {
    if condition {
        if let Some(panic_result) =
            validate_branch_target(target_address, context.code, context.bitmask)
        {
            return panic_result;
        }
        context.program_counter = target_address;
    }
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

/// When condition is true, validate target then set PC; otherwise continue. Matches TS: validateBranchTarget before branch.
fn do_branch_reg(
    context: &mut InstructionContext<'_>,
    condition: bool,
    target_address: u32,
) -> InstructionResult {
    if condition {
        if let Some(panic_result) =
            validate_branch_target(target_address, context.code, context.bitmask)
        {
            return panic_result;
        }
        context.program_counter = target_address;
    }
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

macro_rules! branch_imm_instruction {
    ($name:ident, $opcode:ident, $cond:expr) => {
        pub struct $name;

        impl $name {
            #[must_use]
            pub const fn new() -> Self {
                Self
            }
        }

        impl InstructionHandler for $name {
            fn opcode(&self) -> i32 {
                i32::from($opcode)
            }
            fn name(&self) -> &'static str {
                stringify!($name)
            }
            fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
                let parsed = parse_branch_operands(context.operands, context.program_counter);
                let reg_val = get_register(context.registers, parsed.register_a);
                let cond = $cond(reg_val, parsed.immediate_x);
                do_branch_imm(context, cond, parsed.target_address)
            }
        }
    };
}

// Signed compare: (a as i64).cmp(b) -> use in condition
fn branch_eq(reg: u64, imm: i64) -> bool {
    reg as i64 == imm
}
fn branch_ne(reg: u64, imm: i64) -> bool {
    reg as i64 != imm
}
fn branch_lt_u(reg: u64, imm: i64) -> bool {
    reg < imm as u64
}
fn branch_le_u(reg: u64, imm: i64) -> bool {
    reg <= imm as u64
}
fn branch_ge_u(reg: u64, imm: i64) -> bool {
    reg >= imm as u64
}
fn branch_gt_u(reg: u64, imm: i64) -> bool {
    reg > imm as u64
}
fn branch_lt_s(reg: u64, imm: i64) -> bool {
    (reg as i64) < imm
}
fn branch_le_s(reg: u64, imm: i64) -> bool {
    (reg as i64) <= imm
}
fn branch_ge_s(reg: u64, imm: i64) -> bool {
    (reg as i64) >= imm
}
fn branch_gt_s(reg: u64, imm: i64) -> bool {
    (reg as i64) > imm
}

branch_imm_instruction!(BranchEqImmInstruction, OPCODE_BRANCH_EQ_IMM, branch_eq);
branch_imm_instruction!(BranchNeImmInstruction, OPCODE_BRANCH_NE_IMM, branch_ne);
branch_imm_instruction!(BranchLtUImmInstruction, OPCODE_BRANCH_LT_U_IMM, branch_lt_u);
branch_imm_instruction!(BranchLeUImmInstruction, OPCODE_BRANCH_LE_U_IMM, branch_le_u);
branch_imm_instruction!(BranchGeUImmInstruction, OPCODE_BRANCH_GE_U_IMM, branch_ge_u);
branch_imm_instruction!(BranchGtUImmInstruction, OPCODE_BRANCH_GT_U_IMM, branch_gt_u);
branch_imm_instruction!(BranchLtSImmInstruction, OPCODE_BRANCH_LT_S_IMM, branch_lt_s);
branch_imm_instruction!(BranchLeSImmInstruction, OPCODE_BRANCH_LE_S_IMM, branch_le_s);
branch_imm_instruction!(BranchGeSImmInstruction, OPCODE_BRANCH_GE_S_IMM, branch_ge_s);
branch_imm_instruction!(BranchGtSImmInstruction, OPCODE_BRANCH_GT_S_IMM, branch_gt_s);

// Register-based branches
macro_rules! branch_reg_instruction {
    ($name:ident, $opcode:ident, $cond:expr) => {
        pub struct $name;

        impl $name {
            #[must_use]
            pub const fn new() -> Self {
                Self
            }
        }

        impl InstructionHandler for $name {
            fn opcode(&self) -> i32 {
                i32::from($opcode)
            }
            fn name(&self) -> &'static str {
                stringify!($name)
            }
            fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
                let parsed =
                    parse_register_branch_operands(context.operands, context.program_counter);
                let reg_a = get_register(context.registers, parsed.register_a);
                let reg_b = get_register(context.registers, parsed.register_b);
                let cond = $cond(reg_a, reg_b);
                do_branch_reg(context, cond, parsed.target_address)
            }
        }
    };
}

fn branch_eq_reg(a: u64, b: u64) -> bool {
    a == b
}
fn branch_ne_reg(a: u64, b: u64) -> bool {
    a != b
}
fn branch_lt_u_reg(a: u64, b: u64) -> bool {
    a < b
}
fn branch_lt_s_reg(a: u64, b: u64) -> bool {
    (a as i64) < (b as i64)
}
fn branch_ge_u_reg(a: u64, b: u64) -> bool {
    a >= b
}
fn branch_ge_s_reg(a: u64, b: u64) -> bool {
    (a as i64) >= (b as i64)
}

branch_reg_instruction!(BranchEqInstruction, OPCODE_BRANCH_EQ, branch_eq_reg);
branch_reg_instruction!(BranchNeInstruction, OPCODE_BRANCH_NE, branch_ne_reg);
branch_reg_instruction!(BranchLtUInstruction, OPCODE_BRANCH_LT_U, branch_lt_u_reg);
branch_reg_instruction!(BranchLtSInstruction, OPCODE_BRANCH_LT_S, branch_lt_s_reg);
branch_reg_instruction!(BranchGeUInstruction, OPCODE_BRANCH_GE_U, branch_ge_u_reg);
branch_reg_instruction!(BranchGeSInstruction, OPCODE_BRANCH_GE_S, branch_ge_s_reg);
