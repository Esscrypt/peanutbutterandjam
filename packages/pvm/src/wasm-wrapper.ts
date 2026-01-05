/**
 * PVM WASM-Compatible Wrapper
 *
 * Implements a WASM-compatible interface for our PVM implementation.
 * This wrapper allows our TypeScript/JavaScript PVM to be used with
 * the same interface as WASM PVM shells, enabling drop-in replacement
 * and compatibility testing.
 *
 * Status: TypeScript implementation (can be compiled to WASM with Bun)
 */

import { logger } from '@pbnjam/core'
import { RESULT_CODES } from './config'
import type { HostFunctionRegistry } from './host-functions/general/registry'
import { PVM } from './pvm'

/**
 * PVM execution status codes matching WASM interface
 */
export enum Status {
  OK = 0, // Execution can continue
  HALT = 1, // Halted normally
  PANIC = 2, // Panic condition
  FAULT = 3, // Page fault
  HOST = 4, // Host call
  OOG = 5, // Out of gas
}

/**
 * WASM-compatible PVM shell interface
 *
 * This interface matches the expected WASM PVM shell API,
 * allowing our TypeScript implementation to be used as a drop-in replacement.
 */
export interface WasmPvmShellInterface {
  // Core execution
  resetGeneric(program: Uint8Array, registers: Uint8Array, gas: bigint): void
  resetGenericWithMemory?(
    program: Uint8Array,
    registers: Uint8Array,
    pageMap: Uint8Array,
    chunks: Uint8Array,
    gas: bigint,
  ): void
  nextStep(): boolean
  nSteps(steps: number): boolean

  // State inspection
  getProgramCounter(): number
  setNextProgramCounter?(pc: number): void
  getGasLeft(): bigint
  setGasLeft?(gas: bigint): void
  getStatus(): Status
  getExitArg(): number

  // Register management
  getRegisters(): Uint8Array
  setRegisters(registers: Uint8Array): void

  // Memory management
  getPageDump(index: number): Uint8Array
  setMemory(address: number, data: Uint8Array): void
}

/**
 * PVM Wrapper implementing WASM-compatible interface
 *
 * Maps our PVM implementation to the expected WASM interface
 * for compatibility with existing WASM-based PVM shells.
 *
 * Usage:
 * ```typescript
 * const registry = new HostFunctionRegistry(configService)
 * const pvmShell = new PVMWasmWrapper(registry)
 *
 * pvmShell.resetGeneric(program, registers, gas)
 * while (pvmShell.nextStep()) {
 *   console.log(`PC: ${pvmShell.getProgramCounter()}`)
 * }
 * console.log(`Status: ${pvmShell.getStatus()}`)
 * ```
 */
export class PVMWasmWrapper implements WasmPvmShellInterface {
  private pvm: PVM
  private lastStatus: Status = Status.OK
  private exitArg = 0 // eslint-disable-line @typescript-eslint/no-magic-numbers

  constructor(hostFunctionRegistry: HostFunctionRegistry) {
    this.pvm = new PVM(hostFunctionRegistry)
  }

