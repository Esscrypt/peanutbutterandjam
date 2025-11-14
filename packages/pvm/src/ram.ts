import { logger } from '@pbnj/core'
import type { MemoryAccessType, RAM } from '@pbnj/types'
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
  public stackAddress = 0
  public stackAddressEnd = 0
  public heapStartAddress = 0
  public heapEndAddress = 0 // heap data end (exclusive), padding starts here
  public roDataAddress = 0
  public roDataAddressEnd = 0
  public currentHeapPointer = 0 // heap address end (includes padding)

  public argumentDataAddress = 0
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

  // Sparse storage for addresses outside standard regions (used by test vectors)
  // Maps address to byte value for addresses not in heap/stack/roData/argumentData
  // Gray Paper: writes are permitted if page has write access, regardless of region
  private readonly sparseMemory: Map<bigint, number> = new Map()

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

    const argumentDataStartAddress = REGISTER_INIT.ARGS_SEGMENT_START()
    const argumentDataEndAddress =
      argumentDataStartAddress + alignToPage(argumentDataLength)
    const argumentDataZeroPaddingEndAddress =
      argumentDataEndAddress + alignToPage(argumentDataLength)

    const stackEndAddress = REGISTER_INIT.STACK_SEGMENT_END()
    const stackStartAddress = stackEndAddress - alignToPage(stackSize)

    const readOnlyZoneStartAddress = INIT_CONFIG.ZONE_SIZE
    const readOnlyZoneEndAddress =
      readOnlyZoneStartAddress + alignToPage(readOnlyDataLength)

    // Always reinitialize structure with actual sizes from the program
    // This ensures the structure matches the program's memory layout
    // Note: heap.length is not used - Go reference uses readOnlyDataSize for initial heap region size
    this.stack = new Uint8Array(stackSize)
    this.heap = new Uint8Array(heapSize) // Match Go: rw_data_address_end - rw_data_address
    this.roData = new Uint8Array(readOnlyDataLength)
    this.argumentData = new Uint8Array(argumentDataLength)

    this.argumentData.set(argumentData, 0)
    this.roData.set(readOnlyData, 0)
    this.heap.set(heap, 0)

    // Update currentHeapPointer to match their implementation
    // currentHeapPointer extends to heapZerosEnd (includes heap length + jump table)
    this.argumentDataAddress = argumentDataStartAddress
    this.argumentDataEnd = argumentDataZeroPaddingEndAddress
    this.roDataAddress = readOnlyZoneStartAddress
    this.roDataAddressEnd = readOnlyZoneEndAddress
    this.stackAddress = stackStartAddress
    this.stackAddressEnd = stackEndAddress
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
    // This ensures arrays are large enough when test vectors write to initialized pages
    const addr = Number(address)

    // Check if page is in heap region and grow array if needed
    if (addr >= this.heapStartAddress && addr < this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      const requiredSize = offset + length
      if (this.heap.length < requiredSize) {
        // Grow by at least one page (page-aligned)
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        newData.set(this.heap, 0)
        this.heap = newData
        // Update currentHeapPointer to reflect the new size
        this.currentHeapPointer = this.heapStartAddress + this.heap.length
      }
    }

    // Check if page is in roData region and grow array if needed
    if (addr >= this.roDataAddress && addr < this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      const requiredSize = offset + length
      if (this.roData.length < requiredSize) {
        // Grow by at least one page (page-aligned)
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        newData.set(this.roData, 0)
        this.roData = newData
        // Update roDataAddressEnd to reflect the new size
        this.roDataAddressEnd = this.roDataAddress + this.roData.length
      }
    }

    // Check if page is in stack region and grow array if needed
    if (addr >= this.stackAddress && addr < this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      const requiredSize = offset + length
      if (this.stack.length < requiredSize) {
        // Grow by at least one page (page-aligned)
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        newData.set(this.stack, 0)
        this.stack = newData
        // Update stackAddressEnd to reflect the new size
        this.stackAddressEnd = this.stackAddress + this.stack.length
      }
    }

    // Check if page is in output region and grow array if needed
    if (addr >= this.argumentDataAddress && addr < this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      const requiredSize = offset + length
      if (this.argumentData.length < requiredSize) {
        // Grow by at least one page (page-aligned)
        const alignedSize = alignToPage(requiredSize)
        const newData = new Uint8Array(alignedSize)
        newData.set(this.argumentData, 0)
        this.argumentData = newData
        // Update outputEnd to reflect the new size
        this.argumentDataEnd =
          this.argumentDataAddress + this.argumentData.length
      }
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
    count: 1n | 2n | 4n | 8n | 16n | 32n,
  ): [Uint8Array | null, bigint | null] {
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
        // Beyond allocated array - check if we're in padding region
        if (addr >= this.heapEndAddress) {
          // In padding region (heapEndAddress to heapZerosEndAddress)
          // Gray Paper: padding is initialized to zeros and is readable
          return [new Uint8Array(length), null]
        } else {
          // Within data region but array too small
          // Check sparse memory as fallback (for test vectors that initialized memory before heap bounds were set)
          const result = new Uint8Array(length)
          let hasSparseData = false
          for (let i = 0; i < length; i++) {
            const sparseAddr = address + BigInt(i)
            const sparseValue = this.sparseMemory.get(sparseAddr)
            if (sparseValue !== undefined) {
              result[i] = sparseValue
              hasSparseData = true
            } else {
              result[i] = 0
            }
          }
          if (hasSparseData) {
            return [result, null]
          }
          // No sparse data - return fault
          const faultPage = this.getPageIndex(address)
          return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
        }
      } else {
        // Within allocated array - return data
        // But also check sparse memory as fallback for addresses that were initialized before heap bounds were set
        const heapData = this.heap.slice(offset, offset + length)
        // Check if sparse memory has data for any of these addresses
        let hasSparseData = false
        for (let i = 0; i < length; i++) {
          const sparseAddr = address + BigInt(i)
          if (this.sparseMemory.has(sparseAddr)) {
            hasSparseData = true
            break
          }
        }
        if (hasSparseData) {
          // Merge: use sparse memory if available, otherwise use heap data
          const result = new Uint8Array(length)
          for (let i = 0; i < length; i++) {
            const sparseAddr = address + BigInt(i)
            const sparseValue = this.sparseMemory.get(sparseAddr)
            result[i] = sparseValue !== undefined ? sparseValue : heapData[i]
          }
          return [result, null]
        }
        return [heapData, null]
      }
    }

    // Read-only data section: roDataAddress ≤ i < roDataAddressEnd (data)
    // Read-only padding: roDataAddressEnd ≤ i < roDataAddressEnd + padding (padding, value = 0)
    // Since max read is 32 bytes, a read can span at most one page boundary
    if (addr >= this.roDataAddress) {
      if (addr < this.roDataAddressEnd) {
        // Read starts in data region
        const offset = addr - this.roDataAddress
        const dataLength = Math.min(length, this.roDataAddressEnd - addr)

        if (end <= this.roDataAddressEnd) {
          // Entire read is within data region
          if (offset + length > this.roData.length) {
            const faultPage = this.getPageIndex(address)
            return [null, faultPage * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
          }
          return [this.roData.slice(offset, offset + length), null]
        } else {
          // Read spans data + padding (max 32 bytes total, so simple case)
          const dataPortion = this.roData.slice(offset, offset + dataLength)
          const result = new Uint8Array(length)
          result.set(dataPortion, 0)
          return [result, null]
        }
      }
      // Read starts in padding region - fall through to return zeros
    }

    // Address outside defined regions but in readable page
    // Gray Paper: readable pages can be read even outside standard regions
    // Check sparse memory first (for test vectors that write to uninitialized regions)
    const result = new Uint8Array(length)
    for (let i = 0; i < length; i++) {
      const addr = address + BigInt(i)
      const value = this.sparseMemory.get(addr)
      // If sparse memory has a value, use it; otherwise default to zero
      // Gray Paper: unallocated memory reads as zero
      result[i] = value !== undefined ? value : 0
    }
    return [result, null]
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
      // Go doesn't check array size - assumes it's correct if bounds check passes
      // If array is too small, this will throw (matching Go's behavior)
      this.argumentData.set(values, offset)
      return null
    }

    if (addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      // Go implementation: directly copies (no array growth)
      this.stack.set(values, offset)
      return null
    }

    // heap region: from heapStartAddress to zone-aligned currentHeapPointer
    // Go WriteRAMBytes: address >= ram.rw_data_address && end <= Z_func(ram.current_heap_pointer)
    if (addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      // Check if array needs to be grown to accommodate the write
      if (offset + length > this.heap.length) {
        // Address is beyond allocated heap but within zone-aligned heap bound
        // Per Gray Paper: if page is writable, we should be able to write to it
        // Grow the array to accommodate the write (similar to allocatePages behavior)
        const requiredSize = offset + length
        const newData = new Uint8Array(requiredSize)
        newData.set(this.heap, 0)
        this.heap = newData
      }
      // Go implementation: directly copies (arrays are grown via allocatePages or here)
      this.heap.set(values, offset)
      return null
    }

    if (addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      // Go implementation: directly copies (no array growth)
      this.roData.set(values, offset)
      return null
    }

    // Address outside defined regions but in writable page
    // Gray Paper pvm.tex: writes are permitted if page has write access, regardless of region
    // Store in sparse memory for addresses outside standard regions
    // This is needed for test vectors that initialize pages directly
    for (let i = 0; i < length; i++) {
      this.sparseMemory.set(address + BigInt(i), values[i])
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

    // Write directly to the appropriate region without checking writable access
    // Check if heap bounds are initialized (non-zero) before using heap region
    if (this.heapStartAddress > 0 && addr >= this.heapStartAddress && end <= this.currentHeapPointer) {
      const offset = addr - this.heapStartAddress
      // Grow heap if needed
      if (offset + length > this.heap.length) {
        const requiredSize = offset + length
        const newData = new Uint8Array(requiredSize)
        newData.set(this.heap, 0)
        this.heap = newData
      }
      this.heap.set(values, offset)
      return
    }

    if (this.argumentDataAddress > 0 && addr >= this.argumentDataAddress && end <= this.argumentDataEnd) {
      const offset = addr - this.argumentDataAddress
      this.argumentData.set(values, offset)
      return
    }

    if (this.stackAddress > 0 && addr >= this.stackAddress && end <= this.stackAddressEnd) {
      const offset = addr - this.stackAddress
      this.stack.set(values, offset)
      return
    }

    if (this.roDataAddress > 0 && addr >= this.roDataAddress && end <= this.roDataAddressEnd) {
      const offset = addr - this.roDataAddress
      this.roData.set(values, offset)
      return
    }

    // Address outside standard regions or bounds not initialized yet - use sparse memory
    // This is needed for test vectors that initialize memory before heap bounds are set
    for (let i = 0; i < length; i++) {
      this.sparseMemory.set(address + BigInt(i), values[i])
    }
  }

  isReadableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
    // Check bounds
    if (address < 0n || address + size > this.MAX_ADDRESS) {
      return [false, address]
    }

    // Gray Paper: readable(memory) ≡ {i | memory_ram_access[⌊i/Cpvmpagesize⌋] ≠ none}
    // This means both 'read' and 'write' pages are readable (anything ≠ none)
    // Check all pages that the address range spans
    // Note: endAddress in stored ranges is exclusive, so we check if [address, address + size) is contained
    const endRequestedAddress = address + size
    for (const [
      [startAddress, endAddress],
      pageAccess,
    ] of this.pageAccess.entries()) {
      // Range [startAddress, endAddress) contains [address, address + size) if:
      // startAddress <= address AND endAddress >= address + size
      if (startAddress <= address && endAddress >= endRequestedAddress) {
        if (pageAccess !== 'none') {
          return [true, null]
        }
      }
    }
    return [false, this.getPageIndex(address) * BigInt(MEMORY_CONFIG.PAGE_SIZE)]
  }

  isWritableWithFault(address: bigint, size = 1n): [boolean, bigint | null] {
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

    // Address outside defined regions - check sparse memory first
    // Gray Paper: unallocated memory reads as zero
    const result = new Array(length)
    for (let i = 0; i < length; i++) {
      const addr = address + BigInt(i)
      const value = this.sparseMemory.get(addr)
      // If sparse memory has a value, use it; otherwise default to zero
      result[i] = value !== undefined ? value : 0
    }
    return result
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

    // Clear sparse memory
    this.sparseMemory.clear()

    // Reset addresses
    this.stackAddress = 0
    this.stackAddressEnd = 0
    this.heapStartAddress = 0
    this.heapEndAddress = 0
    this.roDataAddress = 0
    this.roDataAddressEnd = 0
    this.currentHeapPointer = 0
    this.argumentDataAddress = 0
    this.argumentDataEnd = 0
    // Clear page and address interaction history
    this.addressInteractionHistory.clear()

    logger.debug('PVMRAM cleared')
  }
}
