/**
 * PVM RAM Implementation (AssemblyScript)
 *
 * Implements Gray Paper RAM specification using contiguous memory regions
 * Gray Paper reference: pvm.tex equation 770-802
 */

import { alignToPage, alignToZone } from './alignment-helpers'
import { INIT_CONFIG, MEMORY_CONFIG, REGISTER_INIT_ARGS_SEGMENT_START, REGISTER_INIT_STACK_SEGMENT_END } from './config'
import { FaultCheckResult, MemoryAccessType, RAM, ReadResult, WriteResult } from './types'

/**
 * Page map entry
 */
export class PageMapEntry {
  address: u64
  length: i32
  isWritable: bool
  accessType: MemoryAccessType

  constructor(address: u64, length: i32, isWritable: bool, accessType: MemoryAccessType) {
    this.address = address
    this.length = length
    this.isWritable = isWritable
    this.accessType = accessType
  }
}

/**
 * PVM RAM Implementation
 *
 * Manages all PVM memory regions according to Gray Paper specification
 */
export class PVMRAM implements RAM {
  // Fixed addresses according to Gray Paper (pvm.tex equation 770-802)
  roDataAddress: u32 = INIT_CONFIG.ZONE_SIZE // 65536 (2^16)
  argumentDataAddress: u32 = REGISTER_INIT_ARGS_SEGMENT_START() // 0xFEFF0000
  stackAddressEnd: u32 = REGISTER_INIT_STACK_SEGMENT_END() // 0xFEFE0000

  // Variable addresses (set during initialization)
  stackAddress: u32 = 0
  heapStartAddress: u32 = 0
  heapEndAddress: u32 = 0
  roDataAddressEnd: u32 = 0
  currentHeapPointer: u32 = 0
  argumentDataEnd: u32 = 0

  // Page-based memory: Map from page index to Uint8Array(4096)
  // Each page is a separate 4KB array - created on-demand when initPage is called
  pages: Map<u32, Uint8Array> = new Map<u32, Uint8Array>()

  // Page access tracking: Map from page index to access type
  // Only stores pages that have been explicitly initialized
  pageAccess: Map<u32, MemoryAccessType> = new Map<u32, MemoryAccessType>()

  MAX_ADDRESS: u32 = 0xffffffff // 4GB address space

