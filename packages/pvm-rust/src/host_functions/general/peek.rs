//! PEEK host function (Ω_P). Gray Paper: function ID 9.
//! r7=n (machine ID), r8=dest offset, r9=source offset in machine, r10=length.
//! No refineContext → set r7=WHO, return PANIC.

use crate::config::{FUNC_PEEK, REG_OK, REG_OOB, REG_WHO};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// PEEK (9): with refine_context: copy from machine RAM to current RAM; WHO if no machine, OOB if source unreadable; dest unwritable → PANIC.
pub struct PeekHostFunction;

impl HostFunction for PeekHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_PEEK
    }
    fn name(&self) -> &'static str {
        "peek"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            context.registers[7] = REG_WHO;
            crate::host_log!("[hostfn] peek PANIC: no refine_context");
            return HostFunctionResult::panic();
        };

        let machine_id = context.registers[7];
        let dest_offset = context.registers[8] as u32;
        let source_offset = context.registers[9] as u32;
        let length = context.registers[10] as u32;

        let mut data = None;
        let found = refine.with_machine(machine_id, &mut |machine| {
            if machine.ram_is_readable(source_offset, length) {
                data = machine.ram_read(source_offset, length);
            }
        });
        if !found {
            context.registers[7] = REG_WHO;
            return HostFunctionResult::continue_execution();
        }
        let Some(data) = data else {
            context.registers[7] = REG_OOB;
            return HostFunctionResult::continue_execution();
        };

        let writable = context.ram.is_writable_with_fault(dest_offset, length);
        if !writable.success {
            crate::host_log!(
                "[hostfn] peek PANIC: dest not writable (offset={}, len={}, fault_address={})",
                dest_offset, length, writable.fault_address
            );
            return HostFunctionResult::panic();
        }
        let write_result = context.ram.write_octets(dest_offset, &data);
        if write_result.has_fault {
            crate::host_log!(
                "[hostfn] peek PANIC: dest write fault (offset={}, len={})",
                dest_offset, data.len()
            );
            return HostFunctionResult::panic();
        }

        context.registers[7] = REG_OK;
        HostFunctionResult::continue_execution()
    }
}
