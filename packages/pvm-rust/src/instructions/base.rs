//! Base instruction handler trait and helpers (mirrors assembly/instructions/base.ts).

use crate::config::{is_termination_instruction, RESULT_CODE_PANIC};
use crate::types::{InstructionContext, InstructionResult};

/// Result of parsing one register and one immediate.
#[derive(Clone, Debug)]
pub struct RegisterAndImmediateResult {
    pub register_a: u8,
    pub immediate_x: i64,
}

/// Result of parsing one offset (JUMP target).
#[derive(Clone, Debug)]
pub struct OffsetOnlyResult {
    pub target_address: u32,
}

/// Result of parsing one register and two immediates (e.g. STORE_IMM_IND_*).
#[derive(Clone, Debug)]
pub struct RegisterAndTwoImmediatesResult {
    pub register_a: u8,
    pub immediate_x: i64,
    pub immediate_y: i64,
}

/// Result of parsing two registers and one immediate (Gray Paper §7.4.9: r_A, r_B, immed_X).
#[derive(Clone, Debug)]
pub struct TwoRegistersAndImmediateResult {
    pub register_a: u8,
    pub register_b: u8,
    pub immediate_x: i64,
}

/// Result of parse_branch_operands (One Register, One Immediate, One Offset). Gray Paper §7.4 Format 2.
#[derive(Clone, Debug)]
pub struct BranchOperandsResult {
    pub register_a: u8,
    pub immediate_x: i64,
    pub target_address: u32,
}

/// Result of parse_register_branch_operands (Two Registers & One Offset). Gray Paper §7.4.
#[derive(Clone, Debug)]
pub struct RegisterBranchOperandsResult {
    pub register_a: u8,
    pub register_b: u8,
    pub target_address: u32,
}

/// Result of parse_two_registers (Gray Paper: operands[0] = (A << 4) | D; r_D = low, r_A = high).
#[derive(Clone, Debug)]
pub struct TwoRegistersResult {
    pub register_d: u8,
    pub register_a: u8,
}

/// Result of parse_two_registers_and_two_immediates. Gray Paper §7.4 Format 5 (LOAD_IMM_JUMP_IND).
#[derive(Clone, Debug)]
pub struct TwoRegistersAndTwoImmediatesResult {
    pub register_a: u8,
    pub register_b: u8,
    pub immediate_x: i64,
    pub immediate_y: i64,
}

/// Parse two registers from single byte. Gray Paper: r_D = low nibble, r_A = high nibble.
#[must_use]
pub fn parse_two_registers(operands: &[u8]) -> TwoRegistersResult {
    let register_d = get_register_index(operands[0]);
    let register_a = get_register_b(operands);
    TwoRegistersResult {
        register_d,
        register_a,
    }
}

/// Get immediate X length from high nibble bits 4-6. Gray Paper: l_X = min(4, (operands[0]>>4) & 0x07).
#[must_use]
pub fn get_immediate_length_x(operands: &[u8]) -> i32 {
    let b = operands.get(0).copied().unwrap_or(0);
    ((b >> 4) & 0x07).min(4) as i32
}

/// Gray Paper: get register index from operand byte; r_A = min(12, operand_byte mod 16).
#[must_use]
pub fn get_register_index(operand_byte: u8) -> u8 {
    (operand_byte & 0x0f).min(12)
}

/// Gray Paper: get register B from high nibble; operands[0] = (B << 4) | A.
#[must_use]
pub fn get_register_b(operands: &[u8]) -> u8 {
    if operands.is_empty() {
        return 0;
    }
    ((operands[0] >> 4) & 0x0f).min(12)
}

/// Sign-extend value to 64 bits. Gray Paper sext{n}(x).
#[must_use]
pub fn sign_extend(value: u64, octets: i32) -> u64 {
    let masked = match octets {
        1 => value & 0xff,
        2 => value & 0xffff,
        3 => value & 0xffffff,
        4 => value & 0xffff_ffff,
        _ => value,
    };
    let sign_bit_pos = (8 * octets).saturating_sub(1) as u32;
    let sign_bit = (masked >> sign_bit_pos) & 1;
    let extension = match octets {
        1 => 0xFFFF_FFFF_FFFF_FF00u64,
        2 => 0xFFFF_FFFF_FFFF_0000u64,
        3 => 0xFFFF_FFFF_FF00_0000u64,
        4 => 0xFFFF_FFFF_0000_0000u64,
        _ => 0u64,
    };
    if sign_bit != 0 {
        masked | extension
    } else {
        masked
    }
}

