//! Instruction registry: map opcode → handler. Mirrors assembly/instructions/registry.ts.

use crate::instructions::base::InstructionHandler;
use std::collections::HashMap;

/// Central registry mapping opcodes to instruction handlers.
pub struct InstructionRegistry {
    handlers: HashMap<i32, Box<dyn InstructionHandler>>,
}

impl InstructionRegistry {
    #[must_use]
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    pub fn register(&mut self, handler: Box<dyn InstructionHandler>) {
        self.handlers.insert(handler.opcode(), handler);
    }

    #[must_use]
    pub fn get_handler(&self, opcode: i32) -> Option<&dyn InstructionHandler> {
        self.handlers.get(&opcode).map(|b| b.as_ref())
    }

    #[must_use]
    pub fn has_handler(&self, opcode: i32) -> bool {
        self.handlers.contains_key(&opcode)
    }

    #[must_use]
    pub fn registered_opcodes(&self) -> Vec<i32> {
        self.handlers.keys().copied().collect()
    }

    pub fn clear(&mut self) {
        self.handlers.clear();
    }
}

impl Default for InstructionRegistry {
    fn default() -> Self {
        Self::new()
    }
}
