/**
 * Arithmetic Instructions
 *
 * ADD_IMM and MUL_IMM variants - Add/Multiply with immediate values
 */

import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * ADD_IMM_32 instruction (opcode 0x12B)
 * Add immediate to 32-bit register as specified in Gray Paper
 */
export class ADD_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_IMM_32
  readonly name = 'ADD_IMM_32'
  readonly description = 'Add immediate to 32-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const result = (registerValue + immediate) % 2n ** 32n

    logger.debug('Executing ADD_IMM_32 instruction', {
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

/**
 * MUL_IMM_32 instruction (opcode 0x12F)
 * Multiply 32-bit register by immediate as specified in Gray Paper
 */
export class MUL_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_IMM_32
  readonly name = 'MUL_IMM_32'
  readonly description = 'Multiply 32-bit register by immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const result = (registerValue * immediate) % 2n ** 32n

    logger.debug('Executing MUL_IMM_32 instruction', {
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

/**
 * ADD_IMM_64 instruction (opcode 0x13D)
 * Add immediate to 64-bit register as specified in Gray Paper
 */
export class ADD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_IMM_64
  readonly name = 'ADD_IMM_64'
  readonly description = 'Add immediate to 64-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue + immediate

    logger.debug('Executing ADD_IMM_64 instruction', {
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

/**
 * MUL_IMM_64 instruction (opcode 0x13E)
 * Multiply 64-bit register by immediate as specified in Gray Paper
 */
export class MUL_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_IMM_64
  readonly name = 'MUL_IMM_64'
  readonly description = 'Multiply 64-bit register by immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const result = registerValue * immediate

    logger.debug('Executing MUL_IMM_64 instruction', {
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
