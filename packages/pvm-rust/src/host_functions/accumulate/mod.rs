//! Accumulate host functions (mirrors assembly/host-functions/accumulate/). One file per host, logic 1:1 with AssemblyScript where possible; no implications context in Rust → return appropriate error codes.

mod assign;
mod base;
mod bless;
mod checkpoint;
mod designate;
mod eject;
mod forget;
mod new;
mod provide;
mod query;
mod solicit;
mod transfer;
mod upgrade;
mod yield_;

use std::collections::HashMap;
use crate::host_functions::base::HostFunction;

pub use assign::AssignHostFunction;
pub use bless::BlessHostFunction;
pub use checkpoint::CheckpointHostFunction;
pub use designate::DesignateHostFunction;
pub use eject::EjectHostFunction;
pub use forget::ForgetHostFunction;
pub use new::NewHostFunction;
pub use provide::ProvideHostFunction;
pub use query::QueryHostFunction;
pub use solicit::SolicitHostFunction;
pub use transfer::TransferHostFunction;
pub use upgrade::UpgradeHostFunction;
pub use yield_::YieldHostFunction;

/// Build accumulate host function registry with all implementations.
pub fn create_accumulate_registry() -> HashMap<u8, Box<dyn HostFunction>> {
    let mut m = HashMap::new();
    let register = |m: &mut HashMap<u8, Box<dyn HostFunction>>, h: Box<dyn HostFunction>| {
        m.insert(h.function_id(), h);
    };
    register(&mut m, Box::new(BlessHostFunction));
    register(&mut m, Box::new(AssignHostFunction));
    register(&mut m, Box::new(DesignateHostFunction));
    register(&mut m, Box::new(CheckpointHostFunction));
    register(&mut m, Box::new(NewHostFunction));
    register(&mut m, Box::new(UpgradeHostFunction));
    register(&mut m, Box::new(TransferHostFunction));
    register(&mut m, Box::new(EjectHostFunction));
    register(&mut m, Box::new(QueryHostFunction));
    register(&mut m, Box::new(SolicitHostFunction));
    register(&mut m, Box::new(ForgetHostFunction));
    register(&mut m, Box::new(YieldHostFunction));
    register(&mut m, Box::new(ProvideHostFunction));
    m
}
