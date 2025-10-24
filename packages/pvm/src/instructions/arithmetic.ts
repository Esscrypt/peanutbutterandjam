/**
 * Arithmetic Instructions
 *
 * ADD_IMM and MUL_IMM variants - Add/Multiply with immediate values
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * ADD_IMM_32 instruction (opcode 0x83 / 131)
 * Add immediate to 32-bit register
 *
 * Gray Paper pvm.tex §7.4.9 line 490:
 * reg'_A = sext_4((reg_B + immed_X) mod 2^32)
 *
 * Operand format (lines 462-469):
 * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
 * - operands[1:1+l_X]: immed_X (sign-extended)
 * Where: l_X = min(4, max(0, ℓ - 1))
 */
export class ADD_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ADD_IMM_32
  readonly name = 'ADD_IMM_32'
  readonly description = 'Add immediate to 32-bit register'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerValue = this.getRegisterValueAs32(
      context.registers,
      registerB,
    )

    // Gray Paper: reg'_A = sext_4((reg_B + immed_X) mod 2^32)
    const immediateValue = immediateX & 0xffffffffn
    const result = this.signExtend(registerValue + immediateValue, 4)

    logger.debug('Executing ADD_IMM_32 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      result,
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    // Mutate context directly
    

    return { resultCode: null }
  }
}

/**
 * MUL_IMM_32 instruction (opcode 0x12F)
 * Multiply 32-bit register by immediate as specified in Gray Paper
 */
export class MUL_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.MUL_IMM_32
  readonly name = 'MUL_IMM_32'
  readonly description = 'Multiply 32-bit register by immediate'

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

    logger.debug('Executing MUL_IMM_32 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      result,
    })
    this.setRegisterValueWith32BitResult(
      context.registers,
      registerD,
      BigInt(result),
    )

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * ADD_IMM_64 instruction (opcode 0x13D)
 * Add immediate to 64-bit register as specified in Gray Paper
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
    const result = (registerValue + immediateX) & 0xffffffffffffffffn // mod 2^64

    logger.debug('Executing ADD_IMM_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    // Mutate context directly
    

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * MUL_IMM_64 instruction (opcode 0x13E)
 * Multiply 64-bit register by immediate as specified in Gray Paper
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

    logger.debug('Executing MUL_IMM_64 instruction', {
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

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
