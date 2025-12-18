/**
 * Memory Instructions
 *
 * LOAD_IMM_64, STORE_IMM variants, LOAD/STORE variants
 */

import type { InstructionContext, InstructionResult } from '@pbnjam/types'
import { INIT_CONFIG, OPCODES, RESULT_CODES } from '../config'
import { PVMRAM } from '../ram'
import { BaseInstruction } from './base'

/**
 * LOAD_IMM_64 instruction (opcode 0x20)
 * Load 64-bit immediate into register as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = immed_X
 */
export class LOAD_IMM_64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM_64
  readonly name = 'LOAD_IMM_64'
  readonly description = 'Load 64-bit immediate into register'
  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of One Register and One Extended Width Immediate
    // r_A = min(12, instructions[ι+1] mod 16)
    // immed_X = decode[8]{instructions[ι+2:8]} - decode 8 bytes as unsigned (no sign extension)
    const registerA = this.getRegisterA(context.instruction.operands)

    // Read 8 bytes (64 bits) as unsigned little-endian
    // Gray Paper: decode[8] means read 8 bytes without sign extension
    let immediateX = 0n
    for (let i = 0; i < 8 && 1 + i < context.instruction.operands.length; i++) {
      immediateX |= BigInt(context.instruction.operands[1 + i]) << BigInt(i * 8)
    }

    this.setRegisterValue(context.registers, registerA, immediateX)

    context.log('LOAD_IMM_64: After setting register', {
      registerA,
      immediateX,
      registerValue: context.registers[registerA],
    })
    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * STORE_IMM_U8 instruction (opcode 0x30)
 * Store 8-bit immediate to memory
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X] = immed_Y mod 2^8
 */
export class STORE_IMM_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U8
  readonly name = 'STORE_IMM_U8'
  readonly description = 'Store 8-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const { immediateX, immediateY } = this.parseTwoImmediates(
      context.instruction.operands,
      context.fskip,
    )

    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    // mem'[immed_X] = immed_Y mod 2^8
    const value = immediateY & 0xffn

    context.log('STORE_IMM_U8: Writing value to memory', {
      immediateX,
      value,
    })
    if (immediateX < 65536n) {
      context.log('STORE_IMM_U8: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        undefined, // No register for immediate stores
        value,
      )
    }

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 1),
    )
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
 * STORE_IMM_U16 instruction (opcode 0x31)
 * Store 16-bit immediate to memory
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:2] = encode[2](immed_Y mod 2^16)
 */
export class STORE_IMM_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U16
  readonly name = 'STORE_IMM_U16'
  readonly description = 'Store 16-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const { immediateX, immediateY } = this.parseTwoImmediates(
      context.instruction.operands,
      context.fskip,
    )

    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    // mem'[immed_X:2] = encode[2](immed_Y mod 2^16)
    const value = immediateY & 0xffffn

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        undefined, // No register for immediate stores
        value,
      )
    }

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 2),
    )
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
 * STORE_IMM_U32 instruction (opcode 0x32)
 * Store 32-bit immediate to memory
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:4] = encode[4](immed_Y mod 2^32)
 */
export class STORE_IMM_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U32
  readonly name = 'STORE_IMM_U32'
  readonly description = 'Store 32-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const { immediateX, immediateY } = this.parseTwoImmediates(
      context.instruction.operands,
      context.fskip,
    )

    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    // mem'[immed_X:4] = encode[4](immed_Y mod 2^32)
    const value = immediateY & 0xffffffffn

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        undefined, // No register for immediate stores
        value,
      )
    }

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 4),
    )
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
 * STORE_IMM_U64 instruction (opcode 0x33)
 * Store 64-bit immediate to memory
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:8] = encode[8](immed_Y)
 */
