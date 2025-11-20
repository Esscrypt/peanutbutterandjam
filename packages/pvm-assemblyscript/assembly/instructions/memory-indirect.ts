/**
 * Indirect Memory Instructions
 *
 * STORE_IND and LOAD_IND variants - Store/Load to/from register + immediate address
 */

import {
  OPCODE_LOAD_IND_I8,
  OPCODE_LOAD_IND_I16,
  OPCODE_LOAD_IND_I32,
  OPCODE_LOAD_IND_U8,
  OPCODE_LOAD_IND_U16,
  OPCODE_LOAD_IND_U32,
  OPCODE_LOAD_IND_U64,
  OPCODE_STORE_IND_U8,
  OPCODE_STORE_IND_U16,
  OPCODE_STORE_IND_U32,
  OPCODE_STORE_IND_U64,
  RESULT_CODE_FAULT,
  RESULT_CODE_PANIC,
  ZONE_SIZE,
} from '../config'
import { InstructionContext, InstructionResult } from '../types'
import { BaseInstruction } from './base'

/**
 * STORE_IND_U8 instruction (opcode 0x120)
 * Store to register + immediate address as specified in Gray Paper
 *
 * Gray Paper pvm.tex formula:
 * mem'[reg_B + immed_X] = reg_A mod 2^8
 */
export class STORE_IND_U8Instruction extends BaseInstruction {
  opcode: i32 = OPCODE_STORE_IND_U8
  name: string = 'STORE_IND_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

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
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Write 8-bit value to memory
    const byteValue = registerAValue & u64(0xff)
    const encodedByteValue = this.bigIntToBytesLE(byteValue, 1)

    const writeResult = context.ram.writeOctets(u32(address), encodedByteValue)

    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IND_U16
  name: string = 'STORE_IND_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

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
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const value = registerAValue & u64(0xffff)
    const encodedValue = this.bigIntToBytesLE(value, 2)
    const writeResult = context.ram.writeOctets(u32(address), encodedValue)

    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IND_U32
  name: string = 'STORE_IND_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
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
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Write 32-bit value to memory (little-endian)
    const value = registerAValue & u64(0xffffffff)
    const encodedValue = this.bigIntToBytesLE(value, 4)
    const writeResult = context.ram.writeOctets(u32(address), encodedValue)

    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_STORE_IND_U64
  name: string = 'STORE_IND_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

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
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    // Check memory access - addresses < 2^16 cause PANIC
    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    const value = registerAValue & u64(0xffffffffffffffff)
    // Write 64-bit value to memory (little-endian)
    // Gray Paper: memwr[reg_B + immed_X:8] = encode[8]{reg_A}
    const encodedValue = this.bigIntToBytesLE(value, 8)

    const writeResult = context.ram.writeOctets(u32(address), encodedValue)
    if (writeResult.hasFault) {
      return new InstructionResult(RESULT_CODE_FAULT, writeResult.faultAddress)
    }

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_U8
  name: string = 'LOAD_IND_U8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 8-bit unsigned value from memory
    const readResult = context.ram.readOctets(u32(address), 1)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const byteValue = readResult.data![0]
    const value = u64(byteValue)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_I8
  name: string = 'LOAD_IND_I8'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 8-bit value from memory
    const readResult = context.ram.readOctets(u32(address), 1)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    // Gray Paper: reg'_A = unsigned{signedn{1}{memr_{\reg_B + \immed_X}}}
    // signedn{1}(x) = signfunc{1}(x) = x if x < 2^7, else x - 2^8
    const decodedValue = u64(readResult.data![0]) & u64(0xff)
    const signedValue = decodedValue < u64(0x80) ? i64(decodedValue) : i64(decodedValue) - i64(0x100)
    
    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    // unsigned{} = signedValue < 0 ? signedValue + 2^64 : signedValue
    // In AssemblyScript, casting i64 to u64 automatically handles two's complement conversion
    const unsignedValue = u64(signedValue)
    
