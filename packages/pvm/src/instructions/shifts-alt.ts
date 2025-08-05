import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_ALT_32
  readonly name = 'SHLO_L_IMM_ALT_32'
  readonly description = 'Alternative logical left shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Alternative shift implementation (same as regular for now)
    const shiftAmount = Number(immediate % 32n)
    const result = (registerValue << BigInt(shiftAmount)) % 2n ** 32n

    logger.debug('Executing SHLO_L_IMM_ALT_32 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHLO_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_ALT_32
  readonly name = 'SHLO_R_IMM_ALT_32'
  readonly description = 'Alternative logical right shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Alternative shift implementation (same as regular for now)
    const shiftAmount = Number(immediate % 32n)
    const result = (registerValue >> BigInt(shiftAmount)) % 2n ** 32n

    logger.debug('Executing SHLO_R_IMM_ALT_32 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHAR_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_ALT_32
  readonly name = 'SHAR_R_IMM_ALT_32'
  readonly description =
    'Alternative arithmetic right shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Alternative arithmetic shift implementation (same as regular for now)
    const signedValue = this.toSigned32(registerValue)
    const shiftAmount = Number(immediate % 32n)
    const shiftedValue = signedValue >> shiftAmount
    const result = this.toUnsigned32(shiftedValue)

    logger.debug('Executing SHAR_R_IMM_ALT_32 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: number[]): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }

  private toSigned32(value: bigint): number {
    if (value >= 2n ** 31n) {
      return Number(value - 2n ** 32n)
    }
    return Number(value)
  }

  private toUnsigned32(value: number): bigint {
    if (value < 0) {
      return BigInt(value + 2 ** 32)
    }
    return BigInt(value) % 2n ** 32n
  }
}