export class STORE_IMM_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_U64
  readonly name = 'STORE_IMM_U64'
  readonly description = 'Store 64-bit immediate to memory'

  execute(context: InstructionContext): InstructionResult {
    const { immediateX, immediateY } = this.parseTwoImmediates(
      context.instruction.operands,
      context.fskip,
    )

    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    // mem'[immed_X:8] = encode[8](immed_Y)
    // No modulo for U64 - use full 64-bit value

    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
        'write',
        {
          pc: context.pc,
          opcode: context.instruction.opcode,
          name: this.name,
          operands: Array.from(context.instruction.operands),
        },
        undefined, // No register for immediate stores
        immediateY,
      )
    }

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(immediateY, 8),
    )
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
 * LOAD_IMM instruction (opcode 0x33)
 * Load immediate into register
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = immed_X
 */
export class LOAD_IMMInstruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_IMM
  readonly name = 'LOAD_IMM'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )

    // Log BEFORE modification to capture the before state
    const beforeValue = context.registers[registerA]
    context.log('LOAD_IMM Executing', {
      fskip: context.fskip,
      operands: Array.from(context.instruction.operands),
      registerA,
      immediateX: immediateX.toString(),
      beforeValue: beforeValue.toString(),
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
      pc: context.pc,
    })

    this.setRegisterValue(context.registers, registerA, immediateX)

    // Log AFTER modification to capture the after state
    context.log('LOAD_IMM After setting register', {
      fskip: context.fskip,
      registerA,
      immediateX: immediateX.toString(),
      afterValue: context.registers[registerA].toString(),
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
      pc: context.pc,
    })

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_U8 instruction (opcode 0x52)
 * Load unsigned 8-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[1](mem[immed_X:1])
 */
export class LOAD_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U8
  readonly name = 'LOAD_U8'
  readonly description = 'Load unsigned 8-bit from memory'
  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediateUnsigned(
      context.instruction.operands,
      context.fskip,
    )

    context.log('Executing LOAD_U8 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 1n)
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
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }

    // Gray Paper: decode[1] reads a single byte - no endianness conversion needed
    // For single-byte values, bytesToBigIntLE is redundant; direct access is more efficient
    const value = BigInt(bytes[0])
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_I8 instruction (opcode 0x53)
 * Load signed 8-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[8](decode[1](mem[immed_X:1]))
 */
export class LOAD_I8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I8
  readonly name = 'LOAD_I8'
  readonly description = 'Load signed 8-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediateUnsigned(
      context.instruction.operands,
      context.fskip,
    )

    context.log('Executing LOAD_I8 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 1n)
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
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }

    const value = this.signExtend(this.bytesToBigIntLE(bytes), 1)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_U16 instruction (opcode 0x54)
 * Load unsigned 16-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[2](mem[immed_X:2])
 */
export class LOAD_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U16
  readonly name = 'LOAD_U16'
  readonly description = 'Load unsigned 16-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediateUnsigned(
      context.instruction.operands,
      context.fskip,
    )

    context.log('Executing LOAD_U16 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 2n)
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
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_I16 instruction (opcode 0x55)
 * Load signed 16-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[16](decode[2](mem[immed_X:2]))
 */
export class LOAD_I16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I16
  readonly name = 'LOAD_I16'
  readonly description = 'Load signed 16-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediateUnsigned(
      context.instruction.operands,
      context.fskip,
    )

    context.log('Executing LOAD_I16 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 2n)
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
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 2)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_U32 instruction (opcode 0x56)
 * Load unsigned 32-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[4](mem[immed_X:4])
 */
export class LOAD_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U32
  readonly name = 'LOAD_U32'
  readonly description = 'Load unsigned 32-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediateUnsigned(
      context.instruction.operands,
      context.fskip,
    )

    context.log('Executing LOAD_U32 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

    if (immediateX < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_U32: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }
    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 4n)
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
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * LOAD_I32 instruction (opcode 0x57)
 * Load signed 32-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = sext[32](decode[4](mem[immed_X:4]))
 */
export class LOAD_I32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_I32
  readonly name = 'LOAD_I32'
  readonly description = 'Load signed 32-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )

    const address = immediateX & 0xffffffffn
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_I32: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: address,
          details: 'Memory not readable',
        },
      }
    }

    context.log('Executing LOAD_I32 instruction', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
    })

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

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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
 * LOAD_U64 instruction (opcode 0x58)
 * Load unsigned 64-bit from memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = decode[8](mem[immed_X:8])
 */
