/**
 * Indirect Memory Instructions
 *
 * STORE_IND and LOAD_IND variants - Store/Load to/from register + immediate address
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
import { BaseInstruction } from './base'

/**
 * STORE_IND_U8 instruction (opcode 0x120)
 * Store to register + immediate address as specified in Gray Paper
 */
export class STORE_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U8
  readonly name = 'STORE_IND_U8'
  readonly description = 'Store to register + immediate address (8-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const value = this.getRegisterValue(context.registers, registerD)
    const address = registerValue + immediate

    logger.debug('Executing STORE_IND_U8 instruction', {
      registerD,
      registerA,
      immediate,
      address,
      value,
    })

    // TODO: Implement memory write
    // const byteValue = Number(value % (2n ** 8n))
    // context.memory[Number(address)] = byteValue

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IND_U16 instruction (opcode 0x121)
 * Store to register + immediate address as specified in Gray Paper
 */
export class STORE_IND_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U16
  readonly name = 'STORE_IND_U16'
  readonly description = 'Store to register + immediate address (16-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const value = this.getRegisterValue(context.registers, registerD)
    const address = registerValue + immediate

    logger.debug('Executing STORE_IND_U16 instruction', {
      registerD,
      registerA,
      immediate,
      address,
      value,
    })

    // TODO: Implement memory write for 16-bit value
    // const bytes = new Uint8Array(2)
    // new DataView(bytes.buffer).setUint16(0, Number(value % (2n ** 16n)), true) // little-endian
    // context.memory.set(bytes, Number(address))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IND_U32 instruction (opcode 0x122)
 * Store to register + immediate address as specified in Gray Paper
 */
export class STORE_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U32
  readonly name = 'STORE_IND_U32'
  readonly description = 'Store to register + immediate address (32-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const value = this.getRegisterValue(context.registers, registerD)
    const address = registerValue + immediate

    logger.debug('Executing STORE_IND_U32 instruction', {
      registerD,
      registerA,
      immediate,
      address,
      value,
    })

    // TODO: Implement memory write for 32-bit value
    // const bytes = new Uint8Array(4)
    // new DataView(bytes.buffer).setUint32(0, Number(value % (2n ** 32n)), true) // little-endian
    // context.memory.set(bytes, Number(address))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IND_U64 instruction (opcode 0x123)
 * Store to register + immediate address as specified in Gray Paper
 */
export class STORE_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U64
  readonly name = 'STORE_IND_U64'
  readonly description = 'Store to register + immediate address (64-bit)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const value = this.getRegisterValue(context.registers, registerD)
    const address = registerValue + immediate

    logger.debug('Executing STORE_IND_U64 instruction', {
      registerD,
      registerA,
      immediate,
      address,
      value,
    })

    // TODO: Implement memory write for 64-bit value
    // const bytes = new Uint8Array(8)
    // new DataView(bytes.buffer).setBigUint64(0, value, true) // little-endian
    // context.memory.set(bytes, Number(address))

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U8 instruction (opcode 0x124)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U8
  readonly name = 'LOAD_IND_U8'
  readonly description =
    'Load from register + immediate address (8-bit unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_U8 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read
    // const value = BigInt(context.memory[Number(address)])

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I8 instruction (opcode 0x125)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_I8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I8
  readonly name = 'LOAD_IND_I8'
  readonly description = 'Load from register + immediate address (8-bit signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_I8 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read with sign extension
    // const rawValue = context.memory[Number(address)]
    // const value = (rawValue & 0x80) ? BigInt(rawValue - 256) : BigInt(rawValue)

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U16 instruction (opcode 0x126)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U16
  readonly name = 'LOAD_IND_U16'
  readonly description =
    'Load from register + immediate address (16-bit unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_U16 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read for 16-bit value
    // const bytes = context.memory.slice(Number(address), Number(address) + 2)
    // const value = BigInt(new DataView(bytes.buffer).getUint16(0, true)) // little-endian

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I16 instruction (opcode 0x127)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_I16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I16
  readonly name = 'LOAD_IND_I16'
  readonly description =
    'Load from register + immediate address (16-bit signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_I16 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read for 16-bit signed value
    // const bytes = context.memory.slice(Number(address), Number(address) + 2)
    // const rawValue = new DataView(bytes.buffer).getInt16(0, true) // little-endian
    // const value = BigInt(rawValue)

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U32 instruction (opcode 0x128)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U32
  readonly name = 'LOAD_IND_U32'
  readonly description =
    'Load from register + immediate address (32-bit unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_U32 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read for 32-bit value
    // const bytes = context.memory.slice(Number(address), Number(address) + 4)
    // const value = BigInt(new DataView(bytes.buffer).getUint32(0, true)) // little-endian

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I32 instruction (opcode 0x129)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_I32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I32
  readonly name = 'LOAD_IND_I32'
  readonly description =
    'Load from register + immediate address (32-bit signed)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_I32 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read for 32-bit signed value
    // const bytes = context.memory.slice(Number(address), Number(address) + 4)
    // const rawValue = new DataView(bytes.buffer).getInt32(0, true) // little-endian
    // const value = BigInt(rawValue)

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U64 instruction (opcode 0x12A)
 * Load from register + immediate address as specified in Gray Paper
 */
export class LOAD_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U64
  readonly name = 'LOAD_IND_U64'
  readonly description =
    'Load from register + immediate address (64-bit unsigned)'

  execute(context: InstructionContext): InstructionResult {
    const registerD = this.getRegisterD(context.instruction.operands)
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediate = this.getImmediateValue(context.instruction.operands, 2n)
    const registerValue = this.getRegisterValue(context.registers, registerA)
    const address = registerValue + immediate

    logger.debug('Executing LOAD_IND_U64 instruction', {
      registerD,
      registerA,
      immediate,
      address,
    })

    // TODO: Implement memory read for 64-bit value
    // const bytes = context.memory.slice(Number(address), Number(address) + 8)
    // const value = new DataView(bytes.buffer).getBigUint64(0, true) // little-endian

    const newRegisters = { ...context.registers }
    this.setRegisterValue(newRegisters, registerD, 0n) // Placeholder

    return {
      resultCode: RESULT_CODES.HALT,
      newInstructionPointer: context.instructionPointer + 1n,
      newGasCounter: context.gasCounter - 1n,
      newRegisters,
    }
  }

  validate(operands: Uint8Array): boolean {
    return operands.length >= 3 // Need two registers and immediate
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterD(operands)
    const registerA = this.getRegisterA(operands)
    const immediate = this.getImmediateValue(operands, 2n)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
