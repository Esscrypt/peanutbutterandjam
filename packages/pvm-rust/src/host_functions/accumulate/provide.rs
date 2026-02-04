//! PROVIDE accumulation host function (Ω_♈). Gray Paper: function ID 26.
//! r7 = target service (s; 2^64-1 = current), r8 = preimage offset (o), r9 = preimage length (z).
//! 1:1 with AS provide.ts: read preimage, resolve service, check request exists, check not already provided, add to provisions.

use crate::config::FUNC_PROVIDE;
use crate::crypto::blake2b256;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{get_request_value, ProvisionEntry};

/// 2^64 - 1: use current service when r7 equals this.
const MAX_U64: u64 = u64::MAX;

pub struct ProvideHostFunction;

impl HostFunction for ProvideHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_PROVIDE
    }
    fn name(&self) -> &'static str {
        "provide"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let target_service_id = context.registers[7];
        let preimage_offset = context.registers[8] as u32;
        let preimage_length = context.registers[9];

        // Gray Paper: s = imX.id when registers[7] = 2^64-1, otherwise registers[7]
        let service_id = if target_service_id == MAX_U64 {
            match context.service_id {
                Some(id) => id,
                None => {
                    base::set_accumulate_error(context.registers, codes::HUH);
                    return HostFunctionResult::continue_execution();
                }
            }
        } else {
            target_service_id
        };

        // Read preimage data from memory. Fault → panic; r7 unchanged.
        let read_result = context.ram.read_octets(preimage_offset, preimage_length as u32);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return HostFunctionResult::panic();
        }
        let preimage_data = read_result.data.unwrap();
        if preimage_data.len() != preimage_length as usize {
            return HostFunctionResult::panic();
        }

        // Target service account must exist (WHO if not found).
        let accounts = match &context.accounts {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };
        let service_account = match accounts.get(&service_id) {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };

        // Gray Paper: a.sa_requests[(blake(i), z)] ≠ []. Compute hash and look up request.
        let preimage_hash = blake2b256(&preimage_data);
        let request_value = get_request_value(
            service_account,
            service_id as u32,
            &preimage_hash,
            preimage_length,
        );
        if request_value.is_none() {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }

        // Gray Paper: (s, i) ∈ imX.provisions with same blob → HUH (already provided).
        let provisions = match &mut context.provisions {
            Some(p) => p,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };
        let service_id_u32 = service_id as u32;
        if let Some(entry) = provisions.iter().find(|e| e.service_id == service_id_u32) {
            if entry.blob == *preimage_data {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        }

        // Add or replace provision: imX.provisions ∪ {(s, i)}.
        if let Some(entry) = provisions.iter_mut().find(|e| e.service_id == service_id_u32) {
            entry.blob = preimage_data.to_vec();
        } else {
            provisions.push(ProvisionEntry {
                service_id: service_id_u32,
                blob: preimage_data.to_vec(),
            });
        }

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
