import { logger } from '@pbnj/core'
import { OPCODES, RESULT_CODES } from '../config'
import type { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SET_LT_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_U
  readonly name = 'SET_LT_U'
  readonly description = 'Set if less than (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA < valueB ? 1n : 0n

    logger.debug('Executing SET_LT_U instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
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
    return operands.length >= 3 // Need three registers
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SET_LT_SInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_S
  readonly name = 'SET_LT_S'
  readonly description = 'Set if less than (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const signedB = valueB > 2n ** 63n - 1n ? valueB - 2n ** 64n : valueB

    const result = signedA < signedB ? 1n : 0n

    logger.debug('Executing SET_LT_S instruction', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
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
    return operands.length >= 3 // Need three registers
  }

  disassemble(operands: number[]): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
