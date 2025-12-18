import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class ANDInstruction extends BaseInstruction {
  readonly opcode = OPCODES.AND
  readonly name = 'AND'
  readonly description = 'Bitwise AND'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA & valueB

    context.log('AND: Bitwise AND of registerA and registerB to registerD', {
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

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }
}

/**
 * XOR instruction (opcode 0xD3 / 211)
 * Bitwise XOR of two registers
 *
 * Gray Paper pvm.tex §7.4.10 line 211:
 * ∀i ∈ Nmax{64} : bits{reg'_D}_i = bits{reg_A}_i ⊕ bits{reg_B}_i
 *
 * Operand format (lines 591-603):
 * - operands[0]: r_D
 * - operands[1]: r_A (low 4 bits) + r_B (high 4 bits)
 */
export class XORInstruction extends BaseInstruction {
  readonly opcode = OPCODES.XOR
  readonly name = 'XOR'
  readonly description = 'Bitwise XOR'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA ^ valueB

    context.log('XOR: Bitwise XOR of registerA and registerB to registerD', {
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

/**
 * OR instruction (opcode 0xD4 / 212)
 * Bitwise OR of two registers
 *
 * Gray Paper pvm.tex §7.4.10 line 212:
 * ∀i ∈ Nmax{64} : bits{reg'_D}_i = bits{reg_A}_i ∨ bits{reg_B}_i
 *
 * Operand format (lines 590-603): "Three Registers" format
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1]: r_D
 */
export class ORInstruction extends BaseInstruction {
  readonly opcode = OPCODES.OR
  readonly name = 'OR'
  readonly description = 'Bitwise OR'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Three Registers format
    // r_A = min(12, (instructions[ι+1]) mod 16) - from low nibble of operands[0]
    // r_B = min(12, ⌊instructions[ι+1]/16⌋) - from high nibble of operands[0]
    // r_D = min(12, instructions[ι+2]) - from operands[1]
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)

    // Gray Paper: ∀i ∈ Nmax{64} : bits{reg'_D}_i = bits{reg_A}_i ∨ bits{reg_B}_i
    const result = valueA | valueB

    context.log('OR: Bitwise OR of registerA and registerB to registerD', {
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
