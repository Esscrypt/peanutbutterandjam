import { OPCODE_AND_INV, OPCODE_OR_INV, OPCODE_XNOR } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class AND_INVInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_AND_INV
  name: string = 'AND_INV'
  
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA & ~valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class OR_INVInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_OR_INV
  name: string = 'OR_INV'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA | ~valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class XNORInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_XNOR
  name: string = 'XNOR'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = ~(valueA ^ valueB)

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
