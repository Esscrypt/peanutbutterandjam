import { logger } from '@pbnj/core'
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
    if (BigInt(length) % this.CPVM_PAGE_SIZE !== 0n) {
      throw new Error(`Page length must be divisible by ${this.CPVM_PAGE_SIZE}`)
    }

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
    if (BigInt(length) % this.CPVM_PAGE_SIZE !== 0n) {
      throw new Error(`Page length must be divisible by ${this.CPVM_PAGE_SIZE}`)
    }
    const startPage = this.getPageIndex(address)
    const count = BigInt(length) / this.CPVM_PAGE_SIZE
    for (let i = 0; i < count; i++) {
      const pageIndex = startPage + BigInt(i)
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

  readOctets(
    address: bigint,
    count: bigint,
  ): [Uint8Array | null, bigint | null] {
    // Check if entire range is readable first
    const [readable, faultAddress] = this.isReadableWithFault(address, count)
    if (!readable) {
      return [null, faultAddress]
    }

    const result = new Uint8Array(Number(count))
    for (let i = 0; i < Number(count); i++) {
      result[i] = this.memoryData.get(address + BigInt(i)) ?? 0
    }
    return [result, null]
  }

  writeOctets(address: bigint, values: Uint8Array): bigint | null {
    // Check if entire range is writable first
    const [writable, faultAddress] = this.isWritableWithFault(
      address,
      BigInt(values.length),
    )
    if (!writable) {
      return faultAddress
    }

    // Write each byte individually (O(N) but necessary for sparse storage)
    for (let i = 0; i < values.length; i++) {
      this.memoryData.set(address + BigInt(i), values[i])
    }
    return null
  }

  isReadableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return [false, address]
    }

    // Gray Paper: readable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] ≠ none}
    // Check all pages that the address range spans
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + size - 1n)

    // Check each page in the range
    for (let page = startPage; page <= endPage; page++) {
      const pageAccess = this.pageAccess.get(page)
      if (pageAccess === 'none' || pageAccess === undefined) {
        // Gray Paper: fault address is the start of the page containing the fault
        // Formula: Cpvmpagesize × ⌊min(x) ÷ Cpvmpagesize⌋
        const faultAddress = page * this.CPVM_PAGE_SIZE
        return [false, faultAddress]
      }
    }

    return [true, null]
  }

  isWritableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return [false, address]
    }

    // Gray Paper: writable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] = W}
    // Check all pages that the address range spans
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + size - 1n)

    // Check each page in the range
    for (let page = startPage; page <= endPage; page++) {
      const pageAccess = this.pageAccess.get(page)
      if (pageAccess !== 'write' && pageAccess !== 'read+write') {
        // Gray Paper: fault address is the start of the page containing the fault
        // Formula: Cpvmpagesize × ⌊min(x) ÷ Cpvmpagesize⌋
        const faultAddress = page * this.CPVM_PAGE_SIZE
        return [false, faultAddress]
      }
    }

    return [true, null]
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
