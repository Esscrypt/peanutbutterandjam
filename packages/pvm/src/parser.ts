import type { ParseResult, Parser, PVMInstruction } from '@pbnj/types'

/**
 * PVM Parser implementation
 * Parses PVM instruction data and program blobs
 */
export class PVMParser implements Parser {
  /**
   * Parse a single instruction from raw data
   */
  parseInstruction(data: Uint8Array): ParseResult {
    try {
      if (data.length < 4) {
        return {
          success: false,
          error: 'Instruction data too short (minimum 4 bytes required)',
        }
      }

      const opcode = data[0]
      const operands = data.slice(1, 4)
      const address = 0 // Will be set by caller

      const instruction: PVMInstruction = {
        opcode: BigInt(opcode),
        operands,
        address: BigInt(address),
      }

      return {
        success: true,
        instruction,
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse instruction: ${error}`,
      }
    }
  }

  /**
   * Parse a complete program from blob
   */
  parseProgram(blob: {
    instructionData: Uint8Array
    opcodeBitmask: Uint8Array
    dynamicJumpTable: Map<bigint, bigint>
  }): {
    success: boolean
    instructions: PVMInstruction[]
    errors: string[]
  } {
    const instructions: PVMInstruction[] = []
    const errors: string[] = []
    let address = 0n

    try {
      // Parse instructions in 4-byte chunks
      for (let i = 0; i < blob.instructionData.length; i += 4) {
        let chunk = blob.instructionData.slice(i, i + 4)

        if (chunk.length < 4) {
          // Pad with zeros if incomplete
          const paddedChunk = new Uint8Array(4)
          paddedChunk.set(chunk, 0)
          chunk = paddedChunk
        }

        const opcode = chunk[0] & (blob.opcodeBitmask[i] || 0xff)
        const operands = chunk.slice(1, 4)

        const instruction: PVMInstruction = {
          opcode: BigInt(opcode),
          operands,
          address,
        }

        instructions.push(instruction)
        address += 4n
      }

      return {
        success: errors.length === 0,
        instructions,
        errors,
      }
    } catch (error) {
      errors.push(`Failed to parse program: ${error}`)
      return {
        success: false,
        instructions: [],
        errors,
      }
    }
  }

  /**
   * Disassemble a PVM instruction to string representation
   */
  disassemble(instruction: PVMInstruction): string {
    const opcodeName = this.getOpcodeName(instruction.opcode)

    return `${opcodeName} ${instruction.operands.join(', ')}`
  }

  /**
   * Get human-readable opcode name
   */
  private getOpcodeName(opcode: bigint): string {
    const opcodeNames: Map<bigint, string> = new Map([
      [0x00n, 'NOP'],
      [0x01n, 'HALT'],
      [0x02n, 'ERROR'],
      [0x10n, 'LOAD'],
      [0x11n, 'STORE'],
      [0x20n, 'ADD'],
      [0x21n, 'SUB'],
      [0x22n, 'MUL'],
      [0x23n, 'DIV'],
      [0x30n, 'JMP'],
      [0x31n, 'JZ'],
      [0x32n, 'JNZ'],
      [0x40n, 'CALL'],
      [0x41n, 'RET'],
      [0x50n, 'PUSH'],
      [0x51n, 'POP'],
    ])

    return (
      opcodeNames.get(opcode) ||
      `UNKNOWN_${opcode.toString(16).padStart(2, '0').toUpperCase()}`
    )
  }

  /**
   * Validate instruction data
   */
  validateInstruction(instruction: PVMInstruction): string[] {
    const errors: string[] = []

    // Check opcode range
    if (instruction.opcode < 0 || instruction.opcode > 255) {
      errors.push(`Invalid opcode: ${instruction.opcode}`)
    }

    // Check operands
    if (instruction.operands.length !== 3) {
      errors.push(`Invalid operand count: ${instruction.operands.length}`)
    }

    // Check operand values
    instruction.operands.forEach((operand, index) => {
      if (operand < 0 || operand > 255) {
        errors.push(`Invalid operand ${index}: ${operand}`)
      }
    })

    return errors
  }

  /**
   * Create a program blob from raw data
   */
  createBlob(data: number[]): {
    instructionData: number[]
    opcodeBitmask: number[]
    dynamicJumpTable: Map<number, number>
  } {
    // Pad data to 4-byte alignment
    while (data.length % 4 !== 0) {
      data.push(0)
    }

    const opcodeBitmask = new Array(data.length).fill(0xff)
    const dynamicJumpTable = new Map<number, number>()

    return {
      instructionData: data,
      opcodeBitmask,
      dynamicJumpTable,
    }
  }
}
