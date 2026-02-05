//! READ host function (Ω_R). Gray Paper: function ID 3.
//! r7=service selector (NONE=self), r8=key offset, r9=key length, r10=output offset, r11=from, r12=length.
//! 1:1 with AS: if !params set r7=NONE and continue; else read key, resolve account, get storage, write slice, r7=len.

use crate::codec::get_storage_value;
use crate::config::{FUNC_READ, REG_NONE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// READ (3): no params → r7=NONE, continue. With params read key (r8,r9), lookup storage, write at r10 (slice r11,r12).
pub struct ReadHostFunction;

impl HostFunction for ReadHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_READ
    }
    fn name(&self) -> &'static str {
        "read"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let _log_service_id = context.service_id.unwrap_or(0);

        if context.service_id.is_none() || context.accounts.is_none() {
            context.registers[7] = REG_NONE;
            return HostFunctionResult::continue_execution();
        }

        let params_service_id = context.service_id.unwrap();
        let accounts = context.accounts.as_ref().unwrap();

        // Gray Paper equation 404-407: Determine service account
        // s^* = s when registers[7] = 2^64 - 1 (NONE), otherwise registers[7]
        let requested_service_id = if context.registers[7] == REG_NONE {
            params_service_id
        } else {
            context.registers[7]
        };

        // Gray Paper equation 408-412: Select service account
        // a = s when s^* = s, otherwise d[s^*] if s^* in keys(d), otherwise none
        let service_account = if requested_service_id == params_service_id {
            accounts.get(&params_service_id)
        } else {
            accounts.get(&requested_service_id)
        };

        let key_offset = context.registers[8];
        let key_length = context.registers[9];
        let output_offset = context.registers[10];
        let from_offset = context.registers[11];
        let length = context.registers[12];

        let read_key = context.ram.read_octets(key_offset as u32, key_length as u32);
        if read_key.data.is_none() || read_key.fault_address != 0 {
            crate::host_log_error!(
                "[hostfn] read PANIC: key read fault (serviceId={}, offset={}, len={}, fault_address={})",
                _log_service_id, key_offset, key_length, read_key.fault_address
            );
            return HostFunctionResult::panic();
        }
        let key = read_key.data.unwrap();

        let service_account = match service_account {
            Some(a) => a,
            None => {
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };
        let value = get_storage_value(service_account, requested_service_id as u32, &key);
        let value = match value {
            Some(v) => v,
            None => {
                crate::host_log_error!(
                    "[hostfn] read: Storage key not found (serviceId={}, requestedServiceId={}, keyLength={})",
                    _log_service_id, requested_service_id, key.len()
                );
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };

        let value_len = value.len() as i32;
        let f = (from_offset as i64).min(value_len as i64).max(0) as usize;
        let remaining = (value_len - f as i32).max(0) as usize;
        let l = (length as i64).min(remaining as i64).max(0) as usize;
        let data_to_write = value[f..f + l].to_vec();

        if !data_to_write.is_empty() {
            let write_result = context.ram.write_octets(output_offset as u32, &data_to_write);
            if write_result.has_fault {
                crate::host_log_error!(
                    "[hostfn] read PANIC: output write fault (serviceId={}, offset={}, len={})",
                    _log_service_id, output_offset, data_to_write.len()
                );
                return HostFunctionResult::panic();
            }
        }

        context.registers[7] = value_len as u64;
        HostFunctionResult::continue_execution()
    }
}
