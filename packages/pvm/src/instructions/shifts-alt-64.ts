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
    const registerA = this.getRegisterA(context.instruction.operands) // low nibble = destination
    const registerB = this.getRegisterB(context.instruction.operands) // high nibble = shift amount source
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const shiftAmount = Number(
      this.getRegisterValueAs64(context.registers, registerB) % 64n,
    )

    // ALT: shift the immediate value by the register amount
    const result = immediate << BigInt(shiftAmount)

    logger.debug('Executing SHLO_L_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediate,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

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

export class SHLO_R_IMM_ALT_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_ALT_64
  readonly name = 'SHLO_R_IMM_ALT_64'
  readonly description = 'Alternative logical right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = floor(immed_X / 2^(reg_B mod 64))
    // ALT: immediate >> register (not register >> immediate!)
    const registerA = this.getRegisterA(context.instruction.operands) // low nibble = destination
    const registerB = this.getRegisterB(context.instruction.operands) // high nibble = shift amount source
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const shiftAmount = Number(
      this.getRegisterValueAs64(context.registers, registerB) % 64n,
    )

    // ALT: shift the immediate value by the register amount (unsigned)
    const result = immediate >> BigInt(shiftAmount)

    logger.debug('Executing SHLO_R_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediate,
      shiftAmount,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

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

export class SHAR_R_IMM_ALT_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_ALT_64
  readonly name = 'SHAR_R_IMM_ALT_64'
  readonly description =
    'Alternative arithmetic right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: reg'_A = unsigned{floor(signed_64(immed_X) / 2^(reg_B mod 64))}
    // ALT: immediate >> register (not register >> immediate!) with arithmetic shift
    const registerA = this.getRegisterA(context.instruction.operands) // low nibble = destination
    const registerB = this.getRegisterB(context.instruction.operands) // high nibble = shift amount source
    const immediate = this.getImmediateValue(context.instruction.operands, 1)
    const shiftAmount = Number(
      this.getRegisterValueAs64(context.registers, registerB) % 64n,
    )

    // ALT: arithmetic shift the immediate value by the register amount
    const signedImmediate = this.toSigned64(immediate)
    const shiftedValue = signedImmediate >> BigInt(shiftAmount)
    const result = this.toUnsigned64(shiftedValue)

    logger.debug('Executing SHAR_R_IMM_ALT_64 instruction', {
      registerA,
      registerB,
      immediate,
      signedImmediate,
      shiftAmount,
      shiftedValue,
      result,
    })
    this.setRegisterValueWith64BitResult(context.registers, registerA, result)

    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }

  private toSigned64(value: bigint): bigint {
    // Convert 64-bit unsigned to signed
    if (value >= 2n ** 63n) {
      return value - 2n ** 64n
    }
    return value
  }

  private toUnsigned64(value: bigint): bigint {
    // Convert signed back to unsigned
    if (value < 0n) {
      return value + 2n ** 64n
    }
    return value
  }
}
