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
  public memoryData: Map<bigint, number> = new Map()

  // Gray Paper: ram_access - sparse storage for page access rights
  // Using Map for O(1) access and dynamic growth
  private readonly pageAccess: Map<bigint, MemoryAccessType> = new Map()

  // Track padding pages that should be excluded from pageMap output
  // Padding pages have access rights but are purely for alignment
  private readonly paddingPages: Set<bigint> = new Set()

  private readonly MAX_ADDRESS = 2 ** 32 // 4GB address space
  private readonly TOTAL_PAGES = this.MAX_ADDRESS / MEMORY_CONFIG.PAGE_SIZE // 1,048,576 pages

  constructor() {
    // Initialize reserved memory (first 64KB) as readable
    const reservedPages =
      MEMORY_CONFIG.RESERVED_MEMORY_START / MEMORY_CONFIG.PAGE_SIZE
    for (let i = 0; i < reservedPages; i++) {
      this.pageAccess.set(BigInt(i), 'read')
    }
  }

  /**
   * Get page index for an address
   * Gray Paper: ⌊address / Cpvmpagesize⌋
   */
  private getPageIndex(address: bigint): bigint {
    return address / BigInt(MEMORY_CONFIG.PAGE_SIZE)
  }

  /**
   * Initialize a memory page (used for test vectors)
   * @param address - Base address of the page
   * @param length - Length of the page in bytes
   * @param accessType - Access type: 'none', 'read', 'write'
   */
  initializePage(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
  ): void {
    if (BigInt(length) % BigInt(MEMORY_CONFIG.PAGE_SIZE) !== 0n) {
      throw new Error(
        `Page length must be divisible by ${MEMORY_CONFIG.PAGE_SIZE}`,
      )
    }

    this.setPageAccessRights(address, length, accessType)
  }

  /**
   * Set memory page access rights (Gray Paper PAGES function)
   * @param address - Base address of the page
   * @param length - Length of the page in bytes
   * @param accessType - Access type: 'none', 'read', 'write'
   * @param isPadding - If true, mark these pages as padding (excluded from pageMap)
   */
  setPageAccessRights(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
    isPadding = false,
  ): void {
    if (BigInt(length) % BigInt(MEMORY_CONFIG.PAGE_SIZE) !== 0n) {
      throw new Error(
        `Page length must be divisible by ${MEMORY_CONFIG.PAGE_SIZE}. Actual length: ${length}`,
      )
    }
    const startPage = this.getPageIndex(address)
    const count = BigInt(length) / BigInt(MEMORY_CONFIG.PAGE_SIZE)
    for (let i = 0; i < count; i++) {
      const pageIndex = startPage + BigInt(i)
      if (pageIndex >= 0n && pageIndex < this.TOTAL_PAGES) {
        this.pageAccess.set(pageIndex, accessType)
        if (isPadding) {
          this.paddingPages.add(pageIndex)
        }
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
        const faultAddress = page * BigInt(MEMORY_CONFIG.PAGE_SIZE)
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
      if (pageAccess !== 'write') {
        // Gray Paper: fault address is the start of the page containing the fault
        // Formula: Cpvmpagesize × ⌊min(x) ÷ Cpvmpagesize⌋
        const faultAddress = page * BigInt(MEMORY_CONFIG.PAGE_SIZE)
        return [false, faultAddress]
      }
    }

    return [true, null]
  }

  /**
   * Get a summary of all allocated RAM pages with their access rights
   * Returns an array of page information sorted by address
   *
   * Filters out reserved memory (first 64KB) and returns individual pages
   * to match test vector format (no merging of consecutive pages)
   *
   * Includes all pages with access rights (allocated sections), even if empty,
   * but excludes padding pages that are purely for alignment.
   */
  getPageMap(): Array<{
    address: bigint
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
  }> {
    const pages: Array<{
      address: bigint
      length: number
      'is-writable': boolean
      accessType: MemoryAccessType
    }> = []

    // Filter out reserved memory (first 64KB = 16 pages) and 'none' access
    const reservedPages =
      MEMORY_CONFIG.RESERVED_MEMORY_START / MEMORY_CONFIG.PAGE_SIZE
    const sortedPages = Array.from(this.pageAccess.entries())
      .filter(
        ([pageIndex, access]) =>
          access !== 'none' && pageIndex >= reservedPages,
      )
      .sort(([a], [b]) => {
        if (a < b) return -1
        if (a > b) return 1
        return 0
      })

    // Return individual pages (no merging) to match test vector format
    // Include all pages with access rights (allocated sections), even if empty
    // This matches program.json format which includes empty allocated pages
    // Exclude padding pages (they have access rights but are purely for alignment)
    for (const [pageIndex, accessType] of sortedPages) {
      // Skip padding pages
      if (this.paddingPages.has(pageIndex)) {
        continue
      }

      const pageAddress = pageIndex * BigInt(MEMORY_CONFIG.PAGE_SIZE)

      pages.push({
        address: pageAddress,
        length: MEMORY_CONFIG.PAGE_SIZE, // Always one page (4096 bytes)
        'is-writable': accessType === 'write',
        accessType: accessType,
      })
    }

    return pages
  }

  /**
   * Get memory contents for a specific address range
   * Returns array of byte values (0-255) for addresses that have data
   * or are within the range (implicitly 0 for addresses without data)
   */
  getMemoryContents(address: bigint, length: number): number[] {
    const contents: number[] = []
    for (let i = 0; i < length; i++) {
      const addr = address + BigInt(i)
      // In sparse storage, undefined means implicitly 0
      contents.push(this.memoryData.get(addr) ?? 0)
    }
    return contents
  }

  /**
   * Get page map as JSON-serializable format (for logging)
   */
  getPageMapJSON(): Array<{
    address: string
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
  }> {
    return this.getPageMap().map((page) => ({
      address: page.address.toString(),
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
    }))
  }

  /**
   * Get page map with memory contents (for verification against test vectors)
   * Returns pages with their actual memory contents
   */
  getPageMapWithContents(): Array<{
    address: bigint
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
    contents: number[]
  }> {
    return this.getPageMap().map((page) => ({
      address: page.address,
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
      contents: this.getMemoryContents(page.address, page.length),
    }))
  }

  /**
   * Get page map with contents as JSON-serializable format (for verification)
   */
  getPageMapWithContentsJSON(): Array<{
    address: string
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
    contents: number[]
  }> {
    return this.getPageMapWithContents().map((page) => ({
      address: page.address.toString(),
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
      contents: page.contents,
    }))
  }

  /**
   * Clear all memory (useful for testing)
   */
  clear(): void {
    this.memoryData.clear()
    this.pageAccess.clear()

    // Re-initialize reserved memory
    const reservedPages =
      MEMORY_CONFIG.RESERVED_MEMORY_START / MEMORY_CONFIG.PAGE_SIZE
    for (let i = 0; i < reservedPages; i++) {
      this.pageAccess.set(BigInt(i), 'read')
    }

    logger.debug('PVMRAM cleared')
  }
}