/// Arithmetic right shift 32-bit value (signed then back to unsigned).
#[must_use]
pub fn arithmetic_shift_right_32(value: u64, shift: u32) -> u64 {
    let shift = shift.min(31);
    let v = (value & 0xffff_ffff) as i32;
    let result = v >> (shift as i32);
    (result as u64) & 0xffff_ffff
}

/// Arithmetic right shift 64-bit value (signed then back to unsigned).
#[must_use]
pub fn arithmetic_shift_right_64(value: u64, shift: u32) -> u64 {
    let shift = shift.min(63);
    ((value as i64) >> (shift as i32)) as u64
}

/// Read little-endian immediate (signed) from operands[start..start+length].
#[must_use]
pub fn get_immediate_value(operands: &[u8], start: usize, length: i32) -> i64 {
    if length <= 0 {
        return 0;
    }
    let len = length as usize;
    let end = (start + len).min(operands.len());
    if end <= start {
        return 0;
    }
    let mut value: u64 = 0;
    for (i, &b) in operands[start..end].iter().enumerate() {
        value |= u64::from(b) << (i * 8);
    }
    sign_extend(value, length) as i64
}

/// Read little-endian immediate (unsigned) from operands.
#[must_use]
pub fn get_immediate_value_unsigned(operands: &[u8], start: usize, length: i32) -> u64 {
    if length <= 0 {
        return 0;
    }
    let len = length as usize;
    let end = (start + len).min(operands.len());
    if end <= start {
        return 0;
    }
    let mut value: u64 = 0;
    for (i, &b) in operands[start..end].iter().enumerate() {
        value |= u64::from(b) << (i * 8);
    }
    value
}

/// Parse two registers and one immediate. Gray Paper §7.4.9: r_A (low 4), r_B (high 4), l_X = min(4, max(0, ℓ-1)), immed_X.
#[must_use]
pub fn parse_two_registers_and_immediate(
    operands: &[u8],
    fskip: i32,
) -> TwoRegistersAndImmediateResult {
    let register_a = get_register_index(operands[0]);
    let register_b = get_register_b(operands);
    let length_x = (fskip - 1).clamp(0, 4);
    let immediate_x = get_immediate_value(operands, 1, length_x);
    TwoRegistersAndImmediateResult {
        register_a,
        register_b,
        immediate_x,
    }
}

/// Result of parse_three_registers (Gray Paper: operands[0] = (B << 4) | A, operands[1] = D).
#[derive(Clone, Debug)]
pub struct ThreeRegistersResult {
    pub register_d: u8,
    pub register_a: u8,
    pub register_b: u8,
}

/// Parse three registers for instructions like ADD_32. operands[0] = (B<<4)|A, operands[1] = D (low nibble).
#[must_use]
pub fn parse_three_registers(operands: &[u8]) -> ThreeRegistersResult {
    let register_a = get_register_index(operands.get(0).copied().unwrap_or(0));
    let register_b = ((operands.get(0).copied().unwrap_or(0) >> 4) & 0x0f).min(12);
    let register_d = get_register_index(operands.get(1).copied().unwrap_or(0));
    ThreeRegistersResult {
        register_d,
        register_a,
        register_b,
    }
}

/// Parse one register and one immediate (signed). Gray Paper §7.4.5: r_A, l_X = min(4, max(0, ℓ-1)), immed_X.
#[must_use]
pub fn parse_one_register_and_immediate(operands: &[u8], fskip: i32) -> RegisterAndImmediateResult {
    let register_a = get_register_index(operands[0]);
    let length_x = (fskip - 1).clamp(0, 4);
    let immediate_x = get_immediate_value(operands, 1, length_x);
    RegisterAndImmediateResult {
        register_a,
        immediate_x,
    }
}

/// Parse one register and one immediate (unsigned). Same layout, immediate not sign-extended.
#[must_use]
pub fn parse_one_register_and_immediate_unsigned(
    operands: &[u8],
    fskip: i32,
) -> (u8, u64) {
    let register_a = get_register_index(operands[0]);
    let length_x = (fskip - 1).clamp(0, 4);
    let immediate_x = get_immediate_value_unsigned(operands, 1, length_x);
    (register_a, immediate_x)
}