  /**
   * Reset PVM with program and initial registers
   *
   * Gray Paper: Initialize PVM state for execution (Y function)
   *
   * @param program - PVM program preimage (encoded preimage containing code blob)
   * @param registers - Initial register values (13 x 8 bytes = 104 bytes, little-endian)
   * @param gas - Initial gas amount
   */
  resetGeneric(program: Uint8Array, registers: Uint8Array, gas: bigint): void {
    try {
      this.lastStatus = Status.OK
      this.exitArg = 0

      // Decode registers from Uint8Array (13 registers x 8 bytes each, little-endian)
      const registerValues = this.decodeRegisters(registers)

      // Use PVM's initializeProgram (Gray Paper Y function)
      // Pass empty argument data for now (WASM wrapper doesn't use marshalling invocation)
      const argumentData = new Uint8Array(0)
      const [error, codeBlob] = this.pvm.initializeProgram(
        program,
        argumentData,
      )

      if (error) {
        logger.error('PVMWasmWrapper: Program initialization error', {
          error: error.message,
        })
        this.lastStatus = Status.PANIC
        return
      }

      // Set gas and registers
      this.pvm.state.gasCounter = gas
      this.pvm.state.programCounter = 0n
      this.pvm.state.registerState = registerValues

      logger.debug('PVMWasmWrapper: Reset complete', {
        programSize: program.length,
        gas: gas.toString(),
        pc: this.pvm.state.programCounter.toString(),
        codeSize: codeBlob.length,
      })
    } catch (error) {
      logger.error('PVMWasmWrapper: Reset failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.lastStatus = Status.PANIC
    }
  }

  /**
   * Reset PVM with full memory state
   *
   * Restores complete PVM state including memory pages from serialized format.
   *
   * @param program - PVM program preimage (encoded preimage containing code blob)
   * @param registers - Initial register values
   * @param pageMap - Memory page mapping (page_index: u16, chunk_offset: u32) pairs
   * @param chunks - Memory chunk data (concatenated 4KB pages)
   * @param gas - Initial gas amount
   */
  resetGenericWithMemory(
    program: Uint8Array,
    registers: Uint8Array,
    pageMap: Uint8Array,
    chunks: Uint8Array,
    gas: bigint,
  ): void {
    // First do generic reset
    this.resetGeneric(program, registers, gas)

    if (this.lastStatus === Status.PANIC) {
      return
    }

    // Then restore memory state from pageMap and chunks
    try {
      this.restoreMemoryFromChunks(pageMap, chunks)
      logger.debug('PVMWasmWrapper: Memory restored', {
        pageMapSize: pageMap.length,
        chunksSize: chunks.length,
      })
    } catch (error) {
      logger.error('PVMWasmWrapper: Memory restore failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.lastStatus = Status.PANIC
    }
  }

  /**
   * Execute one instruction
   *
   * Gray Paper: Execute single PVM instruction (Ψ_1)
   *
   * @returns true if execution should continue, false if halted/panicked/OOG
   */
  nextStep(): boolean {
    if (this.lastStatus !== Status.OK) {
      return false
    }

    try {
      // Execute single step
      const [error, result] = this.pvm.executeSingleStep()

      if (error) {
        logger.error('PVMWasmWrapper: Step execution error', {
          error: error.message,
          pc: this.pvm.state.programCounter.toString(),
        })
        this.lastStatus = Status.PANIC
        return false
      }

      // Check result code
      if (result === RESULT_CODES.HALT) {
        this.lastStatus = Status.HALT
        this.exitArg = Number(this.pvm.state.registerState[7] & 0xffffffffn)
        logger.debug('PVMWasmWrapper: Halted', {
          exitArg: this.exitArg,
        })
        return false
      } else if (result === RESULT_CODES.PANIC) {
        this.lastStatus = Status.PANIC
        logger.debug('PVMWasmWrapper: Panicked')
        return false
      } else if (result === RESULT_CODES.OOG) {
        this.lastStatus = Status.OOG
        logger.debug('PVMWasmWrapper: Out of gas')
        return false
      } else if (result === RESULT_CODES.FAULT) {
        this.lastStatus = Status.FAULT
        logger.debug('PVMWasmWrapper: Page fault')
        return false
      }

      // Check gas
      if (this.pvm.state.gasCounter < 0n) {
        this.lastStatus = Status.OOG
        return false
      }

      return true
    } catch (error) {
      logger.error('PVMWasmWrapper: Unexpected error in nextStep', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.lastStatus = Status.PANIC
      return false
    }
  }

  /**
   * Execute N instructions
   *
   * @param steps - Number of steps to execute
   * @returns true if execution should continue, false if halted/panicked/OOG
   */
  nSteps(steps: number): boolean {
    for (let i = 0; i < steps; i++) {
      if (!this.nextStep()) {
        return false
      }
    }
    return true
  }

  /**
   * Get current program counter
   */
  getProgramCounter(): number {
    return Number(this.pvm.state.programCounter)
  }

  /**
   * Set next program counter
   */
  setNextProgramCounter(pc: number): void {
    this.pvm.state.programCounter = BigInt(pc)
  }

  /**
   * Get remaining gas
   */
  getGasLeft(): bigint {
    return this.pvm.state.gasCounter
  }

  /**
   * Set remaining gas
   */
  setGasLeft(gas: bigint): void {
    this.pvm.state.gasCounter = gas
  }

  /**
   * Get current execution status
   */
  getStatus(): Status {
    return this.lastStatus
  }

  /**
   * Get exit argument (value in r7 when halted)
   */
  getExitArg(): number {
    return this.exitArg
  }

  /**
   * Get all registers as Uint8Array
   *
   * Gray Paper: Register state serialization (little-endian)
   *
   * @returns 104 bytes (13 registers x 8 bytes each, little-endian)
   */
  getRegisters(): Uint8Array {
    const buffer = new Uint8Array(13 * 8)
    const view = new DataView(buffer.buffer)

    for (let i = 0; i < 13; i++) {
      const value = this.pvm.state.registerState[i]
      view.setBigUint64(i * 8, value, true) // little-endian
    }

    return buffer
  }

  /**
   * Set all registers from Uint8Array
   *
   * @param registers - 104 bytes (13 registers x 8 bytes each, little-endian)
   */
  setRegisters(registers: Uint8Array): void {
    this.pvm.state.registerState = this.decodeRegisters(registers)
  }

  /**
   * Get memory page dump
   *
   * Gray Paper: Read 4KB page from memory
   *
   * @param index - Page index (page address = index * 4096)
   * @returns Page data (4096 bytes)
   */
  getPageDump(index: number): Uint8Array {
    const pageSize = 4096
    const startAddress = BigInt(index * pageSize)

    try {
      const [data, faultAddress] = this.pvm.state.ram.readOctets(
        startAddress,
        BigInt(pageSize),
      )

      if (faultAddress !== null || data === null) {
        logger.warn('PVMWasmWrapper: Page dump fault', {
          index,
          faultAddress: faultAddress?.toString(),
        })
        return new Uint8Array(pageSize) // Return zeros on fault
      }

      return data
    } catch (error) {
      logger.warn('PVMWasmWrapper: Page dump error', {
        index,
        error: error instanceof Error ? error.message : String(error),
      })
      return new Uint8Array(pageSize) // Return zeros on error
    }
  }

  /**
   * Write data to memory at address
   *
   * @param address - Starting address
   * @param data - Data to write
   */
  setMemory(address: number, data: Uint8Array): void {
    const startAddress = BigInt(address)
    const faultAddress = this.pvm.state.ram.writeOctets(startAddress, data)
    if (faultAddress) {
      logger.warn('PVMWasmWrapper: Memory write fault', {
        address,
        dataLength: data.length,
        faultAddress: faultAddress.toString(),
      })
    }
  }

  // ===== Helper Methods =====

  /**
   * Decode registers from Uint8Array (little-endian)
   *
   * @param registers - 104 bytes (13 registers x 8 bytes each)
   * @returns Array of 13 bigint register values
   */
  private decodeRegisters(registers: Uint8Array): bigint[] {
    if (registers.length !== 13 * 8) {
      throw new Error(
        `Invalid register data length: expected 104, got ${registers.length}`,
      )
    }

    const view = new DataView(
      registers.buffer,
      registers.byteOffset,
      registers.byteLength,
    )
    const registerValues: bigint[] = []

    for (let i = 0; i < 13; i++) {
      registerValues.push(view.getBigUint64(i * 8, true)) // little-endian
    }

    return registerValues
  }

  /**
   * Restore memory from page map and chunks
   *
   * Page map format: sequence of (page_index: u16, chunk_offset: u32) pairs (little-endian)
   * Chunks format: concatenated 4KB page data
   *
   * @param pageMap - Page mapping data
   * @param chunks - Concatenated page chunks
   */
  private restoreMemoryFromChunks(
    pageMap: Uint8Array,
    chunks: Uint8Array,
  ): void {
    const pageSize = 4096
    const entrySize = 6 // 2 bytes (u16) + 4 bytes (u32)
    let chunkOffset = 0

    for (
      let mapOffset = 0;
      mapOffset < pageMap.length;
      mapOffset += entrySize
    ) {
      // Read page index (2 bytes, little-endian)
      const pageIndex = pageMap[mapOffset] | (pageMap[mapOffset + 1] << 8)

      // Skip chunk offset field (4 bytes) - we read sequentially
      // (In actual WASM implementation, this would be used for random access)

      // Read page data from chunks
      const pageData = chunks.slice(chunkOffset, chunkOffset + pageSize)
      chunkOffset += pageSize

      // Write to memory
      const startAddress = BigInt(pageIndex * pageSize)
      this.pvm.state.ram.writeOctets(startAddress, pageData)
    }
  }
}

/**
 * Factory function to create PVM wrapper instance
 *
 * @param hostFunctionRegistry - Host function registry for PVM
 * @returns WASM-compatible PVM shell instance
 */
export function createPvmShell(
  hostFunctionRegistry: HostFunctionRegistry,
): WasmPvmShellInterface {
  return new PVMWasmWrapper(hostFunctionRegistry)
}
