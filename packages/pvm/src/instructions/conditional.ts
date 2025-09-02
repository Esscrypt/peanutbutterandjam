import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class CMOV_IZ_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_IZ_IMM
  readonly name = 'CMOV_IZ_IMM'
  readonly description = 'Conditional move if zero with immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // If registerA is zero, move immediate to registerD, otherwise keep registerD unchanged
    const result =
      registerValue === 0n
        ? immediate
        : this.getRegisterValue(context.registers, registerD)

    logger.debug('Executing CMOV_IZ_IMM instruction', {
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
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class CMOV_NZ_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_NZ_IMM
  readonly name = 'CMOV_NZ_IMM'
  readonly description = 'Conditional move if not zero with immediate'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // If registerA is not zero, move immediate to registerD, otherwise keep registerD unchanged
    const result =
      registerValue !== 0n
        ? immediate
        : this.getRegisterValue(context.registers, registerD)

    logger.debug('Executing CMOV_NZ_IMM instruction', {
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
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
