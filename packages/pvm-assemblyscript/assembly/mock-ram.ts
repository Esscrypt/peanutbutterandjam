/**
 * Mock RAM implementation for testing
 * 
 * A no-op implementation that satisfies the RAM interface but does nothing.
 * Useful for testing when you don't need actual memory functionality,
 * or to isolate issues that might be in RAM implementation code.
 */

import { FaultCheckResult, ReadResult, RAM, MemoryAccessType, WriteResult } from './types'
import { MEMORY_CONFIG } from './config'

export class MockRAM implements RAM {
  currentHeapPointer: u32 = 0

  // JIP-6 trace support: Track last load/store (no-op, always 0)
  lastLoadAddress: u32 = 0
  lastLoadValue: u64 = 0
  lastStoreAddress: u32 = 0
  lastStoreValue: u64 = 0

  /**
   * Clear last load/store tracking (no-op)
   */
  clearLastMemoryOp(): void {
    this.lastLoadAddress = 0
    this.lastLoadValue = 0
    this.lastStoreAddress = 0
    this.lastStoreValue = 0
  }

  /**
   * Read multiple octets from memory (no-op)
   * Returns zero-filled data with no faults
   */
  readOctets(address: u32, count: u32): ReadResult {
    // Return zero-filled data, no fault
    return new ReadResult(new Uint8Array(count), 0)
  }

  /**
   * Write multiple octets to memory (no-op)
   * Always succeeds
   */
  writeOctets(address: u32, values: Uint8Array): WriteResult {
    // Always succeed (no fault)
    return new WriteResult(false, 0)
  }

  /**
   * Allocate pages (no-op)
   */
  allocatePages(startPage: u32, count: u32): void {
    // Do nothing
  }

  /**
   * Check if memory is readable (no-op)
   * Always returns readable
   */
  isReadableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    // Always readable (no fault)
    return new FaultCheckResult(true, 0)
  }

  /**
   * Check if memory is writable (no-op)
   * Always returns writable
   */
  isWritableWithFault(address: u32, size: u32 = u32(1)): FaultCheckResult {
    // Always writable (no fault)
    return new FaultCheckResult(true, 0)
  }

  /**
   * Initialize memory layout (no-op)
   */
  initializeMemoryLayout(
    argumentData: Uint8Array,
    readOnlyData: Uint8Array,
    readWriteData: Uint8Array,
    stackSize: u32,
    heapZeroPaddingSize: u32,
  ): void {
    // Do nothing
  }

  /**
   * Set page access rights (no-op)
   */
  setPageAccessRights(address: u32, length: u32, accessType: MemoryAccessType): void {
    // Do nothing
  }

  /**
   * Initialize a memory page (no-op)
   */
  initPage(address: u32, length: u32, accessType: MemoryAccessType): void {
    // Do nothing
  }

  /**
   * Write to memory during initialization (no-op)
   */
  writeOctetsDuringInitialization(address: u32, values: Uint8Array): void {
    // Do nothing
  }

  /**
   * Get page dump for a specific page index (no-op)
   * Returns zeros for mock implementation
   */
  getPageDump(pageIndex: u32): Uint8Array {
    // Return zeros (mock implementation)
    return new Uint8Array(MEMORY_CONFIG.PAGE_SIZE)
  }

  /**
   * Reset RAM to initial state
   * Resets heap pointer (no-op for mock)
   */
  reset(): void {
    // Reset heap pointer
    this.currentHeapPointer = 0
  }
}

