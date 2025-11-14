import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SET_LT_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_U
  readonly name = 'SET_LT_U'
  readonly description = 'Set if less than (unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA < valueB ? 1n : 0n

    context.log('Executing SET_LT_U instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

export class SET_LT_SInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SET_LT_S
  readonly name = 'SET_LT_S'
  readonly description = 'Set if less than (signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Use signedCompare helper for proper signed comparison
    const result = this.signedCompare(valueA, valueB) < 0 ? 1n : 0n

    context.log('Executing SET_LT_S instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}
