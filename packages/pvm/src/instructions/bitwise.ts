import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class AND_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.AND_IMM
  readonly name = 'AND_IMM'
  readonly description = 'Bitwise AND with immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue & immediate

    logger.debug('Executing AND_IMM instruction', {
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
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return BigInt(operands.length) >= 3n // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class XOR_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.XOR_IMM
  readonly name = 'XOR_IMM'
  readonly description = 'Bitwise XOR with immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue ^ immediate

    logger.debug('Executing XOR_IMM instruction', {
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
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return BigInt(operands.length) >= 3n // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class OR_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.OR_IMM
  readonly name = 'OR_IMM'
  readonly description = 'Bitwise OR with immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue | immediate

    logger.debug('Executing OR_IMM instruction', {
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
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return BigInt(operands.length) >= 3n // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
