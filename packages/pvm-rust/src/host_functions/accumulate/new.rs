//! NEW accumulation host function (Ω_N). Gray Paper: function ID 18.
//! r7..r12 = code hash offset (o), expected code length (l), minAccGas, minMemoGas, gratis, desiredId.
//! 1:1 with AS new.ts: read 32-byte code hash, checks, minBalance, allocate newServiceId, create account, deduct, insert.

use crate::config::{
    C_BASE_DEPOSIT, C_BYTE_DEPOSIT, C_ITEM_DEPOSIT, FUNC_NEW, MIN_PUBLIC_INDEX,
};
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{encode_request_timeslots, set_request_value, CompleteServiceAccount};
use std::collections::HashMap;

const CODE_HASH_LEN: u32 = 32;
/// Gray Paper: new service has one request → items = 2.
const NEW_SERVICE_ITEMS: u32 = 2;
/// Gray Paper: octets = 81 + expectedCodeLength per request.
const OCTETS_BASE: u64 = 81;
/// v0.7.1+ modulus: 2^32 - 2^8 - Cminpublicindex.
const NEXTFREEID_MODULUS: u64 = 4_294_967_296 - 256 - (MIN_PUBLIC_INDEX as u64);

pub struct NewHostFunction;

impl NewHostFunction {
    /// Gray Paper v0.7.1+: check((i - Cminpublicindex + 1) mod (2^32 - 2^8 - Cminpublicindex) + Cminpublicindex)
    fn check_service_id_v071(
        id: u64,
        accounts: &HashMap<u64, CompleteServiceAccount>,
    ) -> u64 {
        if !accounts.contains_key(&id) {
            return id;
        }
        let min_pub = u64::from(MIN_PUBLIC_INDEX);
        let next = min_pub + ((id - min_pub + 1) % NEXTFREEID_MODULUS);
        Self::check_service_id_v071(next, accounts)
    }

    /// Gray Paper line 791: i* = Cminpublicindex + (im_nextfreeid - Cminpublicindex + 42) mod MODULUS
    fn get_next_free_id(
        current_id: u64,
        accounts: &HashMap<u64, CompleteServiceAccount>,
    ) -> u64 {
        let min_pub = u64::from(MIN_PUBLIC_INDEX);
        let candidate = min_pub + ((current_id - min_pub + 42) % NEXTFREEID_MODULUS);
        Self::check_service_id_v071(candidate, accounts)
    }

    fn minbalance(items: u64, octets: u64, gratis: u64) -> u64 {
        let before = C_BASE_DEPOSIT
            .saturating_add(C_ITEM_DEPOSIT * items)
            .saturating_add(C_BYTE_DEPOSIT * octets);
        before.saturating_sub(gratis)
    }
}

