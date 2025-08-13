import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class SHLO_L_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_L_IMM_32
  readonly name = 'SHLO_L_IMM_32'
  readonly description = 'Logical left shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Ensure shift amount is within 32-bit range
    const shiftAmount = Number(immediate % 32n)
    const result = (registerValue << BigInt(shiftAmount)) % 2n ** 32n

    logger.debug('Executing SHLO_L_IMM_32 instruction', {
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
      newInstructionPointer: context.instructionPointer + 1,
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
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHLO_R_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHLO_R_IMM_32
  readonly name = 'SHLO_R_IMM_32'
  readonly description = 'Logical right shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Ensure shift amount is within 32-bit range
    const shiftAmount = Number(immediate % 32n)
    const result = (registerValue >> BigInt(shiftAmount)) % 2n ** 32n

    logger.debug('Executing SHLO_R_IMM_32 instruction', {
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
      newInstructionPointer: context.instructionPointer + 1,
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
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

export class SHAR_R_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SHAR_R_IMM_32
  readonly name = 'SHAR_R_IMM_32'
  readonly description = 'Arithmetic right shift by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Convert to signed for arithmetic shift
    const signedValue = this.toSigned32(registerValue)
    const shiftAmount = Number(immediate % 32n)
    const shiftedValue = signedValue >> shiftAmount
    const result = this.toUnsigned32(shiftedValue)

    logger.debug('Executing SHAR_R_IMM_32 instruction', {
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
      newInstructionPointer: context.instructionPointer + 1,
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
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }

  private toSigned32(value: bigint): number {
    if (value >= 2n ** 31n) {
      return Number(value - 2n ** 32n)
    }
    return Number(value)
  }

  private toUnsigned32(value: number): bigint {
    if (value < 0) {
      return BigInt(value + 2 ** 32)
    }
    return BigInt(value) % 2n ** 32n
  }
}

export class NEG_ADD_IMM_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.NEG_ADD_IMM_32
  readonly name = 'NEG_ADD_IMM_32'
  readonly description = 'Negate and add immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Negate the register value and add immediate
    const negatedValue = -registerValue % 2n ** 32n
    const result = (negatedValue + immediate) % 2n ** 32n

    logger.debug('Executing NEG_ADD_IMM_32 instruction', {
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
      newInstructionPointer: context.instructionPointer + 1,
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
    const immediate = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
