import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class AND_INVInstruction extends BaseInstruction {
  readonly opcode = OPCODES.AND_INV
  readonly name = 'AND_INV'
  readonly description = 'Bitwise AND with inverted operand'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA & ~valueB

    context.log('AND_INV: Bitwise AND with inverted operand of registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return { resultCode: null }
  }

}

export class OR_INVInstruction extends BaseInstruction {
  readonly opcode = OPCODES.OR_INV
  readonly name = 'OR_INV'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA | ~valueB

    context.log('OR_INV: Bitwise OR with inverted operand of registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    

    return { resultCode: null }
  }
}

export class XNORInstruction extends BaseInstruction {
  readonly opcode = OPCODES.XNOR
  readonly name = 'XNOR'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = ~(valueA ^ valueB)

    context.log('XNOR: Bitwise XNOR of registerA and registerB to registerD', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return { resultCode: null }
  }
}
