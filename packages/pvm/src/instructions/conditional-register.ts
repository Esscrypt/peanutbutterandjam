import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class CMOV_IZInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_IZ
  readonly name = 'CMOV_IZ'
  readonly description = 'Conditional move if zero'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = { reg_A when reg_B = 0, reg_D otherwise }
    const result =
      valueB === 0n
        ? this.getRegisterValue(context.registers, registerA)
        : this.getRegisterValue(context.registers, registerD)

    logger.debug('Executing CMOV_IZ instruction', {
      registerD,
      registerA,
      registerB,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class CMOV_NZInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_NZ
  readonly name = 'CMOV_NZ'
  readonly description = 'Conditional move if not zero'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = { reg_A when reg_B ≠ 0, reg_D otherwise }
    const result =
      valueB !== 0n
        ? this.getRegisterValue(context.registers, registerA)
        : this.getRegisterValue(context.registers, registerD)

    logger.debug('Executing CMOV_NZ instruction', {
      registerD,
      registerA,
      registerB,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
