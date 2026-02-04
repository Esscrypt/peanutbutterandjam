//! Host functions (mirrors assembly/host-functions/). General + accumulate registries and stubs.

pub mod accumulate;
pub mod base;
pub mod general;
pub mod refine;

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::host_functions::base::HostFunction;

/// Combined host function registry (general + accumulate). Used when ECALLI runs.
fn get_combined_registry() -> &'static HashMap<u8, Box<dyn HostFunction>> {
    static REGISTRY: OnceLock<HashMap<u8, Box<dyn HostFunction>>> = OnceLock::new();
    REGISTRY.get_or_init(|| {
        let mut m = general::create_general_registry();
        for (id, h) in accumulate::create_accumulate_registry() {
            m.insert(id, h);
        }
        m
    })
}

/// Look up a host function by ID. Returns None if not found (caller should return RESULT_CODE_HOST).
pub fn get_host_function(host_call_id: u32) -> Option<&'static dyn HostFunction> {
    let id = host_call_id as u8;
    get_combined_registry()
        .get(&id)
        .map(|b| b.as_ref() as &dyn HostFunction)
}
