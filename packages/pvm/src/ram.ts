import { logger, type Safe, safeError, safeResult } from '@pbnj/core'
import type { MemoryAccessType, RAM } from '@pbnj/types'
import { MEMORY_CONFIG } from './config'

/**
 * PVM RAM Implementation
 *
 * Implements Gray Paper RAM specification with dynamic allocation:
 * - ram_value: sparse storage for actual memory data
 * - ram_access: sparse storage for page access rights
 * - Pages are allocated on-demand for efficiency
 */
export class PVMRAM implements RAM {
  // Gray Paper: ram_value - sparse storage for memory data
  // Using Map for O(1) access and dynamic growth
  private readonly memoryData: Map<bigint, number> = new Map()

  // Gray Paper: ram_access - sparse storage for page access rights
  // Using Map for O(1) access and dynamic growth
  private readonly pageAccess: Map<bigint, MemoryAccessType> = new Map()

  // Gray Paper constants
  private readonly CPVM_PAGE_SIZE = 4096n // Cpvmpagesize = 2^12
  private readonly MAX_ADDRESS = 2n ** 32n // 4GB address space
  private readonly TOTAL_PAGES = this.MAX_ADDRESS / this.CPVM_PAGE_SIZE // 1,048,576 pages

  constructor() {
    // Initialize reserved memory (first 64KB) as readable
    const reservedPages =
      MEMORY_CONFIG.RESERVED_MEMORY_START / this.CPVM_PAGE_SIZE
    for (let i = 0n; i < reservedPages; i++) {
      this.pageAccess.set(i, 'read')
    }
  }

  /**
   * Get page index for an address
   * Gray Paper: ⌊address / Cpvmpagesize⌋
   */
  private getPageIndex(address: bigint): bigint {
    return address / this.CPVM_PAGE_SIZE
  }

  /**
   * Initialize a memory page (used for test vectors)
   * @param address - Base address of the page
   * @param length - Length of the page in bytes
   * @param accessType - Access type: 'none', 'read', 'write', or 'read+write'
   */
  initializePage(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
  ): void {
    this.setPageAccessRights(address, length, accessType)
  }

  /**
   * Set memory page access rights (Gray Paper PAGES function)
   * @param address - Base address of the page
   * @param length - Length of the page in bytes
   * @param accessType - Access type: 'none', 'read', 'write', or 'read+write'
   */
  setPageAccessRights(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
  ): void {
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + BigInt(length))

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      if (pageIndex >= 0n && pageIndex < this.TOTAL_PAGES) {
        this.pageAccess.set(pageIndex, accessType)
      }
    }
  }

  /**
   * Get memory page access type
   * @param address - Address to check
   * @returns Access type for the page containing this address
   */
  getPageAccessType(address: bigint): MemoryAccessType {
    const pageIndex = this.getPageIndex(address)

    if (pageIndex < 0n || pageIndex >= this.TOTAL_PAGES) {
      return 'none'
    }

    // Return stored access type or default to 'none'
    return this.pageAccess.get(pageIndex) ?? 'none'
  }

  readOctets(address: bigint, count: bigint): Safe<Uint8Array> {
    // Check if entire range is readable first
    if (!this.isReadable(address, count)) {
      return safeError(
        new Error(
          `Memory read fault: range ${address}-${address + count - 1n} not readable`,
        ),
      )
    }

    const result = new Uint8Array(Number(count))
    for (let i = 0; i < Number(count); i++) {
      result[i] = this.memoryData.get(address + BigInt(i)) ?? 0
    }
    return safeResult(result)
  }

  writeOctets(address: bigint, values: Uint8Array): Safe<void> {
    // Check if entire range is writable first
    if (!this.isWritable(address, BigInt(values.length))) {
      return safeError(
        new Error(
          `Memory write fault: range ${address}-${address + BigInt(values.length) - 1n} not writable`,
        ),
      )
    }

    // Write each byte individually (O(N) but necessary for sparse storage)
    for (let i = 0; i < values.length; i++) {
      this.memoryData.set(address + BigInt(i), values[i])
    }
    return safeResult(undefined)
  }

  isReadable(address: bigint, size = 1n): boolean {
    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return false
    }

    // Gray Paper: readable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] ≠ none}
    // Check all pages that the address range spans
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + size - 1n)

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const accessType = this.pageAccess.get(pageIndex) ?? 'none'
      if (accessType === 'none') {
        return false
      }
    }

    return true
  }

  isWritable(address: bigint, size = 1n): boolean {
    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return false
    }

    // Gray Paper: writable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] = W}
    // Check all pages that the address range spans
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + size - 1n)

    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const accessType = this.pageAccess.get(pageIndex) ?? 'none'
      if (accessType !== 'write' && accessType !== 'read+write') {
        return false
      }
    }

    return true
  }

  /**
   * Get memory statistics for debugging
   */
  getMemoryStats(): {
    maxAddress: string
    totalPages: number
    pageSize: number
    allocatedPages: number
    allocatedBytes: number
    accessiblePages: number
    writablePages: number
  } {
    let accessiblePages = 0
    let writablePages = 0

    for (const accessType of this.pageAccess.values()) {
      if (accessType !== 'none') {
        accessiblePages++
      }
      if (accessType === 'write' || accessType === 'read+write') {
        writablePages++
      }
    }

    return {
      maxAddress: '4GB',
      totalPages: Number(this.TOTAL_PAGES),
      pageSize: Number(this.CPVM_PAGE_SIZE),
      allocatedPages: this.pageAccess.size,
      allocatedBytes: this.memoryData.size,
      accessiblePages,
      writablePages,
    }
  }

  /**
   * Clear all memory (useful for testing)
   */
  clear(): void {
    this.memoryData.clear()
    this.pageAccess.clear()

    // Re-initialize reserved memory
    const reservedPages =
      MEMORY_CONFIG.RESERVED_MEMORY_START / this.CPVM_PAGE_SIZE
    for (let i = 0n; i < reservedPages; i++) {
      this.pageAccess.set(i, 'read')
    }

    logger.debug('PVMRAM cleared')
  }
}
