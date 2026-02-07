//! POKE host function (Ω_O). Gray Paper: function ID 10.
//! r7=machine ID, r8=source offset, r9=dest offset in machine, r10=length.
//! No refineContext → set r7=WHO, return PANIC.

use crate::config::{FUNC_POKE, REG_OK, REG_OOB, REG_WHO};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// POKE (10): with refine_context: read from current RAM, write to machine RAM; source unreadable → PANIC; WHO if no machine, OOB if dest unwritable.
pub struct PokeHostFunction;

impl HostFunction for PokeHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_POKE
    }
    fn name(&self) -> &'static str {
        "poke"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            context.registers[7] = REG_WHO;
            crate::host_log!("[hostfn] poke PANIC: no refine_context");
            return HostFunctionResult::panic();
        };

        let machine_id = context.registers[7];
        let source_offset = context.registers[8] as u32;
        let dest_offset = context.registers[9] as u32;
        let length = context.registers[10] as u32;

        let read_result = context.ram.read_octets(source_offset, length);
        let Some(data) = read_result.data else {
            crate::host_log!(
                "[hostfn] poke PANIC: source read returned no data (offset={}, len={})",
                source_offset, length
            );
            return HostFunctionResult::panic();
        };
        if read_result.fault_address != 0 {
            crate::host_log!(
                "[hostfn] poke PANIC: source read fault (offset={}, len={}, fault_address={})",
                source_offset, length, read_result.fault_address
            );
            return HostFunctionResult::panic();
        }

        let mut write_ok = None;
        let found = refine.with_machine(machine_id, &mut |machine| {
            write_ok = Some(
                machine.ram_is_writable(dest_offset, length) && machine.ram_write(dest_offset, &data),
            );
        });

        if !found {
            context.registers[7] = REG_WHO;
            HostFunctionResult::continue_execution()
        } else if write_ok == Some(true) {
            context.registers[7] = REG_OK;
            HostFunctionResult::continue_execution()
        } else {
            context.registers[7] = REG_OOB;
            HostFunctionResult::continue_execution()
        }
    }
}
