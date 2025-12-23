import { logger } from '@pbnjam/core'
import type { MemoryAccessType, RAM } from '@pbnjam/types'
import { alignToPage, alignToZone } from './alignment-helpers'
import { INIT_CONFIG, MEMORY_CONFIG, REGISTER_INIT } from './config'

/**
 * PVM RAM Implementation
 *
 * Implements Gray Paper RAM specification using contiguous memory regions
 * following the Go test vector structure:
 * - Contiguous byte arrays for stack, rw_data, ro_data, and output regions
 * - Explicit address boundaries for each region
 * - Dynamic heap growth via allocatePages
 * - Page-based access rights for Gray Paper compliance
 */
export class PVMRAM implements RAM {
  // Memory region address boundaries (uint32)
  // Fixed addresses according to Gray Paper (pvm.tex equation 770-802)
  public readonly roDataAddress = INIT_CONFIG.ZONE_SIZE // 65536 (2^16) - fixed
  public readonly argumentDataAddress = REGISTER_INIT.ARGS_SEGMENT_START() // 4278124544 (0xFEFF0000) - fixed
  public readonly stackAddressEnd = REGISTER_INIT.STACK_SEGMENT_END() // 4278059008 (0xFEFE0000) - fixed

  // Variable addresses (set during initializeMemoryLayout)
  public stackAddress = 0
  public heapStartAddress = 0
  public heapEndAddress = 0 // heap data end (exclusive), padding starts here
  public roDataAddressEnd = 0
  public currentHeapPointer = 0 // heap address end (includes padding)
  public argumentDataEnd = 0

  // Contiguous memory regions (matching Go structure)
  public stack: Uint8Array = new Uint8Array(0)
  public heap: Uint8Array = new Uint8Array(0)
  public roData: Uint8Array = new Uint8Array(0)
  public argumentData: Uint8Array = new Uint8Array(0)

  // Using Map for O(1) access and dynamic growth
  // stores start and end page address to access type
  private readonly pageAccess: Map<[bigint, bigint], MemoryAccessType> =
    new Map()

  // Debug: Track full history of all instructions that interacted with each address
  private readonly addressInteractionHistory: Map<
    bigint,
    Array<{
      pc: bigint
      opcode: bigint
      name: string
      type: 'read' | 'write'
      region:
        | 'reserved'
        | 'roData'
        | 'rwData'
        | 'heap'
        | 'stack'
        | 'argumentData'
        | 'unknown'
      address: bigint // The actual address accessed
      register?: number // Register involved (destination for loads, source for stores)
      value?: bigint // Value loaded/stored (if applicable)
      operands?: number[] // Instruction operands/arguments
    }>
  > = new Map()

  private readonly MAX_ADDRESS = 2 ** 32 // 4GB address space

  constructor(
    readOnlyDataSize = 8192,
    heapSize = 8192,
    argumentDataSize = 1024,
    stackSize = 8192, // Default stack size
  ) {
    // Allocate contiguous arrays - match Go implementation exactly
    // Stack array size must match the address range (rnp_s), not the raw size (stackSize)
    this.stack = new Uint8Array(stackSize)
    this.heap = new Uint8Array(heapSize) // Match Go: rw_data_address_end - rw_data_address
    this.roData = new Uint8Array(readOnlyDataSize)
    this.argumentData = new Uint8Array(argumentDataSize)
  }

