/**
 * Base PVM Instruction System
 *
 * Defines the base interfaces and abstract class for all PVM instructions.
 */

import { bytesToHex } from '@pbnj/core'
import type {
  InstructionContext,
  InstructionResult,
  RegisterIndex,
  RegisterState,
} from '@pbnj/types'
import { isTerminationInstruction, RESULT_CODES } from '../config'

/**
 * Base interface for all PVM instruction handlers
 *
 * Gray Paper Reference: pvm.tex section 7.1-7.3
 */
export interface PVMInstructionHandler {
  readonly opcode: bigint
  readonly name: string

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
export abstract class BaseInstruction implements PVMInstructionHandler {
  abstract readonly opcode: bigint
  abstract readonly name: string

  /**
   * Get register index from operand byte (Gray Paper pattern)
   * r_A = min(12, operand_byte mod 16)
   */
  protected getRegisterIndex(operandByte: number): RegisterIndex {
    return Number(Math.min(12, operandByte & 0x0f)) as RegisterIndex // Low nibble
  }

  /**
   * Get register A from first operand byte (low nibble)
   * Test vector format: operands[0] = (B << 4) | A
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  protected getRegisterA(operands: Uint8Array): RegisterIndex {
    return this.getRegisterIndex(operands[0])
  }

  /**
   * Get immediate X length from high nibble of first operand byte
   * Used in branch instructions with variable-length immediates
   * Gray Paper: l_X = min(4, (operands[0] >> 4) & 0x07)
   */
  protected getImmediateLengthX(operands: Uint8Array): number {
    return Math.min(4, Math.floor((operands[0] >> 4) & 0x07))
  }

