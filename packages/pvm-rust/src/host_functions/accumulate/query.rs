//! QUERY accumulation host function (Ω_Q). Gray Paper: function ID 22.
//! r7 = hash offset (o), r8 = preimage size (z). 1:1 with AS query.ts.
//! Read 32-byte hash; look up request; return encoded status: NONE / 0 / 1+2^32*x / 2+2^32*x,y / 3+2^32*x,y+2^32*z.

use crate::config::FUNC_QUERY;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{decode_request_timeslots, get_request_value};

const HASH_LEN: u32 = 32;
const TWO_TO_32: u64 = 4_294_967_296; // 2^32

pub struct QueryHostFunction;

impl HostFunction for QueryHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_QUERY
    }
    fn name(&self) -> &'static str {
        "query"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let preimage_offset = context.registers[7] as u32;
        let preimage_length = context.registers[8];

        // Read hash from memory (32 bytes). Gray Paper: panic when read fails; r7 unchanged.
        let read_result = context.ram.read_octets(preimage_offset, HASH_LEN);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return HostFunctionResult::panic();
        }
        let hash_data = read_result.data.unwrap();
        if hash_data.len() != HASH_LEN as usize {
            return HostFunctionResult::panic();
        }

        // Current service account (imX). None → NONE, r8=0.
        let service_account = match &context.service_account {
            Some(acc) => acc,
            None => {
                base::set_accumulate_error(context.registers, codes::NONE);
                context.registers[8] = 0;
                return HostFunctionResult::continue_execution();
            }
        };
        let service_id = match context.service_id {
            Some(id) => id as u32,
            None => {
                base::set_accumulate_error(context.registers, codes::NONE);
                context.registers[8] = 0;
                return HostFunctionResult::continue_execution();
            }
        };

        let request_value = get_request_value(service_account, service_id, &hash_data, preimage_length);

        let timeslots = match request_value {
            None => {
                base::set_accumulate_error(context.registers, codes::NONE);
                context.registers[8] = 0;
                return HostFunctionResult::continue_execution();
            }
            Some(ref value) => match decode_request_timeslots(value) {
                Some(t) => t,
                None => {
                    base::set_accumulate_error(context.registers, codes::NONE);
                    context.registers[8] = 0;
                    return HostFunctionResult::continue_execution();
                }
            },
        };

        match timeslots.len() {
            0 => {
                context.registers[7] = 0;
                context.registers[8] = 0;
            }
            1 => {
                let x = u64::from(timeslots[0]);
                context.registers[7] = 1 + TWO_TO_32 * x;
                context.registers[8] = 0;
            }
            2 => {
                let x = u64::from(timeslots[0]);
                let y = u64::from(timeslots[1]);
                context.registers[7] = 2 + TWO_TO_32 * x;
                context.registers[8] = y;
            }
            3 => {
                let x = u64::from(timeslots[0]);
                let y = u64::from(timeslots[1]);
                let z = u64::from(timeslots[2]);
                context.registers[7] = 3 + TWO_TO_32 * x;
                context.registers[8] = y + TWO_TO_32 * z;
            }
            _ => {
                base::set_accumulate_error(context.registers, codes::NONE);
                context.registers[8] = 0;
            }
        }

        HostFunctionResult::continue_execution()
    }
}
