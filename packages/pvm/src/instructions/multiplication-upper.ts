import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class MUL_UPPER_S_SInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_UPPER_S_S
  readonly name = 'MUL_UPPER_S_S'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert to signed values
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const signedB = valueB > 2n ** 63n - 1n ? valueB - 2n ** 64n : valueB

    // Perform signed multiplication and get upper 64 bits
    const fullProduct = signedA * signedB
    const upperBits = fullProduct >> 64n

    // Convert back to unsigned representation
    const result = upperBits < 0n ? upperBits + 2n ** 64n : upperBits

    context.log('MUL_UPPER_S_S: Upper bits of signed multiplication', {
      registerD,
      registerA,
      registerB,
      signedA,
      signedB,
      fullProduct,
      upperBits,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

}

export class MUL_UPPER_U_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_UPPER_U_U
  readonly name = 'MUL_UPPER_U_U'
  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Perform unsigned multiplication and get upper 64 bits
    const fullProduct = valueA * valueB
    const result = fullProduct >> 64n

    context.log('MUL_UPPER_U_U: Upper bits of unsigned multiplication', {
      registerD,
      registerA,
      registerB,
      valueA,
      valueB,
      fullProduct,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

}

export class MUL_UPPER_S_UInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_UPPER_S_U
  readonly name = 'MUL_UPPER_S_U'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const valueB = this.getRegisterValue(context.registers, registerB)

    // Convert first operand to signed, keep second as unsigned
    const signedA = valueA > 2n ** 63n - 1n ? valueA - 2n ** 64n : valueA
    const unsignedB = valueB

    // Perform signed-unsigned multiplication and get upper 64 bits
    const fullProduct = signedA * unsignedB
    const upperBits = fullProduct >> 64n

    // Convert back to unsigned representation
    const result = upperBits < 0n ? upperBits + 2n ** 64n : upperBits

    context.log('MUL_UPPER_S_U: Upper bits of signed-unsigned multiplication', {
      registerD,
      registerA,
      registerB,
      signedA,
      unsignedB,
      fullProduct,
      upperBits,
      result,
    })
    this.setRegisterValue(context.registers, registerD, result)

    // Mutate context directly
    

    return { resultCode: null }
  }
}
