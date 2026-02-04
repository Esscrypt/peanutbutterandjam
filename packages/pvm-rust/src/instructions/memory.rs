//! Memory instructions (mirrors assembly/instructions/memory.ts).
//! LOAD_IMM_64, LOAD_IMM, STORE_IMM_*, LOAD_* from memory, STORE_* to memory, STORE_IMM_IND_*.

use crate::config::{
    OPCODE_LOAD_IMM, OPCODE_LOAD_IMM_64, OPCODE_LOAD_I16, OPCODE_LOAD_I32, OPCODE_LOAD_I8,
    OPCODE_LOAD_U16, OPCODE_LOAD_U32, OPCODE_LOAD_U64, OPCODE_LOAD_U8, OPCODE_STORE_IMM_IND_U16,
    OPCODE_STORE_IMM_IND_U32, OPCODE_STORE_IMM_IND_U64, OPCODE_STORE_IMM_IND_U8, OPCODE_STORE_IMM_U16,
    OPCODE_STORE_IMM_U32, OPCODE_STORE_IMM_U64, OPCODE_STORE_IMM_U8, OPCODE_STORE_U16,
    OPCODE_STORE_U32, OPCODE_STORE_U64, OPCODE_STORE_U8, RESULT_CODE_FAULT, RESULT_CODE_PANIC,
    ZONE_SIZE,
};
use crate::instructions::base::{
    get_register_index, parse_one_register_and_immediate,
    parse_one_register_and_immediate_unsigned, parse_register_and_two_immediates,
    parse_two_immediates, sign_extend, value_to_bytes_le, bytes_to_value_le,
    InstructionHandler, RegisterAndImmediateResult,
};
use crate::types::{InstructionContext, InstructionResult};

fn set_register(registers: &mut [u64; 13], index: u8, value: u64) {
    if (index as usize) < 13 {
        registers[index as usize] = value;
    }
}

fn get_register(registers: &[u64; 13], index: u8) -> u64 {
    registers.get(index as usize).copied().unwrap_or(0)
}

// --- LOAD_IMM_64 (0x14) ---
pub struct LoadImm64Instruction;

impl LoadImm64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadImm64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IMM_64)
    }
    fn name(&self) -> &'static str {
        "LOAD_IMM_64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let register_a = get_register_index(context.operands[0]);
        let mut immediate_x: u64 = 0;
        for i in 0..8.min(context.operands.len().saturating_sub(1)) {
            immediate_x |= u64::from(context.operands[1 + i]) << (i * 8);
        }
        set_register(context.registers, register_a, immediate_x);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- LOAD_IMM (0x33) ---
pub struct LoadImmInstruction;

impl LoadImmInstruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadImmInstruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_IMM)
    }
    fn name(&self) -> &'static str {
        "LOAD_IMM"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let RegisterAndImmediateResult {
            register_a,
            immediate_x,
        } = parse_one_register_and_immediate(context.operands, context.fskip);
        set_register(
            context.registers,
            register_a,
            immediate_x as u64,
        );
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- STORE_IMM_U8 (0x1E) ---
pub struct StoreImmU8Instruction;

impl StoreImmU8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for StoreImmU8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IMM_U8)
    }
    fn name(&self) -> &'static str {
        "STORE_IMM_U8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let (immediate_x, immediate_y) = parse_two_immediates(context.operands, context.fskip);
        let value = (immediate_y as u64) & 0xff;
        let address = (immediate_x as u64) & 0xffff_ffff;
        if address < u64::from(ZONE_SIZE) {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let wr = context
            .ram
            .write_octets(address as u32, &value_to_bytes_le(value, 1));
        if wr.has_fault {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, wr.fault_address);
        }
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- STORE_IMM_U16, U32, U64 ---
macro_rules! store_imm_instruction {
    ($name:ident, $opcode:ident, $mask:expr, $size:expr) => {
        pub struct $name;

        impl $name {
            #[must_use]
            pub const fn new() -> Self {
                Self
            }
        }

        impl InstructionHandler for $name {
            fn opcode(&self) -> i32 {
                i32::from($opcode)
            }
            fn name(&self) -> &'static str {
                stringify!($name)
            }
            fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
                let (immediate_x, immediate_y) = parse_two_immediates(context.operands, context.fskip);
                let value = (immediate_y as u64) & $mask;
                let address = (immediate_x as u64) & 0xffff_ffff;
                if address < u64::from(ZONE_SIZE) {
                    return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
                }
                let wr = context
                    .ram
                    .write_octets(address as u32, &value_to_bytes_le(value, $size));
                if wr.has_fault {
                    return InstructionResult::new(RESULT_CODE_FAULT as i32, wr.fault_address);
                }
                InstructionResult::new(InstructionResult::CONTINUE, 0)
            }
        }
    };
}

