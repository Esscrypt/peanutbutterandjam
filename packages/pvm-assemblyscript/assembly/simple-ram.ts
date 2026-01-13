/**
 * Simple RAM Implementation (AssemblyScript)
 *
 * A simplified RAM implementation with page access rights but without regions.
 * Uses a flat memory space with per-page access control (READ, WRITE, NONE).
 * Used for runBlob and test vectors where we want a simple memory model.
 */

import { FaultCheckResult, ReadResult, RAM, MemoryAccessType, WriteResult } from './types'
import { MEMORY_CONFIG } from './config'

/**
 * Simple RAM - flat memory space with page access rights
 * 
 * Uses a single contiguous Uint8Array for memory storage that grows as needed.
 * Tracks page access rights (READ, WRITE, NONE) per page using a Map for efficient
 * sparse storage of only initialized pages.
 */
export class SimpleRAM implements RAM {
  // Single contiguous memory storage (grows as needed)
  private memory: Uint8Array = new Uint8Array(0)
  
  // Page access rights: Map from page index to MemoryAccessType
  // Only stores pages that have been explicitly initialized
  // Uninitialized pages default to NONE
  private pageAccess: Map<u32, MemoryAccessType> = new Map<u32, MemoryAccessType>()
  
  // Track current heap pointer for SBRK operations
  currentHeapPointer: u32 = 0

  // JIP-6 trace support: Track last load/store for each instruction step
  lastLoadAddress: u32 = 0
  lastLoadValue: u64 = 0
  lastStoreAddress: u32 = 0
  lastStoreValue: u64 = 0

  /**
   * Clear last load/store tracking (call at start of each instruction)
   */
  clearLastMemoryOp(): void {
    this.lastLoadAddress = 0
    this.lastLoadValue = 0
    this.lastStoreAddress = 0
    this.lastStoreValue = 0
  }

  /**
   * Get page index for an address
   */
  private getPageIndex(address: u32): u32 {
    return address / MEMORY_CONFIG.PAGE_SIZE
  }


  /**
   * Ensure memory is large enough for the given address range
   * Grows the single contiguous memory array as needed
   */
  private ensureMemorySize(requiredSize: u32): void {
    if (u32(this.memory.length) >= requiredSize) {
      return // Already large enough
    }
    
    // Grow to next page boundary
    const alignedSize = ((requiredSize / MEMORY_CONFIG.PAGE_SIZE) + 1) * MEMORY_CONFIG.PAGE_SIZE
    const newMemory = new Uint8Array(alignedSize)
    
    // Copy existing data
    if (this.memory.length > 0) {
      newMemory.set(this.memory, 0)
    }
    
    // New memory is zero-initialized by default
    this.memory = newMemory
  }

  /**
   * Get page access type for a page index
   * Returns NONE by default for uninitialized pages
   */
  private getPageAccess(pageIndex: u32): MemoryAccessType {
    // Check if page exists in map, return NONE if not found
    return this.pageAccess.has(pageIndex) ? this.pageAccess.get(pageIndex) : MemoryAccessType.NONE
  }

  /**
   * Check if an address range has the required access type
   * Returns fault address (page start) if access is denied, 0 if allowed
   */
  private checkAccess(address: u32, size: u32, requiredAccess: MemoryAccessType): u32 {
    const startPage = this.getPageIndex(address)
    const endPage = this.getPageIndex(address + size - 1)
    
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      const pageAccess = this.getPageAccess(pageIndex)
      
      // Check if page has required access
      if (requiredAccess === MemoryAccessType.READ) {
        // For READ, need READ or WRITE
        if (pageAccess === MemoryAccessType.NONE) {
          return pageIndex * MEMORY_CONFIG.PAGE_SIZE
        }
      } else if (requiredAccess === MemoryAccessType.WRITE) {
        // For WRITE, need WRITE
        if (pageAccess !== MemoryAccessType.WRITE) {
          return pageIndex * MEMORY_CONFIG.PAGE_SIZE
        }
      }
    }
    
