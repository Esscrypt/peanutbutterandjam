import { decodeBlob } from './codec'
import { PVMInstruction } from './pvm'

/**
 * Parse result structure
 */
export class ParseResult {
  success: bool
  instructions: PVMInstruction[]
  bitmask: Uint8Array
  jumpTable: u32[]
  errors: string[]
  codeLength: u32

  constructor(
    success: bool,
    instructions: PVMInstruction[],
    bitmask: Uint8Array,
    jumpTable: u32[],
    errors: string[],
    codeLength: u32,
  ) {
    this.success = success
    this.instructions = instructions
    this.bitmask = bitmask
    this.jumpTable = jumpTable
    this.errors = errors
    this.codeLength = codeLength
  }
}

/**
 * PVM Parser implementation
 * Parses PVM instruction data and program blobs according to Gray Paper specification
 *
 * Gray Paper Reference: pvm.tex sections 7.1-7.3
 */
export class PVMParser {
  /**
   * Skip function Fskip(i) - determines distance to next instruction
   *
   * Gray Paper Equation 7.1:
   * Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1)
   *
   * @param instructionIndex - Index of instruction opcode in instruction data
   * @param opcodeBitmask - Bitmask indicating valid instruction boundaries
   * @returns Number of octets minus 1 to next instruction's opcode
   */
  skip(instructionIndex: i32, opcodeBitmask: Uint8Array): i32 {
    // Append bitmask with sequence of set bits for final instruction
    const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
    extendedBitmask.set(opcodeBitmask)
    extendedBitmask.fill(1, opcodeBitmask.length)

    // Find next set bit starting from i+1
    for (let j: i32 = 1; j <= 24; j++) {
      const bitIndex = instructionIndex + j
      if (
        bitIndex < extendedBitmask.length &&
        extendedBitmask[bitIndex] === 1
      ) {
        return j - 1
      }
    }

    return 24 // Maximum skip distance
  }

  /**
   * Parse a program using Gray Paper specification (with bitmask)
   *
   * This method decodes the program blob and uses the opcode bitmask
   * to determine instruction boundaries.
   *
   * @param programBlob - The encoded program blob
   * @returns Parsed instructions and errors
   */
  parseProgram(programBlob: Uint8Array): ParseResult {
    const instructions: PVMInstruction[] = []
    const errors: string[] = []

    // Decode the program blob
    const decoded = decodeBlob(programBlob)
    if (!decoded) {
      errors.push('Failed to decode program blob - invalid format')
      return new ParseResult(
        false,
        [] as PVMInstruction[],
        new Uint8Array(0),
        [] as u32[],
        errors,
        0,
      )
    }

    const code = decoded.code
    const bitmask = decoded.bitmask
    const jumpTable = decoded.jumpTable

    // Gray Paper pvm.tex equation: ζ ≡ c ⌢ [0, 0, . . . ]
    // Append 16 zeros to ensure no out-of-bounds access and trap behavior
    // This implements the infinite sequence of zeros as specified in the Gray Paper
    const extendedCode = new Uint8Array(code.length + 16)
    extendedCode.set(code)
    // Zeros are already initialized by Uint8Array constructor

    // Extend bitmask to cover the padded zeros (all 1s = valid opcode positions)
    // Gray Paper: "appends k with a sequence of set bits in order to ensure a well-defined result"
    const extendedBitmask = new Uint8Array(code.length + 16)
    extendedBitmask.set(bitmask)
    extendedBitmask.fill(1, bitmask.length) // Fill remaining positions with 1s

    let instructionIndex: i32 = 0

    // Parse instructions including the implicit trap from padded zeros
    // Continue until we've processed the original code length
    while (instructionIndex < extendedCode.length) {
      // Gray Paper Fskip-based parsing using extended bitmask
      // Check if current position has a valid opcode (bitmask check)
      if (
        instructionIndex >= extendedBitmask.length ||
        extendedBitmask[instructionIndex] === 0
      ) {
        // Not an opcode position, skip
        instructionIndex++
        continue
      }

      const opcode = extendedCode[instructionIndex]

      // Calculate Fskip(i) according to Gray Paper specification:
      // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1)
      const fskip = this.skip(instructionIndex, extendedBitmask)
      const instructionLength = 1 + fskip

      // Extract operands from extended code (with zero padding)
      const operands = extendedCode.slice(
        instructionIndex + 1,
        instructionIndex + instructionLength,
      )

      const instruction = new PVMInstruction(
        opcode,
        operands,
        fskip,
        u32(instructionIndex),
      )

      instructions.push(instruction)

      // Advance to next instruction: ι' = ι + 1 + Fskip(ι)
      instructionIndex += instructionLength
    }

    return new ParseResult(
      errors.length === 0,
      instructions,
      extendedBitmask,
      jumpTable,
      errors,
      u32(code.length),
    )
  }
}
