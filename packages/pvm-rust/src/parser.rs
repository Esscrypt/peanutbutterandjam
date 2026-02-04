//! Program parser (mirrors assembly/parser.ts). Decode blob and parse instructions with bitmask.

use crate::codec::decode_blob;
use crate::pvm::PvmInstruction;

/// Result of parsing a program blob.
#[derive(Clone, Debug)]
pub struct ParseResult {
    pub success: bool,
    pub instructions: Vec<PvmInstruction>,
    /// Extended code (code + 16 zero bytes) for execution.
    pub extended_code: Vec<u8>,
    pub bitmask: Vec<u8>,
    pub jump_table: Vec<u32>,
    pub errors: Vec<String>,
    pub code_length: u32,
}

impl ParseResult {
    #[must_use]
    pub fn new(
        success: bool,
        instructions: Vec<PvmInstruction>,
        extended_code: Vec<u8>,
        bitmask: Vec<u8>,
        jump_table: Vec<u32>,
        errors: Vec<String>,
        code_length: u32,
    ) -> Self {
        Self {
            success,
            instructions,
            extended_code,
            bitmask,
            jump_table,
            errors,
            code_length,
        }
    }
}

/// PVM parser: deblob and Fskip-based instruction boundaries (Gray Paper 7.1–7.3).
pub struct PvmParser;

impl PvmParser {
    #[must_use]
    pub const fn new() -> Self {
        Self
    }

    /// Fskip(i): distance in octets minus 1 to next instruction opcode.
    /// Gray Paper Eq 7.1: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1).
    #[must_use]
    pub fn skip(&self, instruction_index: i32, opcode_bitmask: &[u8]) -> i32 {
        let _ext_len = opcode_bitmask.len() + 25;
        for j in 1..=24 {
            let bit_index = instruction_index + j;
            if bit_index < opcode_bitmask.len() as i32 {
                if opcode_bitmask[bit_index as usize] == 1 {
                    return j - 1;
                }
            } else {
                return j - 1;
            }
        }
        24
    }

    /// Parse program blob: decode blob then walk code using bitmask and Fskip.
    #[must_use]
    pub fn parse_program(&self, program_blob: &[u8]) -> ParseResult {
        let mut instructions = Vec::new();
        let mut errors = Vec::new();

        let Some(decoded) = decode_blob(program_blob) else {
            errors.push("Failed to decode program blob - invalid format".to_string());
            return ParseResult::new(false, instructions, vec![], vec![], vec![], errors, 0);
        };

        let code = &decoded.code;
        let bitmask = &decoded.bitmask;
        let jump_table = decoded.jump_table.clone();

        let code_len = code.len();
        let ext_len = code_len + 16;
        let mut extended_code = vec![0u8; ext_len];
        extended_code[..code_len].copy_from_slice(code);

        let mut extended_bitmask = vec![1u8; ext_len];
        extended_bitmask[..bitmask.len()].copy_from_slice(bitmask);

        let mut instruction_index: i32 = 0;

        while instruction_index < ext_len as i32 {
            if instruction_index >= extended_bitmask.len() as i32
                || extended_bitmask[instruction_index as usize] == 0
            {
                instruction_index += 1;
                continue;
            }

            let opcode = i32::from(extended_code[instruction_index as usize]);
            let fskip = self.skip(instruction_index, &extended_bitmask);
            let instruction_length = 1 + fskip;

            let op_end = (instruction_index + instruction_length as i32).min(ext_len as i32);
            let operands: Vec<u8> = extended_code
                [(instruction_index + 1) as usize..op_end as usize]
                .to_vec();

            let instruction = PvmInstruction::new(
                opcode,
                operands,
                fskip,
                instruction_index as u32,
            );
            instructions.push(instruction);

            instruction_index += instruction_length;
        }

        ParseResult::new(
            errors.is_empty(),
            instructions,
            extended_code,
            extended_bitmask,
            jump_table,
            errors,
            code_len as u32,
        )
    }
}

impl Default for PvmParser {
    fn default() -> Self {
        Self::new()
    }
}