  /**
   * Initialize memory layout according to Gray Paper equation 770-802
   *
   * Gray Paper equation 766: Alignment functions
   * - rnp(x ∈ ℕ) ≡ Cpvmpagesize * ceil(x / Cpvmpagesize) - page alignment
   * - rnq(x ∈ ℕ) ≡ Cpvminitzonesize * ceil(x / Cpvminitzonesize) - zone alignment
   *
   * @param argumentData - Argument data (a)
   * @param readOnlyData - Read-only data section (o)
   * @param readWriteData - Read-write data section (w) -> initial heap data
   * @param stackSize - Stack size (s)
   * @param heapZeroPaddingSize - Heap zero padding size (z) (in number of pages)
   */
  initializeMemoryLayout(
    argumentData: Uint8Array,
    readOnlyData: Uint8Array,
    heap: Uint8Array,
    stackSize: number,
    heapZeroPaddingSize: number,
  ): void {
    const readOnlyDataLength = readOnlyData.length
    const heapSize = heap.length
    const argumentDataLength = argumentData.length

    const heapStartAddress =
      2 * INIT_CONFIG.ZONE_SIZE + alignToZone(readOnlyDataLength)
    const heapEndAddress = heapStartAddress + alignToPage(heapSize)
    const heapZerosEndAddress =
      heapEndAddress + heapZeroPaddingSize * MEMORY_CONFIG.PAGE_SIZE
    const heapSizeWithPadding = heapZerosEndAddress - heapStartAddress

    // Fixed addresses are already set in constructor
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


    // Always reinitialize structure with actual sizes from the program
    // This ensures the structure matches the program's memory layout
    // Note: heap.length is not used - Go reference uses readOnlyDataSize for initial heap region size
    this.stack = new Uint8Array(stackSize)
    this.heap = new Uint8Array(heapSizeWithPadding) // Match Go: rw_data_address_end - rw_data_address
    this.roData = new Uint8Array(readOnlyDataLength)
    this.argumentData = new Uint8Array(argumentDataLength)

    this.argumentData.set(argumentData, 0)

    this.roData.set(readOnlyData, 0)
    this.heap.set(heap, 0)

    // Update variable addresses (fixed addresses are already set in constructor)
    // currentHeapPointer extends to heapZerosEnd (includes heap length + jump table)
    this.argumentDataEnd = argumentDataZeroPaddingEndAddress
    this.roDataAddressEnd = readOnlyZoneEndAddress
    this.stackAddress = stackStartAddress
    this.heapStartAddress = heapStartAddress
    this.heapEndAddress = heapEndAddress
    this.currentHeapPointer = heapZerosEndAddress

    // Set page access rights for all memory regions
    this.setPageAccessRightsForAddressRange(
      BigInt(readOnlyZoneStartAddress),
      BigInt(readOnlyZoneEndAddress),
      'read',
    )

    this.setPageAccessRightsForAddressRange(
      BigInt(argumentDataStartAddress),
      BigInt(argumentDataZeroPaddingEndAddress),
      'read',
    )
    if (argumentDataZeroPaddingEndAddress > argumentDataEndAddress) {
      this.setPageAccessRightsForAddressRange(
        BigInt(argumentDataEndAddress),
        BigInt(argumentDataZeroPaddingEndAddress),
        'read',
      )
    }

    if (stackStartAddress < stackEndAddress) {
      this.setPageAccessRightsForAddressRange(
        BigInt(stackStartAddress),
        BigInt(stackEndAddress),
        'write',
      )
    }

    if (heapSize > 0) {
      this.setPageAccessRightsForAddressRange(
        BigInt(heapStartAddress),
        BigInt(heapEndAddress),
        'write',
      )
    }
    if (heapEndAddress < heapZerosEndAddress) {
      this.setPageAccessRightsForAddressRange(
        BigInt(heapEndAddress),
        BigInt(heapZerosEndAddress),
        'write',
      )
    }
  }

