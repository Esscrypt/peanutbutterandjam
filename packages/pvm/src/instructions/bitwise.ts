import type { InstructionContext, InstructionResult } from '@pbnjam/types'
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

    context.log(
      'AND_IMM: Bitwise AND with immediate of registerA and immediate to registerD',
      {
        registerD,
        registerA,
        immediate,
        registerValue,
        result,
      },
    )
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
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

    context.log(
      'XOR_IMM: Bitwise XOR with immediate of registerA and immediate to registerD',
      {
        registerD,
        registerA,
        immediate,
        registerValue,
        result,
      },
    )
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
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

    context.log(
      'OR_IMM: Bitwise OR with immediate of registerA and immediate to registerD',
      {
        registerD,
        registerA,
        immediate,
        registerValue,
        result,
      },
    )
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}
