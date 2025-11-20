import {
  OPCODE_SHAR_R_32,
  OPCODE_SHLO_L_32,
  OPCODE_SHLO_R_32,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * SHLO_L_32 instruction (opcode 0x7A)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A · 2^(reg_B mod 32)) mod 2^32}
 */
export class SHLO_L_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_32
  name: string = 'SHLO_L_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % u64(32)
    const result = valueA << shiftAmount

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHLO_R_32 instruction (opcode 0x7B)
 * Gray Paper formula: reg'_D = sext{4}{floor((reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHLO_R_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_32
  name: string = 'SHLO_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % u64(32)
    const result = valueA >> shiftAmount // Unsigned right shift

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHAR_R_32 instruction (opcode 0x7C)
 * Gray Paper formula: reg'_D = unsigned{floor(signed_4(reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHAR_R_32Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_32
  name: string = 'SHAR_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % u64(32)

    // Convert to signed for arithmetic shift
    // If valueA > 2^31 - 1, it's negative in signed 32-bit representation
    const signedValue = valueA > u64(0x7fffffff) ? i64(valueA) - i64(0x100000000) : i64(valueA)
    const shiftedValue = signedValue >> i64(shiftAmount)
    const result = shiftedValue < i64(0) ? u64(shiftedValue + i64(0x100000000)) : u64(shiftedValue)

    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