  /**
   * Allocate additional pages for dynamic heap growth (SBRK)
   * Equivalent to allocatePages(startPage, count) in Go
   *
   * @param startPage - Starting page index (absolute, not relative to heapStartAddress)
   * @param count - Number of pages to allocate
   */
  allocatePages(startPage: number, count: number): void {
    // Calculate the required size for the heap array
    // heap array is indexed from 0 and corresponds to addresses starting at heapStartAddress
    // So if we need to support pages from startPage to (startPage + count - 1),
    // the array needs to be large enough to cover addresses up to (startPage + count) * MEMORY_CONFIG.PAGE_SIZE
    // The offset in the array for address (startPage + count) * MEMORY_CONFIG.PAGE_SIZE is:
    const required =
      (startPage + count) * MEMORY_CONFIG.PAGE_SIZE - this.heapStartAddress
    if (this.heap.length < required) {
      // Grow rw_data to fit new allocation
      const oldSize = this.heap.length
      const newData = new Uint8Array(required)
      // copy the old data to the new array
      newData.set(this.heap, 0)
      this.heap = newData
      logger.debug('PVMRAM: Expanded rw_data', {
        oldSize,
        newSize: required,
        startPage,
        count,
        heapStartAddress: this.heapStartAddress,
      })
    }

    // Set page access rights for newly allocated pages
    // Gray Paper: All pages in the heap region should have 'write' access
    // This ensures that pages allocated via SBRK are writable (and readable, since write implies read)
    const startPageBigInt = BigInt(startPage)
    const endPageBigInt = BigInt(startPage + count)
    this.setPageAccessRightsForRange(startPageBigInt, endPageBigInt, 'write')

    // Note: currentHeapPointer is updated by SBRK instruction, which will call updateCachedHeapBound
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
   * Grows arrays to accommodate pages in standard regions (matching Go behavior)
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

    // Set page access rights first
    this.setPageAccessRights(address, length, accessType)

    // Grow arrays to accommodate pages in standard regions
    // Determine region based on fixed addresses only (similar to writeOctetsDuringInitialization)
    // Check in order from highest to lowest addresses
    const addr = Number(address)
    const end = addr + length

    // 1. Check argument data region (fixed start: argumentDataAddress = 0xFEFF0000, highest)
    if (addr >= this.argumentDataAddress) {
      const offset = addr - this.argumentDataAddress
      const requiredSize = offset + length
      if (this.argumentData.length < requiredSize) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.argumentData.length > 0) {
          newData.set(this.argumentData, 0)
        }
        this.argumentData = newData
        this.argumentDataEnd =
          this.argumentDataAddress + this.argumentData.length
      }
      return
    }

    // 2. Check stack region (fixed end: stackAddressEnd = 0xFEFE0000)
    // Stack grows downward from stackAddressEnd
    if (end <= this.stackAddressEnd && addr < this.argumentDataAddress) {
      const requiredSize = this.stackAddressEnd - addr
      if (this.stack.length < requiredSize) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.stack.length > 0) {
          // Copy existing data to the end of the new array (stack grows downward)
          newData.set(this.stack, alignedSize - this.stack.length)
        }
        this.stack = newData
        this.stackAddress = this.stackAddressEnd - this.stack.length
      }
      return
    }

    // 3. Check heap region (between roData and stack, before roData check)
    // Heap starts after roData zone, before stack
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // Initialize heapStartAddress if not set (heap starts after roData)
      if (this.heapStartAddress === 0) {
        // Heap starts after roData zone (zone-aligned)
        this.heapStartAddress =
          this.roDataAddressEnd > 0
            ? this.roDataAddressEnd
            : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
      }
      // Check if address is in heap (beyond roData region)
      const isInHeap =
        addr >= this.heapStartAddress ||
        (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd)
      if (isInHeap) {
        // Ensure heapStartAddress is set correctly
        if (
          this.heapStartAddress === 0 ||
          (this.roDataAddressEnd > 0 &&
            this.heapStartAddress < this.roDataAddressEnd)
        ) {
          this.heapStartAddress =
            this.roDataAddressEnd > 0
              ? this.roDataAddressEnd
              : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
        }
        const offset = addr - this.heapStartAddress
        const requiredSize = offset + length
        if (this.heap.length < requiredSize) {
          const alignedSize = alignToPage(requiredSize)
          const newData = new Uint8Array(alignedSize)
          if (this.heap.length > 0) {
            newData.set(this.heap, 0)
          }
          this.heap = newData
          this.currentHeapPointer = this.heapStartAddress + this.heap.length
        }
        return
      }
    }

    // 4. Check read-only data region (fixed start: roDataAddress = 65536, lowest)
    // Only if not already matched by heap
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // Check if address is beyond roData region (should be in heap instead)
      if (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd) {
        // Should have been caught by heap check, but if heapStartAddress wasn't set, handle it
        // Initialize heap for this address
        if (this.heapStartAddress === 0) {
          this.heapStartAddress = this.roDataAddressEnd
        }
        const offset = addr - this.heapStartAddress
        const requiredSize = offset + length
        if (this.heap.length < requiredSize) {
          const alignedSize = alignToPage(requiredSize)
          const newData = new Uint8Array(alignedSize)
          if (this.heap.length > 0) {
            newData.set(this.heap, 0)
          }
          this.heap = newData
          this.currentHeapPointer = this.heapStartAddress + this.heap.length
        }
        return
      }
      const offset = addr - this.roDataAddress
      const requiredSize = offset + length
      if (this.roData.length < requiredSize) {
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        if (this.roData.length > 0) {
          newData.set(this.roData, 0)
        }
        this.roData = newData
        this.roDataAddressEnd = this.roDataAddress + this.roData.length
      }
      return
    }
  }

  /**
   * Set memory page access rights for a range of pages
   * Helper method that works directly with page indices (simpler for sequential regions)
   * @param startPage - Starting page index
   * @param endPage - Ending page index (exclusive)
   * @param accessType - Access type: 'none', 'read', 'write'
   */
  setPageAccessRightsForRange(
    startPage: bigint,
    endPage: bigint,
    accessType: MemoryAccessType,
  ): void {
    const startAddress = startPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
    const endAddress = endPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
    this.pageAccess.set([startAddress, endAddress], accessType)
  }

  /**
   * Set memory page access rights (Gray Paper PAGES function)
   * @param address - Base address of the page
   * @param length - Length of the page in bytes
   * @param accessType - Access type: 'none', 'read', 'write'
   */
  setPageAccessRights(
    address: bigint,
    length: number,
    accessType: MemoryAccessType,
  ): void {
    const startAddress = address
    // endAddress is exclusive to match isWritableWithFault/isReadableWithFault expectations
    const endAddress = address + BigInt(length)
    this.pageAccess.set([startAddress, endAddress], accessType)
  }

  setPageAccessRightsForAddressRange(
    startAddress: bigint,
    endAddress: bigint,
    accessType: MemoryAccessType,
  ): void {
    this.pageAccess.set([startAddress, endAddress], accessType)
  }

  /**
   * Get memory page access type
   * @param address - Address to check
   * @returns Access type for the page containing this address
   */
  getPageAccessType(address: bigint): MemoryAccessType {
    for (const [
      [startAddress, endAddress],
      accessType,
    ] of this.pageAccess.entries()) {
      if (address >= startAddress && address < endAddress) {
        return accessType
      }
    }
    return 'none'
  }

  /**
   * Get address interaction history for debugging
   * Returns a map of address -> array of all instructions that interacted with it
   */
  public getAddressInteractionHistory(): Map<
    bigint,
    Array<{
      pc: bigint
      opcode: bigint
      name: string
      type: 'read' | 'write'
      region:
        | 'reserved'
        | 'roData'
        | 'rwData'
        | 'heap'
        | 'stack'
        | 'argumentData'
        | 'unknown'
      address: bigint
      register?: number
      value?: bigint
      operands?: number[]
    }>
  > {
    // Return a deep copy to prevent external modification
    const result = new Map<
      bigint,
      Array<{
        pc: bigint
        opcode: bigint
        name: string
        type: 'read' | 'write'
        region:
          | 'reserved'
          | 'roData'
          | 'rwData'
          | 'heap'
          | 'stack'
          | 'argumentData'
          | 'unknown'
        address: bigint
        register?: number
        value?: bigint
        operands?: number[]
      }>
    >()
    for (const [address, history] of this.addressInteractionHistory.entries()) {
      result.set(address, [...history])
    }
    return result
  }

  /**
   * Determine which memory region a page belongs to
   */
  private getPageRegion(
    pageIndex: bigint,
  ):
    | 'reserved'
    | 'roData'
    | 'rwData'
    | 'heap'
    | 'stack'
    | 'argumentData'
    | 'unknown' {
    const pageAddress = pageIndex * BigInt(MEMORY_CONFIG.PAGE_SIZE)
    const reservedEnd = BigInt(MEMORY_CONFIG.RESERVED_MEMORY_END)

    // Reserved memory (first 64KB)
    if (pageAddress < reservedEnd) {
      return 'reserved'
    }

    // Read-only data section
    if (
      pageAddress >= BigInt(this.roDataAddress) &&
      pageAddress < BigInt(this.roDataAddressEnd)
    ) {
      return 'roData'
    }

    // Read-write data section (heap region, includes padding)
    if (
      pageAddress >= BigInt(this.heapStartAddress) &&
      pageAddress < BigInt(this.currentHeapPointer)
    ) {
      return 'heap'
    }

    // Stack section
    if (
      pageAddress >= BigInt(this.stackAddress) &&
      pageAddress < BigInt(this.stackAddressEnd)
    ) {
      return 'stack'
    }

    // Argument data section
    if (
      pageAddress >= BigInt(this.argumentDataAddress) &&
      pageAddress < BigInt(this.argumentDataEnd)
    ) {
      return 'argumentData'
    }

    return 'unknown'
  }

  /**
   * Track interaction with instruction context
   * Called by instructions to track memory access with full instruction context
   */
  public trackInteraction(
    address: bigint,
    type: 'read' | 'write',
    instructionContext: {
      pc: bigint
      opcode: bigint
      name: string
      operands?: number[]
    },
    register?: number,
    value?: bigint,
  ): void {
    const pageIndex = this.getPageIndex(address)
    const region = this.getPageRegion(pageIndex)

    const addressInteraction = {
      pc: instructionContext.pc,
      opcode: instructionContext.opcode,
      name: instructionContext.name,
      type,
      region,
      address,
      ...(register !== undefined && { register }),
      ...(value !== undefined && { value }),
      ...(instructionContext.operands !== undefined && {
        operands: instructionContext.operands,
      }),
    }

    // Track address-level interaction
    if (!this.addressInteractionHistory.has(address)) {
      this.addressInteractionHistory.set(address, [])
    }
    this.addressInteractionHistory.get(address)!.push(addressInteraction)
  }

  readOctets(
    address: bigint,
    count: bigint,
  ): [Uint8Array | null, bigint | null] {
    // Gray Paper: Empty range is trivially readable - return empty array
    if (count === 0n) {
      return [new Uint8Array(0), null]
    }

    // Check if entire range is readable first
    const [readable, faultAddress] = this.isReadableWithFault(address, count)
    if (!readable) {
      return [null, faultAddress]
    }

    // Safe conversion: count <= 32, so Number conversion is always safe
    const addr = Number(address)
    const length = Number(count)
    const end = addr + length

    // Gray Paper pvm.tex line 145: fault address is page start: Cpvmpagesize × ⌊min(x) ÷ Cpvmpagesize⌋
    // Output section
    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      if (offset + length > this.argumentData.length) {
        const faultPage = this.getPageIndex(address)
        return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
      }
      return [this.argumentData.slice(offset, offset + length), null]
    }

    // Stack section
    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      if (offset + length > this.stack.length) {
        const faultPage = this.getPageIndex(address)
        return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
      }
      return [this.stack.slice(offset, offset + length), null]
    }

    // heap region: from heapStartAddress to currentHeapPointer (includes padding)
    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      if (offset + length > this.heap.length) {
        const faultPage = this.getPageIndex(address)
        return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
      }
      return [this.heap.slice(offset, offset + length), null]
    }

    // Read-only data section: roDataAddress ≤ i < roDataAddressEnd (data)
    // Read-only padding: roDataAddressEnd ≤ i < roDataAddressEnd + padding (padding, value = 0)
    // Since max read is 32 bytes, a read can span at most one page boundary
    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      // Read starts in data region
      const offset = addr - this.roDataAddress

      if (offset + length > this.roData.length) {
        const faultPage = this.getPageIndex(address)
        return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
      }
      return [this.roData.slice(offset, offset + length), null]
    }

    return [null, this.getPageIndex(address) * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
  }

  writeOctets(address: bigint, values: Uint8Array): bigint | null {
    // Note: Tracking is now done by instructions directly via trackInteraction
    // This method no longer tracks automatically to avoid requiring instruction context

    // Check if entire range is writable first
    const [writable, faultAddress] = this.isWritableWithFault(
      address,
      BigInt(values.length),
    )
    if (!writable) {
      return faultAddress
    }

    const addr = Number(address)
    const length = values.length
    const end = addr + length

    // Match Go WriteRAMBytes structure exactly
    // Go implementation: checks bounds, then directly copies (no array growth)
    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      if (offset + length > this.argumentData.length) {
        const faultPage = this.getPageIndex(address)
        return faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
      }
      // Go doesn't check array size - assumes it's correct if bounds check passes
      // If array is too small, this will throw (matching Go's behavior)
      this.argumentData.set(values, offset)
      return null
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      if (offset + length > this.stack.length) {
        const faultPage = this.getPageIndex(address)
        return faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
      }
      // Go implementation: directly copies (no array growth)
      this.stack.set(values, offset)
      return null
    }

    // heap region: from heapStartAddress to zone-aligned currentHeapPointer
    // Go WriteRAMBytes: address >= ram.rw_data_address && end <= Z_func(ram.current_heap_pointer)
    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      if (offset + length > this.heap.length) {
        const faultPage = this.getPageIndex(address)
        return faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
      }
      // Go implementation: directly copies (arrays are grown via allocatePages or here)
      this.heap.set(values, offset)
      return null
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      if (offset + length > this.roData.length) {
        const faultPage = this.getPageIndex(address)
        return faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)
      }
      // Go implementation: directly copies (no array growth)
      this.roData.set(values, offset)
      return null
    }

    return null
  }

  /**
   * Write to memory during initialization, bypassing writable checks
   * This is used by test vectors to initialize memory regardless of page access type
   * @param address - Address to write to
   * @param values - Values to write
   */
  writeOctetsDuringInitialization(address: bigint, values: Uint8Array): void {
    const addr = Number(address)
    const length = values.length
    const end = addr + length

    // Determine which region based on fixed addresses only
    // Then initialize/grow the array as needed
    // Check in order from highest to lowest addresses to avoid false matches

    // 1. Check argument data region (fixed start: argumentDataAddress = 0xFEFF0000, highest)
    if (addr >= this.argumentDataAddress) {
      const offset = addr - this.argumentDataAddress
      const requiredSize = offset + length
      // Grow array if needed
      if (this.argumentData.length < requiredSize) {
        const newSize = alignToPage(requiredSize)
        const newData = new Uint8Array(newSize)
        if (this.argumentData.length > 0) {
          newData.set(this.argumentData, 0)
        }
        this.argumentData = newData
        this.argumentDataEnd =
          this.argumentDataAddress + this.argumentData.length
      }
      this.argumentData.set(values, offset)
      return
    }

    // 2. Check stack region (fixed end: stackAddressEnd = 0xFEFE0000)
    // Stack grows downward from stackAddressEnd
    if (end <= this.stackAddressEnd && addr < this.argumentDataAddress) {
      // Calculate required size from address to stack end
      const requiredSize = this.stackAddressEnd - addr
      if (this.stack.length < requiredSize) {
        const newSize = alignToPage(requiredSize)
        const newData = new Uint8Array(newSize)
        if (this.stack.length > 0) {
          // Copy existing data to the end of the new array (stack grows downward)
          newData.set(this.stack, newSize - this.stack.length)
        }
        this.stack = newData
        this.stackAddress = this.stackAddressEnd - this.stack.length
      }
      const offset = addr - this.stackAddress
      this.stack.set(values, offset)
      return
    }

    // 3. Check heap region (between roData and stack, before roData check)
    // Heap starts after roData zone, before stack
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // Initialize heapStartAddress if not set (heap starts after roData)
      if (this.heapStartAddress === 0) {
        // Heap starts after roData zone (zone-aligned)
        this.heapStartAddress =
          this.roDataAddressEnd > 0
            ? this.roDataAddressEnd
            : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
      }
      // Check if address is in heap (beyond roData region)
      const isInHeap =
        addr >= this.heapStartAddress ||
        (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd)
      if (isInHeap) {
        // Ensure heapStartAddress is set correctly
        if (
          this.heapStartAddress === 0 ||
          (this.roDataAddressEnd > 0 &&
            this.heapStartAddress < this.roDataAddressEnd)
        ) {
          this.heapStartAddress =
            this.roDataAddressEnd > 0
              ? this.roDataAddressEnd
              : alignToZone(this.roDataAddress) + INIT_CONFIG.ZONE_SIZE
        }
        const offset = addr - this.heapStartAddress
        const requiredSize = offset + length
        // Grow array if needed
        if (this.heap.length < requiredSize) {
          const newSize = alignToPage(requiredSize)
          const newData = new Uint8Array(newSize)
          if (this.heap.length > 0) {
            newData.set(this.heap, 0)
          }
          this.heap = newData
          this.currentHeapPointer = this.heapStartAddress + this.heap.length
        }
        this.heap.set(values, offset)
        return
      }
    }

    // 4. Check read-only data region (fixed start: roDataAddress = 65536, lowest)
    // Only if not already matched by heap
    if (addr >= this.roDataAddress && end < this.stackAddressEnd) {
      // Check if address is beyond roData region (should be in heap instead)
      if (this.roDataAddressEnd > 0 && addr >= this.roDataAddressEnd) {
        // Should have been caught by heap check, but if heapStartAddress wasn't set, skip
        return
      }
      const offset = addr - this.roDataAddress
      const requiredSize = offset + length
      // Grow array if needed
      if (this.roData.length < requiredSize) {
        const newSize = alignToPage(requiredSize)
        const newData = new Uint8Array(newSize)
        if (this.roData.length > 0) {
          newData.set(this.roData, 0)
        }
        this.roData = newData
        this.roDataAddressEnd = this.roDataAddress + this.roData.length
      }
      this.roData.set(values, offset)
      return
    }
  }

  isReadableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
    // Gray Paper: Empty range is trivially readable
    // Nrange{a}{0} ⊆ readable(mem) is always true for any address a
    if (size === 0n) {
      return [true, null]
    }

    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return [false, address]
    }

    // Gray Paper: readable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] ≠ none}
    // This means both 'read' and 'write' pages are readable (anything ≠ none)
    // Check that EVERY address in the range is covered by SOME page access entry with non-'none' access
    // This handles cases where the heap was grown via multiple SBRK calls creating separate entries
    const endRequestedAddress = address + size

    // First, try to find a single entry that covers the entire range (fast path)
    for (const [
      [startAddress, endAddress],
      pageAccess,
    ] of this.pageAccess.entries()) {
      if (startAddress <= address && endAddress >= endRequestedAddress) {
        if (pageAccess !== 'none') {
          return [true, null]
        }
      }
    }

    // Slow path: check each address individually to handle fragmented ranges
    for (let addr = address; addr < endRequestedAddress; addr++) {
      let isReadable = false
      for (const [
        [startAddress, endAddress],
        pageAccess,
      ] of this.pageAccess.entries()) {
        if (addr >= startAddress && addr < endAddress && pageAccess !== 'none') {
          isReadable = true
          break
        }
      }
      if (!isReadable) {
        // Found an address that's not readable - return fault at page boundary
        return [false, this.getPageIndex(addr) * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
      }
    }
    return [true, null]
  }

  isWritableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
    // Gray Paper: Empty range is trivially writable
    // Nrange{a}{0} ⊆ writable(mem) is always true for any address a
    if (size === 0n) {
      return [true, null]
    }

    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      const faultAddress =
        this.getPageIndex(address) * BigInt(MEMORY_CONFIG.PAGE_SIZE)
      return [false, faultAddress]
    }

    // Gray Paper pvm.tex line 141-145:
    // x = {x | x ∈ w ∧ x mod 2^32 ∉ writable(mem)}
    // fault = Cpvmpagesize × ⌊min(x) mod 2^32 ÷ Cpvmpagesize⌋
    // We need to find the minimum address in the range that is not writable
    const endRequestedAddress = address + size
    let minInaccessibleAddress: bigint | null = null

    // Check each address in the range to find the first one that's not writable
    for (let addr = address; addr < endRequestedAddress; addr++) {
      let isWritable = false
      for (const [
        [startAddress, endAddress],
        pageAccess,
      ] of this.pageAccess.entries()) {
        // Check if this address is in a writable page
        if (addr >= startAddress && addr < endAddress) {
          if (pageAccess === 'write') {
            isWritable = true
            break
          }
        }
      }
      if (!isWritable) {
        minInaccessibleAddress = addr
        break
      }
    }

    if (minInaccessibleAddress !== null) {
      // Gray Paper: fault address is page start of the minimum inaccessible address
      const faultAddress =
        this.getPageIndex(minInaccessibleAddress) *
        BigInt(MEMORY_CONFIG.PAGE_SIZE)
      return [false, faultAddress]
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
    region:
      | 'reserved'
      | 'roData'
      | 'rwData'
      | 'heap'
      | 'stack'
      | 'argumentData'
      | 'unknown'
  }> {
    const pages: Array<{
      address: bigint
      length: number
      'is-writable': boolean
      accessType: MemoryAccessType
      region:
        | 'reserved'
        | 'roData'
        | 'rwData'
        | 'heap'
        | 'stack'
        | 'argumentData'
        | 'unknown'
    }> = []

    // Return individual pages (no merging) to match test vector format
    // Include all pages with access rights (allocated sections), even if empty
    // This matches program.json format which includes empty allocated pages
    // Exclude padding pages (they have access rights but are purely for alignment)
    for (const [
      [startAddress, endAddress],
      accessType,
    ] of this.pageAccess.entries()) {
      const pageAddress = startAddress

      const region = this.getPageRegion(startAddress)
      pages.push({
        address: pageAddress,
        length: Number(endAddress - startAddress), // Should always be one page (4096 bytes)
        'is-writable': accessType === 'write',
        accessType: accessType,
        region: region,
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
    const addr = Number(address)
    const end = addr + length

    // Try to read from contiguous arrays first
    if (addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      return Array.from(this.argumentData.slice(offset, offset + length))
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      return Array.from(this.stack.slice(offset, offset + length))
    }

    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      return Array.from(this.heap.slice(offset, offset + length))
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      return Array.from(this.roData.slice(offset, offset + length))
    }
    throw new Error(
      'getMemoryContents: Invalid address range: ' +
        address.toString() +
        ' to ' +
        (address + BigInt(length)).toString(),
    )
  }

  /**
   * Get page map as JSON-serializable format (for logging)
   */
  getPageMapJSON(): Array<{
    address: string
    length: number
    'is-writable': boolean
    accessType: MemoryAccessType
    region:
      | 'reserved'
      | 'roData'
      | 'rwData'
      | 'heap'
      | 'stack'
      | 'argumentData'
      | 'unknown'
  }> {
    return this.getPageMap().map((page) => ({
      address: page.address.toString(),
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
      region: page.region,
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
    region:
      | 'reserved'
      | 'roData'
      | 'rwData'
      | 'heap'
      | 'stack'
      | 'argumentData'
      | 'unknown'
    contents: number[]
  }> {
    return this.getPageMap().map((page) => ({
      address: page.address,
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
      region: page.region,
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
    region:
      | 'reserved'
      | 'roData'
      | 'rwData'
      | 'heap'
      | 'stack'
      | 'argumentData'
      | 'unknown'
    contents: number[]
  }> {
    return this.getPageMapWithContents().map((page) => ({
      address: page.address.toString(),
      length: page.length,
      'is-writable': page['is-writable'],
      accessType: page.accessType,
      region: page.region,
      contents: page.contents,
    }))
  }

  /**
   * Clear all memory (useful for testing)
   */
  clear(): void {
    this.pageAccess.clear()

    // Clear contiguous arrays
    this.stack.fill(0)
    this.heap.fill(0)
    this.roData.fill(0)
    this.argumentData.fill(0)

    // Reset variable addresses (fixed addresses remain unchanged)
    this.stackAddress = 0
    this.heapStartAddress = 0
    this.heapEndAddress = 0
    this.roDataAddressEnd = 0
    this.currentHeapPointer = 0
    this.argumentDataEnd = 0
    // Fixed addresses (roDataAddress, argumentDataAddress, stackAddressEnd) are not reset
    // Clear page and address interaction history
    this.addressInteractionHistory.clear()

    logger.debug('PVMRAM cleared')
  }
}
