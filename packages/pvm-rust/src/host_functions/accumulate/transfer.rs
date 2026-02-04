//! TRANSFER accumulation host function (Ω_T). Gray Paper: function ID 20.
//! r7..r10 = dest, amount, gas limit (l), memo offset (o). 1:1 with AS transfer.ts.
//! Read memo (128 bytes); current account → HUH if missing; dest → WHO if missing;
//! gasLimit < dest.minmemogas → LOW; balance checks → CASH; else deduct balance, r7=OK, gas 10+l.

use crate::config::{C_BASE_DEPOSIT, C_BYTE_DEPOSIT, C_ITEM_DEPOSIT, C_MEMO_SIZE, FUNC_TRANSFER};
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// On success total gas = 10 + gasLimit; base 10 deducted in state_wrapper, we deduct gasLimit here.

pub struct TransferHostFunction;

impl TransferHostFunction {
    /// Gray Paper accounts.tex: minbalance = max(0, Cbasedeposit + Citemdeposit*items + Cbytedeposit*octets - gratis)
    fn minbalance(account: &crate::codec::CompleteServiceAccount) -> u64 {
        let total_deposit = C_BASE_DEPOSIT
            .saturating_add(C_ITEM_DEPOSIT * account.items as u64)
            .saturating_add(C_BYTE_DEPOSIT * account.octets);
        total_deposit.saturating_sub(account.gratis)
    }
}

impl HostFunction for TransferHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_TRANSFER
    }
    fn name(&self) -> &'static str {
        "transfer"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let dest = context.registers[7];
        let amount = context.registers[8];
        let gas_limit = context.registers[9];
        let memo_offset = context.registers[10];

        // Read memo from memory (128 bytes). Gray Paper: panic when range not readable; r7 unchanged.
        let read_result = context.ram.read_octets(memo_offset as u32, C_MEMO_SIZE);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return HostFunctionResult::panic();
        }
        let _memo_data = read_result.data.unwrap();
        if _memo_data.len() != C_MEMO_SIZE as usize {
            return HostFunctionResult::panic();
        }

        // Current service account (imX.id lookup). None → HUH.
        let current_account = match &mut context.service_account {
            Some(acc) => acc,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        // Destination service. Need accounts map; if missing or dest not found → WHO.
        let accounts = match &context.accounts {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };
        let dest_service = match accounts.get(&dest) {
            Some(s) => s,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                return HostFunctionResult::continue_execution();
            }
        };

        // Gray Paper: l < destService.minmemogas → LOW
        if gas_limit < dest_service.minmemogas {
            base::set_accumulate_error(context.registers, codes::LOW);
            return HostFunctionResult::continue_execution();
        }

        // balance < amount → CASH
        if current_account.balance < amount {
            base::set_accumulate_error(context.registers, codes::CASH);
            return HostFunctionResult::continue_execution();
        }
        let balance_after_transfer = current_account.balance - amount;

        // balanceAfterTransfer < minbalance → CASH
        let minbalance = Self::minbalance(current_account);
        if balance_after_transfer < minbalance {
            base::set_accumulate_error(context.registers, codes::CASH);
            return HostFunctionResult::continue_execution();
        }

        // Success: deduct amount from sender (deferred transfer not stored in Rust; no implications.xfers).
        current_account.balance = balance_after_transfer;
        base::set_accumulate_success(context.registers, codes::OK);

        // Gray Paper: on success additional gas = l (base 10 already deducted in state_wrapper)
        let additional_gas = gas_limit as u32;
        *context.gas_remaining = context.gas_remaining.saturating_sub(additional_gas);

        HostFunctionResult::continue_execution()
    }
}
