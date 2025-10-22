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
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_B + immed_X] = reg_A mod 2^8
 */
export class STORE_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U8
  readonly name = 'STORE_IND_U8'
  readonly description = 'Store to register + immediate address (8-bit)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    // Consume gas first
    context.gas -= 1n

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if memory is writable - inaccessible memory causes FAULT
    if (!context.ram.isWritable(address, 1n)) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    // Write 8-bit value to memory
    const byteValue = registerAValue & 0xffn
    const encodedByteValue = this.bigIntToBytesLE(byteValue, 1)

    logger.debug('Writing 8-bit value to memory', {
      registerB,
      registerBValue,
      immediateX,
      registerAValue,
      address,
      byteValue,
      encodedByteValue,
    })
    const [error] = context.ram.writeOctets(address, encodedByteValue)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(operands, 4)
    return `${this.name} r${registerA} r${registerB} ${immediateX}`
  }
}

/**
 * STORE_IND_U16 instruction (opcode 0x121)
 * Store to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_B + immed_X:2] = encode[2](reg_A mod 2^16)
 */
export class STORE_IND_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U16
  readonly name = 'STORE_IND_U16'
  readonly description = 'Store to register + immediate address (16-bit)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    // Consume gas first
    context.gas -= 1n

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if memory is writable - inaccessible memory causes FAULT
    if (!context.ram.isWritable(address, 2n)) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    const value = registerAValue & 0xffffn

    const encodedValue = this.bigIntToBytesLE(value, 2)
    const [error] = context.ram.writeOctets(address, encodedValue)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IND_U32 instruction (opcode 0x122)
 * Store to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_B + immed_X:4] = encode[4](reg_A mod 2^32)
 */
export class STORE_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U32
  readonly name = 'STORE_IND_U32'
  readonly description = 'Store to register + immediate address (32-bit)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )
    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('STORE_IND_U32: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue,
      registerBValue,
      address,
      addressHex: address.toString(16),
    })

    // Consume gas first
    context.gas -= 1n

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      console.log('STORE_IND_U32: PANIC - address < 2^16', { address })
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if memory is writable - inaccessible memory causes FAULT
    if (!context.ram.isWritable(address, 4n)) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    // Write 32-bit value to memory (little-endian)
    const value = registerAValue & 0xffffffffn
    const encodedValue = this.bigIntToBytesLE(value, 4)
    const [error] = context.ram.writeOctets(address, encodedValue)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * STORE_IND_U64 instruction (opcode 0x123)
 * Store to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_B + immed_X:8] = encode[8](reg_A)
 */
export class STORE_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IND_U64
  readonly name = 'STORE_IND_U64'
  readonly description = 'Store to register + immediate address (64-bit)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = registerBValue + immediateX

    logger.debug('Executing STORE_IND_U64 instruction', {
      registerB,
      registerBValue,
      immediateX,
      registerAValue,
      address,
    })

    // Consume gas first
    context.gas -= 1n

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if memory is writable - inaccessible memory causes FAULT
    if (!context.ram.isWritable(address, 8n)) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    const value = registerAValue & 0xffffffffffffffffn

    // Write 64-bit value to memory (little-endian)
    // Gray Paper: memwr[reg_B + immed_X:8] = encode[8]{reg_A}
    const encodedValue = this.bigIntToBytesLE(value, 8)
    const [error] = context.ram.writeOctets(address, encodedValue)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U8 instruction (opcode 0x124)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[1](mem[reg_B + immed_X:1])
 */
export class LOAD_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U8
  readonly name = 'LOAD_IND_U8'
  readonly description =
    'Load from register + immediate address (8-bit unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_U8 instruction', {
      registerB,
      registerBValue,
      immediateX,
      registerAValue,
      address,
    })

    // Load 8-bit unsigned value from memory
    const [error, bytes] = context.ram.readOctets(address, 1n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const byteValue = bytes[0]
    const value = BigInt(byteValue)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I8 instruction (opcode 0x125)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[8](decode[1](mem[reg_B + immed_X:1]))
 */
export class LOAD_IND_I8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I8
  readonly name = 'LOAD_IND_I8'
  readonly description = 'Load from register + immediate address (8-bit signed)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_I8 instruction', {
      registerA,
      registerB,
      immediateX,
      address,
    })
    // Load 8-bit signed value from memory
    const [error, bytes] = context.ram.readOctets(address, 1n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const byteValue = bytes[0]
    // Sign-extend: if bit 7 is set, it's negative
    const value = byteValue & 0x80 ? BigInt(byteValue - 256) : BigInt(byteValue)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U16 instruction (opcode 0x126)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[2](mem[reg_B + immed_X:2])
 */
export class LOAD_IND_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U16
  readonly name = 'LOAD_IND_U16'
  readonly description =
    'Load from register + immediate address (16-bit unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_U16 instruction', {
      registerB,
      registerA,
      address,
    })
    // Load 16-bit unsigned value from memory (little-endian)
    const [error, bytes] = context.ram.readOctets(address, 2n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I16 instruction (opcode 0x127)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[16](decode[2](mem[reg_B + immed_X:2]))
 */
export class LOAD_IND_I16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I16
  readonly name = 'LOAD_IND_I16'
  readonly description =
    'Load from register + immediate address (16-bit signed)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_I16 instruction', {
      registerB,
      registerA,
      immediateX,
      address,
    })
    // Load 16-bit signed value from memory (little-endian)
    const [error, bytes] = context.ram.readOctets(address, 2n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 2)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U32 instruction (opcode 0x128)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[4](mem[reg_B + immed_X:4])
 */
export class LOAD_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U32
  readonly name = 'LOAD_IND_U32'
  readonly description =
    'Load from register + immediate address (32-bit unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_U32 instruction', {
      registerB,
      registerA,
      immediateX,
      address,
    })
    // Load 32-bit unsigned value from memory (little-endian)
    const [error, bytes] = context.ram.readOctets(address, 4n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_I32 instruction (opcode 0x129)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[32](decode[4](mem[reg_B + immed_X:4]))
 */
export class LOAD_IND_I32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I32
  readonly name = 'LOAD_IND_I32'
  readonly description =
    'Load from register + immediate address (32-bit signed)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_I32 instruction', {
      registerA,
      registerB,
      immediateX,
      address,
    })
    // Load 32-bit signed value from memory (little-endian)
    const [error, bytes] = context.ram.readOctets(address, 4n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 4)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}

/**
 * LOAD_IND_U64 instruction (opcode 0x12A)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[8](mem[reg_B + immed_X:8])
 */
export class LOAD_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_U64
  readonly name = 'LOAD_IND_U64'
  readonly description =
    'Load from register + immediate address (64-bit unsigned)'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediateUnsigned(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('Executing LOAD_IND_U64 instruction', {
      registerA,
      registerB,
      immediateX,
      address,
    })
    // Load 64-bit unsigned value from memory (little-endian)
    const [error, bytes] = context.ram.readOctets(address, 8n)
    if (error) {
      return { resultCode: RESULT_CODES.FAULT }
    }
    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly
    context.gas -= 1n

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerD = this.getRegisterA(operands)
    const registerA = this.getRegisterB(operands)
    const immediate = this.getImmediateValue(operands, 1)
    return `${this.name} r${registerD} r${registerA} ${immediate}`
  }
}
