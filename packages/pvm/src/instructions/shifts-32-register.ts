import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

/**
 * SHLO_L_32 instruction (opcode 0x7A)
 * Gray Paper formula: reg'_D = sext{4}{(reg_A · 2^(reg_B mod 32)) mod 2^32}
 */
export class SHLO_L_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_32
  readonly name = 'SHLO_L_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n
    const result = valueA << shiftAmount

    context.log('SHLO_L_32: Shift left (32-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * SHLO_R_32 instruction (opcode 0x7B)
 * Gray Paper formula: reg'_D = sext{4}{floor((reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHLO_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_32
  readonly name = 'SHLO_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n
    const result = valueA >> shiftAmount // Unsigned right shift

    context.log('SHLO_R_32: Shift right logical (32-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * SHAR_R_32 instruction (opcode 0x7C)
 * Gray Paper formula: reg'_D = unsigned{floor(signed_4(reg_A mod 2^32) ÷ 2^(reg_B mod 32))}
 */
export class SHAR_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_32
  readonly name = 'SHAR_R_32'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValueAs32(context.registers, registerA)
    const valueB = this.getRegisterValueAs32(context.registers, registerB)
    const shiftAmount = valueB % 32n

    // Convert to signed for arithmetic shift
    const signedValue = valueA > 2n ** 31n - 1n ? valueA - 2n ** 32n : valueA
    const shiftedValue = signedValue >> shiftAmount
    const result = shiftedValue < 0n ? shiftedValue + 2n ** 32n : shiftedValue

    context.log('SHAR_R_32: Shift right arithmetic (32-bit)', {
      registerD,
      registerA,
      registerB,
      valueA,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })
    this.setRegisterValueWith32BitResult(context.registers, registerD, result)

    // Mutate context directly

    return { resultCode: null }
  }
}