impl HostFunction for NewHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_NEW
    }
    fn name(&self) -> &'static str {
        "new"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let code_hash_offset = context.registers[7];
        let expected_code_length = context.registers[8];
        let min_acc_gas = context.registers[9];
        let min_memo_gas = context.registers[10];
        let gratis = context.registers[11];
        let desired_id = context.registers[12];

        let _log_service_id = context.service_id.unwrap_or(0);
        crate::host_log!(
            "[hostfn] NEW host function invoked codeHashOffset={} expectedCodeLength={} minAccGas={} minMemoGas={} gratis={} desiredId={} currentServiceId={}",
            code_hash_offset, expected_code_length, min_acc_gas, min_memo_gas, gratis, desired_id, _log_service_id
        );

        if expected_code_length > 0xFFFF_FFFF {
            crate::host_log_error!(
                "[hostfn] new PANIC: expected_code_length overflow (serviceId={}, value={})",
                _log_service_id, expected_code_length
            );
            return HostFunctionResult::panic();
        }

        let read_result = context.ram.read_octets(code_hash_offset as u32, CODE_HASH_LEN);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            crate::host_log_error!(
                "[hostfn] new PANIC: code_hash read fault (serviceId={}, offset={}, fault_address={})",
                _log_service_id, code_hash_offset, read_result.fault_address
            );
            return HostFunctionResult::panic();
        }
        let code_hash_data = read_result.data.unwrap();
        if code_hash_data.len() != CODE_HASH_LEN as usize {
            crate::host_log_error!(
                "[hostfn] new PANIC: code_hash length mismatch (serviceId={}, got {}, expected {})",
                _log_service_id, code_hash_data.len(), CODE_HASH_LEN as usize
            );
            return HostFunctionResult::panic();
        }
        let mut code_hash = [0u8; 32];
        code_hash.copy_from_slice(&code_hash_data);

        let service_id = match context.service_id {
            Some(id) => id,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };
        let accounts = match context.accounts.as_deref_mut() {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };
        let (nextfreeid, manager_id, registrar_id, timeslot) = (
            context.nextfreeid.as_deref_mut(),
            context.manager_id,
            context.registrar_id,
            context.timeslot,
        );

        if gratis != 0 {
            let is_manager = manager_id.map_or(false, |m| m == service_id);
            if !is_manager {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        }

        let new_service_octets = OCTETS_BASE + expected_code_length;
        let min_balance = Self::minbalance(NEW_SERVICE_ITEMS as u64, new_service_octets, gratis);

        let balance_after = {
            let current_service = match &mut context.service_account {
                Some(s) => s,
                None => match accounts.get_mut(&service_id) {
                    Some(s) => s,
                    None => {
                        base::set_accumulate_error(context.registers, codes::HUH);
                        return HostFunctionResult::continue_execution();
                    }
                },
            };
            if current_service.balance < min_balance {
                base::set_accumulate_error(context.registers, codes::CASH);
                return HostFunctionResult::continue_execution();
            }
            let b = current_service.balance - min_balance;
            let current_min = Self::minbalance(
                current_service.items as u64,
                current_service.octets,
                current_service.gratis,
            );
            if b < current_min {
                base::set_accumulate_error(context.registers, codes::CASH);
                return HostFunctionResult::continue_execution();
            }
            b
        };

        let min_pub = u64::from(MIN_PUBLIC_INDEX);
        let is_registrar = registrar_id.map_or(false, |r| r == service_id);
        let use_reserved = gratis == 0 && is_registrar && desired_id < min_pub;

        let (new_service_id, update_nextfreeid) = if use_reserved {
            if accounts.contains_key(&desired_id) {
                base::set_accumulate_error(context.registers, codes::FULL);
                return HostFunctionResult::continue_execution();
            }
            (desired_id, false)
        } else {
            let current_id = match nextfreeid.as_ref() {
                Some(n) => u64::from(**n),
                None => {
                    base::set_accumulate_error(context.registers, codes::HUH);
                    return HostFunctionResult::continue_execution();
                }
            };
            (current_id, true)
        };

        let created = timeslot.map_or(0, |t| t as u32);
        let parent = service_id as u32;

        let mut new_account = CompleteServiceAccount {
            codehash: code_hash,
            balance: min_balance,
            minaccgas: min_acc_gas,
            minmemogas: min_memo_gas,
            octets: new_service_octets,
            gratis,
            items: NEW_SERVICE_ITEMS,
            created,
            lastacc: 0,
            parent,
            ..Default::default()
        };
        set_request_value(
            &mut new_account,
            new_service_id as u32,
            &code_hash,
            expected_code_length,
            encode_request_timeslots(&[]),
        );

        {
            let current_service = match &mut context.service_account {
                Some(s) => s,
                None => match accounts.get_mut(&service_id) {
                    Some(s) => s,
                    None => {
                        base::set_accumulate_error(context.registers, codes::HUH);
                        return HostFunctionResult::continue_execution();
                    }
                },
            };
            current_service.balance = balance_after;
        }

        let next_id_to_set = {
            accounts.insert(new_service_id, new_account);
            if update_nextfreeid {
                Some(Self::get_next_free_id(new_service_id, accounts))
            } else {
                None
            }
        };

        base::set_accumulate_success(context.registers, new_service_id);
        if let Some(next_id) = next_id_to_set {
            if let Some(n) = context.nextfreeid.as_deref_mut() {
                *n = next_id as u32;
            }
        }
        crate::host_log!("[host-calls] [{}] NEW({}) <- OK (newServiceId={})", _log_service_id, code_hash_offset, new_service_id);
        HostFunctionResult::continue_execution()
    }
}
