import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * SHLO_L_32 instruction (opcode 0x7A)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A · 2^(reg_B mod 32)) mod 2^32}
 */
export class SHLO_L_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_32
  readonly name = 'SHLO_L_32'
  readonly description = 'Shift left (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n
    const result = valueA << shiftAmount

    logger.debug('Executing SHLO_L_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

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
 * SHLO_R_32 instruction (opcode 0x7B)
 * Gray Paper formula: reg'_D = sext{4}{floor((reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHLO_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_32
  readonly name = 'SHLO_R_32'
  readonly description = 'Shift right logical (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n
    const result = valueA >> shiftAmount // Unsigned right shift

    logger.debug('Executing SHLO_R_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

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
 * SHAR_R_32 instruction (opcode 0x7C)
 * Gray Paper formula: reg'_D = unsigned{floor(signed_4(reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHAR_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_32
  readonly name = 'SHAR_R_32'
  readonly description = 'Shift right arithmetic (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n

    // Convert to signed for arithmetic shift
    const signedValue = valueA > 2n ** 31n - 1n ? valueA - 2n ** 32n : valueA
    const shiftedValue = signedValue >> shiftAmount
    const result = shiftedValue < 0n ? shiftedValue + 2n ** 32n : shiftedValue

    logger.debug('Executing SHAR_R_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

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
