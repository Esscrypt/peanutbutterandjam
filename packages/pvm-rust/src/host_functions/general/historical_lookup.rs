//! HISTORICAL_LOOKUP host function (Ω_H). Gray Paper: function ID 6.
//! r7=service, r8=hash offset, r9=output, r10=from, r11=length.
//! 1:1 with AS: no params → PANIC; else histlookup (preimage + request validity at lookup_timeslot), write slice, r7=len.

use crate::codec::{decode_request_timeslots, get_preimage_value, get_request_value, CompleteServiceAccount};
use crate::config::{FUNC_HISTORICAL_LOOKUP, REG_NONE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// HISTORICAL_LOOKUP (6): no params → PANIC; else resolve account, read hash, histlookup, write slice, r7=len.
pub struct HistoricalLookupHostFunction;

impl HistoricalLookupHostFunction {
    fn check_request_validity(timeslots: &[u32], timeslot: u64) -> bool {
        match timeslots.len() {
            0 => false,
            1 => u64::from(timeslots[0]) <= timeslot,
            2 => u64::from(timeslots[0]) <= timeslot && timeslot < u64::from(timeslots[1]),
            3 => {
                (u64::from(timeslots[0]) <= timeslot && timeslot < u64::from(timeslots[1]))
                    || u64::from(timeslots[2]) <= timeslot
            }
            _ => false,
        }
    }

    fn hist_lookup(
        account: &CompleteServiceAccount,
        service_id: u32,
        hash_bytes: &[u8],
        timeslot: u64,
    ) -> Option<Vec<u8>> {
        let preimage = get_preimage_value(account, service_id, hash_bytes)?;
        let length = preimage.len() as u64;
        let request_value = get_request_value(account, service_id, hash_bytes, length)?;
        let timeslots = decode_request_timeslots(&request_value)?;
        if !Self::check_request_validity(&timeslots, timeslot) {
            return None;
        }
        Some(preimage)
    }
}

impl HostFunction for HistoricalLookupHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_HISTORICAL_LOOKUP
    }
    fn name(&self) -> &'static str {
        "historical_lookup"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        if context.service_id.is_none() || context.accounts.is_none() || context.lookup_timeslot.is_none() {
            return HostFunctionResult::panic();
        }

        let requested_service_id = if context.registers[7] == REG_NONE {
            context.service_id.unwrap()
        } else {
            context.registers[7]
        };

        let accounts = context.accounts.as_ref().unwrap();
        let service_account = match accounts.get(&requested_service_id) {
            Some(a) => a,
            None => {
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };

        let hash_offset = context.registers[8];
        let output_offset = context.registers[9];
        let from_offset = context.registers[10];
        let length = context.registers[11];

        let read_hash = context.ram.read_octets(hash_offset as u32, 32);
        if read_hash.data.is_none() || read_hash.fault_address != 0 {
            return HostFunctionResult::panic();
        }
        let hash_data = read_hash.data.as_ref().unwrap();

        let timeslot = context.lookup_timeslot.unwrap();
        let actual_sid = if context.registers[7] == REG_NONE {
            context.service_id.unwrap()
        } else {
            requested_service_id
        };

        let preimage = match Self::hist_lookup(
            service_account,
            actual_sid as u32,
            hash_data,
            timeslot,
        ) {
            Some(p) => p,
            None => {
                context.registers[7] = REG_NONE;
                return HostFunctionResult::continue_execution();
            }
        };

        let preimage_len = preimage.len();
        let f = (from_offset as usize).min(preimage_len);
        let l = (length as usize).min(preimage_len - f);
        if l == 0 {
            context.registers[7] = REG_NONE;
            return HostFunctionResult::continue_execution();
        }

        let data_to_write = preimage[f..f + l].to_vec();
        let write_result = context.ram.write_octets(output_offset as u32, &data_to_write);
        if write_result.has_fault {
            return HostFunctionResult::panic();
        }

        context.registers[7] = preimage_len as u64;
        HostFunctionResult::continue_execution()
    }
}
