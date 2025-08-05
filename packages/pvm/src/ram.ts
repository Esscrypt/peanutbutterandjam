import { logger } from '@pbnj/core'
import { MEMORY_CONFIG } from './config'
import type { RAM } from './types'
import { PVMError } from './types'

/**
 * PVM RAM Implementation
 *
 * Manages memory layout and access for the PVM runtime
 */
export class PVMRAM implements RAM {
  public cells: Map<number, number> = new Map()
  private readonly stackStart: number = 0
  private readonly heapStart: number = MEMORY_CONFIG.INITIAL_ZONE_SIZE
  private readonly totalSize: number = MEMORY_CONFIG.MAX_MEMORY_ADDRESS

  constructor() {
    this.heapStart = MEMORY_CONFIG.INITIAL_ZONE_SIZE
    this.totalSize = MEMORY_CONFIG.MAX_MEMORY_ADDRESS
    logger.debug('PVMRAM initialized', {
      heapStart: this.heapStart,
      totalSize: this.totalSize,
    })
  }

  readOctet(address: number): number {
    // Check if address is in reserved memory (first 64KB)
    if (address < MEMORY_CONFIG.RESERVED_MEMORY_START) {
      throw new PVMError(
        `Memory access to reserved address: ${address}`,
        'RESERVED_MEMORY_ACCESS',
        { address },
      )
    }

    // Check if address is readable
    if (!this.isReadable(address)) {
      throw new PVMError(
        `Memory read access violation at address: ${address}`,
        'MEMORY_READ_FAULT',
        { address },
      )
    }

    return this.cells.get(address) || 0
  }

  writeOctet(address: number, value: number): void {
    // Check if address is in reserved memory (first 64KB)
    if (address < MEMORY_CONFIG.RESERVED_MEMORY_START) {
      throw new PVMError(
        `Memory access to reserved address: ${address}`,
        'RESERVED_MEMORY_ACCESS',
        { address },
      )
    }

    // Check if address is writable
    if (!this.isWritable(address)) {
      throw new PVMError(
        `Memory write access violation at address: ${address}`,
        'MEMORY_WRITE_FAULT',
        { address },
      )
    }

    // Ensure value is 8-bit
    const octet = value & 0xff
    this.cells.set(address, octet)
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

  read(address: number, size: number): number[] {
    if (!this.isReadable(address, size)) {
      throw new Error(`Memory read access violation at address ${address}`)
    }

    const result: number[] = []
    for (let i = 0; i < size; i++) {
      result.push(this.cells.get(address + i) || 0)
    }
    return result
  }

  write(address: number, data: number[]): void {
    if (!this.isWritable(address, data.length)) {
      throw new Error(`Memory write access violation at address ${address}`)
    }

    for (let i = 0; i < data.length; i++) {
      this.cells.set(address + i, data[i])
    }
  }

  isReadable(address: number, size = 1): boolean {
    // Check bounds
    if (address < 0 || address + size > this.totalSize) {
      return false
    }

    // Reserved memory (first 64KB) is read-only
    if (address < MEMORY_CONFIG.RESERVED_MEMORY_START) {
      return true // Readable but not writable
    }

    return true
  }

  isWritable(address: number, size = 1): boolean {
    // Check bounds
    if (address < 0 || address + size > this.totalSize) {
      return false
    }

    // Reserved memory (first 64KB) is not writable
    if (address < MEMORY_CONFIG.RESERVED_MEMORY_START) {
      return false
    }

    return true
  }

  getMemoryLayout(): {
    stackStart: number
    heapStart: number
    totalSize: number
  } {
    return {
      stackStart: this.stackStart,
      heapStart: this.heapStart,
      totalSize: this.totalSize,
    }
  }
}
