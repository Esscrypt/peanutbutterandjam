//! PVM core (mirrors assembly/pvm.ts). Stub for full port.

#![allow(dead_code)]

/// Single decoded instruction (opcode, operands, fskip, pc). Mirrors PVMInstruction.
#[derive(Clone, Debug)]
pub struct PvmInstruction {
    pub opcode: i32,
    pub operands: Vec<u8>,
    pub fskip: i32,
    pub pc: u32,
}

impl PvmInstruction {
    #[must_use]
    pub fn new(opcode: i32, operands: Vec<u8>, fskip: i32, pc: u32) -> Self {
        Self {
            opcode,
            operands,
            fskip,
            pc,
        }
    }
}

/// Placeholder PVM state. Full implementation to be ported from AssemblyScript.
pub struct Pvm;

impl Pvm {
    pub fn reset(&mut self) {}
}
