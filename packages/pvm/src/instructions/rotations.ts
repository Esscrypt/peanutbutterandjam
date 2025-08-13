import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class ROT_R_64_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64_IMM
  readonly name = 'ROT_R_64_IMM'
  readonly description = 'Rotate right by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Ensure rotation amount is within 64-bit range
    const rotationAmount = Number(immediate % 64n)
    const result = this.rotateRight64(registerValue, rotationAmount)

    logger.debug('Executing ROT_R_64_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      rotationAmount,
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

  private rotateRight64(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 64 + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 64n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(64 - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_64_IMM_ALTInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64_IMM_ALT
  readonly name = 'ROT_R_64_IMM_ALT'
  readonly description = 'Alternative rotate right by immediate (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)

    // Alternative rotation implementation (same as regular for now)
    const rotationAmount = Number(immediate % 64n)
    const result = this.rotateRight64(registerValue, rotationAmount)

    logger.debug('Executing ROT_R_64_IMM_ALT instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      rotationAmount,
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

  private rotateRight64(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 64n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(64 - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_32_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_32_IMM
  readonly name = 'ROT_R_32_IMM'
  readonly description = 'Rotate right by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Ensure rotation amount is within 32-bit range
    const rotationAmount = Number(immediate % 32n)
    const result = this.rotateRight32(registerValue, rotationAmount)

    logger.debug('Executing ROT_R_32_IMM instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      rotationAmount,
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

  private rotateRight32(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-31 range
    amount = amount % 32

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 32n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(32 - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}

export class ROT_R_32_IMM_ALTInstruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_32_IMM_ALT
  readonly name = 'ROT_R_32_IMM_ALT'
  readonly description = 'Alternative rotate right by immediate (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Alternative rotation implementation (same as regular for now)
    const rotationAmount = Number(immediate % 32n)
    const result = this.rotateRight32(registerValue, rotationAmount)

    logger.debug('Executing ROT_R_32_IMM_ALT instruction', {
      registerD,
      registerA,
      immediate,
      registerValue,
      rotationAmount,
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

  private rotateRight32(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-31 range
    amount = amount % 32

    if (amount === 0) return value

    // Perform right rotation
    const mask = (1n << 32n) - 1n
    const rightPart = value >> BigInt(amount)
    const leftPart = (value << BigInt(32 - amount)) & mask
    return (rightPart | leftPart) & mask
  }
}
