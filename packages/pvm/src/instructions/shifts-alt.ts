import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_ALT_32
  readonly name = 'SHLO_L_IMM_ALT_32'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = sext{4}{(immed_X · 2^(reg_B mod 32)) mod 2^32}
    // ALT: immediate << register (not register << immediate!)
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const shiftAmount =
      this.getRegisterValueAs32(context.registers, registerB) % 32n

    // Gray Paper: (immed_X · 2^(reg_B mod 32)) mod 2^32
    // Convert immediate to 32-bit unsigned, perform left shift, then mask to 32 bits
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit unsigned
    const shifted = immediate32 << shiftAmount // Left shift and mask to 32 bits
    const result = shifted // Convert back to bigint for sign extension

    context.log('SHLO_L_IMM_ALT_32: Alternative logical left shift of immediate by register (32-bit) and storing in registerA', {
      registerA,
      registerB,
      immediate: immediateX.toString(),
      shiftAmount,
      immediate32,
      shifted,
      result: result.toString(),
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    

    return { resultCode: null }
  }
}

export class SHLO_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_ALT_32
  readonly name = 'SHLO_R_IMM_ALT_32'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = sext{4}{floor((immed_X mod 2^32) / 2^(reg_B mod 32))}
    // ALT: immediate >> register (not register >> immediate!)
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const shiftAmount =
      this.getRegisterValueAs32(context.registers, registerB) % 32n

    // Gray Paper: floor((immed_X mod 2^32) / 2^(reg_B mod 32))
    // Convert immediate to 32-bit unsigned, perform right shift
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit unsigned
    const shifted = immediate32 >> shiftAmount // Unsigned right shift
    const result = shifted & 0xffffffffn // Mask to 32 bits

    context.log('SHLO_R_IMM_ALT_32: Alternative logical right shift of immediate by register (32-bit) and storing in registerA', {
      registerA,
      registerB,
      immediate: immediateX.toString(),
      shiftAmount,
      immediate32,
      shifted,
      result: result.toString(),
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    

    return { resultCode: null }
  }
}

export class SHAR_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_ALT_32
  readonly name = 'SHAR_R_IMM_ALT_32'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = unsigned{floor(signed_32(immed_X mod 2^32) / 2^(reg_B mod 32))}
    // ALT: immediate >> register (not register >> immediate!) with arithmetic shift
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const shiftAmount =
      this.getRegisterValueAs32(context.registers, registerB) % 32n

    // Gray Paper: unsigned{floor(signed_32(immed_X mod 2^32) / 2^(reg_B mod 32))}
    // Convert immediate to 32-bit signed, perform arithmetic right shift, then convert back to unsigned
    const immediate32 = immediateX & 0xffffffffn // Convert to 32-bit unsigned
    const signed32 = this.signExtend(immediate32, 4) // Convert to signed 32-bit
    const shifted = signed32 >> shiftAmount // Arithmetic right shift, then mask to unsigned 32-bit
    const result = BigInt(shifted) // Convert back to bigint for sign extension

    context.log('SHAR_R_IMM_ALT_32: Alternative arithmetic right shift of immediate by register (32-bit) and storing in registerA', {
      registerA,
      registerB,
      immediate: immediateX.toString(),
      shiftAmount,
      immediate32,
      signed32,
      shifted,
      result: result.toString(),
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    

    return { resultCode: null }
  }
}
