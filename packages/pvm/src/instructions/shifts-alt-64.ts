import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_ALT_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_ALT_64
  readonly name = 'SHLO_L_IMM_ALT_64'
  readonly description = 'Alternative logical left shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = (immed_X · 2^(reg_B mod 64)) mod 2^64
    // ALT: immediate << register (not register << immediate!)
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const shiftAmount = registerBValue % 64n

    // ALT: shift the immediate value by the register amount
    const result = immediateX << shiftAmount

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    console.log('Executing SHLO_L_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      shiftAmount,
      result,
    })

    return { resultCode: null }
  }
}

export class SHLO_R_IMM_ALT_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_ALT_64
  readonly name = 'SHLO_R_IMM_ALT_64'
  readonly description = 'Alternative logical right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = floor(immed_X / 2^(reg_B mod 64))
    // ALT: immediate >> register (not register >> immediate!)
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const shiftAmount = registerBValue % 64n

    // ALT: shift the immediate value by the register amount (unsigned)
    const result = immediateX >> shiftAmount

    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    console.log('Executing SHLO_R_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      shiftAmount,
      result,
      registers: context.registers,
    })

    return { resultCode: null }
  }
}

export class SHAR_R_IMM_ALT_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_ALT_64
  readonly name = 'SHAR_R_IMM_ALT_64'
  readonly description =
    'Alternative arithmetic right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = unsigned{floor(signed_64(immed_X) / 2^(reg_B mod 64))}
    // ALT: immediate >> register (not register >> immediate!) with arithmetic shift
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const shiftAmount = registerBValue % 64n

    // ALT: arithmetic shift the immediate value by the register amount
    const signedImmediate = this.toSigned64(immediateX)
    const shiftedValue = signedImmediate >> BigInt(shiftAmount)
    const result = this.toUnsigned64(shiftedValue)

    logger.debug('Executing SHAR_R_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediateX,
      registerBValue,
      signedImmediate,
      shiftAmount,
      shiftedValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    return { resultCode: null }
  }
}
