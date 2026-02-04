//! EXPUNGE host function (Ω_X). Gray Paper: function ID 13.
//! r7=machine ID. No refineContext → PANIC. WHO → HALT; else r7=pc, continue.

use crate::config::FUNC_EXPUNGE;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// EXPUNGE (13): with refine_context: remove machine; r7=WHO and HALT if not found, else r7=pc and continue.
pub struct ExpungeHostFunction;

impl HostFunction for ExpungeHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_EXPUNGE
    }
    fn name(&self) -> &'static str {
        "expunge"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            return HostFunctionResult::panic();
        };

        let machine_id = context.registers[7];
        match refine.remove_machine(machine_id) {
            None => {
                context.registers[7] = crate::config::REG_WHO;
                HostFunctionResult::halt()
            }
            Some(pc) => {
                context.registers[7] = pc;
                HostFunctionResult::continue_execution()
            }
        }
    }
}
