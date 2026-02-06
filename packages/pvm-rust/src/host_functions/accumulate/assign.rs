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

        let _log_service_id = context.service_id.unwrap_or(0);
        let num_cores_val = context.num_cores.unwrap_or(DEFAULT_NUM_CORES);
        crate::host_log!(
            "[hostfn] ASSIGN host function invoked coreIndex={} authQueueOffset={} serviceIdToAssign={} currentServiceId={} numCores={}",
            core_index, auth_queue_offset, service_id_to_assign, _log_service_id, num_cores_val
        );

        let auth_queue_length = u64::from(C_AUTH_QUEUE_SIZE) * u64::from(AUTH_ENTRY_SIZE);
        let read_result = context.ram.read_octets(
            auth_queue_offset as u32,
            auth_queue_length as u32,
        );
        if read_result.fault_address != 0 || read_result.data.is_none() {
            base::set_accumulate_error(context.registers, codes::OOB);
            crate::host_log!(
                "[hostfn] assign PANIC: auth_queue read fault (offset={}, fault_address={})",
                auth_queue_offset, read_result.fault_address
            );
            return HostFunctionResult::panic();
        }
        let auth_queue_data = read_result.data.unwrap();

        let auth_queue = Self::parse_auth_queue(&auth_queue_data);

        if core_index >= u64::from(num_cores_val) {
            base::set_accumulate_error(context.registers, codes::CORE);
            crate::host_log!("[hostfn] ASSIGN CORE error: invalid core index");
            crate::host_log!("[host-calls] [{}] ASSIGN({}, {}) <- CORE", _log_service_id, core_index, service_id_to_assign);
            return HostFunctionResult::continue_execution();
        }

        // AS always has implications.regular; single imX.state (accumulation_state).
        let current_service_id = context
            .service_id
            .expect("assign: accumulation context must have service_id");
        let state = context
            .accumulation_state
            .as_deref_mut()
            .expect("assign: accumulation context must have accumulation_state");

        let core_idx = core_index as usize;
        while state.assigners.len() <= core_idx {
            state.assigners.push(0);
        }
        if current_service_id != u64::from(state.assigners[core_idx]) {
            base::set_accumulate_error(context.registers, codes::HUH);
            crate::host_log_error!(
                "[hostfn] assign: HUH (currentServiceId={} is not assigner for core {}, assigner={})",
                current_service_id, core_index, state.assigners[core_idx]
            );
            return HostFunctionResult::continue_execution();
        }

        // WHO (serviceId >= MAX) before "no service" / "no assign_state" HUH so we return WHO when
        // service_id is invalid even if context lacks service_id/assign_state (matches AS outcome).
        if service_id_to_assign >= MAX_SERVICE_ID {
            base::set_accumulate_error(context.registers, codes::WHO);
            crate::host_log_error!(
                "[hostfn] assign: WHO (invalid serviceIdToAssign={}, max={})",
                service_id_to_assign, MAX_SERVICE_ID
            );
            return HostFunctionResult::continue_execution();
        }

        while state.authqueue.len() <= core_idx {
            state.authqueue.push(vec![]);
        }
        state.authqueue[core_idx] = auth_queue;
        state.assigners[core_idx] = service_id_to_assign as u32;

        base::set_accumulate_success(context.registers, codes::OK);
        crate::host_log!("[host-calls] [{}] ASSIGN({}, {}) <- OK", _log_service_id, core_index, service_id_to_assign);
        HostFunctionResult::continue_execution()
    }
}
