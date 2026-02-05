//! LOG host function (JIP-1). Gray Paper: function ID 100. Base 10 gas (charged in state_wrapper).
//! level=ω7, target=μ[ω8..ω9], message=μ[ω10..ω11]. Log to operator; invalid memory → no side-effect, continue.
//! Matches TypeScript: UTF-8 decode (lossy), all levels logged, invalid access → continue.

use crate::config::FUNC_LOG;
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

/// LOG (100): read target and message from memory, decode as UTF-8, format and log; invalid access → continue.
pub struct LogHostFunction;

impl HostFunction for LogHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_LOG
    }
    fn name(&self) -> &'static str {
        "log"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let level = context.registers[7] as i32;
        let target_offset = context.registers[8];
        let target_length = context.registers[9];
        let message_offset = context.registers[10];
        let message_length = context.registers[11];

        let mut target_opt: Option<String> = None;
        if target_offset != 0 && target_length != 0 {
            let read_target = context.ram.read_octets(target_offset as u32, target_length as u32);
            if read_target.data.is_some() && read_target.fault_address == 0 {
                if let Some(ref data) = read_target.data {
                    target_opt = Some(String::from_utf8_lossy(data).into_owned());
                }
            }
        }

        let read_msg = context.ram.read_octets(message_offset as u32, message_length as u32);
        let message_data = match &read_msg.data {
            Some(d) if read_msg.fault_address == 0 => d.as_slice(),
            _ => return HostFunctionResult::continue_execution(),
        };
        let message = String::from_utf8_lossy(message_data).into_owned();

        let level_str = match level {
            0 => "FATAL",
            1 => "WARN",
            2 => "INFO",
            3 => "DEBUG",
            4 => "TRACE",
            _ => "INFO",
        };
        let formatted = match &target_opt {
            Some(t) => format!("{} [{}] {}", level_str, t, message),
            None => format!("{} {}", level_str, message),
        };
        #[cfg(feature = "log_host_call_logging")]
        eprintln!("{}", formatted);
        if let Some(log_messages) = context.log_messages.as_mut() {
            log_messages.push(formatted);
        }
        HostFunctionResult::continue_execution()
    }
}