  /**
   * Initialize memory layout according to Gray Paper equation 770-802
   *
   * @param argumentData - Argument data (a)
   * @param readOnlyData - Read-only data section (o)
   * @param heapData - Read-write data section (w) -> initial heap data
   * @param stackSize - Stack size (s)
   * @param heapZeroPaddingSize - Heap zero padding size (z) (in number of pages)
   */
  initializeMemoryLayout(
    argumentData: Uint8Array,
    readOnlyData: Uint8Array,
    heap: Uint8Array,
    stackSize: u32,
    heapZeroPaddingSize: u32,
  ): void {
    const readOnlyDataLength = readOnlyData.length
    const heapSize = heap.length
    const argumentDataLength = argumentData.length

    // Calculate addresses
    const heapStartAddress =
      2 * INIT_CONFIG.ZONE_SIZE + alignToZone(readOnlyDataLength)
    const heapEndAddress = heapStartAddress + alignToPage(heapSize)
    const heapZerosEndAddress =
      heapEndAddress + heapZeroPaddingSize * MEMORY_CONFIG.PAGE_SIZE
    // const heapSizeWithPadding = heapZerosEndAddress - heapStartAddress

    const argumentDataStartAddress = this.argumentDataAddress
    const argumentDataEndAddress =
      argumentDataStartAddress + alignToPage(argumentDataLength)
    const argumentDataZeroPaddingEndAddress =
      argumentDataEndAddress + alignToPage(argumentDataLength)

    const stackEndAddress = this.stackAddressEnd
    const stackStartAddress = stackEndAddress - alignToPage(stackSize)

    const readOnlyZoneStartAddress = this.roDataAddress
    const readOnlyZoneEndAddress =
      readOnlyZoneStartAddress + alignToPage(readOnlyDataLength)

    // Create pages for all memory regions and copy data
    // Pages are created on-demand, but we initialize them here for efficiency
    
    // Copy argument data to pages
    if (argumentDataLength > 0) {
      this.writeOctetsDuringInitialization(argumentDataStartAddress, argumentData)
    }
    
    // Copy read-only data to pages
    if (readOnlyDataLength > 0) {
      this.writeOctetsDuringInitialization(readOnlyZoneStartAddress, readOnlyData)
    }
    
    // Copy heap data to pages
    if (heapSize > 0) {
      this.writeOctetsDuringInitialization(heapStartAddress, heap)
    }
    
    // Update variable addresses
    this.argumentDataEnd = argumentDataZeroPaddingEndAddress
    this.roDataAddressEnd = readOnlyZoneEndAddress
    this.stackAddress = stackStartAddress
    this.heapStartAddress = heapStartAddress
    this.heapEndAddress = heapEndAddress
    this.currentHeapPointer = heapZerosEndAddress

    // Initialize pages and set access rights for all memory regions using initPage
    // This ensures pages are created and access rights are set together
    
    // Read-only data region (READ access)
    if (readOnlyDataLength > 0) {
      const roDataSize = readOnlyZoneEndAddress - readOnlyZoneStartAddress
      this.initPage(
        readOnlyZoneStartAddress,
        roDataSize,
        MemoryAccessType.READ,
      )
    }

    // Argument data region (READ access)
    if (argumentDataLength > 0) {
      const argsSize = argumentDataZeroPaddingEndAddress - argumentDataStartAddress

      this.initPage(
        argumentDataStartAddress,
        argsSize,
        MemoryAccessType.READ,
      )
    }

    // Stack region (WRITE access, zero-initialized per Gray Paper)
    if (stackStartAddress < stackEndAddress) {
      const stackSizeActual = stackEndAddress - stackStartAddress
      this.initPage(
        stackStartAddress,
        stackSizeActual,
        MemoryAccessType.WRITE,
      )
    }

    // Heap region (WRITE access)
    if (heapSize > 0) {
      const heapSizeActual = heapEndAddress - heapStartAddress
      
      this.initPage(
        heapStartAddress,
        heapSizeActual,
        MemoryAccessType.WRITE,
      )
    }
    
    // Heap zero padding region (WRITE access)
    if (heapEndAddress < heapZerosEndAddress) {
      const heapPaddingSize = heapZerosEndAddress - heapEndAddress

      this.initPage(
        heapEndAddress,
        heapPaddingSize,
        MemoryAccessType.WRITE,
      )
    }

  }

  /**
   * Allocate additional pages for dynamic heap growth (SBRK)
   */
  allocatePages(startPage: u32, count: u32): void {
    // Create pages and set access rights
    const endPage = startPage + count
    for (let pageIndex = startPage; pageIndex < endPage; pageIndex++) {
      // Create page if it doesn't exist
      this.getOrCreatePage(pageIndex)
      // Set write access
      this.pageAccess.set(pageIndex, MemoryAccessType.WRITE)
    }

    // Update heap pointer to reflect allocated pages
    const endAddress = endPage * MEMORY_CONFIG.PAGE_SIZE
    if (endAddress > this.currentHeapPointer) {
      this.currentHeapPointer = endAddress
    }
  }

  /**
   * Get page index for an address
   */
  getPageIndex(address: u32): u32 {
    return address / MEMORY_CONFIG.PAGE_SIZE
  }

  /**
   * Get page offset within a page for an address
   */
  private getPageOffset(address: u32): u32 {
    return address % MEMORY_CONFIG.PAGE_SIZE
  }

  /**
   * Get or create a page at the given page index
   * Returns null if page cannot be created
   */
  private getOrCreatePage(pageIndex: u32): Uint8Array | null {
    if (this.pages.has(pageIndex)) {
      return this.pages.get(pageIndex) as Uint8Array
    }
    // Create new page (4KB)
    const page = new Uint8Array(MEMORY_CONFIG.PAGE_SIZE)
    this.pages.set(pageIndex, page)
    return page
  }