store_imm_instruction!(StoreImmU16Instruction, OPCODE_STORE_IMM_U16, 0xffff, 2);
store_imm_instruction!(StoreImmU32Instruction, OPCODE_STORE_IMM_U32, 0xffff_ffff, 4);
store_imm_instruction!(StoreImmU64Instruction, OPCODE_STORE_IMM_U64, 0xffff_ffff_ffff_ffff, 8);

// --- LOAD_U8, LOAD_I8 ---
pub struct LoadU8Instruction;

impl LoadU8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadU8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_U8)
    }
    fn name(&self) -> &'static str {
        "LOAD_U8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let (register_a, immediate_x) =
            parse_one_register_and_immediate_unsigned(context.operands, context.fskip);
        let read_result = context.ram.read_octets(immediate_x as u32, 1);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
        }
        let value = u64::from(read_result.data.as_ref().unwrap()[0]);
        set_register(context.registers, register_a, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct LoadI8Instruction;

impl LoadI8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadI8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_I8)
    }
    fn name(&self) -> &'static str {
        "LOAD_I8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let (register_a, immediate_x) =
            parse_one_register_and_immediate_unsigned(context.operands, context.fskip);
        let read_result = context.ram.read_octets(immediate_x as u32, 1);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
        }
        let raw = bytes_to_value_le(read_result.data.as_ref().unwrap());
        let value = sign_extend(raw, 1);
        set_register(context.registers, register_a, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- LOAD_U16, LOAD_I16 ---
fn load_u16_common(context: &mut InstructionContext<'_>) -> InstructionResult {
    let (register_a, immediate_x) =
        parse_one_register_and_immediate_unsigned(context.operands, context.fskip);
    let read_result = context.ram.read_octets(immediate_x as u32, 2);
    if read_result.fault_address != 0 || read_result.data.is_none() {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
    }
    let value = bytes_to_value_le(read_result.data.as_ref().unwrap());
    set_register(context.registers, register_a, value);
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

fn load_i16_common(context: &mut InstructionContext<'_>) -> InstructionResult {
    let (register_a, immediate_x) =
        parse_one_register_and_immediate_unsigned(context.operands, context.fskip);
    let read_result = context.ram.read_octets(immediate_x as u32, 2);
    if read_result.fault_address != 0 || read_result.data.is_none() {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
    }
    let raw = bytes_to_value_le(read_result.data.as_ref().unwrap());
    let value = sign_extend(raw, 2);
    set_register(context.registers, register_a, value);
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

pub struct LoadU16Instruction;

impl LoadU16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadU16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_U16)
    }
    fn name(&self) -> &'static str {
        "LOAD_U16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_u16_common(context)
    }
}

pub struct LoadI16Instruction;

impl LoadI16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadI16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_I16)
    }
    fn name(&self) -> &'static str {
        "LOAD_I16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        load_i16_common(context)
    }
}

// --- LOAD_U32, LOAD_I32 (with ZONE_SIZE check) ---
pub struct LoadU32Instruction;

impl LoadU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_U32)
    }
    fn name(&self) -> &'static str {
        "LOAD_U32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let (register_a, immediate_x) =
            parse_one_register_and_immediate_unsigned(context.operands, context.fskip);
        if immediate_x < u64::from(ZONE_SIZE) {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let read_result = context.ram.read_octets(immediate_x as u32, 4);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
        }
        let value = bytes_to_value_le(read_result.data.as_ref().unwrap());
        set_register(context.registers, register_a, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

pub struct LoadI32Instruction;

impl LoadI32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadI32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_I32)
    }
    fn name(&self) -> &'static str {
        "LOAD_I32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let RegisterAndImmediateResult {
            register_a,
            immediate_x,
        } = parse_one_register_and_immediate(context.operands, context.fskip);
        let address = (immediate_x as u64) & 0xffff_ffff;
        if address < u64::from(ZONE_SIZE) {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let read_result = context.ram.read_octets(address as u32, 4);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
        }
        let raw = bytes_to_value_le(read_result.data.as_ref().unwrap());
        let value = sign_extend(raw, 4);
        set_register(context.registers, register_a, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- LOAD_U64 ---
pub struct LoadU64Instruction;

impl LoadU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for LoadU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_LOAD_U64)
    }
    fn name(&self) -> &'static str {
        "LOAD_U64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        let RegisterAndImmediateResult {
            register_a,
            immediate_x,
        } = parse_one_register_and_immediate(context.operands, context.fskip);
        let address = (immediate_x as u64) & 0xffff_ffff;
        if address < u64::from(ZONE_SIZE) {
            return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
        }
        let read_result = context.ram.read_octets(immediate_x as u32, 8);
        if read_result.fault_address != 0 || read_result.data.is_none() {
            return InstructionResult::new(RESULT_CODE_FAULT as i32, read_result.fault_address);
        }
        let value = bytes_to_value_le(read_result.data.as_ref().unwrap());
        set_register(context.registers, register_a, value);
        InstructionResult::new(InstructionResult::CONTINUE, 0)
    }
}

