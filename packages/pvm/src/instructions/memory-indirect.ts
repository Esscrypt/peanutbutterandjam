/**
 * Indirect Memory Instructions
 *
 * STORE_IND and LOAD_IND variants - Store/Load to/from register + immediate address
 */

import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { INIT_CONFIG, OPCODES, RESULT_CODES } from '../config'
import { PVMRAM } from '../ram'
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
  execute(context: InstructionContext): InstructionResult {
    context.log('STORE_IND_U8: Starting execution', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })

    const { registerA, registerB, immediateX } =
      this.parseTwoRegistersAndImmediate(
        context.instruction.operands,
        context.fskip,
      )

    context.log('STORE_IND_U8: Parsed operands', {
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    context.log('STORE_IND_U8: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IND_U8: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }

    // Write 8-bit value to memory
    const byteValue = registerAValue & 0xffn
    const encodedByteValue = this.bigIntToBytesLE(byteValue, 1)

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        byteValue,
      )
    }

    context.log('STORE_IND_U8: About to call writeOctets', {
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
      context.log('STORE_IND_U8: writeOctets failed, returning FAULT')
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_write',
          address: faultAddress,
          details: 'Memory not writable',
        },
      }
    }

    // Interaction already tracked with value above

    context.log('STORE_IND_U8: writeOctets succeeded')

    return { resultCode: null }
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_B + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IND_U16: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    const value = registerAValue & 0xffffn

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        value,
      )
    }

    const encodedValue = this.bigIntToBytesLE(value, 2)
    const faultAddress = context.ram.writeOctets(address, encodedValue)
    context.log('STORE_IND_U16: executing', {
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

    // Interaction already tracked with value above
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    context.log('STORE_IND_U32: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IND_U32: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Write 32-bit value to memory (little-endian)
    const value = registerAValue & 0xffffffffn

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        value,
      )
    }

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

    // Interaction already tracked with value above
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_B + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    context.log('STORE_IND_U64: Address calculation', {
      registerA,
      registerB,
      immediateX,
      registerAValue: registerAValue.toString(),
      registerBValue: registerBValue.toString(),
      address: address.toString(),
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IND_U64: PANIC - address < 2^16', {
        address: address.toString(),
        threshold: '65536',
      })
      return { resultCode: RESULT_CODES.PANIC }
    }

    const value = registerAValue & 0xffffffffffffffffn

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        value,
      )
    }

    // Write 64-bit value to memory (little-endian)
    // Gray Paper: memwr[reg_B + immed_X:8] = encode[8]{reg_A}
    const encodedValue = this.bigIntToBytesLE(value, 8)

    const faultAddress = context.ram.writeOctets(address, encodedValue)
    if (faultAddress) {
      context.log('STORE_IND_U64: FAULT - memory write failed', {
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

    // Interaction already tracked with value above
    context.log('STORE_IND_U64: Executing', {
      operands: Array.from(context.instruction.operands),
      registerA,
      registerB,
      immediateX,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_U8: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

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

    // Interaction already tracked with value above
    return { resultCode: null }
  }
}

/**
 * LOAD_IND_I8 instruction (opcode 0x125)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex line 484:
 * reg'_A = unsigned{signedn{1}{memr_{\reg_B + \immed_X}}}
 *
 * signedn{1}(x) = signfunc{1}(x) = x if x < 2^7, else x - 2^8
 * unsigned{} converts signed value back to unsigned 64-bit
 */
export class LOAD_IND_I8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IND_I8
  readonly name = 'LOAD_IND_I8'
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_I8: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    context.log(
      'LOAD_IND_I8: Load from register + immediate address (8-bit signed)',
      {
        registerA,
        registerB,
        immediateX,
        address,
      },
    )

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

    // Load 8-bit value from memory
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

    // Gray Paper: memr_{\reg_B + \immed_X} - read single byte
    const decodedValue = BigInt(bytes[0]) & 0xffn

    // Gray Paper: signedn{1}(x) = signfunc{1}(x) = x if x < 2^7, else x - 2^8
    const signedValue =
      decodedValue < 0x80n ? decodedValue : decodedValue - 0x100n

    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    const unsignedValue =
      signedValue < 0n ? signedValue + 2n ** 64n : signedValue

    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      unsignedValue,
    )

    // Interaction already tracked with value above
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_U16: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

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

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log(
      'LOAD_IND_U16: Load from register + immediate address (16-bit unsigned)',
      {
        operands: Array.from(context.instruction.operands),
        registerB,
        registerA,
        immediateX,
        registerBValue,
        address,
        value,
        bytesReadFromMemory: bytes,
        beforeValue: beforeValue.toString(),
        registers: Array.from(context.registers.slice(0, 13)).map((r) =>
          r.toString(),
        ),
        pc: context.pc,
      },
    )

    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'read',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        value,
      )
    }
    return { resultCode: null }
  }
}

