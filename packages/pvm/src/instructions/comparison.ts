import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SET_LT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_U_IMM
  readonly name = 'SET_LT_U_IMM'
  readonly description = 'Set if less than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue < immediate ? 1n : 0n

    logger.debug('Executing SET_LT_U_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
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

export class SET_LT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_S_IMM
  readonly name = 'SET_LT_S_IMM'
  readonly description = 'Set if less than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Convert to signed comparison
    const signedRegisterValue = this.toSigned64(registerValue)
    const signedImmediate = this.toSigned64(immediate)
    const result = signedRegisterValue < signedImmediate ? 1n : 0n

    logger.debug('Executing SET_LT_S_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      signedRegisterValue,
      signedImmediate,
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

  private toSigned64(value: bigint): bigint {
    // Convert 64-bit unsigned to signed
    if (value >= 2n ** 63n) {
      return value - 2n ** 64n
    }
    return value
  }
}

export class SET_GT_U_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_U_IMM
  readonly name = 'SET_GT_U_IMM'
  readonly description = 'Set if greater than immediate (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue > immediate ? 1n : 0n

    logger.debug('Executing SET_GT_U_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
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

export class SET_GT_S_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_GT_S_IMM
  readonly name = 'SET_GT_S_IMM'
  readonly description = 'Set if greater than immediate (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Convert to signed comparison
    const signedRegisterValue = this.toSigned64(registerValue)
    const signedImmediate = this.toSigned64(immediate)
    const result = signedRegisterValue > signedImmediate ? 1n : 0n

    logger.debug('Executing SET_GT_S_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      signedRegisterValue,
      signedImmediate,
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

  private toSigned64(value: bigint): bigint {
    // Convert 64-bit unsigned to signed
    if (value >= 2n ** 63n) {
      return value - 2n ** 64n
    }
    return value
  }
}
