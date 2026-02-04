//! FORGET accumulation host function (Ω_F). Gray Paper: function ID 24.
//! r7 = hash offset (o), r8 = preimage length (z). 1:1 with AS forget.ts.

use crate::config::FUNC_FORGET;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{
    decode_request_timeslots, delete_preimage_value, delete_request_value, encode_request_timeslots,
    get_request_value, set_request_value,
};

const HASH_LEN: u32 = 32;
/// Gray Paper: octets delta per request = 81 + z.
const OCTETS_BASE: u64 = 81;

fn remove_request_and_update_footprint(
    service_account: &mut crate::codec::CompleteServiceAccount,
    service_id: u32,
    hash_data: &[u8],
    preimage_length: u64,
) {
    let _ = delete_request_value(service_account, service_id, hash_data, preimage_length);
    let _ = delete_preimage_value(service_account, service_id, hash_data);
    if service_account.items >= 2 {
        service_account.items -= 2;
    } else {
        service_account.items = 0;
    }
    let octets_delta = OCTETS_BASE + preimage_length;
    if service_account.octets >= octets_delta {
        service_account.octets -= octets_delta;
    } else {
        service_account.octets = 0;
    }
}

pub struct ForgetHostFunction;

impl HostFunction for ForgetHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_FORGET
    }
    fn name(&self) -> &'static str {
        "forget"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let hash_offset = context.registers[7];
        let preimage_length = context.registers[8];

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

        let service_account = match context.service_account.as_deref_mut() {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };
        let service_id = match context.service_id {
            Some(id) => id as u32,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        let request_value = match get_request_value(
            service_account,
            service_id,
            &hash_bytes,
            preimage_length,
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

        match timeslots.len() {
            0 => {
                remove_request_and_update_footprint(
                    service_account,
                    service_id,
                    &hash_bytes,
                    preimage_length,
                );
            }
            2 => {
                let y = u64::from(timeslots[1]);
                if y + expunge_period < timeslot {
                    remove_request_and_update_footprint(
                        service_account,
                        service_id,
                        &hash_bytes,
                        preimage_length,
                    );
                } else {
                    base::set_accumulate_error(context.registers, codes::HUH);
                    return HostFunctionResult::continue_execution();
                }
            }
            1 => {
                let x = timeslots[0];
                let new_timeslots = [x, timeslot as u32];
                set_request_value(
                    service_account,
                    service_id,
                    &hash_bytes,
                    preimage_length,
                    encode_request_timeslots(&new_timeslots),
                );
            }
            3 => {
                let y = u64::from(timeslots[1]);
                let w = timeslots[2];
                if y + expunge_period < timeslot {
                    let new_timeslots = [w, timeslot as u32];
                    set_request_value(
                        service_account,
                        service_id,
                        &hash_bytes,
                        preimage_length,
                        encode_request_timeslots(&new_timeslots),
                    );
                } else {
                    base::set_accumulate_error(context.registers, codes::HUH);
                    return HostFunctionResult::continue_execution();
                }
            }
            _ => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        }

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