export class LOAD_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.LOAD_U64
  readonly name = 'LOAD_U64'
  readonly description = 'Load unsigned 64-bit from memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )

    const address = immediateX & 0xffffffffn

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('LOAD_U64: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_read',
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }
    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(immediateX, 'read', {
        pc: context.pc,
        opcode: context.instruction.opcode,
        name: this.name,
        operands: Array.from(context.instruction.operands),
      })
    }

    const [bytes, faultAddress] = context.ram.readOctets(address, 8n)
    context.log('LOAD_U64: executing', {
      registerA,
      immediateX,
      pc: context.pc,
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
      registers: Array.from(context.registers.slice(0, 13)).map((r) =>
        r.toString(),
      ),
      bytes: bytes ? Array.from(bytes) : [],
      faultAddress: faultAddress?.toString(),
    })
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
      context.log('LOAD_U64: FAULT - no bytes returned', {
        immediateX: immediateX.toString(),
      })
      return {
        resultCode: RESULT_CODES.FAULT,
        faultInfo: {
          type: 'memory_read',
          address: immediateX,
          details: 'Memory not readable',
        },
      }
    }

    const value = this.bytesToBigIntLE(bytes)

    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Track interaction with instruction context, register and value
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    context.log('LOAD_U64: After setting register', {
      immediateX: immediateX.toString(),
      bytes: Array.from(bytes),
      registerA,
      value: value.toString(),
      finalRegisterValue: context.registers[registerA],
    })

    // Mutate context directly

    return { resultCode: null }
  }
}

/**
 * STORE_U8 instruction (opcode 0x59)
 * Store unsigned 8-bit to memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X] = reg_A mod 2^8
 */
export class STORE_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U8
  readonly name = 'STORE_U8'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )
    const value =
      this.getRegisterValueAs64(context.registers, registerA) % 2n ** 8n

    if (immediateX < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_U8: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: immediateX,
          details: 'Memory not writable',
        },
      }
    }
    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    const faultAddress = context.ram.writeOctets(
      immediateX,
      new Uint8Array([Number(value)]),
    )

    context.log('Executing STORE_U8 instruction', {
      registerA,
      immediateX,
      value,
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
 * STORE_U16 instruction (opcode 0x5A)
 * Store unsigned 16-bit to memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:2] = encode[2](reg_A mod 2^16)
 */
export class STORE_U16Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U16
  readonly name = 'STORE_U16'
  readonly description = 'Store unsigned 16-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )
    const value =
      this.getRegisterValueAs64(context.registers, registerA) % 2n ** 16n

    if (immediateX < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_U16: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: immediateX,
          details: 'Memory not writable',
        },
      }
    }
    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 2),
    )
    context.log('Executing STORE_U16 instruction', {
      registerA,
      immediateX,
      value,
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
 * STORE_U32 instruction (opcode 0x5B)
 * Store unsigned 32-bit to memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:4] = encode[4](reg_A mod 2^32)
 */
export class STORE_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U32
  readonly name = 'STORE_U32'
  readonly description = 'Store unsigned 32-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const registerA = this.getRegisterA(context.instruction.operands)
    const address = this.getImmediateValue(context.instruction.operands, 1)
    const value =
      this.getRegisterValueAs64(context.registers, registerA) % 2n ** 32n

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_U32: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }
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

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 4),
    )
    context.log('Executing STORE_U32 instruction', {
      registerA,
      address,
      value,
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
 * STORE_U64 instruction (opcode 0x5C)
 * Store unsigned 64-bit to memory as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[immed_X:8] = encode[8](reg_A)
 */
export class STORE_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_U64
  readonly name = 'STORE_U64'
  readonly description = 'Store unsigned 64-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )
    const value = this.getRegisterValueAs64(context.registers, registerA)

    if (immediateX < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_U64: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: immediateX,
          details: 'Memory not writable',
        },
      }
    }
    // Track interaction with instruction context
    if (context.ram instanceof PVMRAM) {
      context.ram.trackInteraction(
        immediateX,
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

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 8),
    )
    context.log(
      'STORE_U64: Store 64-bit from register A to immediate address',
      {
        registerA,
        immediateX,
        value,
        faultAddress: faultAddress?.toString(),
      },
    )
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
 * STORE_IMM_IND_U8 instruction (opcode 0x46 / 70)
 * Store 8-bit immediate to memory at register + offset
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X] = immed_Y mod 2^8
 */
