/**
 * Memory Instructions
 *
 * LOAD_IMM_64, STORE_IMM variants, LOAD/STORE variants
 */

import { logger } from '@pbnj/core'
import type { InstructionContext, InstructionResult } from '@pbnj/types'
import { OPCODES, RESULT_CODES } from '../config'
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
    // immed_X = decode[8]{instructions[ι+2:8]}
    const registerA = this.getRegisterA(context.instruction.operands)
    const immediateX = this.getImmediateValue(
      context.instruction.operands,
      1,
      8,
    )

    console.log('LOAD_IMM_64: Executing instruction', { registerA, immediateX })
    this.setRegisterValue(context.registers, registerA, immediateX)

    console.log('LOAD_IMM_64: After setting register', {
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

    console.log('STORE_IMM_U8: Writing value to memory', {
      immediateX,
      value,
    })
    if (immediateX < 65536n) {
      console.log('STORE_IMM_U8: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }

    const faultAddress = context.ram.writeOctets(immediateX, this.bigIntToBytesLE(value, 1))
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
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
    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 2),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
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
    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 4),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
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
    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(immediateY, 8),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
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
  readonly description = 'Load immediate into register'

  execute(context: InstructionContext): InstructionResult {
    console.log('LOAD_IMM: Starting execution')
    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )

    console.log('LOAD_IMM: Parsed values', { registerA, immediateX })
    logger.debug('Executing LOAD_IMM instruction', { registerA, immediateX })
    this.setRegisterValue(context.registers, registerA, immediateX)

    console.log('LOAD_IMM: After setting register', {
      registerA,
      immediateX,
      registerValue: context.registers[registerA],
    })

    // Mutate context directly

    return { resultCode: null }
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

    logger.debug('Executing LOAD_U8 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 1n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    // Mutate context directly

    return { resultCode: null }
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

    logger.debug('Executing LOAD_I8 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 1n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }

    const value = this.signExtend(this.bytesToBigIntLE(bytes), 1)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

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

    logger.debug('Executing LOAD_U16 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 2n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

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

    logger.debug('Executing LOAD_I16 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 2n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 2)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

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

    logger.debug('Executing LOAD_U32 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 4n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }

    const value = this.bytesToBigIntLE(bytes)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

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

    logger.debug('Executing LOAD_I32 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 4n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }
    const value = this.signExtend(this.bytesToBigIntLE(bytes), 4)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)
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

    logger.debug('Executing LOAD_U64 instruction', { registerA, immediateX })

    const [bytes, faultAddress] = context.ram.readOctets(immediateX, 8n)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: faultAddress, details: 'Memory not readable' } }
    }
    if (!bytes) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_read', address: immediateX, details: 'Memory not readable' } }
    }
    this.setRegisterValueWith64BitResult(
      context.registers,
      registerA,
      this.bytesToBigIntLE(bytes),
    )

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
  readonly description = 'Store unsigned 8-bit to memory'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)

    const { registerA, immediateX } = this.parseOneRegisterAndImmediate(
      context.instruction.operands,
      context.fskip,
    )
    const value =
      this.getRegisterValueAs64(context.registers, registerA) % 2n ** 8n

    logger.debug('Executing STORE_U8 instruction', {
      registerA,
      immediateX,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      immediateX,
      new Uint8Array([Number(value)]),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

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

    logger.debug('Executing STORE_U16 instruction', {
      registerA,
      immediateX,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 2),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

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

    logger.debug('Executing STORE_U32 instruction', {
      registerA,
      address,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 4),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

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

    console.log('Executing STORE_U64 instruction', {
      registerA,
      immediateX,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      immediateX,
      this.bigIntToBytesLE(value, 8),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

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

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }


    const value = immediateY & 0xffn

    console.log('Executing STORE_IMM_IND_U8 instruction', {
      registerA,
      registerAValue,
      address,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 1),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

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
  readonly description =
    'Store immediate to register + immediate address (16-bit)'

  execute(context: InstructionContext): InstructionResult {
    // Consume gas first (Gray Paper: gas is always charged when execution is attempted)
    console.log('STORE_IMM_IND_U16: Starting execution', {
      operands: Array.from(context.instruction.operands),
      fskip: context.fskip,
    })
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

    console.log('STORE_IMM_IND_U16: Address calculation', {
      registerA,
      registerAValue,
      immediateX,
      address,
    })

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < 65536n) {
      console.log('STORE_IMM_IND_U16: Address < 2^16, returning PANIC')
      return { resultCode: RESULT_CODES.PANIC }
    }


    // mem'[reg_A + immed_X] = immed_Y mod 2^16
    const value = immediateY & 0xffffn

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 2),
    )
    if (faultAddress) {
      console.log('STORE_IMM_IND_U16: Memory write error, returning FAULT')
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

    return { resultCode: null }
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
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X:4] = encode[4](immed_Y mod 2^32)
 */
export class STORE_IMM_IND_U32Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U32
  readonly name = 'STORE_IMM_IND_U32'
  readonly description =
    'Store immediate to register + immediate address (32-bit)'

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
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^32
    const value = immediateY & 0xffffffffn

    logger.debug('Executing STORE_IMM_IND_U32 instruction', {
      registerA,
      address,
      value,
    })

    const faultAddress = context.ram.writeOctets(
      address,
      this.bigIntToBytesLE(value, 4),
    )
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

    return { resultCode: null }
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
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_A + immed_X:8] = encode[8](immed_Y)
 */
export class STORE_IMM_IND_U64Instruction extends BaseInstruction {
  readonly opcode = OPCODES.STORE_IMM_IND_U64
  readonly name = 'STORE_IMM_IND_U64'
  readonly description =
    'Store immediate to register + immediate address (64-bit)'

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
    if (address < 65536n) {
      return { resultCode: RESULT_CODES.PANIC }
    }


    // mem'[reg_A + immed_X] = immed_Y mod 2^64
    const value = immediateY & 0xffffffffffffffffn

    logger.debug('Executing STORE_IMM_IND_U64 instruction', {
      registerA,
      immediateX,
      immediateY,
      registerAValue,
      address,
      value,
    })

    const bytes = this.bigIntToBytesLE(value, 8)
    const faultAddress = context.ram.writeOctets(address, bytes)
    if (faultAddress) {
      return { resultCode: RESULT_CODES.FAULT, faultInfo: { type: 'memory_write', address: faultAddress, details: 'Memory not writable' } }
    }

    return { resultCode: null }
  }

  disassemble(operands: Uint8Array): string {
    const registerA = this.getRegisterA(operands)
    const immediateX = this.getImmediateValue(operands, 1)
    const immediateY = this.getImmediateValue(operands, 2)
    return `${this.name} r${registerA} ${immediateX} ${immediateY}`
  }
}
