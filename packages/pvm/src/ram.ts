import { logger } from '@pbnj/core'
import type { RAM } from '@pbnj/types'
import { PVMError } from '@pbnj/types'
import { MEMORY_CONFIG } from './config'

/**
 * PVM RAM Implementation
 *
 * Manages memory layout and access for the PVM runtime
 */
export class PVMRAM implements RAM {
  public cells: Map<number, Uint8Array> = new Map()
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

  readOctet(address: number): Uint8Array {
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

    return this.cells.get(address) || new Uint8Array([])
  }

  writeOctet(address: number, value: Uint8Array): void {
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

    //check if value is 8-bit
    if (value.length !== 1) {
      throw new PVMError(
        `Memory write access violation at address: ${address}`,
        'MEMORY_WRITE_FAULT',
        { address },
      )
    }

    // Ensure value is 8-bit
    this.cells.set(address, value)
  }

  readOctets(address: number, count: number): Uint8Array {
    const result = new Uint8Array(count)
    for (let i = 0; i < count; i++) {
      result.set(this.readOctet(address + i), i)
    }
    return result
  }

  writeOctets(address: number, values: Uint8Array): void {
    values.forEach((value, index) => {
      this.writeOctet(address + index, new Uint8Array([value]))
    })
  }

  read(address: number, size: number): Uint8Array {
    if (!this.isReadable(address, size)) {
      throw new Error(`Memory read access violation at address ${address}`)
    }

    const result: Uint8Array = new Uint8Array(size)
    for (let i = 0; i < size; i++) {
      result.set(this.cells.get(address + i) || new Uint8Array([]), i)
    }
    return result
  }

  write(address: number, data: number[]): void {
    if (!this.isWritable(address, data.length)) {
      throw new Error(`Memory write access violation at address ${address}`)
    }

    for (let i = 0; i < data.length; i++) {
      this.cells.set(address + i, new Uint8Array([data[i]]))
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