export class STORE_IMM_IND_U8Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U8
  readonly name = 'STORE_IMM_IND_U8'
  readonly description =
    'Store immediate to register + immediate address (8-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    const { registerA, immediateX, immediateY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )
    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = registerAValue + immediateX

    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IMM_IND_U8: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }

    const value = immediateY & 0xffn

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
        undefined, // No register for immediate stores
        value,
      )
    }

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 1),
    )

    context.log(
      'STORE_IMM_IND_U8: Store 8-bit immediate to register + immediate address',
      {
        registerA,
        registerAValue,
        address,
        value,
        faultAddress: faultAddress?.toString(),
      },
    )

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
 * STORE_IMM_IND_U16 instruction (opcode 0x71)
 * Store immediate to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X:2] = encode[2](immed_Y mod 2^16)
 */
export class STORE_IMM_IND_U16Instruction extends BaseInstruction {
  // Consume gas first (Gray Paper: gas is always charged when execution is attempted)
  readonly opcode = OPCODES.STORE_IMM_IND_U16
  readonly name = 'STORE_IMM_IND_U16'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)
    const { registerA, immediateX, immediateY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = registerAValue + immediateX

    context.log(
      'STORE_IMM_IND_U16: Store 16-bit immediate to register + immediate address',
      {
        registerA,
        registerAValue,
        immediateX,
        address,
      },
    )

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IMM_IND_U16: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^16
    const value = immediateY & 0xffffn

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
        undefined, // No register for immediate stores
        value,
      )
    }

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 2),
    )
    if (faultAddress) {
      context.log('STORE_IMM_IND_U16: Memory write fault, returning FAULT')
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
 * STORE_IMM_IND_U32 instruction (opcode 0x72)
 * Store immediate to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X:4] = encode[4](immed_Y mod 2^32)
 */
export class STORE_IMM_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U32
  readonly name = 'STORE_IMM_IND_U32'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    // Format: [register, valueBytes...]
    const { registerA, immediateX, immediateY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = registerAValue + immediateX

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IMM_IND_U32: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^32
    const value = immediateY & 0xffffffffn

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
        undefined, // No register for immediate stores
        value,
      )
    }

    context.log(
      'STORE_IMM_IND_U32: Store 32-bit immediate to register + immediate address',
      {
        registerA,
        address,
        value,
      },
    )

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 4),
    )
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
 * STORE_IMM_IND_U64 instruction (opcode 0x73)
 * Store immediate to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X:8] = encode[8](immed_Y)
 */
export class STORE_IMM_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U64
  readonly name = 'STORE_IMM_IND_U64'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    const { registerA, immediateX, immediateY } =
      this.parseRegisterAndTwoImmediates(
        context.instruction.operands,
        context.fskip,
      )

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = registerAValue + immediateX

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < INIT_CONFIG.ZONE_SIZE) {
      context.log('STORE_IMM_IND_U64: Address < 2^16, returning PANIC')
      return {
        resultCode: RESULT_CODES.PANIC,
        faultInfo: {
          type: 'memory_write',
          address: address,
          details: 'Memory not writable',
        },
      }
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^64
    const value = immediateY & 0xffffffffffffffffn

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
        undefined, // No register for immediate stores
        value,
      )
    }

    const bytes = this.bigIntToBytesLE(value, 8)
    const faultAddress = context.ram.writeOctets(address, bytes)
    context.log(
      'STORE_IMM_IND_U64: Store 64-bit immediate to register + immediate address',
      {
        registerA,
        immediateX,
        immediateY,
        registerAValue,
        address,
        value,
        bytes: Array.from(bytes),
        faultAddress: faultAddress?.toString(),
        pc: context.pc,
      },
    )
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
