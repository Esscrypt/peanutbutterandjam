import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * SHLO_L_IMM_32 instruction (opcode 0x8A)
 * Gray Paper formula: reg'_A = sext{4}{(reg_B · 2^(immed_X mod 32)) mod 2^32}
 */
export class SHLO_L_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_32
  readonly name = 'SHLO_L_IMM_32'
  readonly description = 'Logical left shift by immediate (32-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = sext{4}{(reg_B · 2^(immed_X mod 32)) mod 2^32}
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB, // Source register
    )

    // Ensure shift amount is within 32-bit range
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit number
    const shiftAmount = immediate32 % 32n
    const shifted = registerValue << shiftAmount
    const result = shifted & 0xffffffffn // Mask to 32 bits

    logger.debug('Executing SHLO_L_IMM_32 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      shifted,
      result,
    })
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerA, // Destination register
      result,
    )

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * SHLO_R_IMM_32 instruction (opcode 0x8B)
 * Gray Paper formula: reg'_A = sext{4}{floor(reg_B mod 2^32 / 2^(immed_X mod 32))}
 */
export class SHLO_R_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_32
  readonly name = 'SHLO_R_IMM_32'
  readonly description = 'Logical right shift by immediate (32-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = sext{4}{floor(reg_B mod 2^32 / 2^(immed_X mod 32))}
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB, // Source register
    )

    // Ensure shift amount is within 32-bit range
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit number
    const shiftAmount = immediate32 % 32n
    const shifted = registerValue >> shiftAmount // Right shift for bigint
    const result = shifted & 0xffffffffn // Mask to 32 bits

    logger.debug('Executing SHLO_R_IMM_32 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      shiftAmount,
      shifted,
      result,
    })
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerA, // Destination register
      result,
    )

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * SHAR_R_IMM_32 instruction (opcode 0x8C)
 * Gray Paper formula: reg'_A = unsigned{floor(signed_4(reg_B mod 2^32) / 2^(immed_X mod 32))}
 */
export class SHAR_R_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_32
  readonly name = 'SHAR_R_IMM_32'
  readonly description = 'Arithmetic right shift by immediate (32-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper formula: reg'_A = unsigned{floor(signed_4(reg_B mod 2^32) / 2^(immed_X mod 32))}
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB, // Source register
    )

    // Arithmetic shift (signed)
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit number
    const shiftAmount = immediate32 % 32n

    // Convert to signed 32-bit, perform arithmetic right shift, then back to unsigned
    const signedValue = this.signExtend(registerValue, 4) // Convert to signed 32-bit
    const shifted = signedValue >> shiftAmount // Arithmetic right shift
    const result = shifted & 0xffffffffn // Convert back to unsigned 32-bit

    logger.debug('Executing SHAR_R_IMM_32 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      signedValue,
      shiftAmount,
      shifted,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * NEG_ADD_IMM_32 instruction (opcode 0x8D)
 * Gray Paper formula: reg'_A = sext{4}{(immed_X + 2^32 - reg_B) mod 2^32}
 */
export class NEG_ADD_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.NEG_ADD_IMM_32
  readonly name = 'NEG_ADD_IMM_32'
  readonly description = 'Negate and add immediate (32-bit)'
  execute(context: InstructionContext): InstructionResult {
    // Use the standard two-register-and-immediate format
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB,
    )

    // Gray Paper formula: reg'_A = (immed_X + 2^32 - reg_B) mod 2^32
    const immediate32 = immediateX & 0xffffffffn
    const result = (immediate32 + 0x100000000n - registerValue) & 0xffffffffn

    logger.debug('Executing NEG_ADD_IMM_32 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      immediate32,
      result,
      calculation: `${immediate32} + 0x100000000n - ${registerValue} = ${(immediate32 + 0x100000000n - registerValue) & 0xffffffffn}`,
      resultHex: `0x${result.toString(16)}`,
    })
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerA,
      BigInt(result),
    )

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
