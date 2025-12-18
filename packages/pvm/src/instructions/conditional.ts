import type { InstructionContext, InstructionResult } from '@pbnjam/types'
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

    context.log('Executing CMOV_IZ_IMM instruction', {
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

    context.log('Executing CMOV_NZ_IMM instruction', {
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
}
