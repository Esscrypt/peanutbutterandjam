//! EXPORT host function (Ω_E). Gray Paper: function ID 7.
//! r7=memory offset (p), r8=length (capped at SEGMENT_SIZE). No refineContext → PANIC.

use crate::config::{FUNC_EXPORT, REG_FULL, SEGMENT_SIZE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// EXPORT (7): with refine_context: read memory, zero-pad segment, append; r7=segoff+len or FULL. No refine → PANIC.
pub struct ExportHostFunction;

impl HostFunction for ExportHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_EXPORT
    }
    fn name(&self) -> &'static str {
        "export"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            return HostFunctionResult::panic();
        };

        let memory_offset = context.registers[7] as u32;
        let raw_length = context.registers[8] as u32;
        let capped_length = raw_length.min(SEGMENT_SIZE);

        let check = context.ram.is_readable_with_fault(memory_offset, capped_length);
        if !check.success {
            context.registers[7] = 0;
            return HostFunctionResult::panic();
        }
        let read_result = context.ram.read_octets(memory_offset, capped_length);
        let Some(data) = read_result.data else {
            context.registers[7] = 0;
            return HostFunctionResult::panic();
        };
        if read_result.fault_address != 0 {
            context.registers[7] = 0;
            return HostFunctionResult::panic();
        }

        let mut segment = vec![0u8; SEGMENT_SIZE as usize];
        let len = data.len().min(SEGMENT_SIZE as usize);
        segment[..len].copy_from_slice(&data[..len]);

        match refine.push_export_segment(segment) {
            Ok(result) => context.registers[7] = result as u64,
            Err(()) => context.registers[7] = REG_FULL,
        }
        HostFunctionResult::continue_execution()
    }
}