    return 0 // No fault
  }

  /**
   * Read multiple octets from memory
   */
  readOctets(address: u32, count: u32): ReadResult {
    if (count === 0) {
      return new ReadResult(new Uint8Array(0), 0)
    }

    // Check read access
    const faultAddress = this.checkAccess(address, count, MemoryAccessType.READ)
    if (faultAddress !== 0) {
      return new ReadResult(null, faultAddress)
    }

    // Ensure memory is allocated
    this.ensureMemorySize(address + count)
    
    // Read directly from contiguous memory
    const result = new Uint8Array(count)
    const sourceView = this.memory.subarray(address, address + count)
    result.set(sourceView, 0)

    // JIP-6 trace support: Track last load address and value
    this.lastLoadAddress = address
    if (count > 0) {
      let value: u64 = 0
      const bytesToRead = min(count, 8)
      for (let i: u32 = 0; i < bytesToRead; i++) {
        value |= u64(result[i]) << (i * 8)
      }
      this.lastLoadValue = value
    }

    return new ReadResult(result, 0) // No faults
  }

  /**
   * Write multiple octets to memory
   */
  writeOctets(address: u32, values: Uint8Array): WriteResult {
    if (values.length === 0) {
      return new WriteResult(false, 0)
    }

    // Check write access (same pattern as ram.ts)
    const writableResult = this.isWritableWithFault(address, u32(values.length))
    if (!writableResult.success) {
      return new WriteResult(true, writableResult.faultAddress !== 0 ? writableResult.faultAddress : 0xFFFFFFFF)
    }

    // Ensure memory is allocated
    this.ensureMemorySize(address + values.length)
    
    // Write directly to contiguous memory
    this.memory.set(values, address)

    // Update heap pointer if writing beyond current heap
    if (address + values.length > this.currentHeapPointer) {
      this.currentHeapPointer = address + values.length
    }

    // JIP-6 trace support: Track last store address and value
    this.lastStoreAddress = address
    if (values.length > 0) {
      let value: u64 = 0
      const bytesToRead = min(u32(values.length), 8)
      for (let i: u32 = 0; i < bytesToRead; i++) {
        value |= u64(values[i]) << (i * 8)
      }
      this.lastStoreValue = value
    }

    return new WriteResult(false, 0) // No faults
  }

  /**
   * Allocate pages (for SBRK)
   */
  allocatePages(startPage: u32, count: u32): void {
    // Ensure memory is allocated for these pages
    const startAddress = startPage * MEMORY_CONFIG.PAGE_SIZE
    const endAddress = (startPage + count) * MEMORY_CONFIG.PAGE_SIZE
    this.ensureMemorySize(endAddress)
    
    // Update heap pointer
    if (endAddress > this.currentHeapPointer) {
      this.currentHeapPointer = endAddress
    }
  }

  /**
   * Check if memory is readable
   */
  isReadableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    const faultAddress = this.checkAccess(address, size, MemoryAccessType.READ)
    return new FaultCheckResult(faultAddress === 0, faultAddress)
  }

  /**
   * Check if memory is writable
   * Matches ram.ts implementation: finds minimum inaccessible address, returns page start
   */
  isWritableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    const endRequestedAddress = address + size
    let minInaccessibleAddress: u32 = 0xFFFFFFFF // Sentinel value for "not found"

    // Check each address in the range to find the first one that's not writable
    for (let addr: u32 = address; addr < endRequestedAddress; addr++) {
      const pageIndex = this.getPageIndex(addr)
      const pageAccess = this.getPageAccess(pageIndex)
      
      // For WRITE, need WRITE access
      if (pageAccess !== MemoryAccessType.WRITE) {
        minInaccessibleAddress = addr
        break
      }
    }

    if (minInaccessibleAddress !== 0xFFFFFFFF) {
      // Gray Paper: fault address is page start of the minimum inaccessible address
      const faultAddress = this.getPageIndex(minInaccessibleAddress) * MEMORY_CONFIG.PAGE_SIZE
      return new FaultCheckResult(false, faultAddress)
    }

    return new FaultCheckResult(true, 0)
  }

  /**
   * Initialize memory layout (no-op for SimpleRAM)
   */
  initializeMemoryLayout(
    argumentData: Uint8Array,
    readOnlyData: Uint8Array,
    readWriteData: Uint8Array,
    stackSize: u32,
    heapZeroPaddingSize: u32,
  ): void {
    // No-op: SimpleRAM doesn't use regions
    // If needed, we could write the data to appropriate addresses
    // For now, just update heap pointer
    if (readWriteData.length > 0) {
      // Assume heap starts at 2 * 65536 (standard heap start)
      const heapStart = 2 * 65536
      this.writeOctets(heapStart, readWriteData)
    }
  }

  /**
   * Set page access rights for an address range
   */
  setPageAccessRights(address: u32, length: u32, accessType: MemoryAccessType): void {
    if (length === 0) {
      return // Nothing to set
    }
    
    const startPage = this.getPageIndex(address)
    // Calculate end page: (address + length - 1) / PAGE_SIZE
    // Use safe calculation to avoid underflow
    const endAddress = address + length - 1
    const endPage = this.getPageIndex(endAddress)
    
    // Set access rights for all pages in the range
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      this.pageAccess.set(pageIndex, accessType)
    }
  }

  /**
   * Initialize a memory page (creates the page if needed and sets access rights)
   * This is the interface method required by RAM interface
   */
  initPage(address: u32, length: u32, accessType: MemoryAccessType): void {
    if (length === 0) {
      return // Nothing to initialize
    }
    
    // Ensure memory is allocated for this address range
    this.ensureMemorySize(address + length)
    
    const startPage = this.getPageIndex(address)
    // Calculate end page: (address + length - 1) / PAGE_SIZE
    // Use safe calculation to avoid underflow
    const endAddress = address + length - 1
    const endPage = this.getPageIndex(endAddress)
    
    // Set access rights for all pages in the range
    for (let pageIndex = startPage; pageIndex <= endPage; pageIndex++) {
      this.pageAccess.set(pageIndex, accessType)
    }
  }

  /**
   * Write to memory during initialization (bypasses access rights)
   */
  writeOctetsDuringInitialization(address: u32, values: Uint8Array): void {
    // Bypass access rights checking during initialization
    // This allows writing to read-only pages during setup
    if (values.length === 0) {
      return
    }

    // Ensure memory is allocated (bypasses access check)
    this.ensureMemorySize(address + values.length)
    
    // Write directly to contiguous memory
    this.memory.set(values, address)

    // Update heap pointer if writing beyond current heap
    if (address + values.length > this.currentHeapPointer) {
      this.currentHeapPointer = address + values.length
    }
  }

  /**
   * Get page dump for a specific page index
   * Returns a copy of the page data (4KB) or zeros if page doesn't exist
   */
  getPageDump(pageIndex: u32): Uint8Array {
    const pageSize = MEMORY_CONFIG.PAGE_SIZE
    const startAddress = pageIndex * pageSize
    const endAddress = startAddress + pageSize
    
    // Ensure memory is large enough
    this.ensureMemorySize(endAddress)
    
    // Extract page data
    const pageData = new Uint8Array(pageSize)
    const sourceView = this.memory.subarray(startAddress, endAddress)
    pageData.set(sourceView, 0)
    
    return pageData
  }

  /**
   * Reset RAM to initial state
   * Clears all memory, page access rights, and resets heap pointer
   */
  reset(): void {
    // Clear memory (reset to empty array)
    this.memory = new Uint8Array(0)
    
    // Clear page access rights
    this.pageAccess.clear()
    
    // Reset heap pointer
    this.currentHeapPointer = 0
  }
}

