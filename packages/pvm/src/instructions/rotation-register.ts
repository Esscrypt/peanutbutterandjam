import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

export class ROT_L_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_L_64
  readonly name = 'ROT_L_64'
  readonly description = 'Rotate left (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = this.rotateLeft64(valueA, rotationAmount)

    logger.debug('Executing ROT_L_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
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
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }

  private rotateLeft64(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 64 + amount
    }

    // Normalize amount to 0-63 range
    amount = amount % 64

    if (amount === 0) return value

    // Perform left rotation
    const mask = (1n << 64n) - 1n
    const leftPart = (value << BigInt(amount)) & mask
    const rightPart = value >> BigInt(64 - amount)
    return (leftPart | rightPart) & mask
  }
}

export class ROT_L_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_L_32
  readonly name = 'ROT_L_32'
  readonly description = 'Rotate left (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = this.rotateLeft32(valueA, rotationAmount)

    logger.debug('Executing ROT_L_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
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
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
  }

  private rotateLeft32(value: bigint, amount: number): bigint {
    // Handle negative rotation amounts
    if (amount < 0) {
      amount = 32 + amount
    }

    // Normalize amount to 0-31 range
    amount = amount % 32

    if (amount === 0) return value

    // Perform left rotation
    const mask = (1n << 32n) - 1n
    const leftPart = (value << BigInt(amount)) & mask
    const rightPart = value >> BigInt(32 - amount)
    return (leftPart | rightPart) & mask
  }
}

export class ROT_R_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_64
  readonly name = 'ROT_R_64'
  readonly description = 'Rotate right (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA = this.getRegisterValue(context.registers, registerA)
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 64n,
    )
    const result = this.rotateRight64(valueA, rotationAmount)

    logger.debug('Executing ROT_R_64 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
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
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
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

export class ROT_R_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ROT_R_32
  readonly name = 'ROT_R_32'
  readonly description = 'Rotate right (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const registerB = this.getRegisterB(context.instruction.operands)
    const valueA =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n
    const rotationAmount = Number(
      this.getRegisterValue(context.registers, registerB) % 32n,
    )
    const result = this.rotateRight32(valueA, rotationAmount)

    logger.debug('Executing ROT_R_32 instruction', {
      registerD,
      registerA,
      registerB,
      valueA,
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
    const registerB = this.getRegisterB(operands)
    return `${this.name} r${registerD} r${registerA} r${registerB}`
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
