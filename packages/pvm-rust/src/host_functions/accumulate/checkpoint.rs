//! CHECKPOINT accumulation host function (Ω_C). Gray Paper: function ID 17.
//! imY' = imX (copy regular to exceptional); r7 = gascounter'. 1:1 with AS checkpoint.ts.

use crate::config::FUNC_CHECKPOINT;
use crate::host_functions::accumulate::base;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

pub struct CheckpointHostFunction;

impl HostFunction for CheckpointHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_CHECKPOINT
    }
    fn name(&self) -> &'static str {
        "checkpoint"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        // Gray Paper line 752: imY' = imX. Executor (with full implications) copies regular → exceptional when checkpoint_requested is set.
        if let Some(ref mut requested) = context.checkpoint_requested {
            **requested = true;
        }
        // Gray Paper line 753: registers'_7 = gascounter' (gas counter after deduction by executor)
        base::set_accumulate_success(context.registers, u64::from(*context.gas_remaining));
        HostFunctionResult::continue_execution()
    }
}
