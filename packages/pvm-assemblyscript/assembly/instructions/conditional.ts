import { OPCODE_CMOV_IZ_IMM, OPCODE_CMOV_NZ_IMM } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class CMOV_IZ_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_CMOV_IZ_IMM
  name: string = 'CMOV_IZ_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_A = { immed_X when reg_B = 0, reg_A otherwise }
    const result =
      registerBValue === i64(0)
        ? immediateX
        : this.getRegisterValue(context.registers, registerA)

    this.setRegisterValue(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}

export class CMOV_NZ_IMMInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_CMOV_NZ_IMM
  name: string = 'CMOV_NZ_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_A = { immed_X when reg_B ≠ 0, reg_A otherwise }
    const result =
      registerBValue !== i64(0)
        ? immediateX
        : this.getRegisterValue(context.registers, registerA)

    this.setRegisterValue(context.registers, registerA, result)

    return new InstructionResult(-1)
  }
}
