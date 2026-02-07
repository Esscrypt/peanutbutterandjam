//! AND_INV (reg_D = reg_A & !reg_B), OR_INV (reg_D = reg_A | !reg_B), XNOR (reg_D = !(reg_A ^ reg_B)).

use crate::config::{OPCODE_AND_INV, OPCODE_OR_INV, OPCODE_XNOR};
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

pub struct AndInvInstruction;
impl AndInvInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for AndInvInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_AND_INV)
    }
    fn name(&self) -> &'static str {
        "AND_INV"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        set_register(context.registers, p.register_d, a & !b);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct OrInvInstruction;
impl OrInvInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for OrInvInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_OR_INV)
    }
    fn name(&self) -> &'static str {
        "OR_INV"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        set_register(context.registers, p.register_d, a | !b);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct XnorInstruction;
impl XnorInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for XnorInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_XNOR)
    }
    fn name(&self) -> &'static str {
        "XNOR"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let p = parse_three_registers(context.operands);
        let a = get_register(context.registers, p.register_a);
        let b = get_register(context.registers, p.register_b);
        set_register(context.registers, p.register_d, !(a ^ b));
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}
