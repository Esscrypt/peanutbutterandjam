import { OPCODE_AND, OPCODE_OR, OPCODE_XOR } from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

export class ANDInstruction extends BaseInstruction {
  opcode: i32 = OPCODE_AND
  name: string = 'AND'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA & valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)
    return this.name + ' r' + registerD.toString() + ' r' + registerA.toString() + ' r' + registerB.toString()
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
  opcode: i32 = OPCODE_XOR
  name: string = 'XOR'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands) // From operands[1]
    const registerA = this.getRegisterA(context.operands) // From operands[0] low nibble
    const registerB = this.getRegisterB(context.operands) // From operands[0] high nibble
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const result = valueA ^ valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_OR
  name: string = 'OR'

  execute(context: InstructionContext): InstructionResult {
    // Extract operands from code starting at programCounter + 1
    // Format for three-register instructions: operands[0] = (B << 4) | A, operands[1] = D
    const pc = i32(context.programCounter)
    const operands = context.code.slice(pc + 1, pc + 3) // Get operand bytes
    
    // Gray Paper: Three Registers format
    // r_A = min(12, (instructions[ι+1]) mod 16) - from low nibble of operands[0]
    // r_B = min(12, ⌊instructions[ι+1]/16⌋) - from high nibble of operands[0]
    // r_D = min(12, instructions[ι+2]) - from operands[1]
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    
    // Gray Paper: ∀i ∈ Nmax{64} : bits{reg'_D}_i = bits{reg_A}_i ∨ bits{reg_B}_i
    const result = valueA | valueB

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)
    return new InstructionResult(-1)
  }
}
