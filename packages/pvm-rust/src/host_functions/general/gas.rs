//! GAS host function (Ω_G). Gray Paper: function ID 0, gas cost 10.
//! Sets registers[7] = remaining gas.

use crate::config::FUNC_GAS;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// GAS (0): set registers[7] = remaining gas. Base 10 gas already deducted in state_wrapper.
pub struct GasHostFunction;

impl HostFunction for GasHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_GAS
    }
    fn name(&self) -> &'static str {
        "gas"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        context.registers[7] = u64::from(*context.gas_remaining);
        HostFunctionResult::continue_execution()
    }
}
