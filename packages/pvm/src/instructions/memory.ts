/**
 * Memory Instructions
 *
 * LOAD_IMM_64, STORE_IMM variants, LOAD/STORE variants
 */

import { bytesToBigInt, logger, numberToBytes } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * LOAD_IMM_64 instruction (opcode 0x20)
 * Load 64-bit immediate into register as specified in Gray Paper
 */
export class LOAD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_64
  readonly name = 'LOAD_IMM_64'
  readonly description = 'Load 64-bit immediate into register'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediate64(context.instruction.operands, 1)

    logger.debug('Executing LOAD_IMM_64 instruction', { registerA, immediate })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerA, immediate)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 9 // Need register + 8-byte immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediate64(operands, 1)
    return `${this.name} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IMM_U8 instruction (opcode 0x30)
 * Store 8-bit immediate to memory as specified in Gray Paper
 */
export class STORE_IMM_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U8
  readonly name = 'STORE_IMM_U8'
  readonly description = 'Store 8-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const immediateX = this.getImmediateValue(context.instruction.operands, 0)
    const immediateY = this.getImmediateValue(context.instruction.operands, 1)
    // const value = Number(immediateY % 2n ** 8n)

    logger.debug('Executing STORE_IMM_U8 instruction', {
      address: immediateX,
      // value,
    })

    context.ram.writeOctets(Number(immediateX), numberToBytes(immediateY))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    // add check that value is less than 256
    const immediateY = this.getImmediateValue(operands, 1)
    if (immediateY >= 256) {
      return false
    }
    return operands.length >= 2 // Need two immediates
  }

  disassemble(operands: Uint8Array): string {
    const immediateX = this.getImmediateValue(operands, 0)
    const immediateY = this.getImmediateValue(operands, 1)
    return `${this.name} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_U16 instruction (opcode 0x31)
 * Store 16-bit immediate to memory as specified in Gray Paper
 */
export class STORE_IMM_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U16
  readonly name = 'STORE_IMM_U16'
  readonly description = 'Store 16-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const immediateX = this.getImmediateValue(context.instruction.operands, 0)
    const immediateY = this.getImmediateValue(context.instruction.operands, 1)
    // const value = Number(immediateY % 2n ** 16n)

    logger.debug('Executing STORE_IMM_U16 instruction', {
      address: immediateX,
      // value,
    })

    context.ram.writeOctets(Number(immediateX), numberToBytes(immediateY))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need two immediates
  }

  disassemble(operands: Uint8Array): string {
    const immediateX = this.getImmediateValue(operands, 0)
    const immediateY = this.getImmediateValue(operands, 1)
    return `${this.name} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_U32 instruction (opcode 0x32)
 * Store 32-bit immediate to memory as specified in Gray Paper
 */
export class STORE_IMM_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U32
  readonly name = 'STORE_IMM_U32'
  readonly description = 'Store 32-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const immediateX = this.getImmediateValue(context.instruction.operands, 0)
    const immediateY = this.getImmediateValue(context.instruction.operands, 1)
    // const value = Number(immediateY % 2n ** 32n)

    logger.debug('Executing STORE_IMM_U32 instruction', {
      address: immediateX,
      // value,
    })

    context.ram.writeOctets(Number(immediateX), numberToBytes(immediateY))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    const immediateY = this.getImmediateValue(operands, 1)
    if (immediateY >= 2n ** 32n) {
      return false
    }
    return operands.length >= 2 // Need two immediates
  }

  disassemble(operands: Uint8Array): string {
    const immediateX = this.getImmediateValue(operands, 0)
    const immediateY = this.getImmediateValue(operands, 1)
    return `${this.name} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_U64 instruction (opcode 0x33)
 * Store 64-bit immediate to memory as specified in Gray Paper
 */
export class STORE_IMM_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U64
  readonly name = 'STORE_IMM_U64'
  readonly description = 'Store 64-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const immediateX = this.getImmediateValue(context.instruction.operands, 0)
    const immediateY = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing STORE_IMM_U64 instruction', {
      address: immediateX,
      // value: immediateY,
    })

    context.ram.writeOctets(Number(immediateX), numberToBytes(immediateY))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    const immediateY = this.getImmediateValue(operands, 1)
    if (immediateY >= 2n ** 64n) {
      return false
    }
    return operands.length >= 2 // Need two immediates
  }

  disassemble(operands: Uint8Array): string {
    const immediateX = this.getImmediateValue(operands, 0)
    const immediateY = this.getImmediateValue(operands, 1)
    return `${this.name} ${immediateX} ${immediateY}`
  }
}

