//! WRITE host function (Ω_W). Gray Paper: function ID 4.
//! r7..r10 = key offset, key length, value offset, value length.
//! 1:1 with AS: if !params return PANIC; else read key/value, resolve account, update storage, r7=previous length or FULL.

use crate::config::{C_BASE_DEPOSIT, C_BYTE_DEPOSIT, C_ITEM_DEPOSIT, FUNC_WRITE, REG_FULL, REG_NONE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use crate::codec::{get_storage_value, set_storage_value, delete_storage_value};

/// WRITE (4): no params → PANIC. With params read key/value, update storage, check balance, r7=previous len or FULL.
pub struct WriteHostFunction;

impl WriteHostFunction {
    fn calculate_min_balance(items: u64, octets: u64, gratis: u64) -> u64 {
        let total = C_BASE_DEPOSIT + C_ITEM_DEPOSIT * items + C_BYTE_DEPOSIT * octets;
        total.saturating_sub(gratis)
    }
}

impl HostFunction for WriteHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_WRITE
    }
    fn name(&self) -> &'static str {
        "write"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        // Resolve current service account from accounts + service_id (same as AS WriteParams.serviceAccount).
        let service_id = match context.service_id {
            Some(id) => id,
            None => {
                crate::host_log!("[hostfn] write PANIC: no service_id in context");
                return HostFunctionResult::panic();
            }
        };
        let service_account = match &mut context.accounts {
            Some(accounts) => match accounts.get_mut(&service_id) {
                Some(acc) => acc,
                None => {
                    crate::host_log!("[hostfn] write PANIC: service {} not in accounts", service_id);
                    return HostFunctionResult::panic();
                }
            },
            None => {
                crate::host_log!("[hostfn] write PANIC: no accounts in context");
                return HostFunctionResult::panic();
            }
        };

        let key_offset = context.registers[7];
        let key_length = context.registers[8];
        let value_offset = context.registers[9];
        let value_length = context.registers[10];

        let read_key = context.ram.read_octets(key_offset as u32, key_length as u32);
        if read_key.data.is_none() || read_key.fault_address != 0 {
            crate::host_log!(
                "[hostfn] write PANIC: key read fault (offset={}, len={}, fault_address={})",
                key_offset, key_length, read_key.fault_address
            );
            return HostFunctionResult::panic();
        }
        let key = read_key.data.unwrap();

        if value_length == 0 {
            let has_key = get_storage_value(service_account, service_id as u32, &key).is_some();
            let new_items = service_account.items as u64 - if has_key { 1 } else { 0 };
            let prev = get_storage_value(service_account, service_id as u32, &key);
            let deleted_octets = if prev.is_some() {
                34 + key.len() as u64 + prev.as_ref().unwrap().len() as u64
            } else {
                0
            };
            let new_octets = service_account.octets.saturating_sub(deleted_octets);
            let new_min = Self::calculate_min_balance(new_items, new_octets, service_account.gratis);
            if new_min > service_account.balance {
                context.registers[7] = REG_FULL;
                return HostFunctionResult::continue_execution();
            }
            let previous_length = prev.as_ref().map(|v| v.len() as i64).unwrap_or(-1);
            if prev.is_some() {
                delete_storage_value(service_account, service_id as u32, &key);
            }
            service_account.items = new_items as u32;
            service_account.octets = new_octets;
            context.registers[7] = if previous_length >= 0 {
                previous_length as u64
            } else {
                REG_NONE
            };
            return HostFunctionResult::continue_execution();
        }

        let read_value = context.ram.read_octets(value_offset as u32, value_length as u32);
        if read_value.data.is_none() || read_value.fault_address != 0 {
            crate::host_log!(
                "[hostfn] write PANIC: value read fault (offset={}, len={}, fault_address={})",
                value_offset, value_length, read_value.fault_address
            );
            return HostFunctionResult::panic();
        }
        let value = read_value.data.unwrap();

        let has_key = get_storage_value(service_account, service_id as u32, &key).is_some();
        let new_items = service_account.items as u64 + if has_key { 0 } else { 1 };
        let prev = get_storage_value(service_account, service_id as u32, &key);
        let octets_delta: i64 = match &prev {
            Some(p) => value.len() as i64 - p.len() as i64,
            None => 34 + key.len() as i64 + value.len() as i64,
        };
        let new_octets = (service_account.octets as i64 + octets_delta).max(0) as u64;
        let new_min = Self::calculate_min_balance(new_items, new_octets, service_account.gratis);
        if new_min > service_account.balance {
            context.registers[7] = REG_FULL;
            return HostFunctionResult::continue_execution();
        }

        let previous_length = prev.as_ref().map(|v| v.len() as i64).unwrap_or(-1);
        set_storage_value(service_account, service_id as u32, &key, value);
        service_account.items = new_items as u32;
        service_account.octets = new_octets;
        context.registers[7] = if previous_length >= 0 {
            previous_length as u64
        } else {
            REG_NONE
        };
        HostFunctionResult::continue_execution()
    }
}
