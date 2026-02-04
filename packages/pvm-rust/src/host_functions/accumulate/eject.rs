//! EJECT accumulation host function (Ω_J). Gray Paper: function ID 21.
//! r7 = service ID to eject (d), r8 = hash offset (o). 1:1 with AS eject.ts.

use crate::config::FUNC_EJECT;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{
    decode_request_timeslots, encode_fixed_length, get_request_value,
};

const HASH_LEN: u32 = 32;

pub struct EjectHostFunction;

impl HostFunction for EjectHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_EJECT
    }
    fn name(&self) -> &'static str {
        "eject"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let service_id_to_eject = context.registers[7];
        let hash_offset = context.registers[8];

        let read_result = context.ram.read_octets(hash_offset as u32, HASH_LEN);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return HostFunctionResult::panic();
        }
        let hash_data = read_result.data.unwrap();
        if hash_data.len() != HASH_LEN as usize {
            return HostFunctionResult::panic();
        }
        let mut hash_bytes = [0u8; 32];
        hash_bytes.copy_from_slice(&hash_data);

        let accounts = match context.accounts.as_deref_mut() {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };
        let current_service = match context.service_account.as_deref_mut() {
            Some(s) => s,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };
        let current_service_id = match context.service_id {
            Some(id) => id,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };

        if service_id_to_eject == current_service_id {
            base::set_accumulate_error(context.registers, codes::WHO);
            return HostFunctionResult::continue_execution();
        }

        let target = match accounts.get(&service_id_to_eject) {
            Some(t) => t,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };

        let expected_code_hash = encode_fixed_length(current_service_id, 32);
        if target.codehash.as_slice() != expected_code_hash.as_slice() {
            base::set_accumulate_error(context.registers, codes::WHO);
            return HostFunctionResult::continue_execution();
        }

        let l = 81u64.max(target.octets) - 81;

        if target.items != 2 {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }

        let request_value = match get_request_value(
            target,
            service_id_to_eject as u32,
            &hash_bytes,
            l,
        ) {
            Some(v) => v,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        let timeslots = match decode_request_timeslots(&request_value) {
            Some(t) => t,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        let timeslot = context.timeslot.unwrap_or(0);
        let expunge_period = context.expunge_period.unwrap_or(0);
        if timeslots.len() < 2 {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }
        let y = u64::from(timeslots[1]);
        if y + expunge_period >= timeslot {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }

        let balance_to_transfer = target.balance;
        accounts.remove(&service_id_to_eject);
        current_service.balance += balance_to_transfer;

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
