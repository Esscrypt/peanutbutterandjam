/**
 * Register Operations Instructions
 *
 * MOVE_REG, SBRK, and bit manipulation instructions
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * MOVE_REG instruction (opcode 0x100)
 * Move register value as specified in Gray Paper
 */
export class MOVE_REGInstruction extends BaseInstruction {
  readonly opcode = OPCODES.MOVE_REG
  readonly name = 'MOVE_REG'
  readonly description = 'Move register value'

  execute(context: InstructionContext): InstructionResult {
    // For MOVE_REG: operands[0] = destination, operands[1] = source
    const registerD = this.getRegisterIndex(context.instruction.operands[0])
    const registerA = this.getRegisterIndex(context.instruction.operands[1])
    const value = this.getRegisterValue(context.registers, registerA)

    logger.debug('Executing MOVE_REG instruction', {
      registerD,
      registerA,
      value,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, value)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterIndex(operands[0])
    const registerA = this.getRegisterIndex(operands[1])
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * SBRK instruction (opcode 0x101)
 * Allocate memory as specified in Gray Paper
 */
export class SBRKInstruction extends BaseInstruction {
  readonly opcode = OPCODES.SBRK
  readonly name = 'SBRK'
  readonly description = 'Allocate memory'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const size = this.getRegisterValue(context.registers, registerA)

    logger.debug('Executing SBRK instruction', { registerD, registerA, size })

    // TODO: Implement memory allocation
    // This is a placeholder - actual implementation would need memory management
    const allocatedAddress = 0n // Placeholder

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, allocatedAddress)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * COUNT_SET_BITS_64 instruction (opcode 0x102)
 * Count set bits in 64-bit register as specified in Gray Paper
 */
export class COUNT_SET_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.COUNT_SET_BITS_64
  readonly name = 'COUNT_SET_BITS_64'
  readonly description = 'Count set bits in 64-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value = this.getRegisterValue(context.registers, registerA)

    // Count set bits using bit manipulation
    let count = 0n
    let temp = value
    while (temp !== 0n) {
      count += temp & 1n
      temp >>= 1n
    }

    logger.debug('Executing COUNT_SET_BITS_64 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * COUNT_SET_BITS_32 instruction (opcode 0x103)
 * Count set bits in 32-bit register as specified in Gray Paper
 */
export class COUNT_SET_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.COUNT_SET_BITS_32
  readonly name = 'COUNT_SET_BITS_32'
  readonly description = 'Count set bits in 32-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count set bits using bit manipulation
    let count = 0n
    let temp = value
    while (temp !== 0n) {
      count += temp & 1n
      temp >>= 1n
    }

    logger.debug('Executing COUNT_SET_BITS_32 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * LEADING_ZERO_BITS_64 instruction (opcode 0x104)
 * Count leading zero bits in 64-bit register as specified in Gray Paper
 */
export class LEADING_ZERO_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LEADING_ZERO_BITS_64
  readonly name = 'LEADING_ZERO_BITS_64'
  readonly description = 'Count leading zero bits in 64-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value = this.getRegisterValue(context.registers, registerA)

    // Count leading zeros
    let count = 0n
    const temp = value
    for (let i = 63; i >= 0; i--) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    logger.debug('Executing LEADING_ZERO_BITS_64 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * LEADING_ZERO_BITS_32 instruction (opcode 0x105)
 * Count leading zero bits in 32-bit register as specified in Gray Paper
 */
export class LEADING_ZERO_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LEADING_ZERO_BITS_32
  readonly name = 'LEADING_ZERO_BITS_32'
  readonly description = 'Count leading zero bits in 32-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count leading zeros
    let count = 0n
    const temp = value
    for (let i = 31; i >= 0; i--) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    logger.debug('Executing LEADING_ZERO_BITS_32 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * TRAILING_ZERO_BITS_64 instruction (opcode 0x106)
 * Count trailing zero bits in 64-bit register as specified in Gray Paper
 */
export class TRAILING_ZERO_BITS_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAILING_ZERO_BITS_64
  readonly name = 'TRAILING_ZERO_BITS_64'
  readonly description = 'Count trailing zero bits in 64-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value = this.getRegisterValue(context.registers, registerA)

    // Count trailing zeros
    let count = 0n
    const temp = value
    for (let i = 0; i < 64; i++) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    logger.debug('Executing TRAILING_ZERO_BITS_64 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * TRAILING_ZERO_BITS_32 instruction (opcode 0x107)
 * Count trailing zero bits in 32-bit register as specified in Gray Paper
 */
export class TRAILING_ZERO_BITS_32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.TRAILING_ZERO_BITS_32
  readonly name = 'TRAILING_ZERO_BITS_32'
  readonly description = 'Count trailing zero bits in 32-bit register'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    // Count trailing zeros
    let count = 0n
    const temp = value
    for (let i = 0; i < 32; i++) {
      if ((temp & (1n << BigInt(i))) === 0n) {
        count++
      } else {
        break
      }
    }

    logger.debug('Executing TRAILING_ZERO_BITS_32 instruction', {
      registerD,
      registerA,
      value,
      count,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, count)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * SIGN_EXTEND_8 instruction (opcode 0x108)
 * Sign extend 8-bit value as specified in Gray Paper
 */
export class SIGN_EXTEND_8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SIGN_EXTEND_8
  readonly name = 'SIGN_EXTEND_8'
  readonly description = 'Sign extend 8-bit value'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value = this.getRegisterValue(context.registers, registerA) % 2n ** 8n

    // Sign extend 8-bit to 64-bit
    const signBit = value & (1n << 7n)
    const extendedValue = signBit ? value | ~((1n << 8n) - 1n) : value

    logger.debug('Executing SIGN_EXTEND_8 instruction', {
      registerD,
      registerA,
      value,
      extendedValue,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, extendedValue)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * SIGN_EXTEND_16 instruction (opcode 0x109)
 * Sign extend 16-bit value as specified in Gray Paper
 */
export class SIGN_EXTEND_16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.SIGN_EXTEND_16
  readonly name = 'SIGN_EXTEND_16'
  readonly description = 'Sign extend 16-bit value'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 16n

    // Sign extend 16-bit to 64-bit
    const signBit = value & (1n << 15n)
    const extendedValue = signBit ? value | ~((1n << 16n) - 1n) : value

    logger.debug('Executing SIGN_EXTEND_16 instruction', {
      registerD,
      registerA,
      value,
      extendedValue,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, extendedValue)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * ZERO_EXTEND_16 instruction (opcode 0x10A)
 * Zero extend 16-bit value as specified in Gray Paper
 */
export class ZERO_EXTEND_16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.ZERO_EXTEND_16
  readonly name = 'ZERO_EXTEND_16'
  readonly description = 'Zero extend 16-bit value'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 16n

    // Zero extend 16-bit to 64-bit (no change needed since we're already using BigInt)

    logger.debug('Executing ZERO_EXTEND_16 instruction', {
      registerD,
      registerA,
      value,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, value)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}

/**
 * REVERSE_BYTES instruction (opcode 0x10B)
 * Reverse byte order as specified in Gray Paper
 */
export class REVERSE_BYTESInstruction extends BaseInstruction {
  readonly opcode = OPCODES.REVERSE_Uint8Array
  readonly name = 'REVERSE_BYTES'
  readonly description = 'Reverse byte order'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const value = this.getRegisterValue(context.registers, registerA)

    // Reverse byte order (8 bytes)
    let reversed = 0n
    for (let i = 0; i < 8; i++) {
      const byte = (value >> BigInt(i * 8)) & 0xffn
      reversed |= byte << BigInt((7 - i) * 8)
    }

    logger.debug('Executing REVERSE_BYTES instruction', {
      registerD,
      registerA,
      value,
      reversed,
    })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, reversed)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two registers
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    return `${this.name} r${registerD} r${registerA}`
  }
}
