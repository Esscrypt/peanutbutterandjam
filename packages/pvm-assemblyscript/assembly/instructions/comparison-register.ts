import { OPCODE_SET_LT_S, OPCODE_SET_LT_U } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class SET_LT_UInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_LT_U
  name: string = 'SET_LT_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA < valueB ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return this.name + ' r' + registerD.toString() + ' r' + registerA.toString() + ' r' + registerB.toString()
  }
}

export class SET_LT_SInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_SET_LT_S
  name: string = 'SET_LT_S'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Use signedCompare helper for proper signed comparison
    const result = this.signedCompare(valueA, valueB) < 0 ? i64(1) : i64(0)

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return this.name + ' r' + registerD.toString() + ' r' + registerA.toString() + ' r' + registerB.toString()
  }
}
