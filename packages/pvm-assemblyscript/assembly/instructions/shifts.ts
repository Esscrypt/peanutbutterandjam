import {
  OPCODE_NEG_ADD_IMM_32,
  OPCODE_SHAR_R_IMM_32,
  OPCODE_SHLO_L_IMM_32,
  OPCODE_SHLO_R_IMM_32,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * SHLO_L_IMM_32 instruction (opcode 0x8A)
 * Gray Paper formula: reg'_A = sext{4}{(reg_B · 2^(immed_X mod 32)) mod 2^32}
 */
export class SHLO_L_IMM_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_IMM_32
  name: string = 'SHLO_L_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = sext{4}{(reg_B · 2^(immed_X mod 32)) mod 2^32}
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Ensure shift amount is within 32-bit range
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit number
    const shiftAmount = immediate32 % u64(32)
    const shifted = u64(registerValue) << shiftAmount
    const result = shifted & u64(0xffffffff) // Mask to 32 bits

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHLO_R_IMM_32 instruction (opcode 0x8B)
 * Gray Paper formula: reg'_A = sext{4}{floor(reg_B mod 2^32 / 2^(immed_X mod 32))}
 */
export class SHLO_R_IMM_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_IMM_32
  name: string = 'SHLO_R_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = sext{4}{floor(reg_B mod 2^32 / 2^(immed_X mod 32))}
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Ensure shift amount is within 32-bit range
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit number
    const shiftAmount = immediate32 % u64(32)
    const shifted = u64(registerValue) >> shiftAmount // Right shift
    const result = shifted & u64(0xffffffff) // Mask to 32 bits

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHAR_R_IMM_32 instruction (opcode 0x8C)
 * Gray Paper formula: reg'_A = unsigned{floor(signed_4(reg_B mod 2^32) / 2^(immed_X mod 32))}
 */
export class SHAR_R_IMM_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_IMM_32
  name: string = 'SHAR_R_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = unsigned{floor(signed_4(reg_B mod 2^32) / 2^(immed_X mod 32))}
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Arithmetic shift (signed)
    const immediate32 = u64(immediateX) & u64(0xffffffff) // Convert to 32-bit number
    const shiftAmount = immediate32 % u64(32)

    // Convert to signed 32-bit, perform arithmetic right shift, then back to unsigned
    const signedValue_u64 = this.signExtend(registerValue, 4) // Convert to signed 32-bit (returns u64)
    const signedValue_i64 = i64(signedValue_u64) // Cast to i64 for arithmetic right shift
    const shifted = signedValue_i64 >> i64(shiftAmount) // Arithmetic right shift
    const result = u64(shifted) & u64(0xffffffff) // Convert back to unsigned 32-bit

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

/**
 * NEG_ADD_IMM_32 instruction (opcode 0x8D)
 * Gray Paper formula: reg'_A = sext{4}{(immed_X + 2^32 - reg_B) mod 2^32}
 */
export class NEG_ADD_IMM_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_NEG_ADD_IMM_32
  name: string = 'NEG_ADD_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    // Use the standard two-register-and-immediate format
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper formula: reg'_A = (immed_X + 2^32 - reg_B) mod 2^32
    const immediate32 = u64(immediateX) & u64(0xffffffff)
    const result = (immediate32 + u64(0x100000000) - u64(registerValue)) & u64(0xffffffff)

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
