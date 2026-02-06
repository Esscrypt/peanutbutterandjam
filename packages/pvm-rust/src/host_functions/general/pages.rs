//! PAGES host function (Ω_Z). Gray Paper: function ID 11.
//! r7=machine ID, r8=page start, r9=page count, r10=access mode (0–4). No refineContext → PANIC.

use crate::config::{FUNC_PAGES, PAGE_SIZE, REG_HUH, REG_OK, REG_WHO};
use crate::host_functions::base::{HostFunction, HostFunctionContext, HostFunctionResult};

const MIN_PAGE_INDEX: u32 = 16;
/// Gray Paper: p+c >= 2^32/Cpvmpagesize invalid; 2^32 / 4096 = 1048576.
const MAX_PAGE_INDEX: u32 = 1_048_576;

/// PAGES (11): with refine_context: set page access on machine; WHO if no machine, HUH if invalid params.
pub struct PagesHostFunction;

impl HostFunction for PagesHostFunction {
    fn function_id(&self) -> u8 {
        FUNC_PAGES
    }
    fn name(&self) -> &'static str {
        "pages"
    }
    fn execute(&self, context: &mut HostFunctionContext<'_>) -> HostFunctionResult {
        let Some(refine) = context.refine_context.as_mut() else {
            return HostFunctionResult::panic();
        };

        let machine_id = context.registers[7];
        let page_start = context.registers[8] as u32;
        let page_count = context.registers[9] as u32;
        let access_rights = context.registers[10] as u32;

        let mut applied = None;
        let found = refine.with_machine(machine_id, &mut |machine| {
            if page_start < MIN_PAGE_INDEX
                || page_start.saturating_add(page_count) > MAX_PAGE_INDEX
                || access_rights > 4
            {
                applied = Some(false);
                return;
            }
            if access_rights > 2 {
                for i in 0..page_count {
                    let page_index = page_start + i;
                    let page_address = page_index * PAGE_SIZE;
                    if !machine.ram_is_readable(page_address, PAGE_SIZE) {
                        applied = Some(false);
                        return;
                    }
                }
            }
            machine.set_page_access(page_start, page_count, access_rights as u8);
            applied = Some(true);
        });

        if !found {
            context.registers[7] = REG_WHO;
            HostFunctionResult::continue_execution()
        } else if applied == Some(true) {
            context.registers[7] = REG_OK;
            HostFunctionResult::continue_execution()
        } else {
            context.registers[7] = REG_HUH;
            HostFunctionResult::continue_execution()
        }
    }
}
