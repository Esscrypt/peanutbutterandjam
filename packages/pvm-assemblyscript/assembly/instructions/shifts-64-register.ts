import {
  OPCODE_SHAR_R_64,
  OPCODE_SHLO_L_64,
  OPCODE_SHLO_R_64,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * SHLO_L_64 instruction (opcode 0xCF)
 * Gray Paper formula: reg'_D = (reg_A · 2^(reg_B mod 64)) mod 2^64
 */
export class SHLO_L_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_L_64
  name: string = 'SHLO_L_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % u64(64)
    const result = valueA << shiftAmount

    this.setRegisterValue(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHLO_R_64 instruction (opcode 0xD0)
 * Gray Paper formula: reg'_D = floor(reg_A ÷ 2^(reg_B mod 64))
 */
export class SHLO_R_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHLO_R_64
  name: string = 'SHLO_R_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % u64(64)
    const result = valueA >> shiftAmount

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}

/**
 * SHAR_R_64 instruction (opcode 0xD1)
 * Gray Paper formula: reg'_D = unsigned{floor(signed(reg_A) ÷ 2^(reg_B mod 64))}
 */
export class SHAR_R_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_SHAR_R_64
  name: string = 'SHAR_R_64'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.operands)
    const registerA = this.getRegisterA(context.operands)
    const registerB = this.getRegisterB(context.operands)
    const valueA = this.getRegisterValueAs64(context.registers, registerA)
    const valueB = this.getRegisterValueAs64(context.registers, registerB)
    const shiftAmount = valueB % u64(64)

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(valueA)
    const shiftedValue = signedValue >> i64(shiftAmount)
    const result = u64(this.toUnsigned64(shiftedValue))

    this.setRegisterValueWith64BitResult(context.registers, registerD, result)

    return new InstructionResult(-1)
  }
}
