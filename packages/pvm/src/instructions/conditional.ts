import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class CMOV_IZ_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_IZ_IMM
  readonly name = 'CMOV_IZ_IMM'
  readonly description = 'Conditional move if zero with immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_A = { immed_X when reg_B = 0, reg_A otherwise }
    const result =
      registerBValue === 0n
        ? immediate
        : this.getRegisterValue(context.registers, registerA)

    logger.debug('Executing CMOV_IZ_IMM instruction', {
      registerA,
      registerB,
      immediate,
      registerBValue,
      result,
    })
    this.setRegisterValue(context.registers, registerA, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} r${registerB} ${immediate}`
  }
}

export class CMOV_NZ_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.CMOV_NZ_IMM
  readonly name = 'CMOV_NZ_IMM'
  readonly description = 'Conditional move if not zero with immediate'
  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_A = { immed_X when reg_B ≠ 0, reg_A otherwise }
    const result =
      registerBValue !== 0n
        ? immediate
        : this.getRegisterValue(context.registers, registerA)

    logger.debug('Executing CMOV_NZ_IMM instruction', {
      registerA,
      registerB,
      immediate,
      registerBValue,
      result,
    })
    this.setRegisterValue(context.registers, registerA, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
