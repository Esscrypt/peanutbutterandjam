//! ASSIGN accumulation host function (Ω_A). Gray Paper: function ID 15.
//! r7..r9 = c, o, a (core index, auth queue offset, service ID to assign). 1:1 with AS assign.ts.

use crate::config::FUNC_ASSIGN;
use crate::host_functions::accumulate::base::{
    self, codes, C_AUTH_QUEUE_SIZE, DEFAULT_NUM_CORES, MAX_SERVICE_ID,
};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const AUTH_ENTRY_SIZE: u32 = 32;

pub struct AssignHostFunction;

impl AssignHostFunction {
    fn parse_auth_queue(data: &[u8]) -> Vec<Vec<u8>> {
        let mut queue = Vec::with_capacity(C_AUTH_QUEUE_SIZE as usize);
        for i in 0..(C_AUTH_QUEUE_SIZE as usize) {
            let start = i * AUTH_ENTRY_SIZE as usize;
            let end = start + AUTH_ENTRY_SIZE as usize;
            queue.push(data[start..end].to_vec());
        }
        queue
    }
}

impl HostFunction for AssignHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_ASSIGN
    }
    fn name(&self) -> &'static str {
        "assign"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let core_index = context.registers[7];
        let auth_queue_offset = context.registers[8];
        let service_id_to_assign = context.registers[9];

        let auth_queue_length = u64::from(C_AUTH_QUEUE_SIZE) * u64::from(AUTH_ENTRY_SIZE);
        let read_result = context.ram.read_octets(
            auth_queue_offset as u32,
            auth_queue_length as u32,
        );
        if read_result.fault_address != 0 || read_result.data.is_none() {
            base::set_accumulate_error(context.registers, codes::OOB);
            return HostFunctionResult::panic();
        }
        let auth_queue_data = read_result.data.unwrap();
        if auth_queue_data.len() != auth_queue_length as usize {
            base::set_accumulate_error(context.registers, codes::OOB);
            return HostFunctionResult::panic();
        }

        let auth_queue = Self::parse_auth_queue(&auth_queue_data);

        let num_cores = context
            .num_cores
            .unwrap_or(DEFAULT_NUM_CORES);
        if core_index >= u64::from(num_cores) {
            base::set_accumulate_error(context.registers, codes::CORE);
            return HostFunctionResult::continue_execution();
        }

        let current_service_id = match context.service_id {
            Some(id) => id,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        let assign_state = match context.assign_state.as_deref_mut() {
            Some(s) => s,
            None => {
                base::set_accumulate_error(context.registers, codes::HUH);
                return HostFunctionResult::continue_execution();
            }
        };

        let core_idx = core_index as usize;
        while assign_state.assigners.len() <= core_idx {
            assign_state.assigners.push(0);
        }
        if current_service_id != u64::from(assign_state.assigners[core_idx]) {
            base::set_accumulate_error(context.registers, codes::HUH);
            return HostFunctionResult::continue_execution();
        }

        if service_id_to_assign >= MAX_SERVICE_ID {
            base::set_accumulate_error(context.registers, codes::WHO);
            return HostFunctionResult::continue_execution();
        }

        while assign_state.authqueue.len() <= core_idx {
            assign_state.authqueue.push(vec![]);
        }
        assign_state.authqueue[core_idx] = auth_queue;
        assign_state.assigners[core_idx] = service_id_to_assign as u32;

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
