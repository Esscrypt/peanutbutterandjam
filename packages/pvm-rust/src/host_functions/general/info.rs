//! INFO host function (Ω_I)
//!
//! Gets information about service accounts.
//!
//! Gray Paper Specification (pvm-invocations.tex line 193, 457-482):
//! - Function ID: 5 (info)
//! - Gas Cost: 10
//! - Signature: Ω_I(gascounter, registers, memory, s, d)
//!   - s = service ID (from Implications)
//!   - d = accounts dictionary (from PartialState)
//! - Uses registers[7] to specify service account (NONE for self, or specific service ID)
//! - Uses registers[8] for output offset (o)
//! - Uses registers[9] for from offset (f)
//! - Uses registers[10] for length (l)
//! - Returns encoded service account info (codehash, balance, gas limits, etc.)
//! - Writes result to memory at specified offset

use crate::config::{C_BASE_DEPOSIT, C_BYTE_DEPOSIT, C_ITEM_DEPOSIT, FUNC_INFO, REG_NONE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};
use std::cmp::min;

const INFO_LEN: usize = 96;

/// INFO (5): no params (service_id/accounts) → PANIC. With params resolve account, encode 96-byte info (Gray Paper format), write slice, r7=96.
pub struct InfoHostFunction;

impl InfoHostFunction {
    /// Gray Paper equation 466-473: INFO format (not merklization).
    /// codehash (32) + encode[8]{balance, minbalance, minaccgas, minmemogas, octets} (40) +
    /// encode[4]{items} (4) + encode[8]{gratis} (8) + encode[4]{created, lastacc, parent} (12) = 96 bytes.
    fn encode_info(account: &crate::codec::CompleteServiceAccount, minbalance: u64) -> [u8; INFO_LEN] {
        let mut info = [0u8; INFO_LEN];
        info[0..32].copy_from_slice(&account.codehash);
        info[32..40].copy_from_slice(&account.balance.to_le_bytes());
        info[40..48].copy_from_slice(&minbalance.to_le_bytes());
        info[48..56].copy_from_slice(&account.minaccgas.to_le_bytes());
        info[56..64].copy_from_slice(&account.minmemogas.to_le_bytes());
        info[64..72].copy_from_slice(&account.octets.to_le_bytes());
        info[72..76].copy_from_slice(&account.items.to_le_bytes());
        info[76..84].copy_from_slice(&account.gratis.to_le_bytes());
        info[84..88].copy_from_slice(&account.created.to_le_bytes());
        info[88..92].copy_from_slice(&account.lastacc.to_le_bytes());
        info[92..96].copy_from_slice(&account.parent.to_le_bytes());
        info
    }
}

impl HostFunction for InfoHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_INFO
    }
    fn name(&self) -> &'static str {
        "info"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        // Gray Paper: no params (InfoParams = service_id + accounts) → panic
        if context.service_id.is_none() || context.accounts.is_none() {
            return HostFunctionResult::panic();
        }

        let accounts = context.accounts.as_ref().unwrap();
        let service_id = context.service_id.unwrap();

        // Gray Paper: Extract parameters from registers
        // registers[7] = service ID selector (NONE for self, or specific service ID)
        // registers[8] = output offset (o)
        // registers[9] = from offset (f)
        // registers[10] = length (l)
        let requested_service_id = context.registers[7];
        let output_offset = context.registers[8];
        let from_offset = context.registers[9];
        let length = context.registers[10];

        // Gray Paper equation 460-463: a = d[s] if registers[7] = NONE, else d[registers[7]]
        let service_account = if requested_service_id == REG_NONE {
            accounts.get(&service_id)
        } else {
            accounts.get(&requested_service_id)
        };

        let Some(service_account) = service_account else {
            context.registers[7] = REG_NONE;
            return HostFunctionResult::continue_execution();
        };

        // Gray Paper equation 466-473: Encode service account info for INFO host function
        // minbalance = max(0, Cbasedeposit + Citemdeposit*items + Cbytedeposit*octets - gratis)
        let base_deposit = C_BASE_DEPOSIT;
        let item_deposit = C_ITEM_DEPOSIT * service_account.items as u64;
        let byte_deposit = C_BYTE_DEPOSIT * service_account.octets;
        let total_deposit = base_deposit + item_deposit + byte_deposit;
        let minbalance = total_deposit.saturating_sub(service_account.gratis);

        let info = Self::encode_info(service_account, minbalance);

        // Gray Paper equation 475-476: f = min(registers[9], len(v)), l = min(registers[10], len(v) - f)
        let f = min(from_offset as usize, INFO_LEN);
        let l = min(length as usize, INFO_LEN - f);

        if l <= 0 {
            // Return NONE if no data to copy
            context.registers[7] = REG_NONE;
            return HostFunctionResult::continue_execution();
        }

        // Gray Paper equation 480: Extract slice v[f:f+l]
        let data_slice = &info[f..f + l];

        // Pad to requested length if needed (to match reference behavior). Gray Paper equation 478: Write to memory[o:o+l]
        let requested_write_length = length as usize;
        let data_to_write = if requested_write_length > data_slice.len() {
            let mut buf = vec![0u8; requested_write_length];
            buf[..data_slice.len()].copy_from_slice(data_slice);
            buf
        } else {
            data_slice.to_vec()
        };

        if context.ram.write_octets(output_offset as u32, &data_to_write).has_fault {
            return HostFunctionResult::panic();
        }

        // Gray Paper equation 480: Return length of full info data (v) = 96, not the written slice length
        context.registers[7] = INFO_LEN as u64;

        HostFunctionResult::continue_execution()
    }
}
