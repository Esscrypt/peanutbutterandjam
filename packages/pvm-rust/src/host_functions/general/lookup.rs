//! LOOKUP host function (Ω_L). Gray Paper: function ID 2.
//! Preimage lookup by hash; r7=serviceId, r8=hash offset, r9=output offset, r10=from, r11=length.
//! 1:1 with AS: no params → r7=NONE; with params resolve account, get preimage, write slice, r7=len.

use crate::codec::{get_preimage_value, CompleteServiceAccount};
use crate::config::{FUNC_LOOKUP, REG_NONE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const MAX_U64: u64 = u64::MAX;

/// LOOKUP (2): read hash from memory; no accounts → r7 = NONE; else resolve account, preimage lookup, write slice.
pub struct LookupHostFunction;

impl HostFunction for LookupHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_LOOKUP
    }
    fn name(&self) -> &'static str {
        "lookup"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let query_service_id = context.registers[7];
        let hash_offset = context.registers[8];
        let output_offset = context.registers[9];
        let from_offset = context.registers[10];
        let length = context.registers[11];

        let read_hash = context.ram.read_octets(hash_offset as u32, 32);
        if read_hash.data.is_none() || read_hash.fault_address != 0 {
            crate::host_log!(
                "[hostfn] lookup PANIC: hash read fault (offset={}, fault_address={})",
                hash_offset, read_hash.fault_address
            );
            return HostFunctionResult::panic();
        }
        let hash_data = read_hash.data.as_ref().unwrap();

        let (service_account, actual_service_id): (Option<&CompleteServiceAccount>, u32) = match (&context.service_id, &context.accounts) {
            (Some(service_id), Some(accounts)) => {
                let sid_val = *service_id;
                let account = if query_service_id == sid_val || query_service_id == MAX_U64 {
                    accounts.get(&sid_val)
                } else {
                    accounts.get(&query_service_id)
                };
                match account {
                    Some(a) => {
                        let sid = if query_service_id == MAX_U64 {
                            sid_val
                        } else {
                            query_service_id
                        };
                        (Some(a), sid as u32)
                    }
                    None => {
                        crate::host_log_error!(
                            "[hostfn] lookup: Service account not found (queryServiceId={})",
                            query_service_id
                        );
                        context.registers[7] = REG_NONE;
                        return HostFunctionResult::continue_execution();
                    }
                }
            }
            _ => {
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };

        let service_account = match service_account {
            Some(a) => a,
            None => {
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };
        let preimage = get_preimage_value(service_account, actual_service_id, hash_data);
        let preimage = match preimage {
            Some(p) => p,
            None => {
                crate::host_log_error!(
                    "[hostfn] lookup: Preimage not found (serviceId={}, hashOffset={})",
                    actual_service_id, hash_offset
                );
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };

        let preimage_len = preimage.len() as i32;
        let f = from_offset.min(preimage_len as u64) as i32;
        let remaining = (preimage_len - f).max(0);
        let l = (length as i64).min(remaining as i64).max(0) as usize;

        if l > 0 {
            let end = (f as usize + l).min(preimage.len());
            let data_to_write = preimage[f as usize..end].to_vec();
            let write_result = context.ram.write_octets(output_offset as u32, &data_to_write);
            if write_result.has_fault {
                crate::host_log!(
                    "[hostfn] lookup PANIC: output write fault (offset={}, len={})",
                    output_offset, data_to_write.len()
                );
                return HostFunctionResult::panic();
            }
        }

        context.registers[7] = preimage_len as u64;
        HostFunctionResult::continue_execution()
    }
}
