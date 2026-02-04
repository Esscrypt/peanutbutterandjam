//! SOLICIT accumulation host function (Ω_S). Gray Paper: function ID 23.
//! r7 = hash offset (o), r8 = preimage size (z). 1:1 with AS solicit.ts.
//! Read 32-byte hash; get/set request value; new request [] or append timeslot to [x,y]; FULL on overflow/insufficient balance.

use crate::config::{C_BASE_DEPOSIT, C_BYTE_DEPOSIT, C_ITEM_DEPOSIT, FUNC_SOLICIT};
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{
    decode_request_timeslots, encode_request_timeslots, get_request_value, set_request_value,
};

const HASH_LEN: u32 = 32;
/// Gray Paper: octets increment per new request (81 + z).
const OCTETS_BASE_PER_REQUEST: u64 = 81;

pub struct SolicitHostFunction;

impl SolicitHostFunction {
    /// Returns true if a + b would overflow u64.
    fn would_overflow_u64(a: u64, b: u64) -> bool {
        a > u64::MAX - b
    }
}

impl HostFunction for SolicitHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_SOLICIT
    }
    fn name(&self) -> &'static str {
        "solicit"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let hash_offset = context.registers[7] as u32;
        let preimage_length = context.registers[8];

        // Read hash from memory (32 bytes). Gray Paper: panic when h = error; r7 unchanged.
        let read_result = context.ram.read_octets(hash_offset, HASH_LEN);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return HostFunctionResult::panic();
        }
        let hash_data = read_result.data.unwrap();
        if hash_data.len() != HASH_LEN as usize {
            return HostFunctionResult::panic();
        }

        // Current service account (imX). None → HUH.
        let service_account = match &mut context.service_account {
            Some(acc) => acc,
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

        let existing_request_value = get_request_value(service_account, service_id, &hash_data, preimage_length);

        let (new_timeslots, is_new_request) = match existing_request_value {
            None => {
                // Request doesn't exist - create empty request []
                (vec![], true)
            }
            Some(ref value) => {
                let existing_timeslots = match decode_request_timeslots(value) {
                    Some(t) => t,
                    None => {
                        base::set_accumulate_error(context.registers, codes::HUH);
                        return HostFunctionResult::continue_execution();
                    }
                };
                if existing_timeslots.len() == 2 {
                    // [x, y] - append current timeslot to make [x, y, t]
                    let timeslot = match context.timeslot {
                        Some(t) => t as u32,
                        None => {
                            base::set_accumulate_error(context.registers, codes::HUH);
                            return HostFunctionResult::continue_execution();
                        }
                    };
                    let mut nt = existing_timeslots;
                    nt.push(timeslot);
                    (nt, false)
                } else {
                    base::set_accumulate_error(context.registers, codes::HUH);
                    return HostFunctionResult::continue_execution();
                }
            }
        };

        let (new_items, new_octets) = if is_new_request {
            let new_items = service_account.items + 2;
            let octets_increment = OCTETS_BASE_PER_REQUEST
                .checked_add(preimage_length)
                .filter(|_| !Self::would_overflow_u64(OCTETS_BASE_PER_REQUEST, preimage_length));
            let octets_increment = match octets_increment {
                Some(v) => v,
                None => {
                    base::set_accumulate_error(context.registers, codes::FULL);
                    return HostFunctionResult::continue_execution();
                }
            };
            if Self::would_overflow_u64(service_account.octets, octets_increment) {
                base::set_accumulate_error(context.registers, codes::FULL);
                return HostFunctionResult::continue_execution();
            }
            let new_octets = service_account.octets + octets_increment;
            (new_items, new_octets)
        } else {
            (service_account.items, service_account.octets)
        };

        // newMinBalance = max(0, totalDeposit - gratis). Check overflow in totalDeposit.
        let item_deposit = C_ITEM_DEPOSIT * new_items as u64;
        let byte_deposit = C_BYTE_DEPOSIT * new_octets;
        if Self::would_overflow_u64(C_BASE_DEPOSIT, item_deposit)
            || Self::would_overflow_u64(C_BASE_DEPOSIT + item_deposit, byte_deposit)
        {
            base::set_accumulate_error(context.registers, codes::FULL);
            return HostFunctionResult::continue_execution();
        }
        let total_deposit = C_BASE_DEPOSIT + item_deposit + byte_deposit;
        let new_min_balance = total_deposit.saturating_sub(service_account.gratis);

        if new_min_balance > service_account.balance {
            base::set_accumulate_error(context.registers, codes::FULL);
            return HostFunctionResult::continue_execution();
        }

        set_request_value(
            service_account,
            service_id,
            &hash_data,
            preimage_length,
            encode_request_timeslots(&new_timeslots),
        );

        if is_new_request {
            service_account.items = new_items;
            service_account.octets = new_octets;
        }

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
