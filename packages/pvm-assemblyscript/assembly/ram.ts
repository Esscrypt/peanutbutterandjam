/**
 * PVM RAM Implementation (AssemblyScript)
 *
 * Implements Gray Paper RAM specification using contiguous memory regions
 * Gray Paper reference: pvm.tex equation 770-802
 */

import { alignToPage, alignToZone } from './alignment-helpers'
import { INIT_CONFIG, MEMORY_CONFIG, REGISTER_INIT, REGISTER_INIT_ARGS_SEGMENT_START, REGISTER_INIT_STACK_SEGMENT_END } from './config'
import { MemoryAccessType, RAM, WriteResult } from './types'

/**
 * Address range for page access tracking
 */
class AddressRange {
  startAddress: u64
  endAddress: u64

  constructor(startAddress: u64, endAddress: u64) {
    this.startAddress = startAddress
    this.endAddress = endAddress
  }
}

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

import { FaultCheckResult, ReadResult, RAM } from './types'

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

  stack: Uint8Array = new Uint8Array(0)
  heap: Uint8Array = new Uint8Array(0)
  roData: Uint8Array = new Uint8Array(0)
  argumentData: Uint8Array = new Uint8Array(0)


  // Page access tracking (simple map-based approach)
  // Maps "startAddress:endAddress" → access type
  pageAccess: Map<string, MemoryAccessType> = new Map()

  MAX_ADDRESS: u32 = 2 ** 32 // 4GB address space

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
    const heapSizeWithPadding = heapZerosEndAddress - heapStartAddress

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

    // Allocate memory regions
    this.stack = new Uint8Array(stackSize)
    this.heap = new Uint8Array(heapSizeWithPadding)
    this.roData = new Uint8Array(readOnlyDataLength)
    this.argumentData = new Uint8Array(argumentDataLength)

    // Copy data into regions
    if (argumentDataLength > 0) {
      this.argumentData.set(argumentData, 0)
    }
    if (readOnlyDataLength > 0) {
      this.roData.set(readOnlyData, 0)
    }
    if (heapSize > 0) {
      this.heap.set(heap, 0)
    }
    // Stack is zero-initialized (per Gray Paper)

    // Update variable addresses
    this.argumentDataEnd = argumentDataZeroPaddingEndAddress
    this.roDataAddressEnd = readOnlyZoneEndAddress
    this.stackAddress = stackStartAddress
    this.heapStartAddress = heapStartAddress
    this.heapEndAddress = heapEndAddress
    this.currentHeapPointer = heapZerosEndAddress

    // Set page access rights for all memory regions
    this.setPageAccessRightsForAddressRange(
      readOnlyZoneStartAddress,
      readOnlyZoneEndAddress,
      MemoryAccessType.READ,
    )

    this.setPageAccessRightsForAddressRange(
      argumentDataStartAddress,
      argumentDataZeroPaddingEndAddress,
      MemoryAccessType.READ,
    )

    if (stackStartAddress < stackEndAddress) {
      this.setPageAccessRightsForAddressRange(
        stackStartAddress,
        stackEndAddress,
        MemoryAccessType.WRITE,
      )
    }

    if (heapSize > 0) {
      this.setPageAccessRightsForAddressRange(
        heapStartAddress,
        heapEndAddress,
        MemoryAccessType.WRITE,
      )
    }
    if (heapEndAddress < heapZerosEndAddress) {
      this.setPageAccessRightsForAddressRange(
        heapEndAddress,
        heapZerosEndAddress,
        MemoryAccessType.WRITE,
      )
    }
  }

  /**
   * Allocate additional pages for dynamic heap growth (SBRK)
   */
  allocatePages(startPage: u32, count: u32): void {
    const required =
      (startPage + count) * MEMORY_CONFIG.PAGE_SIZE - this.heapStartAddress
    if (u32(this.heap.length) < required) {
      const oldSize = this.heap.length
      const newData = new Uint8Array(required)
      if (oldSize > 0) {
        newData.set(this.heap, 0)
      }
      this.heap = newData
    }

    // Set page access rights for newly allocated pages
    const endPage = startPage + count
    this.setPageAccessRightsForRange(startPage, endPage, MemoryAccessType.WRITE)
  }

  /**
   * Get page index for an address
   */
  getPageIndex(address: u32): u32 {
    return address / MEMORY_CONFIG.PAGE_SIZE
  }

  /**
   * Determine which memory region an address belongs to
   * Returns: 'argumentData' | 'stack' | 'heap' | 'roData' | null
   * 
   * Matches TypeScript implementation logic:
   * 1. Check argumentData (highest addresses)
   * 2. Check stack (high addresses, below argumentData)
   * 3. Check heap (between roData and stack)
   * 4. Check roData (lowest addresses, above reserved)
   */
  private determineRegion(address: u32, length: u32): string | null {
    const addr = address
    const end = addr + length

    // 1. Check argument data region (fixed start: argumentDataAddress = 0xFEFF0000, highest)
    if (addr >= this.argumentDataAddress) {
      return 'argumentData'
    }

    // 2. Check stack region (fixed end: stackAddressEnd = 0xFEFE0000)
    // Stack grows downward from stackAddressEnd
    // Match TypeScript: end <= stackAddressEnd && addr < argumentDataAddress
    // If stackAddress is set, also check addr >= stackAddress to ensure we're in the actual stack range
    if (end <= this.stackAddressEnd && addr < this.argumentDataAddress) {
      // If stackAddress is initialized, verify we're actually in the stack range
      return 'stack'
    }

    // 3. Check heap region (between roData and stack, before roData check)
    // Heap starts after roData zone, before stack
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // Initialize heapStartAddress if not set (heap starts after roData)
      if (this.heapStartAddress === 0) {
        // Heap starts after roData zone (zone-aligned)
        this.heapStartAddress = this.roDataAddressEnd > 0 
          ? this.roDataAddressEnd 
          : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
      }
      // Check if address is in heap (beyond roData region)
      // Match TypeScript logic: addr >= heapStartAddress OR (roDataAddressEnd > 0 && addr >= roDataAddressEnd)
      const isInHeap = addr >= this.heapStartAddress || 
                       (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd)
      if (isInHeap) {
        return 'heap'
      }
    }

    // 4. Check read-only data region (fixed start: roDataAddress = 65536, lowest)
    // Only if not already matched by heap
    // Match TypeScript: addr >= roDataAddress && addr < roDataAddressEnd (if roDataAddressEnd > 0)
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // If roDataAddressEnd is set and address is beyond it, it should be heap (already checked above)
      if (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd) {
        // Should have been caught by heap check, but if heapStartAddress wasn't set, it's heap
        // Initialize heap for this address
        if (this.heapStartAddress === 0) {
          this.heapStartAddress = this.roDataAddressEnd
        }
        return 'heap'
      }
      // Otherwise, it's roData
      return 'roData'
    }

    return null
  }

  /**
   * Initialize a memory page (used for test vectors)
   */
  initPage(
    address: u32,
    length: u32,
    accessType: MemoryAccessType,
  ): void {

    // Set page access rights first
    this.setPageAccessRights(address, length, accessType)

    // Determine which region this address belongs to
    const region = this.determineRegion(address, length)
    if (!region) {
      return // Address doesn't match any region
    }

    const addr = address

    // Grow the appropriate array based on region
    // Match TypeScript behavior: update end addresses only when growing arrays
    if (region === 'argumentData') {
      const offset = addr - this.argumentDataAddress
      const requiredSize = offset + length
      if (u32(this.argumentData.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.argumentData.length > 0) {
          newData.set(this.argumentData, 0)
        }
        this.argumentData = newData
        this.argumentDataEnd = this.argumentDataAddress + this.argumentData.length
      }
    } else if (region === 'stack') {
      const requiredSize = this.stackAddressEnd - addr
      if (u32(this.stack.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.stack.length > 0) {
          // Copy existing data to the end of the new array (stack grows downward)
          newData.set(this.stack, alignedSize - this.stack.length)
        }
        this.stack = newData
        this.stackAddress = this.stackAddressEnd - this.stack.length
      }
    } else if (region === 'heap') {
      // Ensure heapStartAddress is set
      if (this.heapStartAddress === 0) {
        if (this.roDataAddressEnd === 0 && addr >= 2 * INIT_CONFIG.ZONE_SIZE) {
          this.heapStartAddress = 2 * INIT_CONFIG.ZONE_SIZE
        } else {
          this.heapStartAddress = this.roDataAddressEnd > 0 
            ? this.roDataAddressEnd 
            : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
        }
      }
      const offset = addr - this.heapStartAddress
      const requiredSize = offset + length
      if (u32(this.heap.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.heap.length > 0) {
          newData.set(this.heap, 0)
        }
        this.heap = newData
        this.currentHeapPointer = this.heapStartAddress + this.heap.length
      }
    } else if (region === 'roData') {
      const offset = addr - this.roDataAddress
      const requiredSize = offset + length
      if (u32(this.roData.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.roData.length > 0) {
          newData.set(this.roData, 0)
        }
        this.roData = newData
        this.roDataAddressEnd = this.roDataAddress + this.roData.length
      }
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
    const startAddress = startPage * MEMORY_CONFIG.PAGE_SIZE
    const endAddress = endPage * MEMORY_CONFIG.PAGE_SIZE
    this.pageAccess.set(this.createAddressRangeKey(startAddress, endAddress), accessType)
  }

  /**
   * Set memory page access rights
   */
  setPageAccessRights(
    address: u32,
    length: u32,
    accessType: MemoryAccessType,
  ): void {
    const startAddress = address
    const endAddress = address + length
    this.pageAccess.set(this.createAddressRangeKey(startAddress, endAddress), accessType)
  }

  setPageAccessRightsForAddressRange(
    startAddress: u32,
    endAddress: u32,
    accessType: MemoryAccessType,
  ): void {
    this.pageAccess.set(this.createAddressRangeKey(startAddress, endAddress), accessType)
  }

  /**
   * Create a key for address range
   */
  createAddressRangeKey(startAddress: u32, endAddress: u32): string {
    return startAddress.toString() + ':' + endAddress.toString()
  }

  /**
   * Parse address range key
   */
  parseAddressRangeKey(key: string): AddressRange | null {
    const colonIndex = key.indexOf(':')
    if (colonIndex < 0) {
      return null
    }
    const startStr = key.substring(0, colonIndex)
    const endStr = key.substring(colonIndex + 1)
    const startAddress = u64(Number.parseInt(startStr))
    const endAddress = u64(Number.parseInt(endStr))
    return new AddressRange(startAddress, endAddress)
  }

  /**
   * Get memory page access type
   */
  getPageAccessType(address: u64): MemoryAccessType {
    const keys = this.pageAccess.keys()
    for (let i: i32 = 0; i < i32(keys.length); i++) {
      const key = keys[i]
      const range = this.parseAddressRangeKey(key)
      if (range) {
        if (address >= range.startAddress && address < range.endAddress) {
          // In AssemblyScript, Map.get() throws if key doesn't exist, so check first
          if (this.pageAccess.has(key)) {
            const accessType = this.pageAccess.get(key)
            return accessType
          }
        }
      }
    }
    return MemoryAccessType.NONE
  }

  /**
   * Read multiple octets from memory
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
    const end = addr + length

    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      if (offset + length > u32(this.argumentData.length)) {
        const faultPage = this.getPageIndex(address)
        return new ReadResult(null, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.argumentData
      return new ReadResult(view.slice(offset, offset + length), 0)
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      if (offset + length > u32(this.stack.length)) {
        const faultPage = this.getPageIndex(address)
        return new ReadResult(null, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.stack
      return new ReadResult(view.slice(offset, offset + length), 0)
    }

    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset: u32 = addr - this.heapStartAddress
      if (offset + length > u32(this.heap.length)) {
        const faultPage = this.getPageIndex(address)
        return new ReadResult(null, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.heap
      return new ReadResult(view.slice(offset, offset + length), 0)
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
        const offset = addr - this.roDataAddress
        if (offset + length > u32(this.roData.length)) {
          const faultPage = this.getPageIndex(address)
          return new ReadResult(null, faultPage * MEMORY_CONFIG.PAGE_SIZE)
        }
        const view = this.roData
        return new ReadResult(view.slice(offset, offset + length), 0)
    }

    return new ReadResult(null, this.getPageIndex(address) * MEMORY_CONFIG.PAGE_SIZE)
  }

  /**
   * Write multiple octets to memory
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
    const end = addr + length

    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      if (offset + length > u32(this.argumentData.length)) {
        const faultPage = this.getPageIndex(address)
        return new WriteResult(true, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.argumentData
      view.set(values, offset)
      return new WriteResult(false, 0)
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      if (offset + length > u32(this.stack.length)) {
        const faultPage = this.getPageIndex(address)
        return new WriteResult(true, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.stack
      view.set(values, offset)
      return new WriteResult(false, 0)
    }

    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      if (offset + length > u32(this.heap.length)) {
        const faultPage = this.getPageIndex(address)
        return new WriteResult(true, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.heap
      view.set(values, offset)
      return new WriteResult(false, 0)
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      if (offset + length > u32(this.roData.length)) {
        const faultPage = this.getPageIndex(address)
        return new WriteResult(true, faultPage * MEMORY_CONFIG.PAGE_SIZE)
      }
      const view = this.roData
      view.set(values, offset)
      return new WriteResult(false, 0)
    }

    return new WriteResult(true, 0xFFFFFFFF)
  }

  /**
   * Write to memory during initialization, bypassing writable checks
   * Uses the same region detection as initializePage to ensure consistency
   */
  writeOctetsDuringInitialization(address: u32, values: Uint8Array): void {
    const addr = u32(address)
    const length = values.length

    // Determine which region this address belongs to (same logic as initializePage)
    const region = this.determineRegion(addr, length)
    if (!region) {
      return // Address doesn't match any region
    }

    if (region === 'argumentData') {
      const offset = addr - this.argumentDataAddress
      const requiredSize = offset + length
      // Grow array if needed (defensive: in case initializePage wasn't called or didn't grow enough)
      if (u32(this.argumentData.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.argumentData.length > 0) {
          newData.set(this.argumentData, 0)
        }
        this.argumentData = newData
        this.argumentDataEnd = this.argumentDataAddress + this.argumentData.length
      }
      // Now write the data (array is guaranteed to be large enough)
      this.argumentData.set(values, offset)
    } else if (region === 'stack') {
      // Set stackAddress if not already set (needed for offset calculation)
      if (this.stackAddress === 0) {
        this.stackAddress = this.stackAddressEnd - this.stack.length
      }
      const requiredSize = this.stackAddressEnd - addr
      // Grow array if needed (defensive: in case initializePage wasn't called or didn't grow enough)
      if (u32(this.stack.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.stack.length > 0) {
          // Copy existing data to the end of the new array (stack grows downward)
          newData.set(this.stack, alignedSize - this.stack.length)
        }
        this.stack = newData
        this.stackAddress = this.stackAddressEnd - this.stack.length
      }
      const offset = addr - this.stackAddress
      // Now write the data (array is guaranteed to be large enough)
      this.stack.set(values, offset)
    } else if (region === 'heap') {
      // Ensure heapStartAddress is set (should already be set by initializePage, but be safe)
      if (this.heapStartAddress === 0) {
        if (this.roDataAddressEnd === 0 && addr >= 2 * INIT_CONFIG.ZONE_SIZE) {
          this.heapStartAddress = 2 * INIT_CONFIG.ZONE_SIZE
        } else {
          this.heapStartAddress = this.roDataAddressEnd > 0 
            ? this.roDataAddressEnd 
            : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
        }
      }
      const offset = addr - this.heapStartAddress
      const requiredSize = offset + length
      // Grow array if needed (defensive: in case initializePage wasn't called or didn't grow enough)
      if (u32(this.heap.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.heap.length > 0) {
          newData.set(this.heap, 0)
        }
        this.heap = newData
      }
      // Always update currentHeapPointer to reflect the end of the heap array
      // This ensures readOctets can access the entire allocated heap region
      this.currentHeapPointer = this.heapStartAddress + this.heap.length
      // Now write the data (array is guaranteed to be large enough)
      this.heap.set(values, offset)
    } else if (region === 'roData') {
      const offset = addr - this.roDataAddress
      const requiredSize = offset + length
      // Grow array if needed (defensive: in case initializePage wasn't called or didn't grow enough)
      if (u32(this.roData.length) < u32(requiredSize)) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.roData.length > 0) {
          newData.set(this.roData, 0)
        }
        this.roData = newData
      }
      // Always update roDataAddressEnd to reflect the end of the roData array
      // This ensures readOctets can access the entire allocated roData region
      this.roDataAddressEnd = this.roDataAddress + this.roData.length
      // Now write the data (array is guaranteed to be large enough)
      this.roData.set(values, offset)
    }
  }

  isReadableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    if (address + size > this.MAX_ADDRESS) {
      return new FaultCheckResult(false, address)
    }

    const endRequestedAddress = address + size
    const keys = this.pageAccess.keys()
    for (let i: i32 = 0; i < i32(keys.length); i++) {
      const key = keys[i]
      const colonIndex = key.indexOf(':')
      if (colonIndex < 0) {
        continue
      }
      const startStr = key.substring(0, colonIndex)
      const endStr = key.substring(colonIndex + 1)
      const startAddress = u64(Number.parseInt(startStr))
      const endAddress = u64(Number.parseInt(endStr))
      
      // Check if the requested address range is within this page access range
      // The range must fully contain the requested address range
      if (startAddress <= u64(address) && endAddress >= u64(endRequestedAddress)) {
        // In AssemblyScript, Map.get() throws if key doesn't exist, so check first
        if (this.pageAccess.has(key)) {
          const accessType = this.pageAccess.get(key)
          if (accessType !== MemoryAccessType.NONE) {
            return new FaultCheckResult(true, 0)
          }
        }
      }
    }
    // If no matching page access found, return fault
    return new FaultCheckResult(false, this.getPageIndex(address) * MEMORY_CONFIG.PAGE_SIZE)
  }

  isWritableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    if (address + size > this.MAX_ADDRESS) {
      const faultAddress =
        this.getPageIndex(address) * MEMORY_CONFIG.PAGE_SIZE
      return new FaultCheckResult(false, faultAddress)
    }

    const endRequestedAddress = address + size
    let minInaccessibleAddress: u32 = 0xFFFFFFFF // Sentinel value for "not found"

    for (let addr: u32 = address; addr < endRequestedAddress; addr++) {
      let isWritable = false
      const keys = this.pageAccess.keys()
      for (let i: i32 = 0; i < i32(keys.length); i++) {
        const key = keys[i]
        const range = this.parseAddressRangeKey(key)
        if (range) {
          if (u64(addr) >= range.startAddress && u64(addr) < range.endAddress) {
            // In AssemblyScript, Map.get() throws if key doesn't exist, so check first
            if (this.pageAccess.has(key)) {
              const pageAccess = this.pageAccess.get(key)
              if (pageAccess === MemoryAccessType.WRITE) {
                isWritable = true
                break
              }
            }
          }
        }
      }
      if (!isWritable) {
        minInaccessibleAddress = addr
        break
      }
    }

    if (minInaccessibleAddress !== 0xFFFFFFFF) {
      const faultAddress =
        this.getPageIndex(minInaccessibleAddress) *
        MEMORY_CONFIG.PAGE_SIZE
      return new FaultCheckResult(false, faultAddress)
    }

    return new FaultCheckResult(true, 0)
  }

  /**
   * Get a summary of all allocated RAM pages with their access rights
   */
  getPageMap(): PageMapEntry[] {
    const pages: PageMapEntry[] = []

    const keys = this.pageAccess.keys()
    for (let i: i32 = 0; i < i32(keys.length); i++) {
      const key = keys[i]
      const range = this.parseAddressRangeKey(key)
      if (range) {
        // In AssemblyScript, Map.get() throws if key doesn't exist, so check first
        if (this.pageAccess.has(key)) {
          const accessType = this.pageAccess.get(key)
          pages.push(new PageMapEntry(
            range.startAddress,
            i32(range.endAddress - range.startAddress),
            accessType === MemoryAccessType.WRITE,
            accessType,
          ))
        }
      }
    }

    return pages
  }

  /**
   * Get memory contents for a specific address range
   */
  getMemoryContents(address: u64, length: i32): u64[] {
    const addr = u32(address)
    const end = addr + length

    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      const view = this.argumentData
      return Array.from(view.slice(offset, offset + length))
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      const view = this.stack
      return Array.from(view.slice(offset, offset + length))
    }

    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      const view = this.heap
      return Array.from(view.slice(offset, offset + length))
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
        const view = this.roData
        return Array.from(view.slice(offset, offset + length))
    }
    // Return empty array instead of throwing to avoid WASM abort
    // This should not happen if called correctly
    return new Array<u8>(0)
  }

  /**
   * Clear all memory
   */
  clear(): void {
    this.pageAccess.clear()
    this.stack.fill(0)
    this.heap.fill(0)
    this.roData.fill(0)
    this.argumentData.fill(0)
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
    
    // Reset memory arrays to empty
    this.stack = new Uint8Array(0)
    this.heap = new Uint8Array(0)
    this.roData = new Uint8Array(0)
    this.argumentData = new Uint8Array(0)
    
    // Reset all address variables
    this.stackAddress = 0
    this.heapStartAddress = 0
    this.heapEndAddress = 0
    this.roDataAddressEnd = 0
    this.currentHeapPointer = 0
    this.argumentDataEnd = 0
  }
}
