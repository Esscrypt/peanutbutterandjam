import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class MINInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MIN
  readonly name = 'MIN'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = signedA < signedB ? valueA : valueB

    context.log('MIN: Minimum (signed)', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      signedA,
      signedB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

export class MIN_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MIN_U
  readonly name = 'MIN_U'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA < valueB ? valueA : valueB

    context.log('MIN_U: Minimum (unsigned)', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

export class MAXInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MAX
  readonly name = 'MAX'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values for comparison
    const signedA = this.toSigned64(valueA)
    const signedB = this.toSigned64(valueB)
    const result = signedA > signedB ? valueA : valueB

    context.log('MAX: Maximum (signed)', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      signedA,
      signedB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

export class MAX_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MAX_U
  readonly name = 'MAX_U'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)
    const result = valueA > valueB ? valueA : valueB

    context.log('MAX_U: Maximum (unsigned)', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    return { resultCode: null }
  }
}
