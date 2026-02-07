//! BLESS accumulation host function (Ω_B). Gray Paper: function ID 14.
//! r7..r12 = m, a, v, r, o, n (manager, assigners offset, delegator, registrar, always accessors offset, n). 1:1 with AS bless.ts.

use crate::codec::AlwaysAccerEntry;
use crate::config::FUNC_BLESS;
use crate::host_functions::accumulate::base::{self, codes, DEFAULT_NUM_CORES, MAX_SERVICE_ID};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const BYTES_PER_ASSIGNER: u32 = 4;
const BYTES_PER_ALWAYS_ACCER: u32 = 12;

pub struct BlessHostFunction;

impl BlessHostFunction {
    fn parse_assigners(data: &[u8], num_cores: u32) -> Vec<u32> {
        let mut assigners = Vec::with_capacity(num_cores as usize);
        for i in 0..(num_cores as usize) {
            let offset = i * BYTES_PER_ASSIGNER as usize;
            let core_id = u32::from_le_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]);
            assigners.push(core_id);
        }
        assigners
    }

    fn parse_always_accessors(data: &[u8], n: u64) -> Vec<AlwaysAccerEntry> {
        let mut entries = Vec::with_capacity(n as usize);
        for i in 0..(n as usize) {
            let offset = i * BYTES_PER_ALWAYS_ACCER as usize;
            let service_id = u32::from_le_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]);
            let gas = u64::from_le_bytes([
                data[offset + 4],
                data[offset + 5],
                data[offset + 6],
                data[offset + 7],
                data[offset + 8],
                data[offset + 9],
                data[offset + 10],
                data[offset + 11],
            ]);
            entries.push(AlwaysAccerEntry { service_id, gas });
        }
        entries
    }
}

impl HostFunction for BlessHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_BLESS
    }
    fn name(&self) -> &'static str {
        "bless"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let manager_service_id = context.registers[7];
        let assigners_offset = context.registers[8];
        let delegator_service_id = context.registers[9];
        let registrar_service_id = context.registers[10];
        let always_accessors_offset = context.registers[11];
        let number_of_always_accessors = context.registers[12];

        let num_cores = context
            .num_cores
            .unwrap_or(DEFAULT_NUM_CORES);
        let assigners_length = (u64::from(num_cores) * u64::from(BYTES_PER_ASSIGNER)) as u32;
        let read_assigners = context.ram.read_octets(assigners_offset as u32, assigners_length);
        if read_assigners.fault_address != 0 || read_assigners.data.is_none() {
            crate::host_log!(
                "[hostfn] bless PANIC: assigners read fault (offset={}, len={}, fault_address={})",
                assigners_offset, assigners_length, read_assigners.fault_address
            );
            return HostFunctionResult::panic();
        }
        let assigners_data = read_assigners.data.unwrap();
        if assigners_data.len() != assigners_length as usize {
            crate::host_log!(
                "[hostfn] bless PANIC: assigners length mismatch (got {}, expected {})",
                assigners_data.len(),
                assigners_length as usize
            );
            return HostFunctionResult::panic();
        }

        let accessors_length = (number_of_always_accessors * u64::from(BYTES_PER_ALWAYS_ACCER)) as u32;
        let read_accessors = context.ram.read_octets(always_accessors_offset as u32, accessors_length);
        if read_accessors.fault_address != 0 || read_accessors.data.is_none() {
            crate::host_log!(
                "[hostfn] bless PANIC: accessors read fault (offset={}, len={}, fault_address={})",
                always_accessors_offset, accessors_length, read_accessors.fault_address
            );
            return HostFunctionResult::panic();
        }
        let accessors_data = read_accessors.data.unwrap();
        if accessors_data.len() != accessors_length as usize {
            crate::host_log!(
                "[hostfn] bless PANIC: accessors length mismatch (got {}, expected {})",
                accessors_data.len(),
                accessors_length as usize
            );
            return HostFunctionResult::panic();
        }

        if manager_service_id >= MAX_SERVICE_ID
            || delegator_service_id >= MAX_SERVICE_ID
            || registrar_service_id >= MAX_SERVICE_ID
        {
            base::set_accumulate_error(context.registers, codes::WHO);
            return HostFunctionResult::continue_execution();
        }

        let assigners = Self::parse_assigners(&assigners_data, num_cores);
        let alwaysaccers = Self::parse_always_accessors(&accessors_data, number_of_always_accessors);

        // AS always has implications.regular; single imX.state (accumulation_state).
        let state = context
            .accumulation_state
            .as_deref_mut()
            .expect("bless: accumulation context must have accumulation_state");

        state.manager = manager_service_id as u32;
        state.delegator = delegator_service_id as u32;
        state.registrar = registrar_service_id as u32;
        state.assigners = assigners;
        state.alwaysaccers = alwaysaccers;

        base::set_accumulate_success(context.registers, codes::OK);
        HostFunctionResult::continue_execution()
    }
}
