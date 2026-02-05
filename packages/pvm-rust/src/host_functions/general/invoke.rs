//! INVOKE host function (Ω_K). Gray Paper: function ID 12.
//! r7=machine ID, r8=memory offset for gas (8) + registers (104). No refineContext → PANIC.

use crate::config::FUNC_INVOKE;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const INVOKE_HEADER_SIZE: u32 = 8 + 104; // gas (8) + 13 registers (104)

fn decode_u64(bytes: &[u8]) -> u64 {
    let mut buf = [0u8; 8];
    let len = bytes.len().min(8);
    buf[..len].copy_from_slice(&bytes[..len]);
    u64::from_le_bytes(buf)
}

fn encode_u64(value: u64) -> [u8; 8] {
    value.to_le_bytes()
}

/// INVOKE (12): with refine_context: read gas+regs from memory, run machine, write back; r7=result, r8=extra. No refine → PANIC.
pub struct InvokeHostFunction;

impl HostFunction for InvokeHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_INVOKE
    }
    fn name(&self) -> &'static str {
        "invoke"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            crate::host_log!("[hostfn] invoke PANIC: no refine_context");
            return HostFunctionResult::panic();
        };

        let machine_id = context.registers[7];
        let memory_offset = context.registers[8] as u32;

        let read_result = context.ram.read_octets(memory_offset, INVOKE_HEADER_SIZE);
        let Some(data) = read_result.data else {
            crate::host_log!(
                "[hostfn] invoke PANIC: header read returned no data (offset={})",
                memory_offset
            );
            return HostFunctionResult::panic();
        };
        if read_result.fault_address != 0 || data.len() < INVOKE_HEADER_SIZE as usize {
            crate::host_log!(
                "[hostfn] invoke PANIC: header read fault (offset={}, fault_address={}, len={})",
                memory_offset, read_result.fault_address, data.len()
            );
            return HostFunctionResult::panic();
        }

        let gas_limit = decode_u64(&data[0..8]) as u32;
        let mut registers = [0u64; 13];
        for (i, r) in registers.iter_mut().enumerate() {
            let start = 8 + i * 8;
            *r = decode_u64(&data[start..start + 8]);
        }

        let mut invoke_result = None;
        let found = refine.with_machine(machine_id, &mut |machine| {
            invoke_result = Some(machine.invoke(gas_limit, &registers));
        });
        if !found {
            context.registers[7] = crate::config::REG_WHO;
            return HostFunctionResult::continue_execution();
        }
        let invoke_result = invoke_result.expect("with_machine ran");

        let mut out = vec![0u8; INVOKE_HEADER_SIZE as usize];
        out[0..8].copy_from_slice(&encode_u64(invoke_result.gas_remaining as u64));
        for (i, &r) in invoke_result.registers.iter().enumerate() {
            out[8 + i * 8..8 + (i + 1) * 8].copy_from_slice(&encode_u64(r));
        }
        let _ = context.ram.write_octets(memory_offset, &out);

        context.registers[7] = invoke_result.result_code as u64;
        context.registers[8] = invoke_result.extra;

        HostFunctionResult::continue_execution()
    }
}
