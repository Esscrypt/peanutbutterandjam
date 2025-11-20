/**
 * Base PVM Instruction System (AssemblyScript)
 *
 * Defines the base interfaces and class for all PVM instructions.
 */

import { isTerminationInstruction, RESULT_CODE_PANIC } from '../config'
import { bytesToHex, InstructionContext, InstructionResult, RegisterState } from '../types'

/**
 * Result class for parseRegisterAndOneImmediate
 */
export class RegisterAndImmediateResult {
  registerA: u8
  immediateX: i64
  
  constructor(registerA: u8, immediateX: i64) {
    this.registerA = registerA
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseTwoRegistersAndImmediate (with length)
 */
export class TwoRegistersAndImmediateWithLengthResult {
  registerA: u8
  registerB: u8
  lengthX: i32
  immediateX: i64
  
  constructor(registerA: u8, registerB: u8, lengthX: i32, immediateX: i64) {
    this.registerA = registerA
    this.registerB = registerB
    this.lengthX = lengthX
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseTwoRegistersAndImmediate (simple)
 */
export class TwoRegistersAndImmediateResult {
  registerA: u8
  registerB: u8
  immediateX: i64
  
  constructor(registerA: u8, registerB: u8, immediateX: i64) {
    this.registerA = registerA
    this.registerB = registerB
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseBranchOperands
 */
export class BranchOperandsResult {
  registerA: u8
  immediateX: i64
  offset: i64
  targetAddress: u32
  
  constructor(registerA: u8, immediateX: i64, offset: i64, targetAddress: u32) {
    this.registerA = registerA
    this.immediateX = immediateX
    this.offset = offset
    this.targetAddress = targetAddress
  }
}

/**
 * Result class for parseRegisterBranchOperands
 */
export class RegisterBranchOperandsResult {
  registerA: u8
  registerB: u8
  offset: i64
  targetAddress: u32
  
  constructor(registerA: u8, registerB: u8, offset: i64, targetAddress: u32) {
    this.registerA = registerA
    this.registerB = registerB
    this.offset = offset
    this.targetAddress = targetAddress
  }
}

/**
 * Result class for parseRegisterAndTwoImmediates (with lengths)
 */
export class RegisterAndTwoImmediatesWithLengthsResult {
  registerA: u8
  lengthX: i32
  immediateX: i64
  lengthY: i32
  immediateY: i64
  
  constructor(registerA: u8, lengthX: i32, immediateX: i64, lengthY: i32, immediateY: i64) {
    this.registerA = registerA
    this.lengthX = lengthX
    this.immediateX = immediateX
    this.lengthY = lengthY
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseRegisterAndTwoImmediates (simple)
 */
export class RegisterAndTwoImmediatesResult {
  registerA: u8
  immediateX: i64
  immediateY: i64
  
  constructor(registerA: u8, immediateX: i64, immediateY: i64) {
    this.registerA = registerA
    this.immediateX = immediateX
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseTwoRegistersAndTwoImmediates (with lengths)
 */
export class TwoRegistersAndTwoImmediatesWithLengthsResult {
  registerA: u8
  registerB: u8
  lengthX: i32
  immediateX: i64
  lengthY: i32
  immediateY: i64
  
  constructor(registerA: u8, registerB: u8, lengthX: i32, immediateX: i64, lengthY: i32, immediateY: i64) {
    this.registerA = registerA
    this.registerB = registerB
    this.lengthX = lengthX
    this.immediateX = immediateX
    this.lengthY = lengthY
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseTwoRegistersAndTwoImmediates (simple)
 */
export class TwoRegistersAndTwoImmediatesResult {
  registerA: u8
  registerB: u8
  immediateX: i64
  immediateY: i64
  
  constructor(registerA: u8, registerB: u8, immediateX: i64, immediateY: i64) {
    this.registerA = registerA
    this.registerB = registerB
    this.immediateX = immediateX
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseTwoImmediates (with lengths)
 */
export class TwoImmediatesWithLengthsResult {
  lengthX: i32
  immediateX: i64
  lengthY: i32
  immediateY: i64
  
  constructor(lengthX: i32, immediateX: i64, lengthY: i32, immediateY: i64) {
    this.lengthX = lengthX
    this.immediateX = immediateX
    this.lengthY = lengthY
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseTwoImmediates (simple)
 */
export class TwoImmediatesResult {
  immediateX: i64
  immediateY: i64
  
  constructor(immediateX: i64, immediateY: i64) {
    this.immediateX = immediateX
    this.immediateY = immediateY
  }
}

/**
 * Result class for parseRegisterAndImmediateUnsigned
 */
export class RegisterAndImmediateUnsignedResult {
  registerA: u8
  immediateX: u64
  
  constructor(registerA: u8, immediateX: u64) {
    this.registerA = registerA
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseTwoRegistersAndOffset
 */
export class TwoRegistersAndOffsetResult {
  registerA: u8
  registerB: u8
  targetAddress: u32
  
  constructor(registerA: u8, registerB: u8, targetAddress: u32) {
    this.registerA = registerA
    this.registerB = registerB
    this.targetAddress = targetAddress
  }
}

/**
 * Result class for parseOffsetOnly
 */
export class OffsetOnlyResult {
  targetAddress: u32
  
  constructor(targetAddress: u32) {
    this.targetAddress = targetAddress
  }
}

/**
 * Result class for parseTwoRegisters
 */
export class TwoRegistersResult {
  registerD: u8
  registerA: u8
  
  constructor(registerD: u8, registerA: u8) {
    this.registerD = registerD
    this.registerA = registerA
  }
}

/**
 * Result class for parseOneRegisterAndImmediate (with length) - signed immediate
 */
export class OneRegisterAndImmediateWithLengthResult {
  registerA: u8
  lengthX: i32
  immediateX: i64
  
  constructor(registerA: u8, lengthX: i32, immediateX: i64) {
    this.registerA = registerA
    this.lengthX = lengthX
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseOneRegisterAndImmediateUnsigned (with length) - unsigned immediate
 */
export class OneRegisterAndImmediateWithLengthUnsignedResult {
  registerA: u8
  lengthX: i32
  immediateX: u64
  
  constructor(registerA: u8, lengthX: i32, immediateX: u64) {
    this.registerA = registerA
    this.lengthX = lengthX
    this.immediateX = immediateX
  }
}

/**
 * Result class for parseOneRegisterAndImmediate (D and A registers)
 */
export class OneRegisterAndImmediateResult {
  registerD: u8
  registerA: u8
  immediateX: i64
  
  constructor(registerD: u8, registerA: u8, immediateX: i64) {
    this.registerD = registerD
    this.registerA = registerA
    this.immediateX = immediateX
  }
}

/**
 * Base interface for all PVM instruction handlers
 *
 * Gray Paper Reference: pvm.tex section 7.1-7.3
 */
export interface PVMInstructionHandler {
  opcode: i32
  name: string

  /**
   * Execute the instruction (mutates context in place)
   * @returns resultCode (null = continue, otherwise halt/panic/etc)
   */
  execute(context: InstructionContext): InstructionResult

  /**
   * Validate instruction operands
   */
  validate(operands: Uint8Array): boolean

  /**
   * Disassemble instruction to string representation
   */
  disassemble(operands: Uint8Array): string
}

/**
 * Abstract base class for PVM instructions
 * Implements Gray Paper instruction patterns
 */
export class BaseInstruction implements PVMInstructionHandler {
  opcode: i32 = 0
  name: string = ''

  /**
   * Get register index from operand byte (Gray Paper pattern)
   * r_A = min(12, operand_byte mod 16)
   */
  getRegisterIndex(operandByte: u8): u8 {
    return min(12, operandByte & 0x0f) as u8 // Low nibble
  }

  /**
   * Get register A from first operand byte (low nibble)
   * Test vector format: operands[0] = (B << 4) | A
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  getRegisterA(operands: Uint8Array): u8 {
    return this.getRegisterIndex(operands[0])
  }

  /**
   * Get immediate X length from high nibble of first operand byte
   * Used in branch instructions with variable-length immediates
   * Gray Paper: l_X = min(4, (operands[0] >> 4) & 0x07)
   */
  getImmediateLengthX(operands: Uint8Array): i32 {
    return min(4, i32((operands[0] >> 4) & 0x07))
  }

  /**
   * Get immediate X length from low 3 bits of first operand byte
   * Used in two-immediate instructions (STORE_IMM_* opcodes 30-33)
   * Gray Paper pvm.tex §7.4.4 line 288: l_X = min(4, instructions[ι+1] mod 8)
   */
  getImmediateLengthXFromLowBits(operands: Uint8Array): i32 {
    return min(4, i32(operands[0] & 0x07))
  }

  /**
   * Parse one register and two immediate operands according to Gray Paper §7.4.6
   * Used by opcodes 70-73 (STORE_IMM_IND_U8/U16/U32/U64)
   *
   * Gray Paper pvm.tex §7.4.6 lines 360-368:
   * - r_A = min(12, operands[0] mod 16)
   * - l_X = min(4, ⌊operands[0]/16⌋ mod 8)
   * - immed_X = sext(l_X, decode[l_X](operands[1:l_X]))
   * - l_Y = min(4, max(0, ℓ - l_X - 1))
   * - immed_Y = sext(l_Y, decode[l_Y](operands[1+l_X:l_Y]))
   *
   * Where: ℓ = Fskip(ι) = skip distance
   */
  /**
   * Parse "One Register & One Immediate" format (Gray Paper Format 1)
   * Used by opcodes 50-53, 70-73
   * r_A = min(12, instructions[ι+1] mod 16)
   * l_X = min(4, max(0, ℓ - 1))
   * immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
   */
  parseRegisterAndOneImmediate(
    operands: Uint8Array,
    fskip: i32,
  ): RegisterAndImmediateResult {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterIndex(operands[0])

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = min(4, max(0, fskip - 1))

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return new RegisterAndImmediateResult(registerA, immediateX)
  }

  /**
   * Parse "One Register, One Immediate and One Offset" format (Gray Paper Format 2)
   * Used by opcodes 80+
   * r_A = min(12, instructions[ι+1] mod 16)
   * l_X = min(4, floor(instructions[ι+1]/16) mod 8)
   * immed_X = sext{l_X}{decode[l_X]{instructions[ι+2:l_X]}}
   * l_Y = min(4, max(0, ℓ - l_X - 1))
   * immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
   */
  parseRegisterAndTwoImmediates(
    operands: Uint8Array,
    fskip: i32,
  ): RegisterAndTwoImmediatesWithLengthsResult {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterIndex(operands[0])

    // l_X = min(4, ⌊operands[0]/16⌋ mod 8) - HIGH nibble bits 4-6
    const lengthX = min(4, i32((operands[0] >> 4) & 0x07))

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = min(4, max(0, fskip - lengthX - 1))

    // immed_Y starts after immed_X
    const immediateY = this.getImmediateValue(operands, 1 + lengthX, lengthY)

    return new RegisterAndTwoImmediatesWithLengthsResult(registerA, lengthX, immediateX, lengthY, immediateY)
  }

  /**
   * Parse "Two Registers and Two Immediates" format (Gray Paper Format 5)
   * Used by opcode 180 (LOAD_IMM_JUMP_IND)
   * r_A = min(12, (instructions[ι+1]) mod 16)
   * r_B = min(12, ⌊instructions[ι+1]/16⌋)
   * l_X = min(4, instructions[ι+2] mod 8)
   * immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
   * l_Y = min(4, max(0, ℓ - l_X - 2))
   * immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
   */
  parseTwoRegistersAndTwoImmediates(
    operands: Uint8Array,
    fskip: i32,
  ): TwoRegistersAndTwoImmediatesWithLengthsResult {
    // r_A = min(12, (instructions[ι+1]) mod 16)
    const registerA = this.getRegisterIndex(operands[0])

    // r_B = min(12, ⌊instructions[ι+1]/16⌋)
    const registerB = this.getRegisterB(operands)

    // l_X = min(4, instructions[ι+2] mod 8)
    const lengthX = min(4, i32(operands[1] & 0x07))

    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
    const immediateX = this.getImmediateValue(operands, 2, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 2))
    const lengthY = min(4, max(0, fskip - lengthX - 2))

    // immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
    const immediateY = this.getImmediateValue(operands, 2 + lengthX, lengthY)

    return new TwoRegistersAndTwoImmediatesWithLengthsResult(registerA, registerB, lengthX, immediateX, lengthY, immediateY)
  }

  /**
   * Parse two immediate operands (no register)
   * Gray Paper pvm.tex §7.4.4 lines 286-291:
   * - l_X = min(4, instructions[ι+1] mod 8)
   * - immed_X = sext(l_X, decode[l_X](instructions[ι+2:l_X]))
   * - l_Y = min(4, max(0, ℓ - l_X - 1))
   * - immed_Y = sext(l_Y, decode[l_Y](instructions[ι+2+l_X:l_Y]))
   *
   * Used by opcodes 30-33 (STORE_IMM_U8/U16/U32/U64)
   * @param skip - Skip distance (default: 1 for test vectors with all-1s bitmask)
   */
  parseTwoImmediates(
    operands: Uint8Array,
    fskip: i32,
  ): TwoImmediatesWithLengthsResult {
    // FIX: Use low 3 bits instead of high nibble
    const lengthX = min(4, i32(operands[0] & 0x07)) // mod 8 = low 3 bits

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = min(4, max(0, fskip - lengthX - 1))

    // immed_Y starts after immed_X
    const immediateY = this.getImmediateValue(operands, 1 + lengthX, lengthY)

    return new TwoImmediatesWithLengthsResult(lengthX, immediateX, lengthY, immediateY)
  }

  /**
   * Parse one register and one immediate according to Gray Paper §7.4.5
   * Used by opcodes with one register + one immediate pattern
   *
   * Gray Paper pvm.tex §7.4.5 lines 329-333:
   * - r_A = min(12, operands[0] mod 16)
   * - l_X = min(4, max(0, ℓ - 1))
   * - immed_X = sext(l_X, decode[l_X](operands[1:l_X]))
   *
   * Where: ℓ = Fskip(ι) = skip distance
   */
  parseOneRegisterAndImmediate(
    operands: Uint8Array,
    fskip: i32,
  ): OneRegisterAndImmediateWithLengthResult {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterIndex(operands[0])

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = min(4, max(0, fskip - 1))

    // immed_X starts at operands[1], sign-extended
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return new OneRegisterAndImmediateWithLengthResult(registerA, lengthX, immediateX)
  }

  parseOneRegisterAndImmediateUnsigned(
    operands: Uint8Array,
    fskip: i32,
  ): OneRegisterAndImmediateWithLengthUnsignedResult {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterIndex(operands[0])

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = min(4, max(0, fskip - 1))

    // immed_X starts at operands[1], unsigned
    const immediateX = this.getImmediateValueUnsigned(operands, 1, lengthX)

    return new OneRegisterAndImmediateWithLengthUnsignedResult(registerA, lengthX, immediateX)
  }

  /**
   * Get immediate X length from high nibble bits 4-6 of first operand byte
   * Used in one register + two immediate instructions (STORE_IMM_IND_* opcodes 70-73)
   * Gray Paper pvm.tex §7.4.6 line 365: l_X = min(4, ⌊operands[0]/16⌋ mod 8)
   */
  getImmediateLengthXFromHighBits(operands: Uint8Array): i32 {
    return min(4, i32((operands[1] >> 4) & 0x07))
  }

  /**
   * Parse two registers and one immediate according to Gray Paper §7.4.9
   * Used by opcodes 120-299 (Two Registers & One Immediate pattern)
   *
   * Operand format (lines 462-469):
   * - operands[0]: r_A (low 4 bits) + r_B (high 4 bits)
   * - operands[1:1+l_X]: immed_X (sign-extended)
   *
   * Where: l_X = min(4, max(0, ℓ - 1))
   */
  parseTwoRegistersAndImmediate(
    operands: Uint8Array,
    fskip: i32,
  ): TwoRegistersAndImmediateWithLengthResult {
    // r_A from low 4 bits, r_B from high 4 bits
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = min(4, max(0, fskip - 1))

    // immed_X starts at operands[1], sign-extended
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return new TwoRegistersAndImmediateWithLengthResult(registerA, registerB, lengthX, immediateX)
  }

  /**
   * Parse branch instruction operands (One Register, One Immediate, One Offset)
   * Returns: {registerA, immediateX, offset, targetAddress}
   * Gray Paper pvm.tex line 394: immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
   * 
   * signfunc{n}(a) = { a if a < 2^{8-1}, a - 2^{8} otherwise }
   */
  parseBranchOperands(
    operands: Uint8Array,
    currentPC: u32,
  ): BranchOperandsResult {
    const registerA = this.getRegisterIndex(operands[0])
    const lengthX = this.getImmediateLengthX(operands)
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // Offset Y starts after immediate X
    // Gray Paper: l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = min(4, max(0, i32(operands.length) - lengthX - 1))
    
    // Read offset as unsigned first
    const rawOffset_u64 = this.getImmediateValueUnsigned(operands, 1 + lengthX, lengthY)
    const rawOffset = i64(rawOffset_u64)
    
    // Apply Gray Paper signfunc: signfunc{n}(a) = { a if a < 2^{8-1}, a - 2^{8} otherwise }
    // This converts unsigned value to signed in range [-2^{8-1}, 2^{8-1}-1]
    const signBitPosition = i64(8 * lengthY - 1)
    const signBit = lengthY > 0 ? i64((rawOffset >> signBitPosition) & i64(1)) : i64(0)
    const offset =
      signBit === i64(0) ? rawOffset : rawOffset - (i64(1) << i64(8 * lengthY))

    // Calculate target address: immed_Y = ι + signfunc{l_Y}(offset)
    const targetAddress = u32(i32(currentPC) + i32(offset))

    return new BranchOperandsResult(registerA, immediateX, offset, targetAddress)
  }

  /**
   * Get immediate value as unsigned 64-bit integer (no sign extension)
   * Used for unsigned comparisons and operations
   */
  getImmediateValueUnsigned(
    operands: Uint8Array,
    startIndex: i32,
    length: i32,
  ): u64 {
    // Determine how many bytes to read
    const bytesToRead = length > 0 ? length : min(4, i32(operands.length) - startIndex)
    const end = min(i32(operands.length), startIndex + bytesToRead)

    if (end <= startIndex) return u64(0)

    // Read little-endian bytes (no sign extension) as unsigned
    let value = u64(0)
    for (let i = startIndex; i < end; i++) {
      value |= u64(operands[i]) << u64((i - startIndex) * 8)
    }

    return value
  }
  
  signedCompare(a: i64, b: i64): i32 {
    const signedA = this.toSigned64(a)
    const signedB = this.toSigned64(b)

    if (signedA < signedB) return -1
    if (signedA > signedB) return 1
    return 0
  }

  /**
   * Parse register-to-register branch operands (Two Registers & One Offset)
   * Returns: {registerA, registerB, targetAddress}
   * Gray Paper pvm.tex line 541: immed_X = ι + signfunc{l_X}(decode[l_X]{getctions[ι+2:l_X]})
   * 
   * signfunc{n}(a) = { a if a < 2^{8-1}, a - 2^{8} otherwise }
   */
  parseRegisterBranchOperands(
    operands: Uint8Array,
    currentPC: u32,
  ): RegisterBranchOperandsResult {
    const registerA = this.getRegisterIndex(operands[0])
    const registerB = this.getRegisterB(operands)

    // Gray Paper: l_X = min(4, max(0, ℓ - 1))
    // Offset starts at operands[1] (after register byte at ι+1, so offset is at ι+2)
    const lengthX = min(4, max(0, i32(operands.length) - 1))
    
    // Read offset as unsigned first
    const rawOffset_u64 = this.getImmediateValueUnsigned(operands, 1, lengthX)
    const rawOffset = i64(rawOffset_u64)
    
    // Apply Gray Paper signfunc: signfunc{n}(a) = { a if a < 2^{8-1}, a - 2^{8} otherwise }
    // This converts unsigned value to signed in range [-2^{8-1}, 2^{8-1}-1]
    const signBitPosition = i64(8 * lengthX - 1)
    const signBit = lengthX > 0 ? i64((rawOffset >> signBitPosition) & i64(1)) : i64(0)
    const offset =
      signBit === i64(0) ? rawOffset : rawOffset - (i64(1) << i64(8 * lengthX))

    // Calculate target address: immed_X = ι + signfunc{l_X}(offset)
    const targetAddress = u32(i32(currentPC) + i32(offset))

    return new RegisterBranchOperandsResult(registerA, registerB, offset, targetAddress)
  }

  /**
   * Parse one offset operand according to Gray Paper formula
   * Used by JUMP instruction (opcode 0x40)
   *
   * Gray Paper pvm.tex §7.4.3 lines 308-314:
   * \using l_X = \min(4, \ell) \,,\quad
   * \immed_X \equiv \imath + \signfunc{l_X}(\decode[l_X]{\instructions\subrange{\imath+1}{l_X}})
   *
   * @param operands The operand bytes (starting from ι+1)
   * @param fskip The skip distance (ℓ)
   * @param currentPC The current program counter (ι)
   * @returns The target address (immed_X)
   */
  parseOneOffset(
    operands: Uint8Array,
    fskip: i32,
    currentPC: u32,
  ): u32 {
    // l_X = min(4, ℓ)
    const lengthX = min(4, fskip)

    // Read the offset bytes starting from operands[0] (which is ι+1)
    // Gray Paper: \signfunc{l_X}(\decode[l_X]{\instructions\subrange{\imath+1}{l_X}})
    const rawOffset_u64 = this.getImmediateValueUnsigned(operands, 0, lengthX)
    const rawOffset = i64(rawOffset_u64)

    // Apply Gray Paper sign function: \signfunc{l_X}
    // signfunc{n}(a) = { a if a < 2^{8-1}, a - 2^{8} otherwise }
    const signBitPosition = i64(8 * lengthX - 1)
    const signBit = i64((rawOffset >> signBitPosition) & i64(1))
    const offset =
      signBit === i64(0) ? rawOffset : rawOffset - (i64(1) << i64(8 * lengthX))

    // Calculate target address: immed_X = ι + signfunc{l_X}(offset)
    const targetAddress = u32(i32(currentPC) + i32(offset))

    return targetAddress
  }

  /**
   * Get register B from first operand byte (high nibble)
   * Test vector format: operands[0] = (B << 4) | A
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  getRegisterB(operands: Uint8Array): u8 {
    return min(12, (operands[0] >> 4) & 0x0f) as u8
  }

  /**
   * Parse "Two Registers" format (Gray Paper pvm.tex lines 418-428)
   * Used by instructions that only need two registers (no immediate)
   * r_D = min(12, (instructions[ι+1]) mod 16) - destination (low nibble)
   * r_A = min(12, ⌊instructions[ι+1]/16⌋) - source (high nibble)
   */
  parseTwoRegisters(operands: Uint8Array): TwoRegistersResult {
    const registerD = this.getRegisterIndex(operands[0]) // r_D from low nibble
    const registerA = this.getRegisterB(operands) // r_A from high nibble
    return new TwoRegistersResult(registerD, registerA)
  }

  /**
   * Get register D (destination) from second operand byte
   * Test vector format: operands[1] = D
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  getRegisterD(operands: Uint8Array): u8 {
    return this.getRegisterIndex(operands[1])
  }

  /**
   * Get immediate value as 64-bit i64 with proper sign extension
   * Gray Paper: Immediate values are little-endian encoded with sign extension
   * Variable length, sign-extended to 64 bits according to Gray Paper formula
   */
  getImmediateValue(
    operands: Uint8Array,
    startIndex: i32,
    length: i32,
  ): i64 {
    // If length is 0, return 0 immediately (no bytes to read)
    if (length === 0) return i64(0)
    
    // Determine how many bytes to read
    const bytesToRead = length
    const end = min(i32(operands.length), startIndex + bytesToRead)

    if (end <= startIndex) return i64(0)

    // Read little-endian bytes
    let value = i64(0)
    for (let i = startIndex; i < end; i++) {
      value |= i64(operands[i]) << i64((i - startIndex) * 8)
    }

    // Apply Gray Paper sign extension formula: sext{n}(x)
    return this.signExtend(value, bytesToRead)
  }

  setRegisterValue(
    registers: RegisterState,
    index: u8,
    value: u64,
  ): void {
    registers[index] = value
  }

  /**
   * Get register value (all registers store 64-bit values)
   */
  getRegisterValue(
    registers: RegisterState,
    index: u8,
  ): u64 {
    return registers[index]
  }

  /**
   * Get register value as 64-bit u64 (for 64-bit operations)
   * Gray Paper: 64-bit operations can read from ANY register
   * For 32-bit registers, zero-extend to 64 bits
   */
  getRegisterValueAs64(
    registers: RegisterState,
    index: u8,
  ): u64 {
    return this.getRegisterValue(registers, index)
  }

  /**
   * Get register value masked to 32 bits (for 32-bit operations)
   * Gray Paper: 32-bit operations can read from ANY register, mask to 32 bits
   * Returns unsigned 32-bit as u64
   */
  getRegisterValueAs32(
    registers: RegisterState,
    index: u8,
  ): u64 {
    return this.getRegisterValue(registers, index) & u64(0xffffffff)
  }

  /**
   * Sign-extend a value to 64 bits according to Gray Paper formula
   * Gray Paper pvm.tex equation (1): sext{n}(x) = x + floor(x/2^(8-1)) * (2^64 - 2^(8))
   *
   * @param value The value to sign-extend (should be masked to appropriate bit width)
   * @param octets Number of octets (bytes) the original value occupied (1, 2, 3, 4, or 8)
   * @returns Sign-extended 64-bit unsigned value
   */
  signExtend(value: u64, octets: i32): u64 {
    // Gray Paper formula: sext{n}(x) = x + floor(x/2^(8n-1)) * (2^64 - 2^(8n))
    // Work with unsigned values for bit manipulation
    // First, mask the value to the appropriate bit width
    let maskedValue: u64
    if (octets === 1) {
      maskedValue = value & u64(0xff)
    } else if (octets === 2) {
      maskedValue = value & u64(0xffff)
    } else if (octets === 3) {
      maskedValue = value & u64(0xffffff)
    } else if (octets === 4) {
      maskedValue = value & u64(0xffffffff)
    } else {
      // For 8 octets, no masking needed (already 64-bit)
      maskedValue = value
    }
    
    const n = u64(octets)
    const signBitPosition = u64(8) * n - u64(1)
    // Cast shift amount to i32 for proper bit shifting in AssemblyScript
    const signBit = (maskedValue >> i32(signBitPosition)) & u64(1)
    
    
    // Calculate extension mask: 2^64 - 2^(8n) = (0xFFFFFFFFFFFFFFFF << (8*n)) | (value & mask)
    // For 16-bit (octets=2): mask should be 0xFFFFFFFFFFFF0000
    // Use bitwise OR with pre-computed masks to avoid overflow
    let extensionMask: u64
    if (octets === 1) {
      extensionMask = u64(0xFFFFFFFFFFFFFF00)
    } else if (octets === 2) {
      extensionMask = u64(0xFFFFFFFFFFFF0000)
    } else if (octets === 3) {
      extensionMask = u64(0xFFFFFFFFFF000000)
    } else if (octets === 4) {
      extensionMask = u64(0xFFFFFFFF00000000)
    } else {
      // For 8 octets, no extension needed (already 64-bit)
      extensionMask = u64(0)
    }

    // If sign bit is set, apply the extension mask
    if (signBit !== u64(0)) {
      return maskedValue | extensionMask
    } else {
      return maskedValue
    }
  }

  /**
   * Sign-extend a 32-bit value to 64 bits
   * Gray Paper: sext{4}{value}
   */
  signExtend32(value: u64): u64 {
    return this.signExtend(value & u64(0xffffffff), 4)
  }

  /**
   * Convert a sign-extended value to a signed offset for relative addressing
   * If the sign-extended value has the high bit set (>= 2^63), interpret as negative
   * This allows PC + signedOffset to effectively subtract when the offset is negative
   *
   * The sign extension already creates the correct two's complement representation,
   * but we need to convert it from unsigned i64 to signed interpretation.
   *
   * @param signExtendedValue The sign-extended value (64-bit i64)
   * @param originalLength The original length in bytes of the encoded value (for debugging)
   * @returns Signed offset that can be added to PC (negative if high bit is set)
   */
  toSigned64(signExtendedValue: i64): i64 {
    // Convert unsigned 64-bit value to signed 64-bit interpretation
    // If MSB is set (>= 2^63), subtract 2^64 to get negative value
    // Use u64 for the calculation to avoid overflow
    const threshold = i64(1) << i64(63)
    if (signExtendedValue >= threshold) {
      // signExtendedValue - 2^64
      // Since 2^64 = 0x10000000000000000 doesn't fit in u64, we use:
      // value - 2^64 = value - 0x8000000000000000 - 0x8000000000000000
      const value_u64 = u64(signExtendedValue)
      const result_u64 = value_u64 - u64(0x8000000000000000) - u64(0x8000000000000000)
      return i64(result_u64)
    } else {
      return signExtendedValue
    }
  }

  toUnsigned64(value: i64): i64 {
    // Convert signed back to unsigned
    // For negative values, add 2^64 to get the unsigned representation
    // Use u64 arithmetic to avoid overflow: u64 cast gives correct two's complement representation
    if (value < i64(0)) {
      return i64(u64(value))
    }
    return value
  }

  /**
   * Set register value with 64-bit result (for 64-bit operations)
   * Gray Paper: reg'_D = result mod 2^64
   * Works with ANY register - truncates to 32 bits for r8-r12
   */
  setRegisterValueWith64BitResult(
    registers: RegisterState,
    index: u8,
    value: u64,
  ): void {
    this.setRegisterValue(registers, index, value)
  }

  /**
   * Set register value with 32-bit sign-extension (for 32-bit operations)
   * Gray Paper: reg'_D = sext{4}{result mod 2^32}
   * Works with ANY register - sign-extends to 64 bits for r0-r7
   */
  setRegisterValueWith32BitResult(
    registers: RegisterState,
    index: u8,
    value: u64,
  ): void {
    // Gray Paper: 32-bit ops sign-extend to 64 bits for ALL registers
    const value32 = value & u64(0xffffffff) // Mask to 32 bits
    const extended = this.signExtend32(value32)
    this.setRegisterValue(registers, index, extended)
  }

  /**
   * Default validation - check minimum operand count
   */
  validate(operands: Uint8Array): boolean {
    return operands.length >= 1
  }

  /**
   * Default disassembly - show opcode and operands
   */
  disassemble(operands: Uint8Array): string {
    return this.name + ' ' + bytesToHex(operands)
  }

  /**
   * Convert little-endian bytes to i64
   */
  bytesToBigIntLE(bytes: Uint8Array): u64 {
    let value = u64(0)
    for (let i = 0; i < bytes.length; i++) {
      value |= u64(bytes[i]) << u64(i * 8)
    }
    return value
  }

  /**
   * Convert i64 to little-endian bytes of specified length
   */
  bigIntToBytesLE(value: i64, numBytes: i32): Uint8Array {
    const bytes = new Uint8Array(numBytes)
    let val = value
    for (let i = 0; i < numBytes; i++) {
      bytes[i] = u8(val & i64(0xff))
      val = val >> i64(8)
    }
    return bytes
  }

  /**
   * Validate branch target address according to Gray Paper basic block rules
   * Used by all branching instructions (JUMP, BRANCH_*, etc.)
   *
   * Gray Paper: Branches must target basic block starts
   * Basic blocks are defined as:
   * basicblocks ≡ ({0} ∪ {n + 1 + Fskip(n) | n ∈ Nmax(len(c)) ∧ k[n] = 1 ∧ c[n] ∈ T}) ∩ {n | k[n] = 1 ∧ c[n] ∈ U}
   *
   * Where T is the set of termination instructions (trap, fallthrough, jumps, branches)
   *
   * @param targetAddress The address to validate
   * @param context The instruction context
   * @returns InstructionResult with PANIC if invalid, null if valid
   */
  validateBranchTarget(
    targetAddress: u32,
    context: InstructionContext,
  ): InstructionResult | null {
    // Check if target address is within valid bounds
    if (i32(targetAddress) >= context.code.length) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Gray Paper line 124: basicblocks ≡ ({0} ∪ {n + 1 + Fskip(n) | .}) ∩ {n | k[n] = 1 ∧ c[n] ∈ U}
    // The intersection requires BOTH conditions:
    // 1. Target is in {0} ∪ {n + 1 + Fskip(n) | .} (address 0 OR follows termination)
    // 2. Target is in {n | k[n] = 1 ∧ c[n] ∈ U} (valid opcode position)
    
    // Check if target is a valid opcode position (bitmask check) - required by intersection
    // This must be checked even for address 0
    if (
      i32(targetAddress) >= context.bitmask.length ||
      context.bitmask[targetAddress] === 0
    ) {
      return new InstructionResult(RESULT_CODE_PANIC)
    }

    // Check if target is address 0 (always valid basic block start if bitmask[0] = 1)
    if (targetAddress === 0) {
      return null // Valid - allow the branch (bitmask already checked above)
    }

    // Gray Paper: Check if target is a basic block start
    // Basic blocks are defined as:
    // basicblocks ≡ ({0} ∪ {n + 1 + Fskip(n) | n ∈ Nmax(len(c)) ∧ k[n] = 1 ∧ c[n] ∈ T}) ∩ {n | k[n] = 1 ∧ c[n] ∈ U}
    //
    // Where T is the set of termination instructions
    // This means a valid basic block start is either:
    // 1. Address 0 (already handled above)
    // 2. An instruction that follows a termination instruction: n + 1 + Fskip(n)

    // Check if target follows a termination instruction
    const targetIndex = u32(targetAddress)

    // Look backwards to find if there's a termination instruction that ends just before our target
    for (let i: i32 = 0; i < i32(targetIndex); i++) {
      if (context.bitmask[i] === 1) {
        const opcode = u8(context.code[i])
        if (isTerminationInstruction(opcode)) {
          // Calculate where this termination instruction ends using Fskip
          const skipDistance = this.calculateSkipDistance(i, context.bitmask)
          const instructionEnd = i + 1 + skipDistance

          // If this termination instruction ends just before our target, it's a valid basic block start
          if (instructionEnd === targetIndex) {
            return null // Valid basic block start
          }
        }
      }
    }

    // If we get here, the target is not a valid basic block start
    return new InstructionResult(RESULT_CODE_PANIC)
  }

  /**
   * Calculate skip distance for an instruction (Gray Paper Fskip function)
   * Gray Paper: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})[i+1+j] = 1)
   *
   * This calculates how many octets (minus 1) to the next instruction's opcode
   */
  calculateSkipDistance(
    instructionIndex: i32,
    bitmask: Uint8Array,
  ): i32 {
    // Gray Paper: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})[i+1+j] = 1)
    // We need to find the next set bit after instructionIndex + 1

    for (let j = 1; j <= 24; j++) {
      const nextIndex = instructionIndex + j
      if (nextIndex >= bitmask.length || bitmask[nextIndex] === 1) {
        return j - 1
      }
    }
    return 24 // Maximum skip distance
  }

  /**
   * Execute method - must be overridden by subclasses
   * Default implementation returns panic to indicate it must be overridden
   */
  execute(context: InstructionContext): InstructionResult {
    // This should be overridden by all instruction subclasses
    return new InstructionResult(RESULT_CODE_PANIC)
  }
}
