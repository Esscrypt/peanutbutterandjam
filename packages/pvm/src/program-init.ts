/**
 * Program Initialization Implementation
 *
 * Implements the Y(𝐩, 𝐚) function for standard program initialization
 * as specified in the Gray Paper section 7.5
 */

import { logger } from '@pbnj/core'
import type {
  ArgumentData,
  ProgramInitResult,
  RAM,
  RegisterState,
} from './types'
import { PVM_CONSTANTS } from './types'

/**
 * Y(𝐩, 𝐚) Function Implementation
 *
 * Standard program initialization function that decodes program blob 𝐩
 * and argument data 𝐚 into instruction data, registers, and RAM.
 *
 * As specified in Gray Paper equation 7.5
 */
export class ProgramInitializer {
  /**
   * Initialize program from blob and arguments
   *
   * @param programBlob - Program blob data
   * @param argumentData - Argument data
   * @returns Initialization result with instruction data, registers, and RAM
   */
  initialize(
    programBlob: number[],
    argumentData: ArgumentData,
  ): ProgramInitResult {
    logger.debug('ProgramInitializer.initialize called', {
      blobSize: programBlob.length,
      argSize: argumentData.size,
    })

    try {
      // Validate input sizes as per Gray Paper
      if (argumentData.size > Number(PVM_CONSTANTS.INIT_INPUT_SIZE)) {
        return {
          success: false,
          error: `Argument data size ${argumentData.size} exceeds maximum ${PVM_CONSTANTS.INIT_INPUT_SIZE}`,
        }
      }

      // Parse program blob according to Gray Paper format
      const parsed = this.parseProgramBlob(programBlob)
      if (!parsed.success) {
        return parsed
      }

      // Initialize registers as per Gray Paper equation 7.7
      const registers = this.initializeRegisters(argumentData.size)

      // Initialize RAM as per Gray Paper equation 7.6
      const ram = this.initializeRAM(
        parsed.readOnlyData || [],
        parsed.readWriteData || [],
        argumentData,
      )

      return {
        success: true,
        instructionData: parsed.instructionData,
        registers,
        ram,
      }
    } catch (error) {
      logger.error('Program initialization failed', { error })
      return {
        success: false,
        error: `Initialization error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  /**
   * Parse program blob according to Gray Paper format
   *
   * Format: E3(len_o) || E3(len_w) || E2(z) || E3(s) || o || w || E4(len_c) || c
   */
  private parseProgramBlob(blob: number[]): {
    success: boolean
    instructionData?: number[]
    readOnlyData?: number[]
    readWriteData?: number[]
    error?: string
  } {
    if (blob.length < 12) {
      return {
        success: false,
        error: 'Program blob too small',
      }
    }

    let offset = 0

    // Parse lengths as per Gray Paper format
    const readOnlyLength = this.decodeLength(blob, offset, 3)
    offset += 3

    const readWriteLength = this.decodeLength(blob, offset, 3)
    offset += 3

    const dynamicJumpTableSize = this.decodeLength(blob, offset, 2)
    offset += 2

    offset += 3

    // Validate total size
    const expectedSize =
      12 + readOnlyLength + readWriteLength + 4 + dynamicJumpTableSize
    if (blob.length < expectedSize) {
      return {
        success: false,
        error: `Program blob size mismatch: expected ${expectedSize}, got ${blob.length}`,
      }
    }

    // Extract read-only data
    const readOnlyData = blob.slice(offset, offset + readOnlyLength)
    offset += readOnlyLength

    // Extract read-write data
    const readWriteData = blob.slice(offset, offset + readWriteLength)
    offset += readWriteLength

    // Skip dynamic jump table for now
    offset += dynamicJumpTableSize

    // Extract instruction data length
    const instructionDataLength = this.decodeLength(blob, offset, 4)
    offset += 4

    // Extract instruction data
    const instructionData = blob.slice(offset, offset + instructionDataLength)

    return {
      success: true,
      instructionData,
      readOnlyData,
      readWriteData,
    }
  }

  /**
   * Initialize registers as per Gray Paper equation 7.7
   */
  private initializeRegisters(argumentSize: number): RegisterState {
    return {
      // r0: Stack pointer (2^32 - 2^16)
      r0: BigInt(2 ** 32 - 2 ** 16),

      // r1: Stack pointer (2^32 - 2*INIT_ZONE_SIZE - INIT_INPUT_SIZE)
      r1: BigInt(
        2 ** 32 -
          2 * Number(PVM_CONSTANTS.INIT_ZONE_SIZE) -
          Number(PVM_CONSTANTS.INIT_INPUT_SIZE),
      ),

      // r2-r6: Initialize to 0
      r2: 0n,
      r3: 0n,
      r4: 0n,
      r5: 0n,
      r6: 0n,

      // r7: Argument pointer (2^32 - INIT_ZONE_SIZE - INIT_INPUT_SIZE)
      r7: BigInt(
        2 ** 32 -
          Number(PVM_CONSTANTS.INIT_ZONE_SIZE) -
          Number(PVM_CONSTANTS.INIT_INPUT_SIZE),
      ),

      // r8: Argument length
      r8: BigInt(argumentSize),

      // r9-r12: Initialize to 0
      r9: 0n,
      r10: 0n,
      r11: 0n,
      r12: 0n,
    }
  }

  /**
   * Initialize RAM as per Gray Paper equation 7.6
   */
  private initializeRAM(
    readOnlyData: number[],
    readWriteData: number[],
    argumentData: ArgumentData,
  ): RAM {
    // Create RAM with proper memory layout
    const ram = new (class implements RAM {
      public cells: Map<number, number> = new Map()

      readOctet(address: number): number {
        return this.cells.get(address) || 0
      }

      writeOctet(address: number, value: number): void {
        this.cells.set(address, value & 0xff)
      }

      readOctets(address: number, count: number): number[] {
        const result: number[] = []
        for (let i = 0; i < count; i++) {
          result.push(this.readOctet(address + i))
        }
        return result
      }

      writeOctets(address: number, values: number[]): void {
        values.forEach((value, index) => {
          this.writeOctet(address + index, value)
        })
      }

      isReadable(address: number): boolean {
        return address >= Number(PVM_CONSTANTS.RESERVED_MEMORY_START)
      }

      isWritable(address: number): boolean {
        return address >= Number(PVM_CONSTANTS.RESERVED_MEMORY_START)
      }

      getMemoryLayout(): {
        stackStart: number
        heapStart: number
        totalSize: number
      } {
        return {
          stackStart: 0,
          heapStart: Number(PVM_CONSTANTS.INIT_ZONE_SIZE),
          totalSize: Number(PVM_CONSTANTS.MAX_MEMORY_ADDRESS),
        }
      }
    })()

    // Initialize memory zones as per Gray Paper equation 7.6

    // Zone 1: Read-only data (INIT_ZONE_SIZE to INIT_ZONE_SIZE + len_o)
    const readOnlyStart = Number(PVM_CONSTANTS.INIT_ZONE_SIZE)
    readOnlyData.forEach((value, index) => {
      ram.writeOctet(readOnlyStart + index, value)
    })

    // Zone 2: Read-write data (2*INIT_ZONE_SIZE + aligned_len_o to 2*INIT_ZONE_SIZE + aligned_len_o + len_w)
    const readWriteStart =
      2 * Number(PVM_CONSTANTS.INIT_ZONE_SIZE) +
      this.alignToZone(readOnlyData.length)
    readWriteData.forEach((value, index) => {
      ram.writeOctet(readWriteStart + index, value)
    })

    // Zone 3: Arguments (2^32 - INIT_ZONE_SIZE - INIT_INPUT_SIZE to 2^32 - INIT_ZONE_SIZE - INIT_INPUT_SIZE + len_a)
    const argStart =
      2 ** 32 -
      Number(PVM_CONSTANTS.INIT_ZONE_SIZE) -
      Number(PVM_CONSTANTS.INIT_INPUT_SIZE)
    argumentData.data.forEach((value, index) => {
      ram.writeOctet(argStart + index, value)
    })

    return ram
  }

  /**
   * Decode length from blob data
   */
  private decodeLength(
    data: number[],
    offset: number,
    Uint8Array: number,
  ): number {
    let length = 0
    for (let i = 0; i < Uint8Array; i++) {
      length |= data[offset + i] << (i * 8)
    }
    return length
  }

  /**
   * Align size to zone boundary
   */
  private alignToZone(size: number): number {
    return (
      Math.ceil(size / Number(PVM_CONSTANTS.INIT_ZONE_SIZE)) *
      Number(PVM_CONSTANTS.INIT_ZONE_SIZE)
    )
  }
}
