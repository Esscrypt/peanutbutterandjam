/**
 * Indirect Memory Instructions
 *
 * STORE_IND and LOAD_IND variants - Store/Load to/from register + immediate address
 */

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
    console.log('STORE_IND_U8: Starting execution', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    console.log('STORE_IND_U8: Parsed operands', {
      registerA,
      registerB,
      immediateX,
    })

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    console.log('STORE_IND_U8: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      console.log('STORE_IND_U8: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Write 8-bit value to memory
    const byteValue = registerAValue & 0xffn
    const encodedByteValue = this.bigIntToBytesLE(byteValue, 1)

    console.log('STORE_IND_U8: About to call writeOctets', {
      registerB,
      registerBValue,
      immediateX,
      registerAValue,
      address: address.toString(),
      byteValue,
      encodedByteValue: Array.from(encodedByteValue),
    })

    const faultAddress = context.ram.writeOctets(address, encodedByteValue)

    if (faultAddress) {
      console.log('STORE_IND_U8: writeOctets failed, returning FAULT')
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    console.log('STORE_IND_U8: writeOctets succeeded')

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
    // Gray Paper: some gas is always charged whenever execution is attempted
    // This is the case even if no instruction is effectively executed
    console.log('STORE_IND_U16: Starting execution', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

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
    const address = registerBValue + (immediateX & 0xffffn)

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    const value = registerAValue & 0xffffn

    const encodedValue = this.bigIntToBytesLE(value, 2)
    const faultAddress = context.ram.writeOctets(address, encodedValue)
    console.log('STORE_IND_U16: executing', {
      registerA,
      registerB,
      immediateX,
      registerAValue,
      registerBValue,
      address,
      value,
      encodedValue: Array.from(encodedValue),
      faultAddress: faultAddress?.toString(),
    })
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    return { resultCode: null }
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
    // Gray Paper: some gas is always charged whenever execution is attempted
    // This is the case even if no instruction is effectively executed

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

    console.log('STORE_IND_U32: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Write 32-bit value to memory (little-endian)
    const value = registerAValue & 0xffffffffn
    const encodedValue = this.bigIntToBytesLE(value, 4)
    const faultAddress = context.ram.writeOctets(address, encodedValue)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    return { resultCode: null }
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
    // Gray Paper: some gas is always charged whenever execution is attempted
    // This is the case even if no instruction is effectively executed

    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
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

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      console.log('STORE_IND_U64: PANIC - address < 2^16', {
        address: address.toString(),
        threshold: '65536',
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    const value = registerAValue & 0xffffffffffffffffn

    // Write 64-bit value to memory (little-endian)
    // Gray Paper: memwr[reg_B + immed_X:8] = encode[8]{reg_A}
    const encodedValue = this.bigIntToBytesLE(value, 8)

    const faultAddress = context.ram.writeOctets(address, encodedValue)
    if (faultAddress) {
      console.log('STORE_IND_U64: FAULT - memory write failed', {
        faultAddress: faultAddress.toString(),
      })
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    console.log('STORE_IND_U64: Executing', {
      operands: Array.from(context.instruction.operands),
      registerA,
      registerB,
      immediateX,
      registers: context.registers,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
      value: value.toString(),
      encodedValue: Array.from(encodedValue),
      faultAddress: faultAddress?.toString(),
      pc: context.pc,
    })

    return { resultCode: null }
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
    // Mutate context directly

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

    // Load 8-bit unsigned value from memory
    const [bytes, faultAddress] = context.ram.readOctets(address, 1n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }

    const byteValue = bytes[0]
    const value = BigInt(byteValue)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return { resultCode: null }
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
    // Mutate context directly

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
    const [bytes, faultAddress] = context.ram.readOctets(address, 1n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }

    const byteValue = bytes[0]
    // Sign-extend: if bit 7 is set, it's negative
    const value = byteValue & 0x80 ? BigInt(byteValue - 256) : BigInt(byteValue)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return { resultCode: null }
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

    // Load 16-bit unsigned value from memory (little-endian)
    const [bytes, faultAddress] = context.ram.readOctets(address, 2n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    console.log('Executing LOAD_IND_U16 instruction', {
      operands: Array.from(context.instruction.operands),
      registerB,
      registerA,
      immediateX,
      registerBValue,
      address,
      value,
      bytesReadFromMemory: bytes,
      registers: context.registers,
      pc: context.pc,
    })
    return { resultCode: null }
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
    const [bytes, faultAddress] = context.ram.readOctets(address, 2n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 2)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return { resultCode: null }
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
      this.parseTwoRegistersAndImmediate(
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
    const [bytes, faultAddress] = context.ram.readOctets(address, 4n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }
    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return { resultCode: null }
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
    const [bytes, faultAddress] = context.ram.readOctets(address, 4n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 4)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return { resultCode: null }
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
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    const address = registerBValue + immediateX

    // Load 64-bit unsigned value from memory (little-endian)
    const [bytes, faultAddress] = context.ram.readOctets(address, 8n)
    if (faultAddress) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: faultAddress,
          details: 'Memory not readable',
        },
      }
    }
    if (!bytes) {
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }
    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    console.log('Executing LOAD_IND_U64 instruction', {
      registerA,
      registerB,
      registerBValue,
      immediateX,
      address,
      storedValueInRegisterA: value,
      bytesReadFromMemory: bytes,
      pc: context.pc,
    })
    return { resultCode: null }
  }
}
