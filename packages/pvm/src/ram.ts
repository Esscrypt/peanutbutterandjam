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
  public cells: Map<bigint, Uint8Array> = new Map()
  private readonly stackStart: bigint = 0n
  private readonly heapStart: bigint = BigInt(MEMORY_CONFIG.INITIAL_ZONE_SIZE)
  private readonly totalSize: bigint = BigInt(MEMORY_CONFIG.MAX_MEMORY_ADDRESS)

  constructor() {
    this.heapStart = MEMORY_CONFIG.INITIAL_ZONE_SIZE
    this.totalSize = MEMORY_CONFIG.MAX_MEMORY_ADDRESS
    logger.debug('PVMRAM initialized', {
      heapStart: this.heapStart,
      totalSize: this.totalSize,
    })
  }

  readOctet(address: bigint): Uint8Array {
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

  writeOctet(address: bigint, value: Uint8Array): void {
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

  readOctets(address: bigint, count: bigint): Uint8Array {
    const result = new Uint8Array(Number(count))
    for (let i = 0; i < Number(count); i++) {
      result.set(this.readOctet(address + BigInt(i)), i)
    }
    return result
  }

  writeOctets(address: bigint, values: Uint8Array): void {
    values.forEach((value, index) => {
      this.writeOctet(address + BigInt(index), new Uint8Array([value]))
    })
  }

  read(address: bigint, size: bigint): Uint8Array {
    if (!this.isReadable(address, size)) {
      throw new Error(`Memory read access violation at address ${address}`)
    }

    const result: Uint8Array = new Uint8Array(Number(size))
    for (let i = 0; i < Number(size); i++) {
      result.set(this.cells.get(address + BigInt(i)) || new Uint8Array([]), i)
    }
    return result
  }

  write(address: bigint, data: Uint8Array): void {
    if (!this.isWritable(address, BigInt(data.length))) {
      throw new Error(`Memory write access violation at address ${address}`)
    }

    for (let i = 0; i < data.length; i++) {
      this.cells.set(address + BigInt(i), new Uint8Array([data[i]]))
    }
  }

  isReadable(address: bigint, size = 1n): boolean {
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

  isWritable(address: bigint, size = 1n): boolean {
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
    stackStart: bigint
    heapStart: bigint
    totalSize: bigint
  } {
    return {
      stackStart: this.stackStart,
      heapStart: this.heapStart,
      totalSize: this.totalSize,
    }
  }
}
