import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_ALT_32
  readonly name = 'SHLO_L_IMM_ALT_32'
  readonly description = 'Alternative logical left shift by immediate (32-bit)'
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

    logger.debug('Executing SHLO_L_IMM_ALT_32 instruction', {
      registerA,
      registerB,
      immediate: immediateX.toString(),
      shiftAmount,
      immediate32,
      shifted,
      result: result.toString(),
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHLO_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_ALT_32
  readonly name = 'SHLO_R_IMM_ALT_32'
  readonly description = 'Alternative logical right shift by immediate (32-bit)'
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

    logger.debug('Executing SHLO_R_IMM_ALT_32 instruction', {
      registerA,
      registerB,
      immediate: immediateX.toString(),
      shiftAmount,
      immediate32,
      shifted,
      result: result.toString(),
    })

    this.setRegisterValueWith32BitResult(context.registers, registerA, result)

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHAR_R_IMM_ALT_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_ALT_32
  readonly name = 'SHAR_R_IMM_ALT_32'
  readonly description =
    'Alternative arithmetic right shift by immediate (32-bit)'
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

    logger.debug('Executing SHAR_R_IMM_ALT_32 instruction', {
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

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
