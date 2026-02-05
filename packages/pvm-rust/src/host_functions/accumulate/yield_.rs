//! YIELD accumulation host function (Ω_♉). Gray Paper: function ID 25.
//! r7 = hash offset (o). Read 32-byte hash from memory; set yield in accumulation context; r7 = OK or panic.
//! 1:1 with AS yield.ts: read 32 bytes at o; on fault panic (r7 unchanged); else set imX.yield and OK.

use crate::config::FUNC_YIELD;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::types::bytes_to_hex;

const HASH_LEN: u32 = 32;

pub struct YieldHostFunction;

impl HostFunction for YieldHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_YIELD
    }
    fn name(&self) -> &'static str {
        "yield"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let hash_offset = context.registers[7] as u32;
        let _log_service_id = context.service_id.unwrap_or(0);

        let read_result = context.ram.read_octets(hash_offset, HASH_LEN);
        if read_result.fault_address != 0 {
            crate::host_log!(
                "[hostfn] yield PANIC: hash read fault (offset={}, fault_address={})",
                hash_offset, read_result.fault_address
            );
            crate::host_log!("[host-calls] [{}] YIELD({}) <- PANIC", _log_service_id, hash_offset);
            return HostFunctionResult::panic();
        }
        let Some(hash_data) = read_result.data else {
            crate::host_log!("[hostfn] yield PANIC: hash read returned no data");
            crate::host_log!("[host-calls] [{}] YIELD({}) <- PANIC", _log_service_id, hash_offset);
            return HostFunctionResult::panic();
        };
        if hash_data.len() != HASH_LEN as usize {
            crate::host_log!(
                "[hostfn] yield PANIC: hash length mismatch (got {}, expected {})",
                hash_data.len(),
                HASH_LEN as usize
            );
            crate::host_log!("[host-calls] [{}] YIELD({}) <- PANIC", _log_service_id, hash_offset);
            return HostFunctionResult::panic();
        }

        let _hash_hex = bytes_to_hex(&hash_data);
        match &mut context.yield_hash {
            Some(yield_hash) => **yield_hash = Some(hash_data),
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        }

        base::set_accumulate_success(context.registers, codes::OK);
        crate::host_log!("[host-calls] [{}] YIELD({}) <- OK", _log_service_id, _hash_hex);
        HostFunctionResult::continue_execution()
    }
}