// --- STORE_U8, STORE_U16, STORE_U32, STORE_U64 ---
fn store_reg_at_address(
    context: &mut InstructionContext<'_>,
    size: usize,
    mask: u64,
) -> InstructionResult {
    let RegisterAndImmediateResult {
        register_a,
        immediate_x,
    } = parse_one_register_and_immediate(context.operands, context.fskip);
    let value = get_register(context.registers, register_a) & mask;
    let address = (immediate_x as u64) & 0xffff_ffff;
    if address < u64::from(ZONE_SIZE) {
        return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
    }
    let wr = context
        .ram
        .write_octets(address as u32, &value_to_bytes_le(value, size));
    if wr.has_fault {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, wr.fault_address);
    }
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

macro_rules! store_u_instruction {
    ($name:ident, $opcode:ident, $mask:expr, $size:expr) => {
        pub struct $name;

        impl $name {
            #[must_use]
            pub const fn new() -> Self {
                Self
            }
        }

        impl InstructionHandler for $name {
            fn opcode(&self) -> i32 {
                i32::from($opcode)
            }
            fn name(&self) -> &'static str {
                stringify!($name)
            }
            fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
                store_reg_at_address(context, $size, $mask)
            }
        }
    };
}

store_u_instruction!(StoreU8Instruction, OPCODE_STORE_U8, 0xff, 1);
store_u_instruction!(StoreU16Instruction, OPCODE_STORE_U16, 0xffff, 2);
store_u_instruction!(StoreU32Instruction, OPCODE_STORE_U32, 0xffff_ffff, 4);
store_u_instruction!(StoreU64Instruction, OPCODE_STORE_U64, 0xffff_ffff_ffff_ffff, 8);

// --- STORE_IMM_IND_U8, U16, U32, U64 ---
fn store_imm_ind_common(
    context: &mut InstructionContext<'_>,
    size: usize,
    mask: u64,
) -> InstructionResult {
    let parsed = parse_register_and_two_immediates(context.operands, context.fskip);
    let reg_value = get_register(context.registers, parsed.register_a);
    let address = (reg_value.wrapping_add(parsed.immediate_x as u64)) & 0xffff_ffff;
    if address < u64::from(ZONE_SIZE) {
        return InstructionResult::new(RESULT_CODE_PANIC as i32, 0);
    }
    let value = (parsed.immediate_y as u64) & mask;
    let wr = context
        .ram
        .write_octets(address as u32, &value_to_bytes_le(value, size));
    if wr.has_fault {
        return InstructionResult::new(RESULT_CODE_FAULT as i32, wr.fault_address);
    }
    InstructionResult::new(InstructionResult::CONTINUE, 0)
}

pub struct StoreImmIndU8Instruction;

impl StoreImmIndU8Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for StoreImmIndU8Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IMM_IND_U8)
    }
    fn name(&self) -> &'static str {
        "STORE_IMM_IND_U8"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_imm_ind_common(context, 1, 0xff)
    }
}

pub struct StoreImmIndU16Instruction;

impl StoreImmIndU16Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for StoreImmIndU16Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IMM_IND_U16)
    }
    fn name(&self) -> &'static str {
        "STORE_IMM_IND_U16"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_imm_ind_common(context, 2, 0xffff)
    }
}

pub struct StoreImmIndU32Instruction;

impl StoreImmIndU32Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for StoreImmIndU32Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IMM_IND_U32)
    }
    fn name(&self) -> &'static str {
        "STORE_IMM_IND_U32"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_imm_ind_common(context, 4, 0xffff_ffff)
    }
}

pub struct StoreImmIndU64Instruction;

impl StoreImmIndU64Instruction {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }
}

impl InstructionHandler for StoreImmIndU64Instruction {
    fn opcode(&self) -> i32 {
        i32::from(OPCODE_STORE_IMM_IND_U64)
    }
    fn name(&self) -> &'static str {
        "STORE_IMM_IND_U64"
    }
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult {
        store_imm_ind_common(context, 8, 0xffff_ffff_ffff_ffff)
    }
}