/**
 * LOAD_IMM instruction (opcode 0x51)
 * Load immediate into register as specified in Gray Paper
 */
export class LOAD_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM
  readonly name = 'LOAD_IMM'
  readonly description = 'Load immediate into register'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_IMM instruction', { registerA, immediate })

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerA, immediate)

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_U8 instruction (opcode 0x52)
 * Load unsigned 8-bit from memory as specified in Gray Paper
 */
export class LOAD_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U8
  readonly name = 'LOAD_U8'
  readonly description = 'Load unsigned 8-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_U8 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 1)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    const address = this.getImmediateValue(operands, 1)
    if (address >= 256) {
      return false
    }
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_I8 instruction (opcode 0x53)
 * Load signed 8-bit from memory as specified in Gray Paper
 */
export class LOAD_I8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I8
  readonly name = 'LOAD_I8'
  readonly description = 'Load signed 8-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_I8 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 1)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_U16 instruction (opcode 0x54)
 * Load unsigned 16-bit from memory as specified in Gray Paper
 */
export class LOAD_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U16
  readonly name = 'LOAD_U16'
  readonly description = 'Load unsigned 16-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_U16 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 2)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_I16 instruction (opcode 0x55)
 * Load signed 16-bit from memory as specified in Gray Paper
 */
export class LOAD_I16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I16
  readonly name = 'LOAD_I16'
  readonly description = 'Load signed 16-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_I16 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 2)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_U32 instruction (opcode 0x56)
 * Load unsigned 32-bit from memory as specified in Gray Paper
 */
export class LOAD_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U32
  readonly name = 'LOAD_U32'
  readonly description = 'Load unsigned 32-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_U32 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 4)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_I32 instruction (opcode 0x57)
 * Load signed 32-bit from memory as specified in Gray Paper
 */
export class LOAD_I32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I32
  readonly name = 'LOAD_I32'
  readonly description = 'Load signed 32-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_I32 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 4)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * LOAD_U64 instruction (opcode 0x58)
 * Load unsigned 64-bit from memory as specified in Gray Paper
 */
export class LOAD_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U64
  readonly name = 'LOAD_U64'
  readonly description = 'Load unsigned 64-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)

    logger.debug('Executing LOAD_U64 instruction', { registerA, address })

    const value = context.ram.readOctets(Number(address), 8)
    const newRegisters = { ...context.registers }
    this.setRegisterValue(
      newRegisters,
      this.getRegisterIndex(context.instruction.operands[0]),
      bytesToBigInt(value),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * STORE_U8 instruction (opcode 0x59)
 * Store unsigned 8-bit to memory as specified in Gray Paper
 */
export class STORE_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U8
  readonly name = 'STORE_U8'
  readonly description = 'Store unsigned 8-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)
    const value = this.getRegisterValue(context.registers, registerA) % 2n ** 8n

    logger.debug('Executing STORE_U8 instruction', {
      registerA,
      address,
      value,
    })

    context.ram.writeOctets(Number(address), numberToBytes(value))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * STORE_U16 instruction (opcode 0x5A)
 * Store unsigned 16-bit to memory as specified in Gray Paper
 */
export class STORE_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U16
  readonly name = 'STORE_U16'
  readonly description = 'Store unsigned 16-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 16n

    logger.debug('Executing STORE_U16 instruction', {
      registerA,
      address,
      value,
    })

    context.ram.writeOctets(Number(address), numberToBytes(value))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * STORE_U32 instruction (opcode 0x5B)
 * Store unsigned 32-bit to memory as specified in Gray Paper
 */
export class STORE_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U32
  readonly name = 'STORE_U32'
  readonly description = 'Store unsigned 32-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)
    const value =
      this.getRegisterValue(context.registers, registerA) % 2n ** 32n

    logger.debug('Executing STORE_U32 instruction', {
      registerA,
      address,
      value,
    })

    context.ram.writeOctets(Number(address), numberToBytes(value))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * STORE_U64 instruction (opcode 0x5C)
 * Store unsigned 64-bit to memory as specified in Gray Paper
 */
export class STORE_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U64
  readonly name = 'STORE_U64'
  readonly description = 'Store unsigned 64-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)
    const value = this.getRegisterValue(context.registers, registerA)

    logger.debug('Executing STORE_U64 instruction', {
      registerA,
      address,
      value,
    })

    context.ram.writeOctets(Number(address), numberToBytes(value))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 2 // Need register and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const address = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerA} ${address}`
  }
}

