import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_64
  readonly name = 'SHLO_L_IMM_64'
  readonly description = 'Logical left shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Ensure shift amount is within 64-bit range
    const shiftAmount = Number(immediate % 64n)
    const result = registerValue << BigInt(shiftAmount)

    logger.debug('Executing SHLO_L_IMM_64 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHLO_R_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_64
  readonly name = 'SHLO_R_IMM_64'
  readonly description = 'Logical right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Ensure shift amount is within 64-bit range
    const shiftAmount = Number(immediate % 64n)
    const result = registerValue >> BigInt(shiftAmount)

    logger.debug('Executing SHLO_R_IMM_64 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      shiftAmount,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHAR_R_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_64
  readonly name = 'SHAR_R_IMM_64'
  readonly description = 'Arithmetic right shift by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned64(registerValue)
    const shiftAmount = Number(immediate % 64n)
    const shiftedValue = signedValue >> BigInt(shiftAmount)
    const result = this.toUnsigned64(shiftedValue)

    logger.debug('Executing SHAR_R_IMM_64 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      signedValue,
      shiftAmount,
      shiftedValue,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
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

export class NEG_ADD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.NEG_ADD_IMM_64
  readonly name = 'NEG_ADD_IMM_64'
  readonly description = 'Negate and add immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Negate the register value and add immediate
    const negatedValue = -registerValue
    const result = negatedValue + immediate

    logger.debug('Executing NEG_ADD_IMM_64 instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      negatedValue,
      result,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, result)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    if (operands.length !== 3) {
      return false
    }
    return true
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
