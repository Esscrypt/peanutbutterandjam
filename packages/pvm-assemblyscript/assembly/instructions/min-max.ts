import {
  OPCODE_MAX,
  OPCODE_MAX_U,
  OPCODE_MIN,
  OPCODE_MIN_U,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class MINInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MIN
  name: string = 'MIN'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = i64(signedA) < i64(signedB) ? valueA : valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MIN_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MIN_U
  name: string = 'MIN_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA < valueB ? valueA : valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MAXInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MAX
  name: string = 'MAX'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = i64(signedA) > i64(signedB) ? valueA : valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

export class MAX_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_MAX_U
  name: string = 'MAX_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA > valueB ? valueA : valueB

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
