import { OPCODE_CMOV_IZ, OPCODE_CMOV_NZ } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class CMOV_IZInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_CMOV_IZ
  name: string = 'CMOV_IZ'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = { reg_A when reg_B = 0, reg_D otherwise }
    const result =
      valueB === i64(0)
        ? this.getRegisterValue(context.registers, registerA)
        : this.getRegisterValue(context.registers, registerD)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return this.name + ' r' + registerD.toString() + ' r' + registerA.toString() + ' r' + registerB.toString()
  }
}

export class CMOV_NZInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_CMOV_NZ
  name: string = 'CMOV_NZ'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Gray Paper: reg'_D = { reg_A when reg_B ≠ 0, reg_D otherwise }
    const result =
      valueB !== i64(0)
        ? this.getRegisterValue(context.registers, registerA)
        : this.getRegisterValue(context.registers, registerD)

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return this.name + ' r' + registerD.toString() + ' r' + registerA.toString() + ' r' + registerB.toString()
  }
}