  /**
   * Get immediate X length from low 3 bits of first operand byte
   * Used in two-immediate instructions (STORE_IMM_* opcodes 30-33)
   * Gray Paper pvm.tex §7.4.4 line 288: l_X = min(4, instructions[ι+1] mod 8)
   */
  protected getImmediateLengthXFromLowBits(operands: Uint8Array): number {
    return Math.min(4, operands[0] & 0x07)
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
  protected parseRegisterAndOneImmediate(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    immediateX: bigint
  } {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterA(operands)

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = Math.min(4, Math.max(0, fskip - 1))

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return { registerA, immediateX }
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
  protected parseRegisterAndTwoImmediates(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    lengthX: number
    immediateX: bigint
    lengthY: number
    immediateY: bigint
  } {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterA(operands)

    // l_X = min(4, ⌊operands[0]/16⌋ mod 8) - HIGH nibble bits 4-6
    const lengthX = Math.min(4, Math.floor((operands[0] >> 4) & 0x07))

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = Math.min(4, Math.max(0, fskip - lengthX - 1))

    // immed_Y starts after immed_X
    const immediateY = this.getImmediateValue(operands, 1 + lengthX, lengthY)

    return { registerA, lengthX, immediateX, lengthY, immediateY }
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
  protected parseTwoRegistersAndTwoImmediates(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    registerB: RegisterIndex
    lengthX: number
    immediateX: bigint
    lengthY: number
    immediateY: bigint
  } {
    // r_A = min(12, (instructions[ι+1]) mod 16)
    const registerA = this.getRegisterA(operands)

    // r_B = min(12, ⌊instructions[ι+1]/16⌋)
    const registerB = this.getRegisterB(operands)

    // l_X = min(4, instructions[ι+2] mod 8)
    const lengthX = Math.min(4, operands[1] & 0x07)

    // immed_X = sext{l_X}{decode[l_X]{instructions[ι+3:l_X]}}
    const immediateX = this.getImmediateValue(operands, 2, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 2))
    const lengthY = Math.min(4, Math.max(0, fskip - lengthX - 2))

    // immed_Y = sext{l_Y}{decode[l_Y]{instructions[ι+3+l_X:l_Y]}}
    const immediateY = this.getImmediateValue(operands, 2 + lengthX, lengthY)

    return { registerA, registerB, lengthX, immediateX, lengthY, immediateY }
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
  protected parseTwoImmediates(
    operands: Uint8Array,
    fskip: number,
  ): {
    lengthX: number
    immediateX: bigint
    lengthY: number
    immediateY: bigint
  } {
    // FIX: Use low 3 bits instead of high nibble
    const lengthX = Math.min(4, operands[0] & 0x07) // mod 8 = low 3 bits

    // immed_X starts at operands[1]
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = Math.min(4, Math.max(0, fskip - lengthX - 1))

    // immed_Y starts after immed_X
    const immediateY = this.getImmediateValue(operands, 1 + lengthX, lengthY)

    return { lengthX, immediateX, lengthY, immediateY }
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
  protected parseOneRegisterAndImmediate(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    lengthX: number
    immediateX: bigint
  } {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterA(operands)

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = Math.min(4, Math.max(0, fskip - 1))

    // immed_X starts at operands[1], sign-extended
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return { registerA, lengthX, immediateX }
  }

  protected parseOneRegisterAndImmediateUnsigned(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    lengthX: number
    immediateX: bigint
  } {
    // r_A from low 4 bits of operands[0]
    const registerA = this.getRegisterA(operands)

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = Math.min(4, Math.max(0, fskip - 1))

    // immed_X starts at operands[1], unsigned
    const immediateX = this.getImmediateValueUnsigned(operands, 1, lengthX)

    return { registerA, lengthX, immediateX }
  }

  /**
   * Get immediate X length from high nibble bits 4-6 of first operand byte
   * Used in one register + two immediate instructions (STORE_IMM_IND_* opcodes 70-73)
   * Gray Paper pvm.tex §7.4.6 line 365: l_X = min(4, ⌊operands[0]/16⌋ mod 8)
   */
  protected getImmediateLengthXFromHighBits(operands: Uint8Array): number {
    return Math.min(4, Math.floor((operands[1] >> 4) & 0x07))
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
  protected parseTwoRegistersAndImmediate(
    operands: Uint8Array,
    fskip: number,
  ): {
    registerA: RegisterIndex
    registerB: RegisterIndex
    lengthX: number
    immediateX: bigint
  } {
    // r_A from low 4 bits, r_B from high 4 bits
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)

    // l_X = min(4, max(0, ℓ - 1))
    const lengthX = Math.min(4, Math.max(0, fskip - 1))

    // immed_X starts at operands[1], sign-extended
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    return { registerA, registerB, lengthX, immediateX }
  }

  /**
   * Parse branch instruction operands (One Register, One Immediate, One Offset)
   * Returns: {registerA, immediateX, offset, targetAddress}
   * Gray Paper pvm.tex line 394: immed_Y = ι + signfunc{l_Y}(decode[l_Y]{instructions[ι+2+l_X:l_Y]})
   * 
   * signfunc{n}(a) = { a if a < 2^{8n-1}, a - 2^{8n} otherwise }
   */
  protected parseBranchOperands(
    operands: Uint8Array,
    currentPC: bigint,
  ): {
    registerA: RegisterIndex
    immediateX: bigint
    offset: bigint
    targetAddress: bigint
  } {
    const registerA = this.getRegisterA(operands)
    const lengthX = this.getImmediateLengthX(operands)
    const immediateX = this.getImmediateValue(operands, 1, lengthX)

    // Offset Y starts after immediate X
    // Gray Paper: l_Y = min(4, max(0, ℓ - l_X - 1))
    const lengthY = Math.min(4, Math.max(0, operands.length - lengthX - 1))
    
    // Read offset as unsigned first
    const rawOffset = this.getImmediateValueUnsigned(operands, 1 + lengthX, lengthY)
    
    // Apply Gray Paper signfunc: signfunc{n}(a) = { a if a < 2^{8n-1}, a - 2^{8n} otherwise }
    // This converts unsigned value to signed in range [-2^{8n-1}, 2^{8n-1}-1]
    const signBitPosition = BigInt(8 * lengthY - 1)
    const signBit = lengthY > 0 ? (rawOffset >> signBitPosition) & 1n : 0n
    const offset =
      signBit === 0n ? rawOffset : rawOffset - 2n ** BigInt(8 * lengthY)

    // Calculate target address: immed_Y = ι + signfunc{l_Y}(offset)
    const targetAddress = currentPC + offset

    return { registerA, immediateX, offset, targetAddress }
  }

  /**
   * Get immediate value as unsigned 64-bit integer (no sign extension)
   * Used for unsigned comparisons and operations
   */
  protected getImmediateValueUnsigned(
    operands: Uint8Array,
    startIndex = 1,
    length?: number,
  ): bigint {
    // Determine how many bytes to read
    const bytesToRead = length || Math.min(4, operands.length - startIndex)
    const end = Math.min(operands.length, startIndex + bytesToRead)

    if (end <= startIndex) return 0n

    // Read little-endian bytes (no sign extension)
    let value = 0n
    for (let i = startIndex; i < end; i++) {
      value |= BigInt(operands[i]) << BigInt((i - startIndex) * 8)
    }

    return value
  }
  protected signedCompare(a: bigint, b: bigint): number {
    const signedA = this.toSigned64(a)
    const signedB = this.toSigned64(b)

    if (signedA < signedB) return -1
    if (signedA > signedB) return 1
    return 0
  }

  /**
   * Parse register-to-register branch operands (Two Registers & One Offset)
   * Returns: {registerA, registerB, targetAddress}
   * Gray Paper pvm.tex line 541: immed_X = ι + signfunc{l_X}(decode[l_X]{instructions[ι+2:l_X]})
   * 
   * signfunc{n}(a) = { a if a < 2^{8n-1}, a - 2^{8n} otherwise }
   */
  protected parseRegisterBranchOperands(
    operands: Uint8Array,
    currentPC: bigint,
  ): {
    registerA: RegisterIndex
    registerB: RegisterIndex
    offset: bigint
    targetAddress: bigint
  } {
    const registerA = this.getRegisterA(operands)
    const registerB = this.getRegisterB(operands)

    // Gray Paper: l_X = min(4, max(0, ℓ - 1))
    // Offset starts at operands[1] (after register byte at ι+1, so offset is at ι+2)
    const lengthX = Math.min(4, Math.max(0, operands.length - 1))
    
    // Read offset as unsigned first
    const rawOffset = this.getImmediateValueUnsigned(operands, 1, lengthX)
    
    // Apply Gray Paper signfunc: signfunc{n}(a) = { a if a < 2^{8n-1}, a - 2^{8n} otherwise }
    // This converts unsigned value to signed in range [-2^{8n-1}, 2^{8n-1}-1]
    const signBitPosition = BigInt(8 * lengthX - 1)
    const signBit = lengthX > 0 ? (rawOffset >> signBitPosition) & 1n : 0n
    const offset =
      signBit === 0n ? rawOffset : rawOffset - 2n ** BigInt(8 * lengthX)

    // Calculate target address: immed_X = ι + signfunc{l_X}(offset)
    const targetAddress = currentPC + offset

    return { registerA, registerB, offset, targetAddress }
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
  protected parseOneOffset(
    operands: Uint8Array,
    fskip: number,
    currentPC: bigint,
  ): bigint {
    // l_X = min(4, ℓ)
    const lengthX = Math.min(4, fskip)

    // Read the offset bytes starting from operands[0] (which is ι+1)
    // Gray Paper: \signfunc{l_X}(\decode[l_X]{\instructions\subrange{\imath+1}{l_X}})
    const rawOffset = this.getImmediateValueUnsigned(operands, 0, lengthX)

    // Apply Gray Paper sign function: \signfunc{l_X}
    // signfunc{n}(a) = { a if a < 2^{8n-1}, a - 2^{8n} otherwise }
    const signBitPosition = BigInt(8 * lengthX - 1)
    const signBit = (rawOffset >> signBitPosition) & 1n
    const offset =
      signBit === 0n ? rawOffset : rawOffset - 2n ** BigInt(8 * lengthX)

    // Calculate target address: immed_X = ι + signfunc{l_X}(offset)
    const targetAddress = currentPC + offset

    return targetAddress
  }

  /**
   * Get register B from first operand byte (high nibble)
   * Test vector format: operands[0] = (B << 4) | A
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  protected getRegisterB(operands: Uint8Array): RegisterIndex {
    return Number(Math.min(12, Math.floor(operands[0] / 16))) as RegisterIndex
  }

  /**
   * Parse "Two Registers" format (Gray Paper pvm.tex lines 418-428)
   * Used by instructions that only need two registers (no immediate)
   * r_D = min(12, (instructions[ι+1]) mod 16) - destination (low nibble)
   * r_A = min(12, ⌊instructions[ι+1]/16⌋) - source (high nibble)
   */
  protected parseTwoRegisters(operands: Uint8Array): {
    registerD: RegisterIndex
    registerA: RegisterIndex
  } {
    const registerD = this.getRegisterA(operands) // r_D from low nibble
    const registerA = this.getRegisterB(operands) // r_A from high nibble
    return { registerD, registerA }
  }

  /**
   * Get register D (destination) from second operand byte
   * Test vector format: operands[1] = D
   *
   * Gray Paper: Missing operands means invalid instruction → TRAP
   */
  protected getRegisterD(operands: Uint8Array): RegisterIndex {
    return this.getRegisterIndex(operands[1])
  }

  /**
   * Get immediate value as 64-bit bigint with proper sign extension
   * Gray Paper: Immediate values are little-endian encoded with sign extension
   * Variable length, sign-extended to 64 bits according to Gray Paper formula
   */
  protected getImmediateValue(
    operands: Uint8Array,
    startIndex = 1,
    length?: number,
  ): bigint {
    // Determine how many bytes to read
    const bytesToRead = length ?? Math.min(4, operands.length - startIndex)
    const end = Math.min(operands.length, startIndex + bytesToRead)

    if (end <= startIndex) return 0n

    // Read little-endian bytes
    let value = 0n
    for (let i = startIndex; i < end; i++) {
      value |= BigInt(operands[i]) << BigInt((i - startIndex) * 8)
    }

    // Apply Gray Paper sign extension formula: sext{n}(x)
    return this.signExtend(value, bytesToRead)
  }

  protected setRegisterValue(
    registers: RegisterState,
    index: RegisterIndex,
    value: bigint,
  ): void {
    registers[index] = value & 0xffffffffffffffffn
  }

  /**
   * Get register value (all registers store 64-bit values)
   */
  protected getRegisterValue(
    registers: RegisterState,
    index: RegisterIndex,
  ): bigint {
    return registers[index]
  }

  /**
   * Get register value as 64-bit bigint (for 64-bit operations)
   * Gray Paper: 64-bit operations can read from ANY register
   * For 32-bit registers, zero-extend to 64 bits
   */
  protected getRegisterValueAs64(
    registers: RegisterState,
    index: RegisterIndex,
  ): bigint {
    return this.getRegisterValue(registers, index)
  }

  /**
   * Get register value masked to 32 bits (for 32-bit operations)
   * Gray Paper: 32-bit operations can read from ANY register, mask to 32 bits
   * Returns unsigned 32-bit as number
   */
  protected getRegisterValueAs32(
    registers: RegisterState,
    index: RegisterIndex,
  ): bigint {
    return this.getRegisterValue(registers, index) & 0xffffffffn
  }

  /**
   * Sign-extend a value to 64 bits according to Gray Paper formula
   * Gray Paper pvm.tex equation (1): sext{n}(x) = x + floor(x/2^(8n-1)) * (2^64 - 2^(8n))
   *
   * @param value The value to sign-extend (should be masked to appropriate bit width)
   * @param octets Number of octets (bytes) the original value occupied (1, 2, 3, 4, or 8)
   * @returns Sign-extended 64-bit unsigned value
   */
  protected signExtend(value: bigint, octets: number): bigint {
    // Gray Paper formula: sext{n}(x) = x + floor(x/2^(8n-1)) * (2^64 - 2^(8n))
    const n = BigInt(octets)
    const signBitPosition = 8n * n - 1n
    const signBit = (value >> signBitPosition) & 1n
    const extensionMask = 2n ** 64n - 2n ** (8n * n)

    return value + signBit * extensionMask
  }

  /**
   * Sign-extend a 32-bit value to 64 bits
   * Gray Paper: sext{4}{value}
   */
  protected signExtend32(value: bigint): bigint {
    return this.signExtend(value & 0xffffffffn, 4)
  }

  /**
   * Convert a sign-extended value to a signed offset for relative addressing
   * If the sign-extended value has the high bit set (>= 2^63), interpret as negative
   * This allows PC + signedOffset to effectively subtract when the offset is negative
   *
   * The sign extension already creates the correct two's complement representation,
   * but we need to convert it from unsigned bigint to signed interpretation.
   *
   * @param signExtendedValue The sign-extended value (64-bit bigint)
   * @param originalLength The original length in bytes of the encoded value (for debugging)
   * @returns Signed offset that can be added to PC (negative if high bit is set)
   */
  protected toSigned64(signExtendedValue: bigint): bigint {
    // Convert unsigned 64-bit value to signed 64-bit interpretation
    return signExtendedValue >= 2n ** 63n
      ? signExtendedValue - 2n ** 64n
      : signExtendedValue
  }

  protected toUnsigned64(value: bigint): bigint {
    // Convert signed back to unsigned
    if (value < 0n) {
      return value + 2n ** 64n
    }
    return value
  }

  /**
   * Sign-extend a 16-bit value to 64 bits
   * Gray Paper: sext{2}{value}
   */
  protected signExtend16(value: bigint): bigint {
    return this.signExtend(value & 0xffffn, 2)
  }

  /**
   * Sign-extend an 8-bit value to 64 bits
   * Gray Paper: sext{1}{value}
   */
  protected signExtend8(value: bigint): bigint {
    return this.signExtend(value & 0xffn, 1)
  }

  /**
   * Set register value with 64-bit result (for 64-bit operations)
   * Gray Paper: reg'_D = result mod 2^64
   * Works with ANY register - truncates to 32 bits for r8-r12
   */
  protected setRegisterValueWith64BitResult(
    registers: RegisterState,
    index: RegisterIndex,
    value: bigint,
  ): void {
    this.setRegisterValue(registers, index, value)
  }

  /**
   * Set register value with 32-bit sign-extension (for 32-bit operations)
   * Gray Paper: reg'_D = sext{4}{result mod 2^32}
   * Works with ANY register - sign-extends to 64 bits for r0-r7
   */
  protected setRegisterValueWith32BitResult(
    registers: RegisterState,
    index: RegisterIndex,
    value: bigint,
  ): void {
    // Gray Paper: 32-bit ops sign-extend to 64 bits for ALL registers
    const value32 = value & 0xffffffffn // Mask to 32 bits
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
    return `${this.name} ${bytesToHex(operands)}`
  }

  /**
   * Convert little-endian bytes to bigint
   */
  protected bytesToBigIntLE(bytes: Uint8Array): bigint {
    let value = 0n
    for (let i = 0; i < bytes.length; i++) {
      value |= BigInt(bytes[i]) << BigInt(i * 8)
    }
    return value
  }

  /**
   * Convert bigint to little-endian bytes of specified length
   */
  protected bigIntToBytesLE(value: bigint, numBytes: number): Uint8Array {
    const bytes = new Uint8Array(numBytes)
    let val = value
    for (let i = 0; i < numBytes; i++) {
      bytes[i] = Number(val & 0xffn)
      val = val >> 8n
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
  protected validateBranchTarget(
    targetAddress: bigint,
    context: InstructionContext,
  ): InstructionResult | null {
    // Check if target address is within valid bounds
    if (targetAddress < 0n || targetAddress >= BigInt(context.code.length)) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Gray Paper line 124: basicblocks ≡ ({0} ∪ {n + 1 + Fskip(n) | ...}) ∩ {n | k[n] = 1 ∧ c[n] ∈ U}
    // The intersection requires BOTH conditions:
    // 1. Target is in {0} ∪ {n + 1 + Fskip(n) | ...} (address 0 OR follows termination)
    // 2. Target is in {n | k[n] = 1 ∧ c[n] ∈ U} (valid opcode position)
    
    // Check if target is a valid opcode position (bitmask check) - required by intersection
    // This must be checked even for address 0
    if (
      targetAddress >= context.bitmask.length ||
      context.bitmask[Number(targetAddress)] === 0
    ) {
      return { resultCode: RESULT_CODES.PANIC }
    }

    // Check if target is address 0 (always valid basic block start if bitmask[0] = 1)
    if (targetAddress === 0n) {
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
    const targetIndex = Number(targetAddress)

    // Look backwards to find if there's a termination instruction that ends just before our target
    for (let i = 0; i < targetIndex; i++) {
      if (context.bitmask[i] === 1) {
        const opcode = BigInt(context.code[i])
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
    return { resultCode: RESULT_CODES.PANIC }
  }

  /**
   * Calculate skip distance for an instruction (Gray Paper Fskip function)
   * Gray Paper: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})[i+1+j] = 1)
   *
   * This calculates how many octets (minus 1) to the next instruction's opcode
   */
  private calculateSkipDistance(
    instructionIndex: number,
    bitmask: Uint8Array,
  ): number {
    // Gray Paper: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})[i+1+j] = 1)
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
   * Abstract execute method
   */
  abstract execute(context: InstructionContext): InstructionResult
}
