import {
  OPCODE_SHAR_R_IMM_ALT_32,
  OPCODE_SHLO_L_IMM_ALT_32,
  OPCODE_SHLO_R_IMM_ALT_32,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_IMM_ALT_32
  name: string = 'SHLO_L_IMM_ALT_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = sext{4}{(immed_X · 2^(reg_B mod 32)) mod 2^32}
    // ALT: immediate << register (not register << immediate!)
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const shiftAmount =
      u64(this.getRegisterValueAs32(context.registers, registerB)) % u64(32)

    // Gray Paper: (immed_X · 2^(reg_B mod 32)) mod 2^32
    // Convert immediate to 32-bit unsigned, perform left shift, then mask to 32 bits
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit unsigned
    const shifted = immediate32 << shiftAmount // Left shift and mask to 32 bits
    const result = shifted // Result is already 32-bit

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SHLO_R_IMM_ALT_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_IMM_ALT_32
  name: string = 'SHLO_R_IMM_ALT_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = sext{4}{floor((immed_X mod 2^32) / 2^(reg_B mod 32))}
    // ALT: immediate >> register (not register >> immediate!)
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const shiftAmount =
      u64(this.getRegisterValueAs32(context.registers, registerB)) % u64(32)

    // Gray Paper: floor((immed_X mod 2^32) / 2^(reg_B mod 32))
    // Convert immediate to 32-bit unsigned, perform right shift
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit unsigned
    const shifted = immediate32 >> shiftAmount // Unsigned right shift
    const result = shifted & u64(0xffffffff) // Mask to 32 bits

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class SHAR_R_IMM_ALT_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_IMM_ALT_32
  name: string = 'SHAR_R_IMM_ALT_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = unsigned{floor(signed_32(immed_X mod 2^32) / 2^(reg_B mod 32))}
    // ALT: immediate >> register (not register >> immediate!) with arithmetic shift
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const shiftAmount =
      u64(this.getRegisterValueAs32(context.registers, registerB)) % u64(32)

    // Gray Paper: unsigned{floor(signed_32(immed_X mod 2^32) / 2^(reg_B mod 32))}
    // Convert immediate to 32-bit signed, perform arithmetic right shift, then convert back to unsigned
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit unsigned
    const signed32_u64 = this.signExtend(immediate32, 4) // Convert to signed 32-bit (returns u64)
    const signed32_i64 = i64(signed32_u64) // Cast to i64 for arithmetic right shift
    const shifted = signed32_i64 >> i64(shiftAmount) // Arithmetic right shift
    const result = u64(shifted) // Convert back to unsigned

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
