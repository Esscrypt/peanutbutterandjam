//! TRANSFER accumulation host function (Ω_T). Gray Paper: function ID 20.
//! r7..r10 = dest, amount, gas limit (l), memo offset (o). 1:1 with AS transfer.ts.
//! Read memo (128 bytes); current account → HUH if missing; dest → WHO if missing;
//! gasLimit < dest.minmemogas → LOW; balance checks → CASH; else deduct balance, r7=OK, gas 10+l.

use crate::codec::DeferredTransfer;
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

        let _log_service_id = context.service_id.unwrap_or(0);

        // Read memo from memory (128 bytes). Gray Paper: panic when range not readable; r7 unchanged.
        let read_result = context.ram.read_octets(memo_offset as u32, C_MEMO_SIZE);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            crate::host_log!(
                "[hostfn] transfer PANIC: memo read fault (offset={}, fault_address={})",
                memo_offset, read_result.fault_address
            );
            crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- PANIC", _log_service_id, dest, amount, gas_limit);
            return HostFunctionResult::panic();
        }
        let _memo_data = read_result.data.unwrap();
        if _memo_data.len() != C_MEMO_SIZE as usize {
            crate::host_log!(
                "[hostfn] transfer PANIC: memo length mismatch (got {}, expected {})",
                _memo_data.len(),
                C_MEMO_SIZE as usize
            );
            return HostFunctionResult::panic();
        }

        let service_id = match context.service_id {
            Some(id) => id as u32,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- HUH", _log_service_id, dest, amount, gas_limit);
                return HostFunctionResult::continue_execution();
            }
        };

        let accounts = match context.accounts.as_deref_mut() {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- WHO", _log_service_id, dest, amount, gas_limit);
                return HostFunctionResult::continue_execution();
            }
        };
        // 1. Check if source service exists (HUH check)
        // We need to check existence before resolving dest (WHO check) to match AS order.
        let source_exists = context.service_account.is_some()
            || accounts.contains_key(&(service_id as u64));

        if !source_exists {
            base::set_accumulate_error(context.registers, codes::HUH);
            crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- HUH", _log_service_id, dest, amount, gas_limit);
            return HostFunctionResult::continue_execution();
        }

        // 2. Check if destination service exists (WHO check)
        let dest_minmemogas = match accounts.get(&dest) {
            Some(s) => s.minmemogas,
            None => {
                base::set_accumulate_error(context.registers, codes::WHO);
                crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- WHO", _log_service_id, dest, amount, gas_limit);
                return HostFunctionResult::continue_execution();
            }
        };

        // 3. Acquire mutable reference to source account
        // Should always succeed because we checked source_exists above
        let current_account = match &mut context.service_account {
            Some(acc) => acc,
            None => match accounts.get_mut(&(service_id as u64)) {
                Some(acc) => acc,
                None => {
                    // This should be unreachable given the check above
                    base::set_accumulate_error(context.registers, codes::HUH);
                    crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- HUH", _log_service_id, dest, amount, gas_limit);
                    return HostFunctionResult::continue_execution();
                }
            },
        };

        // Gray Paper: l < destService.minmemogas → LOW
        if gas_limit < dest_minmemogas {
            base::set_accumulate_error(context.registers, codes::LOW);
            crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- LOW", _log_service_id, dest, amount, gas_limit);
            return HostFunctionResult::continue_execution();
        }

        // balance < amount → CASH
        if current_account.balance < amount {
            base::set_accumulate_error(context.registers, codes::CASH);
            crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- CASH", _log_service_id, dest, amount, gas_limit);
            return HostFunctionResult::continue_execution();
        }
        let balance_after_transfer = current_account.balance - amount;

        // balanceAfterTransfer < minbalance → CASH
        let minbalance = Self::minbalance(current_account);
        if balance_after_transfer < minbalance {
            base::set_accumulate_error(context.registers, codes::CASH);
            crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- CASH", _log_service_id, dest, amount, gas_limit);
            return HostFunctionResult::continue_execution();
        }

        // Success: deduct amount from sender and record deferred transfer for implications.xfers.
        current_account.balance = balance_after_transfer;
        if let Some(xfers) = &mut context.xfers {
            xfers.push(DeferredTransfer {
                source: service_id,
                dest: dest as u32,
                amount,
                memo: _memo_data.to_vec(),
                gas_limit,
            });
        }
        base::set_accumulate_success(context.registers, codes::OK);
        crate::host_log!("[host-calls] [{}] TRANSFER({}, {}, {}) <- OK", _log_service_id, dest, amount, gas_limit);

        // Gray Paper: on success additional gas = l (base 10 already deducted in state_wrapper)
        let additional_gas = gas_limit as u32;
        *context.gas_remaining = context.gas_remaining.saturating_sub(additional_gas);

        HostFunctionResult::continue_execution()
    }
}
