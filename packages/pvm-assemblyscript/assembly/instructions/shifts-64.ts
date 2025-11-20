import {
  OPCODE_NEG_ADD_IMM_64,
  OPCODE_SHAR_R_IMM_64,
  OPCODE_SHLO_L_IMM_64,
  OPCODE_SHLO_R_IMM_64,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * SHLO_L_IMM_64 instruction (opcode 0x151)
 * Logical left shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = sext{8}{(reg_B · 2^{immed_X mod 64}) mod 2^64}
 */
export class SHLO_L_IMM_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_IMM_64
  name: string = 'SHLO_L_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: reg'_A = sext{8}{(reg_B · 2^{immed_X mod 64}) mod 2^64}
    // Apply mod 2^64 BEFORE sext{8} (sext{8} is a no-op for 64-bit values, but we still need to mask)
    const shiftAmount = u64(immediateX) % u64(64)
    const multiplied = u64(registerValue) << shiftAmount
    const mod64 = multiplied & u64(0xffffffffffffffff) // mod 2^64
    const shift = this.signExtend(mod64, 8) // sext{8} (no-op for 64-bit values)

    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

    return new InstructionResult(-1)
  }
}

/**
 * SHLO_R_IMM_64 instruction (opcode 0x152)
 * Logical right shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = sext{8}{floor{reg_B ÷ 2^{immed_X mod 64}}}
 */
export class SHLO_R_IMM_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_IMM_64
  name: string = 'SHLO_R_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerValue = this.getRegisterValueAs64(context.registers, registerB)

    // Ensure shift amount is within 64-bit range
    const shiftAmount = u64(immediateX) % u64(64)
    const result = u64(registerValue) >> shiftAmount

    const shift = this.signExtend(result, 8)

    this.setRegisterValueWith64BitResult(context.registers, registerA, shift)

    return new InstructionResult(-1)
  }
}

/**
 * SHAR_R_IMM_64 instruction (opcode 0x153)
 * Arithmetic right shift by immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = unsigned{floor{signed{reg_B} ÷ 2^{immed_X mod 64}}}
 */
export class SHAR_R_IMM_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_IMM_64
  name: string = 'SHAR_R_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(registerBValue)
    const shiftAmount = u64(immediateX) % u64(64)
    const shiftedValue = signedValue >> i64(shiftAmount)
    const result = this.toUnsigned64(shiftedValue)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

/**
 * NEG_ADD_IMM_64 instruction (opcode 0x154)
 * Negate and add immediate (64-bit) as specified in Gray Paper
 * Gray Paper formula: reg'_A = (immed_X + 2^64 - reg_B) mod 2^64
 */
export class NEG_ADD_IMM_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_NEG_ADD_IMM_64
  name: string = 'NEG_ADD_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValueAs64(context.registers, registerB)

    // Negate the register value and add immediate
    // (immed_X + 2^64 - reg_B) mod 2^64
    const result = (u64(immediateX) - u64(registerBValue)) & u64(0xffffffffffffffff)

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
