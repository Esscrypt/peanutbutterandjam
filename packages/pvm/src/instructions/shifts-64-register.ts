import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * SHLO_L_64 instruction (opcode 0xCF)
 * Gray Paper formula: reg'_D = (reg_A · 2^(reg_B mod 64)) mod 2^64
 */
export class SHLO_L_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_64
  readonly name = 'SHLO_L_64'
  readonly description = 'Shift left (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % 64n
    const result = valueA << shiftAmount

    logger.debug('Executing SHLO_L_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * SHLO_R_64 instruction (opcode 0xD0)
 * Gray Paper formula: reg'_D = floor(reg_A ÷ 2^(reg_B mod 64))
 */
export class SHLO_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_64
  readonly name = 'SHLO_R_64'
  readonly description = 'Shift right logical (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % 64n
    const result = valueA >> shiftAmount

    logger.debug('Executing SHLO_R_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * SHAR_R_64 instruction (opcode 0xD1)
 * Gray Paper formula: reg'_D = unsigned{floor(signed(reg_A) ÷ 2^(reg_B mod 64))}
 */
export class SHAR_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_64
  readonly name = 'SHAR_R_64'
  readonly description = 'Shift right arithmetic (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % 64n

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(valueA)
    const shiftedValue = signedValue >> shiftAmount
    const result = this.toUnsigned64(shiftedValue)

    logger.debug('Executing SHAR_R_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }

  private toSigned64(value: bigint): bigint {
    // Convert 64-bit unsigned to signed
    if (value >= 2n ** 63n) {
      return value - 2n ** 64n
    }
    return value
  }

  private toUnsigned64(value: bigint): bigint {
    // Convert signed back to unsigned
    if (value < 0n) {
      return value + 2n ** 64n
    }
    return value
  }
}
