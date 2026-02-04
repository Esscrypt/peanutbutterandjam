//! General host functions (mirrors assembly/host-functions/general/). One file per host, logic 1:1 with AssemblyScript.

mod expunge;
mod export;
mod fetch;
mod gas;
mod historical_lookup;
mod info;
mod invoke;
mod log;
mod lookup;
mod machine;
mod pages;
mod peek;
mod poke;
mod read;
mod write;

use std::collections::HashMap;
use crate::host_functions::base::HostFunction;

pub use expunge::ExpungeHostFunction;
pub use export::ExportHostFunction;
pub use fetch::FetchHostFunction;
pub use gas::GasHostFunction;
pub use historical_lookup::HistoricalLookupHostFunction;
pub use info::InfoHostFunction;
pub use invoke::InvokeHostFunction;
pub use log::LogHostFunction;
pub use lookup::LookupHostFunction;
pub use machine::MachineHostFunction;
pub use pages::PagesHostFunction;
pub use peek::PeekHostFunction;
pub use poke::PokeHostFunction;
pub use read::ReadHostFunction;
pub use write::WriteHostFunction;

/// Build general host function registry with all implementations.
pub fn create_general_registry() -> HashMap<u8, Box<dyn HostFunction>> {
    let mut m = HashMap::new();
    let register = |m: &mut HashMap<u8, Box<dyn HostFunction>>, h: Box<dyn HostFunction>| {
        m.insert(h.function_id(), h);
    };
    register(&mut m, Box::new(GasHostFunction));
    register(&mut m, Box::new(FetchHostFunction::default()));
    register(&mut m, Box::new(LookupHostFunction));
    register(&mut m, Box::new(ReadHostFunction));
    register(&mut m, Box::new(WriteHostFunction));
    register(&mut m, Box::new(InfoHostFunction));
    register(&mut m, Box::new(HistoricalLookupHostFunction));
    register(&mut m, Box::new(ExportHostFunction));
    register(&mut m, Box::new(MachineHostFunction));
    register(&mut m, Box::new(PeekHostFunction));
    register(&mut m, Box::new(PokeHostFunction));
    register(&mut m, Box::new(PagesHostFunction));
    register(&mut m, Box::new(InvokeHostFunction));
    register(&mut m, Box::new(ExpungeHostFunction));
    register(&mut m, Box::new(LogHostFunction));
    m
}
