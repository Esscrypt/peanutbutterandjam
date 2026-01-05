import { decodeBlob } from '@pbnjam/codec'
import type { PVMInstruction } from '@pbnjam/types'
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
   * Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
   *
   * @param instructionIndex - Index of instruction opcode in instruction data
   * @param opcodeBitmask - Bitmask indicating valid instruction boundaries
   * @returns Number of octets minus 1 to next instruction's opcode
   */
  private skip(instructionIndex: number, opcodeBitmask: Uint8Array): number {
    // Append bitmask with sequence of set bits for final instruction
    const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
    extendedBitmask.set(opcodeBitmask)
    extendedBitmask.fill(1, opcodeBitmask.length)

    // Find next set bit starting from i+1
    for (let j = 1; j <= 24; j++) {
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
   * @param isTestVector - If true, use simplified test vector format
   * @returns Parsed instructions and errors
   */
  parseProgram(programBlob: Uint8Array): {
    success: boolean
    instructions: PVMInstruction[]
    bitmask: Uint8Array
    jumpTable: bigint[]
    errors: string[]
    codeLength: number
  } {
    const instructions: PVMInstruction[] = []
    const errors: string[] = []

    // Decode the program blob
    const [error, decoded] = decodeBlob(programBlob)
    if (error) {
      errors.push('Failed to decode program blob - invalid format')
      return {
        success: false,
        instructions: [],
        bitmask: new Uint8Array(0),
        jumpTable: [],
        errors,
        codeLength: 0,
      }
    }

    const { code, bitmask, jumpTable } = decoded.value

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

    let instructionIndex = 0

    try {
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
        // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
        const fskip = this.skip(instructionIndex, extendedBitmask)
        const instructionLength = 1 + fskip

        // Extract operands from extended code (with zero padding)
        const operands = extendedCode.slice(
          instructionIndex + 1,
          instructionIndex + instructionLength,
        )

        const instruction: PVMInstruction = {
          opcode: BigInt(opcode),
          operands,
          fskip,
          pc: BigInt(instructionIndex),
        }

        instructions.push(instruction)

        // Advance to next instruction: ι' = ι + 1 + Fskip(ι)
        instructionIndex += instructionLength
      }

      return {
        success: errors.length === 0,
        instructions,
        bitmask: extendedBitmask,
        jumpTable,
        errors,
        codeLength: code.length,
      }
    } catch (error) {
      errors.push(`Failed to parse program: ${error}`)
      return {
        success: false,
        instructions: [],
        bitmask: new Uint8Array(0),
        jumpTable: [],
        errors,
        codeLength: 0,
      }
    }
  }
}