  /**
   * Get a page at the given page index (returns null if not exists)
   */
  private getPage(pageIndex: u32): Uint8Array | null {
    if (this.pages.has(pageIndex)) {
      const page = this.pages.get(pageIndex)
      return page !== null ? page : null
    }
    return null
  }

  /**
   * Initialize a memory page (used for test vectors)
   * Creates 4KB pages as needed, regardless of region
   */
  initPage(
    address: u32,
    length: u32,
    accessType: MemoryAccessType,
  ): void {
    if (length === 0) {
      return // Nothing to initialize
    }

    // Calculate which pages this address range covers
    const startPage = this.getPageIndex(address)
    const endAddress = address + length - 1
    const endPage = this.getPageIndex(endAddress)
    

    // Create/ensure all pages in the range exist
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const pageAddress = pageIndex * MEMORY_CONFIG.PAGE_SIZE
      // Get or create the page (creates a new 4KB array if needed)
      const page = this.getOrCreatePage(pageIndex)
      
      if (page === null) {
        // Failed to create page
        return
      }
      
        // Set page access rights
        this.pageAccess.set(pageIndex, accessType)
    }
  }

  /**
   * Set memory page access rights for a range of pages
   */
  setPageAccessRightsForRange(
    startPage: u32,
    endPage: u32,
    accessType: MemoryAccessType,
  ): void {
    for (let pageIndex = startPage; pageIndex < endPage; pageIndex++) {
      this.pageAccess.set(pageIndex, accessType)
    }
  }

  /**
   * Set memory page access rights for an address range
   */
  setPageAccessRights(
    address: u32,
    length: u32,
    accessType: MemoryAccessType,
  ): void {
    const startPage = this.getPageIndex(address)
    const endAddress = address + length - 1
    const endPage = this.getPageIndex(endAddress)
    
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      this.pageAccess.set(pageIndex, accessType)
    }
  }


  /**
   * Get memory page access type for an address
   */
  getPageAccessType(address: u64): MemoryAccessType {
    const pageIndex = this.getPageIndex(u32(address))
    return this.pageAccess.has(pageIndex) ? (this.pageAccess.get(pageIndex) as MemoryAccessType) : MemoryAccessType.NONE
  }

  /**
   * Read multiple octets from memory
   * Uses page-based memory access
   */
  readOctets(
    address: u32,
    count: u32,
  ): ReadResult {
    const readableResult = this.isReadableWithFault(address, count)
    if (!readableResult.success) {
      return new ReadResult(null, readableResult.faultAddress)
    }

    const addr = u32(address)
    const length = u32(count)
    const result = new Uint8Array(length)
    let resultOffset = 0
    let currentAddr = addr
    const endAddr = addr + length

    // Read across pages if needed
    while (currentAddr < endAddr) {
      const pageIndex = this.getPageIndex(currentAddr)
      const pageOffset = this.getPageOffset(currentAddr)
      const page = this.getPage(pageIndex)
      
      if (page === null) {
        // Page doesn't exist - fault
        return new ReadResult(null, pageIndex * MEMORY_CONFIG.PAGE_SIZE)
      }

      // Calculate how many bytes to read from this page
      const bytesInPage = min(length - resultOffset, MEMORY_CONFIG.PAGE_SIZE - pageOffset)
      const pageEnd = pageOffset + bytesInPage
      
      // Copy data from page to result
      const pageData: Uint8Array = page // Explicit type after null check
      for (let i = pageOffset; i < pageEnd; i++) {
        result[resultOffset++] = pageData[i]
      }
      
      currentAddr += bytesInPage
    }

    return new ReadResult(result, 0)
  }

  /**
   * Write multiple octets to memory
   * Uses page-based memory access
   */
  writeOctets(address: u32, values: Uint8Array): WriteResult {
    const writableResult = this.isWritableWithFault(
      address,
      u32(values.length),
    )
    if (!writableResult.success) {
      return new WriteResult(true, writableResult.faultAddress !== 0 ? writableResult.faultAddress : 0xFFFFFFFF)
    }

    const addr = u32(address)
    const length = values.length
    let valuesOffset = 0
    let currentAddr = addr
    const endAddr = addr + length

    // Write across pages if needed
    while (currentAddr < endAddr) {
      const pageIndex = this.getPageIndex(currentAddr)
      const pageOffset = this.getPageOffset(currentAddr)
      const page = this.getPage(pageIndex)
      
      if (page === null) {
        // Page doesn't exist - fault
        return new WriteResult(true, pageIndex * MEMORY_CONFIG.PAGE_SIZE)
      }

      // Calculate how many bytes to write to this page
      const bytesInPage = min(length - valuesOffset, MEMORY_CONFIG.PAGE_SIZE - pageOffset)
      const pageEnd = pageOffset + bytesInPage
      
      // Copy data from values to page
      const pageData: Uint8Array = page // Explicit type after null check
      for (let i = pageOffset; i < pageEnd; i++) {
        pageData[i] = values[valuesOffset++]
      }
      
      currentAddr += bytesInPage
    }

      return new WriteResult(false, 0)
  }

  /**
   * Write to memory during initialization, bypassing writable checks
   * Uses page-based memory access
   */
  writeOctetsDuringInitialization(address: u32, values: Uint8Array): void {
    const addr = u32(address)
    const length = values.length
    let valuesOffset = 0
    let currentAddr = addr
    const endAddr = addr + length

    // Write across pages if needed
    while (currentAddr < endAddr) {
      const pageIndex = this.getPageIndex(currentAddr)
      const pageOffset = this.getPageOffset(currentAddr)
      
      // Get or create the page (creates if needed during initialization)
      const page = this.getOrCreatePage(pageIndex)
      if (page === null) {
        return // Failed to create page
      }

      // Calculate how many bytes to write to this page
      const pageData: Uint8Array = page // Explicit type after null check
      const bytesInPage = min(length - valuesOffset, MEMORY_CONFIG.PAGE_SIZE - pageOffset)
      const pageEnd = pageOffset + bytesInPage
      
      // Copy data from values to page
      for (let i = pageOffset; i < pageEnd; i++) {
        pageData[i] = values[valuesOffset++]
      }
      
      currentAddr += bytesInPage
    }
  }

  isReadableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    if (address + size > this.MAX_ADDRESS) {
      return new FaultCheckResult(false, address)
    }

    const endRequestedAddress = address + size
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(endRequestedAddress - 1)
      
    // Check all pages in the range have READ or WRITE access
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const accessType = this.pageAccess.has(pageIndex) 
        ? (this.pageAccess.get(pageIndex) as MemoryAccessType)
        : MemoryAccessType.NONE
      
      if (accessType === MemoryAccessType.NONE) {
        // Page not accessible - return fault at page start
        return new FaultCheckResult(false, pageIndex * MEMORY_CONFIG.PAGE_SIZE)
      }
    }
    
    return new FaultCheckResult(true, 0)
  }

  isWritableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    if (address + size > this.MAX_ADDRESS) {
      const faultAddress =
        this.getPageIndex(address) * MEMORY_CONFIG.PAGE_SIZE
      return new FaultCheckResult(false, faultAddress)
    }

    const endRequestedAddress = address + size
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(endRequestedAddress - 1)
    
    // Check all pages in the range have WRITE access
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const pageAddress = pageIndex * MEMORY_CONFIG.PAGE_SIZE
      const hasAccess = this.pageAccess.has(pageIndex)
      const accessType = hasAccess
        ? (this.pageAccess.get(pageIndex) as MemoryAccessType)
        : MemoryAccessType.NONE
      
      const accessTypeStr = accessType === MemoryAccessType.READ ? 'READ' : 
                           accessType === MemoryAccessType.WRITE ? 'WRITE' : 'NONE'
      
      if (accessType !== MemoryAccessType.WRITE) {
        // Page not writable - return fault at page start
        return new FaultCheckResult(false, pageAddress)
      }
    }

    return new FaultCheckResult(true, 0)
  }

  /**
   * Get a summary of all allocated RAM pages with their access rights
   */
  getPageMap(): PageMapEntry[] {
    const pages: PageMapEntry[] = []

    const pageIndices = this.pageAccess.keys()
    for (let i: i32 = 0; i < i32(pageIndices.length); i++) {
      const pageIndex = pageIndices[i]
      if (this.pageAccess.has(pageIndex)) {
        const accessType = this.pageAccess.get(pageIndex) as MemoryAccessType
        const startAddress = u64(pageIndex * MEMORY_CONFIG.PAGE_SIZE)
          pages.push(new PageMapEntry(
          startAddress,
          MEMORY_CONFIG.PAGE_SIZE,
            accessType === MemoryAccessType.WRITE,
            accessType,
          ))
      }
    }

    return pages
  }

  /**
   * Get memory contents for a specific address range
   * Uses page-based memory access
   */
  getMemoryContents(address: u64, length: i32): u64[] {
    const addr = u32(address)
    const result: u64[] = []
    let currentAddr = addr
    const endAddr = addr + length

    // Read across pages if needed
    while (currentAddr < endAddr) {
      const pageIndex = this.getPageIndex(currentAddr)
      const pageOffset = this.getPageOffset(currentAddr)
      const page = this.getPage(pageIndex)
      
      if (page === null) {
        // Page doesn't exist - return zeros
        const remaining = endAddr - currentAddr
        for (let i = 0; i < remaining; i++) {
          result.push(u64(0))
    }
        break
      }

      // Calculate how many bytes to read from this page
      const pageData: Uint8Array = page // Explicit type after null check
      const bytesInPage = min(i32(endAddr - currentAddr), i32(MEMORY_CONFIG.PAGE_SIZE - pageOffset))
      const pageEnd = pageOffset + bytesInPage
      
      // Copy data from page to result
      for (let i = pageOffset; i < pageEnd; i++) {
        result.push(u64(pageData[i]))
      }
      
      currentAddr += u32(bytesInPage)
    }

    return result
  }

  /**
   * Clear all memory (zero out pages but keep them allocated)
   */
  clear(): void {
    // Clear all pages (zero them out)
    const pageIndices = this.pages.keys()
    for (let i: i32 = 0; i < i32(pageIndices.length); i++) {
      const pageIndex = pageIndices[i]
      const page = this.pages.get(pageIndex)!
      page.fill(0)
    }
    
    // Reset address variables
    this.stackAddress = 0
    this.heapStartAddress = 0
    this.heapEndAddress = 0
    this.roDataAddressEnd = 0
    this.currentHeapPointer = 0
    this.argumentDataEnd = 0
  }

  /**
   * Reset RAM to initial state
   * Clears all memory, page access rights, and resets all address variables
   */
  reset(): void {
    // Clear page access rights
    this.pageAccess.clear()
    
    // Clear all pages
    this.pages.clear()
    
    // Reset all address variables
    this.stackAddress = 0
    this.heapStartAddress = 0
    this.heapEndAddress = 0
    this.roDataAddressEnd = 0
    this.currentHeapPointer = 0
    this.argumentDataEnd = 0
  }

  /**
   * Get page dump for a specific page index
   * Returns a copy of the page data (4KB) or zeros if page doesn't exist
   */
  getPageDump(pageIndex: u32): Uint8Array {
    const page = this.getPage(pageIndex)
    if (page === null) {
      // Return zeros if page doesn't exist
      return new Uint8Array(MEMORY_CONFIG.PAGE_SIZE)
    }
    // Return a copy of the page
    const result = new Uint8Array(MEMORY_CONFIG.PAGE_SIZE)
    const pageData: Uint8Array = page // Explicit type to help flow analysis
    result.set(pageData)
    return result
  }
}
