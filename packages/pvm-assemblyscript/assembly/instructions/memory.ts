/**
 * Memory Instructions
 *
 * LOAD_IMM_64, STORE_IMM variants, LOAD/STORE variants
 */

import {
  OPCODE_LOAD_I8,
  OPCODE_LOAD_I16,
  OPCODE_LOAD_I32,
  OPCODE_LOAD_IMM,
  OPCODE_LOAD_IMM_64,
  OPCODE_LOAD_U8,
  OPCODE_LOAD_U16,
  OPCODE_LOAD_U32,
  OPCODE_LOAD_U64,
  OPCODE_STORE_IMM_IND_U8,
  OPCODE_STORE_IMM_IND_U16,
  OPCODE_STORE_IMM_IND_U32,
  OPCODE_STORE_IMM_IND_U64,
  OPCODE_STORE_IMM_U8,
  OPCODE_STORE_IMM_U16,
  OPCODE_STORE_IMM_U32,
  OPCODE_STORE_IMM_U64,
  OPCODE_STORE_U8,
  OPCODE_STORE_U16,
  OPCODE_STORE_U32,
  OPCODE_STORE_U64,
  RESULT_CODE_FAULT,
  RESULT_CODE_PANIC,
  ZONE_SIZE,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * LOAD_IMM_64 instruction (opcode 0x20)
 * Load 64-bit immediate into register as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * reg'_A = immed_X
 */
export class LOAD_IMM_64Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_LOAD_IMM_64
  name: string = 'LOAD_IMM_64'

  execute(context: InstructionContext): InstructionResult {
    // Gray Paper: Instructions with Arguments of One Register and One Extended Width Immediate
    // r_A = min(12, instructions[ι+1] mod 16)
    // immed_X = decode[8]{instructions[ι+2:8]} - decode 8 bytes as unsigned (no sign extension)
    const registerA = this.getRegisterIndex(context.operands[0])
    
    // Read 8 bytes (64 bits) as unsigned little-endian
    // Gray Paper: decode[8] means read 8 bytes without sign extension
    let immediateX: u64 = u64(0)
    for (let i = 0; i < 8 && (1 + i) < context.operands.length; i++) {
      immediateX |= u64(context.operands[1 + i]) << u64(i * 8)
    }

    this.setRegisterValue(context.registers, registerA, immediateX)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_U8
  name: string = 'STORE_IMM_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoImmediates(context.operands, context.fskip)
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // mem'[immed_X] = immed_Y mod 2^8
    const value = immediateY & u64(0xff)

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 1),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, u32(writeResult.faultAddress))
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_U16
  name: string = 'STORE_IMM_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoImmediates(context.operands, context.fskip)
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // mem'[immed_X:2] = encode[2](immed_Y mod 2^16)
    const value = immediateY & u64(0xffff)

    const writeResult = context.ram.writeOctets(
      u32(immediateX),
      this.bigIntToBytesLE(value, 2),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_U32
  name: string = 'STORE_IMM_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoImmediates(context.operands, context.fskip)
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // mem'[immed_X:4] = encode[4](immed_Y mod 2^32)
    const value = immediateY & u64(0xffffffff)

    const writeResult = context.ram.writeOctets(
      u32(immediateX),
      this.bigIntToBytesLE(value, 4),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_U64
  name: string = 'STORE_IMM_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoImmediates(context.operands, context.fskip)
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    // mem'[immed_X:8] = encode[8](immed_Y)
    // No modulo for U64 - use full 64-bit value

    const writeResult = context.ram.writeOctets(
      u32(immediateX),
      this.bigIntToBytesLE(immediateY, 8),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IMM
  name: string = 'LOAD_IMM'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    this.setRegisterValue(context.registers, registerA, immediateX)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_U8
  name: string = 'LOAD_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediateUnsigned(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    const readResult = context.ram.readOctets(u32(immediateX), 1)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    // Gray Paper: decode[1] reads a single byte - no endianness conversion needed
    // For single-byte values, bytesToBigIntLE is redundant; direct access is more efficient
    const value = u64(readResult.data![0])
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_I8
  name: string = 'LOAD_I8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediateUnsigned(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    const readResult = context.ram.readOctets(u32(immediateX), 1)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const value = this.signExtend(this.bytesToBigIntLE(readResult.data!), 1)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_U16
  name: string = 'LOAD_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediateUnsigned(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    const readResult = context.ram.readOctets(u32(immediateX), 2)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_I16
  name: string = 'LOAD_I16'

  execute(context: InstructionContext): InstructionResult {
    // Step 1: Parse operands
    const parseResult = this.parseOneRegisterAndImmediateUnsigned(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    // Step 2: Convert address (TypeScript version doesn't check ZONE_SIZE for LOAD_I16)
    const address = u32(immediateX)
    
    // Step 3: Read from memory
    const readResult = context.ram.readOctets(address, 2)
    
    // Step 4: Check for faults
    if (readResult.faultAddress !== 0) {
      // Memory fault - return early
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    if (readResult.data === null) {
      // No data returned - return early
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    
    // Step 5: Read 16-bit value as little-endian and sign extend
    const rawValue = this.bytesToBigIntLE(readResult.data!)
    const value = this.signExtend(rawValue, 2)
    
    // Step 6: Update register (this should work with reference)
    this.setRegisterValue(context.registers, registerA, value)

    // Step 7: Return continue
    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_U32
  name: string = 'LOAD_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediateUnsigned(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    if (immediateX < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }
    const readResult = context.ram.readOctets(u32(immediateX), 4)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_I32
  name: string = 'LOAD_I32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const readResult = context.ram.readOctets(u32(address), 4)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    const value = this.signExtend(this.bytesToBigIntLE(readResult.data!), 4)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_U64
  name: string = 'LOAD_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const readResult = context.ram.readOctets(u32(immediateX), 8)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_U8
  name: string = 'STORE_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const value = this.getRegisterValueAs64(context.registers, registerA) & u64(0xff)

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const encodedValue = this.bigIntToBytesLE(value, 1)
    const writeResult = context.ram.writeOctets(u32(address), encodedValue)

    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_U16
  name: string = 'STORE_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const value = this.getRegisterValueAs64(context.registers, registerA) & u64(0xffff)

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 2),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_U32
  name: string = 'STORE_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const value = this.getRegisterValueAs64(context.registers, registerA) & u64(0xffffffff)

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 4),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_U64
  name: string = 'STORE_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseOneRegisterAndImmediate(context.operands, context.fskip)
    const registerA: u8 = parseResult.registerA
    const immediateX = parseResult.immediateX
    const value = this.getRegisterValueAs64(context.registers, registerA)

    // Cast signed immediate to unsigned address (mask to 32 bits)
    const address = u64(immediateX) & u64(0xffffffff)
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 8),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_IND_U8
  name: string = 'STORE_IMM_IND_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY
    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    // Convert signed i64 immediate to u64 for address calculation
    // Address space is 32-bit, so mask to 32 bits after addition
    const address = (registerAValue + u64(immediateX)) & u64(0xffffffff)

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^8
    const value = immediateY & u64(0xff)

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 1),
    )

    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_IND_U16
  name: string = 'STORE_IMM_IND_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    // Convert signed i64 immediate to u64 for address calculation
    // Address space is 32-bit, so mask to 32 bits after addition
    const address = (registerAValue + u64(immediateX)) & u64(0xffffffff)

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^16
    const value = immediateY & u64(0xffff)

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 2),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_IND_U32
  name: string = 'STORE_IMM_IND_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    const address = (registerAValue + u64(immediateX)) & u64(0xffffffff)

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^32
    const value = immediateY & u64(0xffffffff)

    const writeResult = context.ram.writeOctets(
      u32(address),
      this.bigIntToBytesLE(value, 4),
    )
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, u32(writeResult.faultAddress))
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IMM_IND_U64
  name: string = 'STORE_IMM_IND_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseRegisterAndTwoImmediates(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const immediateX = parseResult.immediateX
    const immediateY = parseResult.immediateY

    const registerAValue = this.getRegisterValueAs64(
      context.registers,
      registerA,
    )
    // Convert signed i64 immediate to u64 for address calculation
    // Address space is 32-bit, so mask to 32 bits after addition
    const address = (registerAValue + u64(immediateX)) & u64(0xffffffff)

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // mem'[reg_A + immed_X] = immed_Y mod 2^64
    const value = immediateY & u64(0xffffffffffffffff)

    const bytes = this.bigIntToBytesLE(value, 8)
    const writeResult = context.ram.writeOctets(u32(address), bytes)
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, u32(writeResult.faultAddress))
    }

    return new InstructionResult(-1)
  }
}

