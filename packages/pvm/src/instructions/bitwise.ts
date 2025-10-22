import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class AND_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.AND_IMM
  readonly name = 'AND_IMM'
  readonly description = 'Bitwise AND with immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands)
    const registerA = this.getRegisterB(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue & immediate

    logger.debug('Executing AND_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
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

export class XOR_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.XOR_IMM
  readonly name = 'XOR_IMM'
  readonly description = 'Bitwise XOR with immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands)
    const registerA = this.getRegisterB(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue ^ immediate

    logger.debug('Executing XOR_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
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

export class OR_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.OR_IMM
  readonly name = 'OR_IMM'
  readonly description = 'Bitwise OR with immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterA(context.instruction.operands)
    const registerA = this.getRegisterB(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue | immediate

    logger.debug('Executing OR_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
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
