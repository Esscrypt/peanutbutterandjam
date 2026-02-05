//! DESIGNATE accumulation host function (Ω_D). Gray Paper: function ID 16.
//! r7 = validators array offset (o). 1:1 with AS designate.ts.

use crate::config::FUNC_DESIGNATE;
use crate::host_functions::accumulate::base::{self, codes, DEFAULT_NUM_VALIDATORS, VALIDATOR_SIZE};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

pub struct DesignateHostFunction;

impl HostFunction for DesignateHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_DESIGNATE
    }
    fn name(&self) -> &'static str {
        "designate"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let validators_offset = context.registers[7];
        let num_validators = context
            .num_validators
            .unwrap_or(DEFAULT_NUM_VALIDATORS);
        let total_size = (VALIDATOR_SIZE * num_validators) as u32;

        let read_result = context.ram.read_octets(validators_offset as u32, total_size);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            crate::host_log!(
                "[hostfn] designate PANIC: validators read fault (offset={}, len={}, fault_address={})",
                validators_offset, total_size, read_result.fault_address
            );
            return HostFunctionResult::panic();
        }
        let validators_data = read_result.data.unwrap();
        if validators_data.len() != total_size as usize {
            crate::host_log!(
                "[hostfn] designate PANIC: validators length mismatch (got {}, expected {})",
                validators_data.len(),
                total_size as usize
            );
            return HostFunctionResult::panic();
        }

        // AS: imX.id !== imX.state.delegator → HUH. Single imX.state (accumulation_state).
        let state = context
            .accumulation_state
            .as_deref_mut()
            .expect("designate: accumulation context must have accumulation_state");
        let current_service_id = context
            .service_id
            .expect("designate: accumulation context must have service_id");
        if current_service_id != u64::from(state.delegator) {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }

        let validator_size = VALIDATOR_SIZE as usize;
        let mut validators = Vec::with_capacity(num_validators as usize);
        for i in 0..(num_validators as usize) {
            let start = i * validator_size;
            let end = start + validator_size;
            validators.push(validators_data[start..end].to_vec());
        }
        state.stagingset = validators;

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