    this.setRegisterValueWith64BitResult(context.registers, registerA, unsignedValue)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_U16
  name: string = 'LOAD_IND_U16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 16-bit unsigned value from memory (little-endian)
    const readResult = context.ram.readOctets(u32(address), 2)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }

    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_I16
  name: string = 'LOAD_IND_I16'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 16-bit value from memory (little-endian)
    const readResult = context.ram.readOctets(u32(address), 2)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    
    // Gray Paper: decode[2](mem[.]) - decode 2 bytes as little-endian
    const decodedValue = this.bytesToBigIntLE(readResult.data!) & u64(0xffff)
    
    // Gray Paper: reg'_A = unsigned{signedn{2}{decode[2](mem[reg_B + immed_X:2])}}
    // signedn{2}(x) = signfunc{2}(x) = x if x < 2^15, else x - 2^16
    const signedValue = decodedValue < u64(0x8000) ? i64(decodedValue) : i64(decodedValue) - i64(0x10000)
    
    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    // unsigned{} = signedValue < 0 ? signedValue + 2^64 : signedValue
    // In AssemblyScript, casting i64 to u64 automatically handles two's complement conversion
    const unsignedValue = u64(signedValue)
    
    this.setRegisterValueWith64BitResult(context.registers, registerA, unsignedValue)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_U32
  name: string = 'LOAD_IND_U32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX

    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 32-bit unsigned value from memory (little-endian)
    const readResult = context.ram.readOctets(u32(address), 4)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_I32
  name: string = 'LOAD_IND_I32'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 32-bit value from memory (little-endian)
    const readResult = context.ram.readOctets(u32(address), 4)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    
    // Gray Paper: decode[4](mem[.]) - decode 4 bytes as little-endian
    const decodedValue = this.bytesToBigIntLE(readResult.data!) & u64(0xffffffff)
    
    // Gray Paper: reg'_A = unsigned{signedn{4}{decode[4](mem[reg_B + immed_X:4])}}
    // signedn{4}(x) = signfunc{4}(x) = x if x < 2^31, else x - 2^32
    const signedValue = decodedValue < u64(0x80000000) ? i64(decodedValue) : i64(decodedValue) - i64(0x100000000)
    
    // Gray Paper: unsigned{} converts signed value back to unsigned 64-bit
    // unsigned{} = signedValue < 0 ? signedValue + 2^64 : signedValue
    // In AssemblyScript, casting i64 to u64 automatically handles two's complement conversion
    const unsignedValue = u64(signedValue)
    
    this.setRegisterValueWith64BitResult(context.registers, registerA, unsignedValue)

    return new InstructionResult(-1)
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
  opcode: i32 = OPCODE_LOAD_IND_U64
  name: string = 'LOAD_IND_U64'

  execute(context: InstructionContext): InstructionResult {
    const parseResult = this.parseTwoRegistersAndImmediate(
        context.operands,
        context.fskip,
      )
    const registerA = parseResult.registerA
    const registerB = parseResult.registerB
    const immediateX = parseResult.immediateX
    const registerBValue = this.getRegisterValueAs64(
      context.registers,
      registerB,
    )
    // Gray Paper: Address space is 32-bit, so truncate to 32 bits (mod 2^32)
    // This matches JUMP_IND behavior: (reg_A + immed_X) mod 2^32
    const address = u64((registerBValue + immediateX) & u64(0xffffffff))

    if (address < u64(ZONE_SIZE)) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Load 64-bit unsigned value from memory (little-endian)
    const readResult = context.ram.readOctets(u32(address), 8)
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new InstructionResult(RESULT_CODE_FAULT)
    }
    const value = this.bytesToBigIntLE(readResult.data!)
    this.setRegisterValueWith64BitResult(context.registers, registerA, value)

    return new InstructionResult(-1)
  }
}