/// Parse two immediates. Gray Paper §7.4.4: l_X = min(4, operands[0] mod 8), then l_Y = min(4, max(0, ℓ-l_X-1)).
#[must_use]
pub fn parse_two_immediates(operands: &[u8], fskip: i32) -> (i64, i64) {
    let length_x = (operands.get(0).copied().unwrap_or(0) & 0x07) as i32;
    let length_x = length_x.clamp(0, 4);
    let immediate_x = get_immediate_value(operands, 1, length_x);
    let length_y = (fskip - length_x - 1).clamp(0, 4);
    let immediate_y = get_immediate_value(operands, 1 + length_x as usize, length_y);
    (immediate_x, immediate_y)
}

/// Parse register and two immediates. Gray Paper §7.4.6: r_A, l_X = (operands[0]>>4)&0x07, immed_X, l_Y, immed_Y.
#[must_use]
pub fn parse_register_and_two_immediates(
    operands: &[u8],
    fskip: i32,
) -> RegisterAndTwoImmediatesResult {
    let register_a = get_register_index(operands[0]);
    let length_x = ((operands.get(0).copied().unwrap_or(0) >> 4) & 0x07) as i32;
    let length_x = length_x.clamp(0, 4);
    let immediate_x = get_immediate_value(operands, 1, length_x);
    let length_y = (fskip - length_x - 1).clamp(0, 4);
    let immediate_y = get_immediate_value(operands, 1 + length_x as usize, length_y);
    RegisterAndTwoImmediatesResult {
        register_a,
        immediate_x,
        immediate_y,
    }
}

/// Parse two registers and two immediates. Gray Paper §7.4 Format 5 (LOAD_IMM_JUMP_IND).
/// r_A = min(12, operands[0] mod 16), r_B = min(12, operands[0]/16),
/// l_X = min(4, operands[1] mod 8), immed_X at operands[2], l_Y = min(4, max(0, ℓ - l_X - 2)), immed_Y at operands[2+l_X].
#[must_use]
pub fn parse_two_registers_and_two_immediates(
    operands: &[u8],
    fskip: i32,
) -> TwoRegistersAndTwoImmediatesResult {
    let register_a = get_register_index(operands.get(0).copied().unwrap_or(0));
    let register_b = get_register_b(operands);
    let length_x = (operands.get(1).copied().unwrap_or(0) & 0x07) as i32;
    let length_x = length_x.clamp(0, 4);
    let immediate_x = get_immediate_value(operands, 2, length_x);
    let length_y = (fskip - length_x - 2).clamp(0, 4);
    let immediate_y = get_immediate_value(operands, 2 + length_x as usize, length_y);
    TwoRegistersAndTwoImmediatesResult {
        register_a,
        register_b,
        immediate_x,
        immediate_y,
    }
}

/// Gray Paper Fskip(i): min(24, j ∈ N : (k ∥ {1,1,...})[i+1+j] = 1). Octets to next instruction opcode minus 1.
#[must_use]
pub fn calculate_skip_distance(instruction_index: usize, bitmask: &[u8]) -> i32 {
    for j in 1..=24 {
        let next_index = instruction_index + j;
        if next_index >= bitmask.len() || bitmask[next_index] == 1 {
            return (j - 1) as i32;
        }
    }
    24
}

/// Gray Paper: validate branch target is a basic block start. Returns None if valid, Some(panic result) if invalid.
#[must_use]
pub fn validate_branch_target(
    target_address: u32,
    code: &[u8],
    bitmask: &[u8],
) -> Option<InstructionResult> {
    if target_address as usize >= code.len() {
        return Some(InstructionResult::new(RESULT_CODE_PANIC as i32, 0));
    }
    if target_address as usize >= bitmask.len() || bitmask[target_address as usize] == 0 {
        return Some(InstructionResult::new(RESULT_CODE_PANIC as i32, 0));
    }
    if target_address == 0 {
        return None;
    }
    let target_index = target_address as usize;
    for i in 0..target_index {
        if bitmask.get(i).copied().unwrap_or(0) == 1 {
            let opcode = code.get(i).copied().unwrap_or(0);
            if is_termination_instruction(opcode) {
                let skip_distance = calculate_skip_distance(i, bitmask);
                let instruction_end = i + 1 + (skip_distance as usize);
                if instruction_end == target_index {
                    return None;
                }
            }
        }
    }
    Some(InstructionResult::new(RESULT_CODE_PANIC as i32, 0))
}

