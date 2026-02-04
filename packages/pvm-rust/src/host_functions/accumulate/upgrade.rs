//! UPGRADE accumulation host function (Ω_U). Gray Paper: function ID 19.
//! r7 = code hash offset (o), r8 = new min accumulation gas (g), r9 = new min memory gas (m).
//! 1:1 with TS upgrade.ts: read 32-byte code hash from memory; update service account; r7 = OK or HUH/panic.

use crate::config::FUNC_UPGRADE;
use crate::host_functions::accumulate::base::{self, codes};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const CODE_HASH_LEN: u32 = 32;

pub struct UpgradeHostFunction;

impl HostFunction for UpgradeHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_UPGRADE
    }
    fn name(&self) -> &'static str {
        "upgrade"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let code_hash_offset = context.registers[7] as u32;
        let new_min_acc_gas = context.registers[8];
        let new_min_memo_gas = context.registers[9];

        let read_result = context.ram.read_octets(code_hash_offset, CODE_HASH_LEN);
        if read_result.fault_address != 0 {
            return HostFunctionResult::panic();
        }
        let Some(data) = read_result.data else {
            return HostFunctionResult::panic();
        };
        if data.len() != CODE_HASH_LEN as usize {
            return HostFunctionResult::panic();
        }

        let mut codehash = [0u8; 32];
        codehash.copy_from_slice(&data);

        let service_account = match &mut context.service_account {
            Some(a) => a,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        service_account.codehash = codehash;
        service_account.minaccgas = new_min_acc_gas;
        service_account.minmemogas = new_min_memo_gas;

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