/**
 * STORE_IMM_IND_U8 instruction (opcode 0x70)
 * Store immediate to register + immediate address as specified in Gray Paper
 */
export class STORE_IMM_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U8
  readonly name = 'STORE_IMM_IND_U8'
  readonly description =
    'Store immediate to register + immediate address (8-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const immediateY = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediateX
    // const value = Number(immediateY % 2n ** 8n)

    logger.debug('Executing STORE_IMM_IND_U8 instruction', {
      registerA,
      immediateX,
      immediateY,
      address,
      // value,
    })

    context.ram.writeOctets(Number(address), numberToBytes(immediateY))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need register and two immediates
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const immediateY = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_IND_U16 instruction (opcode 0x71)
 * Store immediate to register + immediate address as specified in Gray Paper
 */
export class STORE_IMM_IND_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U16
  readonly name = 'STORE_IMM_IND_U16'
  readonly description =
    'Store immediate to register + immediate address (16-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const immediateY = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediateX
    const value = Number(immediateY % 2n ** 16n)

    logger.debug('Executing STORE_IMM_IND_U16 instruction', {
      registerA,
      immediateX,
      immediateY,
      address,
      value,
    })

    context.ram.writeOctets(
      Number(address),
      new Uint8Array([value & 0xff, (value >> 8) & 0xff]),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need register and two immediates
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const immediateY = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_IND_U32 instruction (opcode 0x72)
 * Store immediate to register + immediate address as specified in Gray Paper
 */
export class STORE_IMM_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U32
  readonly name = 'STORE_IMM_IND_U32'
  readonly description =
    'Store immediate to register + immediate address (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const immediateY = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediateX
    const value = Number(immediateY % 2n ** 32n)

    logger.debug('Executing STORE_IMM_IND_U32 instruction', {
      registerA,
      immediateX,
      immediateY,
      address,
      value,
    })

    context.ram.writeOctets(
      Number(address),
      new Uint8Array([
        value & 0xff,
        (value >> 8) & 0xff,
        (value >> 16) & 0xff,
        (value >> 24) & 0xff,
      ]),
    )

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need register and two immediates
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const immediateY = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} ${immediateX} ${immediateY}`
  }
}

/**
 * STORE_IMM_IND_U64 instruction (opcode 0x73)
 * Store immediate to register + immediate address as specified in Gray Paper
 */
export class STORE_IMM_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U64
  readonly name = 'STORE_IMM_IND_U64'
  readonly description =
    'Store immediate to register + immediate address (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(context.instruction.operands, 1)
    const immediateY = this.getImmediateValue(context.instruction.operands, 2)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediateX

    logger.debug('Executing STORE_IMM_IND_U64 instruction', {
      registerA,
      immediateX,
      immediateY,
      address,
    })

    const value = BigInt(immediateY)
    context.ram.writeOctets(Number(address), numberToBytes(value))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need register and two immediates
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const immediateY = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} ${immediateX} ${immediateY}`
  }
}
