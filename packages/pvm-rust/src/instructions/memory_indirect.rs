//! STORE_IND and LOAD_IND: store/load at address (reg_B + immediate_X).
//! Mirrors pvm-assemblyscript memory-indirect.ts.

use crate::config::{
    OPCODE_LOAD_IND_I16, OPCODE_LOAD_IND_I32, OPCODE_LOAD_IND_I8, OPCODE_LOAD_IND_U16,
    OPCODE_LOAD_IND_U32, OPCODE_LOAD_IND_U64, OPCODE_LOAD_IND_U8, OPCODE_STORE_IND_U16,
    OPCODE_STORE_IND_U32, OPCODE_STORE_IND_U64, OPCODE_STORE_IND_U8, RESULT_CODE_FAULT,
    RESULT_CODE_PANIC, ZONE_SIZE,
};
use crate::instructions::base::{
    bytes_to_value_le, parse_two_registers_and_immediate, sign_extend, value_to_bytes_le,
    InstructionHandler,
};
use crate::types::{InstructionContext, InstructionResult};

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

fn store_ind_common(
    context: &mut InstructionContext<'_>,
    size: usize,
    mask: u64,
) -> InstructionResult {
    let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
    let reg_a_value = get_register(context.registers, parsed.register_a);
    let reg_b_value = get_register(context.registers, parsed.register_b);
    let address = (reg_b_value.wrapping_add(parsed.immediate_x as u64)) & 0xffff_ffff;
    if address < u64::from(ZONE_SIZE) {
        return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
    }
    let value = reg_a_value & mask;
    let bytes = value_to_bytes_le(value, size);
    let wr = context.ram.write_octets(address as u32, &bytes);
    if wr.has_fault {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, wr.fault_address);
    }
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

pub struct StoreIndU8Instruction;
impl StoreIndU8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for StoreIndU8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IND_U8)
    }
    fn name(&self) -> &'static str {
        "STORE_IND_U8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_ind_common(context, 1, 0xff)
    }
}

pub struct StoreIndU16Instruction;
impl StoreIndU16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for StoreIndU16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IND_U16)
    }
    fn name(&self) -> &'static str {
        "STORE_IND_U16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_ind_common(context, 2, 0xffff)
    }
}

pub struct StoreIndU32Instruction;
impl StoreIndU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for StoreIndU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IND_U32)
    }
    fn name(&self) -> &'static str {
        "STORE_IND_U32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_ind_common(context, 4, 0xffff_ffff)
    }
}

pub struct StoreIndU64Instruction;
impl StoreIndU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for StoreIndU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IND_U64)
    }
    fn name(&self) -> &'static str {
        "STORE_IND_U64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_ind_common(context, 8, 0xffff_ffff_ffff_ffff)
    }
}

fn load_ind_common(
    context: &mut InstructionContext<'_>,
    size: usize,
    signed: bool,
) -> InstructionResult {
    let parsed = parse_two_registers_and_immediate(context.operands, context.fskip);
    let reg_b_value = get_register(context.registers, parsed.register_b);
    let address = (reg_b_value.wrapping_add(parsed.immediate_x as u64)) & 0xffff_ffff;
    if address < u64::from(ZONE_SIZE) {
        return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
    }
    let read_result = context.ram.read_octets(address as u32, size as u32);
    if read_result.fault_address != 0 || read_result.data.is_none() {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
    }
    let data = read_result.data.as_ref().unwrap();
    let value = bytes_to_value_le(data);
    let value = if signed {
        sign_extend(value, size as i32)
    } else {
        value
    };
    set_register(context.registers, parsed.register_a, value);
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

pub struct LoadIndU8Instruction;
impl LoadIndU8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndU8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_U8)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_U8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 1, false)
    }
}

pub struct LoadIndI8Instruction;
impl LoadIndI8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndI8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_I8)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_I8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 1, true)
    }
}

pub struct LoadIndU16Instruction;
impl LoadIndU16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndU16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_U16)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_U16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 2, false)
    }
}

pub struct LoadIndI16Instruction;
impl LoadIndI16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndI16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_I16)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_I16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 2, true)
    }
}

pub struct LoadIndU32Instruction;
impl LoadIndU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_U32)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_U32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 4, false)
    }
}

pub struct LoadIndI32Instruction;
impl LoadIndI32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndI32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_I32)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_I32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 4, true)
    }
}

pub struct LoadIndU64Instruction;
impl LoadIndU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}
impl InstructionHandler for LoadIndU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IND_U64)
    }
    fn name(&self) -> &'static str {
        "LOAD_IND_U64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_ind_common(context, 8, false)
    }
}