/// Encode value as little-endian bytes (size 1..=8).
#[must_use]
pub fn value_to_bytes_le(value: u64, size: usize) -> Vec<u8> {
    let size = size.clamp(1, 8);
    (0..size).map(|i| (value >> (i * 8)) as u8).collect()
}

/// Decode little-endian bytes to u64 (no sign extension).
#[must_use]
pub fn bytes_to_value_le(bytes: &[u8]) -> u64 {
    let mut value: u64 = 0;
    for (i, &b) in bytes.iter().take(8).enumerate() {
        value |= u64::from(b) << (i * 8);
    }
    value
}

/// Parse branch operands: One Register, One Immediate, One Offset. Gray Paper §7.4 Format 2.
/// target_address = ι + signfunc{l_Y}(decode[l_Y](instructions[ι+2+l_X:l_Y])).
#[must_use]
pub fn parse_branch_operands(operands: &[u8], current_pc: u32) -> BranchOperandsResult {
    let register_a = get_register_index(operands[0]);
    let length_x = get_immediate_length_x(operands);
    let immediate_x = get_immediate_value(operands, 1, length_x);
    let length_y = (operands.len() as i32 - length_x - 1).clamp(0, 4);
    let raw_offset = get_immediate_value_unsigned(operands, 1 + length_x as usize, length_y);
    let offset_i64 = if length_y <= 0 {
        0i64
    } else {
        let sign_bit_pos = (8 * length_y - 1) as u32;
        let sign_bit = (raw_offset >> sign_bit_pos) & 1;
        if sign_bit != 0 {
            raw_offset as i64 - (1i64 << (8 * length_y))
        } else {
            raw_offset as i64
        }
    };
    let target_address = (current_pc as i64 + offset_i64) as u32;
    BranchOperandsResult {
        register_a,
        immediate_x,
        target_address,
    }
}

/// Parse register branch operands: Two Registers & One Offset. Gray Paper §7.4.
#[must_use]
pub fn parse_register_branch_operands(operands: &[u8], current_pc: u32) -> RegisterBranchOperandsResult {
    let register_a = get_register_index(operands[0]);
    let register_b = get_register_b(operands);
    let length_x = (operands.len() as i32 - 1).clamp(0, 4);
    let raw_offset = get_immediate_value_unsigned(operands, 1, length_x);
    let offset_i64 = if length_x <= 0 {
        0i64
    } else {
        let sign_bit_pos = (8 * length_x - 1) as u32;
        let sign_bit = (raw_offset >> sign_bit_pos) & 1;
        if sign_bit != 0 {
            raw_offset as i64 - (1i64 << (8 * length_x))
        } else {
            raw_offset as i64
        }
    };
    let target_address = (current_pc as i64 + offset_i64) as u32;
    RegisterBranchOperandsResult {
        register_a,
        register_b,
        target_address,
    }
}

/// Parse one offset (JUMP). Gray Paper: l_X = min(4, ℓ), immed_X = ι + signfunc(offset).
#[must_use]
pub fn parse_one_offset(operands: &[u8], fskip: i32, current_pc: u32) -> u32 {
    let length_x = fskip.min(4).max(0);
    if length_x <= 0 {
        return current_pc;
    }
    let raw = get_immediate_value_unsigned(operands, 0, length_x);
    let sign_bit_pos = (8 * length_x).saturating_sub(1) as u32;
    let sign_bit = (raw >> sign_bit_pos) & 1;
    let mask = (1u64 << (8 * length_x)) - 1;
    let raw_masked = raw & mask;
    let offset: i64 = if sign_bit != 0 {
        raw_masked as i64 - (1i64 << (8 * length_x))
    } else {
        raw_masked as i64
    };
    (current_pc as i64 + offset) as u32
}

/// Base trait for all PVM instruction handlers (mirrors PVMInstructionHandler).
pub trait InstructionHandler: Send + Sync {
    fn opcode(&self) -> i32;
    fn name(&self) -> &'static str;

    /// Execute the instruction. Returns InstructionResult (CONTINUE = -1, or halt code).
    fn execute(&self, context: &mut InstructionContext<'_>) -> InstructionResult;

    fn validate(&self, operands: &[u8]) -> bool {
        operands.len() >= 1
    }

    fn disassemble(&self, operands: &[u8]) -> String {
        let hex: String = operands.iter().map(|b| format!("{:02x}", b)).collect();
        format!("{} {}", self.name(), hex)
    }
}
