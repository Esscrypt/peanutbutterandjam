/**
 * Arithmetic Instructions
 *
 * ADD_IMM and MUL_IMM variants - Add/Multiply with immediate values
 */

import { OPCODE_ADD_IMM_32, OPCODE_ADD_IMM_64, OPCODE_MUL_IMM_32, OPCODE_MUL_IMM_64 } from '../config'
import { InstructionContext, InstructionResult } from '../types'
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
  opcode: i32 = OPCODE_ADD_IMM_32
  name: string = 'ADD_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: reg'_A = sext{4}{(\reg_B + \immed_X) \bmod 2^{32}}
    const addition = (registerValue + immediateX) & i64(0xffffffff) // mod 2^32
    const result = addition // setRegisterValueWith32BitResult will sign-extend

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_MUL_IMM_32
  name: string = 'MUL_IMM_32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerValue = this.getRegisterValueAs32(context.registers, registerB)

    // Gray Paper: reg'_A = sext{4}((reg_B · immed_X) mod 2^32)
    const multiplication = (registerValue * immediateX) & i64(0xffffffff) // mod 2^32
    const result = multiplication // setRegisterValueWith32BitResult will sign-extend

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_ADD_IMM_64
  name: string = 'ADD_IMM_64'

  execute(context: InstructionContext): InstructionResult {

    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const registerB: u8 = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerValue = this.getRegisterValueAs64(context.registers, registerB)

    const addition = registerValue + immediateX
    const result = addition & i64(0xffffffffffffffff) // mod 2^64

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_MUL_IMM_64
  name: string = 'MUL_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(context.operands, context.fskip)
    const registerD: u8 = parseResult.registerA // registerA is the destination
    const registerB: u8 = parseResult.registerB // registerB is the source
    const immediateX = parseResult.immediateX

    const registerValue = this.getRegisterValueAs64(context.registers, registerB)
    const result = registerValue * immediateX

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
