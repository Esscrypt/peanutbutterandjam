//! MACHINE host function (Ω_M). Gray Paper: function ID 8.
//! r7=program offset, r8=program length, r9=initial PC. No refineContext → PANIC.

use crate::config::FUNC_MACHINE;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// MACHINE (8): with refine_context: read program from memory, add_machine, r7=machine_id. No refine → PANIC.
pub struct MachineHostFunction;

impl HostFunction for MachineHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_MACHINE
    }
    fn name(&self) -> &'static str {
        "machine"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            return HostFunctionResult::panic();
        };
        // Base 10 gas already deducted in state_wrapper before host dispatch.

        let program_offset = context.registers[7] as u32;
        let program_length = context.registers[8] as u32;
        let initial_pc = context.registers[9];

        let read_result = context.ram.read_octets(program_offset, program_length);
        let Some(program_data) = read_result.data else {
            return HostFunctionResult::fault();
        };
        if read_result.fault_address != 0 {
            return HostFunctionResult::fault();
        }

        let machine_id = refine.add_machine(&program_data, initial_pc);
        context.registers[7] = machine_id;
        HostFunctionResult::continue_execution()
    }
}
