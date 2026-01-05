/**
 * Arithmetic Instructions
 *
 * ADD_IMM and MUL_IMM variants - Add/Multiply with immediate values
 */

import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * ADD_IMM_32 instruction (opcode 0x83 / 131)
 * Add immediate to 32-bit register
 *
 * Gray Paper pvm.tex §7.4.9 line 490:
 * reg'_A = sext{4}{(\reg_B + \immed_X) \bmod 2^{32}}
 *
 * Where:
 * - immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}} (line 469)
 * - l_X = min(4, max(0, ℓ - 1)) (line 468)
 * - ℓ = Fskip(ι) (skip distance)
 *
 * Operand format (lines 462-469):
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1:1+l_X]: immed_X (sign-extended)
 */
export class ADD_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_IMM_32
  readonly name = 'ADD_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    const beforeValueB = context.registers[registerB]

    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB,
    )

    // Gray Paper: reg'_A = sext{4}{(\reg_B + \immed_X) \bmod 2^{32}}
    // Add 32-bit reg_B to 64-bit immed_X, then mod 2^32
    // BigInt two's complement arithmetic handles the addition correctly
    const addition = (registerValue + immediateX) & 0xffffffffn // mod 2^32
    const result = addition // Don't sign-extend here, setRegisterValueWith32BitResult will do it

    context.log('ADD_IMM_32: Add immediate to 32-bit register', {
      fskip: context.fskip,
      registerA,
      registerB,
      immediateX: immediateX.toString(),
      beforeValue: beforeValue.toString(),
      beforeValueB: beforeValueB.toString(),
      registerValue: registerValue.toString(),
      addition: addition.toString(),
      result: result.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
      pc: context.pc,
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    // Log AFTER modification to capture the after state
    context.log('ADD_IMM_32: After setting register', {
      registerA,
      registerB,
      immediateX: immediateX.toString(),
      afterValue: context.registers[registerA].toString(),
      result: result.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
      pc: context.pc,
    })

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * MUL_IMM_32 instruction (opcode 0x12F / 135)
 * Multiply 32-bit register by immediate
 *
 * Gray Paper pvm.tex §7.4.9 line 494:
 * reg'_A = sext{4}((reg_B · immed_X) mod 2^32)
 *
 * Operand format (lines 462-469):
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1:1+l_X]: immed_X (sign-extended)
 * Where: l_X = min(4, max(0, ℓ - 1))
 */
export class MUL_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_IMM_32
  readonly name = 'MUL_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1] = immediate
    const registerD = this.getRegisterA(context.instruction.operands) // low nibble = destination
    const registerA = this.getRegisterB(context.instruction.operands) // high nibble = source
    const immediate = this.getImmediateValue(context.instruction.operands, 1) // immediate at index 1
    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerA,
    )
    const immediate32 = immediate & 0xffffffffn // Convert to 32-bit number
    const result = registerValue * immediate32

    this.setRegisterValueWith32BitResult(
      context.registers,
      registerD,
      BigInt(result),
    )

    context.log('MUL_IMM_32: Multiply 32-bit register by immediate', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
      registers: Array.from(context.registers.slice(0, 13)),
    })

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * ADD_IMM_64 instruction (opcode 0x13D / 149)
 * Add immediate to 64-bit register
 *
 * Gray Paper pvm.tex §7.4.9 line 514:
 * reg'_A = (reg_B + immed_X) mod 2^64
 *
 * Operand format (lines 462-469):
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1:1+l_X]: immed_X (sign-extended)
 * Where: l_X = min(4, max(0, ℓ - 1))
 * Note: For 64-bit instructions, immediate is typically 8 bytes
 */
export class ADD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_IMM_64
  readonly name = 'ADD_IMM_64'
  readonly description = 'Add immediate to 64-bit register'

  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1] = immediate
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )

    const addition = registerValue + immediateX
    const result = addition & 0xffffffffffffffffn // mod 2^64

    context.log('ADD_IMM_64: Add immediate to 64-bit register', {
      operands: Array.from(context.instruction.operands),
      registerA,
      registerB,
      registerAValue: context.registers[registerA],
      registerBValue: context.registers[registerB],
      immediateX,
      registerValue,
      signedImmediateX: this.toSigned64(immediateX),
      result,
      addition,
      pc: context.pc,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * MUL_IMM_64 instruction (opcode 0x13E / 150)
 * Multiply 64-bit register by immediate
 *
 * Gray Paper pvm.tex §7.4.9 line 515:
 * reg'_A = (reg_B · immed_X) mod 2^64
 *
 * Operand format (lines 462-469):
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1:1+l_X]: immed_X (sign-extended)
 * Where: l_X = min(4, max(0, ℓ - 1))
 * Note: For 64-bit instructions, immediate is typically 8 bytes
 */
export class MUL_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_IMM_64
  readonly name = 'MUL_IMM_64'
  readonly description = 'Multiply 64-bit register by immediate'

  execute(context: InstructionContext): InstructionResult {
    // Test vector format: operands[0] = (A << 4) | D, operands[1] = immediate
    const registerD = this.getRegisterA(context.instruction.operands) // low nibble = destination
    const registerA = this.getRegisterB(context.instruction.operands) // high nibble = source
    const immediate = this.getImmediateValue(context.instruction.operands, 1) // immediate at index 1
    const registerValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const result = registerValue * immediate

    context.log('MUL_IMM_64: Multiply 64-bit register by immediate', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}
