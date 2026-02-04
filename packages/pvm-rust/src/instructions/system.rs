//! System instructions (ECALLI). Mirrors assembly/instructions/system.ts.

use crate::config::{OPCODE_ECALLI, RESULT_CODE_HOST};
use crate::instructions::base::InstructionHandler;
use crate::types::{InstructionContext, InstructionResult};

/// ECALLI (opcode 10): host call with immediate. Returns RESULT_CODE_HOST for PVM to dispatch.
pub struct EcalliInstruction;

impl EcalliInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for EcalliInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_ECALLI)
    }

    fn name(&self) -> &'static str {
        "ECALLI"
    }

    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let host_call_id = context
            .operands
            .first()
            .copied()
            .unwrap_or(0) as u32;
        if let Some(ref mut out) = context.host_call_id_out {
            **out = host_call_id;
        }
        InstructionResult::new(RESULT_CODE_HOST as i32, 0)
    }
}

impl Default for EcalliInstruction {
    fn default() -> Self {
        Self::new()
    }
}