/**
 * LOAD_IND_I16 instruction (opcode 0x127)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex line 486:
 * reg'_A = unsigned{signedn{2}{decode[2](mem[reg_B + immed_X:2])}}
 *
 * signedn{2}(x) = signfunc{2}(x) = x if x < 2^15, else x - 2^16
 * unsigned{} converts signed value back to unsigned 64-bit
 * TODO: verify against pvm.tex
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_I16: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    context.log(
      'LOAD_IND_I16: Load from registerB + immediateX address to registerA (16-bit signed)',
      {
        registerB,
        registerA,
        immediateX,
        address,
      },
    )

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

    // Load 16-bit value from memory (little-endian)
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

    // Gray Paper: decode[2](mem[...]) - decode 2 bytes as little-endian
    const decodedValue = this.bytesToBigIntLE(bytes) & 0xffffn

    // Gray Paper: signedn{2}(x) = signfunc{2}(x) = x if x < 2^15, else x - 2^16
    const signedValue =
      decodedValue < 0x8000n ? decodedValue : decodedValue - 0x10000n

    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    const unsignedValue =
      signedValue < 0n ? signedValue + 2n ** 64n : signedValue

    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      unsignedValue,
    )

    // Interaction already tracked with value above
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    context.log(
      'LOAD_IND_U32: Load from registerB + immediateX address to registerA (32-bit unsigned)',
      {
        registerB,
        registerA,
        immediateX,
        address,
        registers: Array.from(context.registers.slice(0, 13)).map((r) =>
          r.toString(),
        ),
        pc: context.pc,
      },
    )

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_U32: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

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

    // Interaction already tracked with value above
    return { resultCode: null }
  }
}

/**
 * LOAD_IND_I32 instruction (opcode 0x129)
 * Load from register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex line 488:
 * reg'_A = unsigned{signedn{4}{decode[4](mem[reg_B + immed_X:4])}}
 *
 * signedn{4}(x) = signfunc{4}(x) = x if x < 2^31, else x - 2^32
 * unsigned{} converts signed value back to unsigned 64-bit
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_I32: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

    // Load 32-bit value from memory (little-endian)
    const [bytes, faultAddress] = context.ram.readOctets(address, 4n)
    context.log(
      'LOAD_IND_I32: Load from registerB + immediateX address to registerA (32-bit signed)',
      {
        registerA,
        registerB,
        immediateX,
        address,
        bytesReadFromMemory: bytes,
        registers: Array.from(context.registers.slice(0, 13)).map((r) =>
          r.toString(),
        ),
        pc: context.pc,
        faultAddress: faultAddress?.toString(),
        bytes: bytes ? Array.from(bytes) : [],
      },
    )
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

    // Gray Paper: decode[4](mem[...]) - decode 4 bytes as little-endian
    const decodedValue = this.bytesToBigIntLE(bytes) & 0xffffffffn

    // Gray Paper: signedn{4}(x) = signfunc{4}(x) = x if x < 2^31, else x - 2^32
    const signedValue =
      decodedValue < 0x80000000n ? decodedValue : decodedValue - 0x100000000n

    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    const unsignedValue =
      signedValue < 0n ? signedValue + 2n ** 64n : signedValue

    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      unsignedValue,
    )

    // Interaction already tracked with value above
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
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = (registerBValue + immediateX) & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_IND_U64: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(address, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

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

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        address,
        'read',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        registerA,
        value,
      )
    }

    context.log(
      'LOAD_IND_U64: Load from registerB + immediateX address to registerA (64-bit unsigned)',
      {
        registerA,
        registerB,
        registerBValue,
        immediateX,
        address,
        storedValueInRegisterA: value,
        bytesReadFromMemory: bytes,
        pc: context.pc,
      },
    )
    return { resultCode: null }
  }
}
