/**
 * PVM WASM-Compatible Wrapper (AssemblyScript)
 * 
 * Implements a WASM-compatible interface for our PVM implementation.
 * This wrapper allows our AssemblyScript PVM to be used with
 * the same interface as WASM PVM shells, enabling drop-in replacement
 * and compatibility testing.
 */

import {
  RESULT_CODE_FAULT,
  RESULT_CODE_HALT,
  RESULT_CODE_HOST,
  RESULT_CODE_OOG,
  RESULT_CODE_PANIC,
} from './config'
import { decodeBlob } from './codec'
import { PVM, PVMInstruction } from './pvm'

import { PVMRAM } from './ram'
import { RAM } from './types'
import {  MemoryAccessType } from './types'
import { HostFunctionRegistry } from './host-functions'

/**
 * PVM execution status codes matching WASM interface
 */
export enum Status {
  OK = 0,        // Execution can continue
  HALT = 1,      // Halted normally
  PANIC = 2,     // Panic condition
  FAULT = 3,     // Page fault
  HOST = 4,      // Host call
  OOG = 5,       // Out of gas
}

/**
 * WASM-compatible PVM shell interface
 * 
 * This interface matches the expected WASM PVM shell API,
 * allowing our AssemblyScript implementation to be used as a drop-in replacement.
 */
export interface WasmPvmShellInterface {
  // Core execution
  resetGeneric(program: Uint8Array, registers: Uint8Array, gas: u64): void
  resetGenericWithMemory(
    program: Uint8Array,
    registers: Uint8Array,
    pageMap: Uint8Array,
    chunks: Uint8Array,
    gas: u64,
  ): void
  nextStep(): bool
  nSteps(steps: i32): bool
  run(codeBlob: Uint8Array | null): void
  runBlob(programBytes: Uint8Array): void
  
  // State inspection
  getProgramCounter(): i32
  setNextProgramCounter(pc: i32): void
  getGasLeft(): u64
  setGasLeft(gas: u64): void
  getStatus(): Status
  getExitArg(): i32
  
  // Register management
  getRegisters(): Uint8Array
  setRegisters(registers: Array<u8>): void
  getRegister(index: u8): u64
  setRegister(index: u8, value: u64): void
  
  // Memory management
  getPageDump(index: u32): Uint8Array
  setMemory(address: u32, data: Uint8Array): void
  initPage(address: u32, length: u32, accessType: MemoryAccessType): void

  // Result extraction
  getResult(): Uint8Array
}

/**
 * PVM Wrapper implementing WASM-compatible interface
 * 
 * Maps our PVM implementation to the expected WASM interface
 * for compatibility with existing WASM-based PVM shells.
 */
export class PVMWasmWrapper implements WasmPvmShellInterface {
  pvm: PVM
  lastStatus: Status = Status.OK
  exitArg: i32 = 0
  
  constructor(ram: RAM | null = null) {
    const registerState = new StaticArray<u64>(13)
    for (let i: i32 = 0; i < 13; i++) {
      registerState[i] = 0
    }
    // Use provided RAM, or default to PVMRAM
    const ramInstance = ram ? ram : new PVMRAM()
    const hostFunctionRegistry = new HostFunctionRegistry()
    this.pvm = new PVM(registerState, ramInstance, 0, 0, hostFunctionRegistry)
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
  resetGeneric(program: Uint8Array, registers: Uint8Array, gas: u32): void {
    this.lastStatus = Status.OK
    this.exitArg = 0
    
    // Decode registers from Uint8Array (13 registers x 8 bytes each, little-endian)
    const registerValues = this.decodeRegistersFromUint8Array(registers)
    
    // Use PVM's initializeProgram (Gray Paper Y function)
    // Pass empty argument data for now (WASM wrapper doesn't use marshalling invocation)
    const argumentData = new Uint8Array(0)
    const codeBlob = this.pvm.initializeProgram(program, argumentData)
    
    if (!codeBlob) {
      this.lastStatus = Status.PANIC
      return
    }
    
    // Set gas and registers
    this.pvm.state.gasCounter = gas
    this.pvm.state.programCounter = 0
    this.pvm.state.registerState = registerValues
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
    gas: u32,
  ): void {
    // First do generic reset
    this.resetGeneric(program, registers, gas)
    
    // Then restore memory state from pageMap and chunks
    this.restoreMemoryFromChunks(pageMap, chunks)

  }
  
  /**
   * Execute one instruction
   * 
   * Gray Paper: Execute single PVM instruction (Ψ_1)
   * 
   * @returns true if execution should continue, false if halted/panicked/OOG
   */
  nextStep(): bool {
    if (this.lastStatus !== Status.OK) {
      return false
    }
    
    // Check if we're out of gas before executing
    if (this.pvm.state.gasCounter === 0) {
      this.lastStatus = Status.OOG
      return false
    }
    
    // Get current instruction
    const instructionIndex = i32(this.pvm.state.programCounter)
    
    // CRITICAL: Verify code and bitmask are set
    // If code is empty, this means initializeProgram failed or wasn't called
    if (this.pvm.state.code.length === 0 || this.pvm.state.bitmask.length === 0) {
      this.lastStatus = Status.PANIC
      return false
    }
    
    // Extend code and bitmask if needed (same as run method)
    const extendedCode = new Uint8Array(this.pvm.state.code.length + 16)
    extendedCode.set(this.pvm.state.code)
    
    const extendedBitmask = new Uint8Array(this.pvm.state.bitmask.length + 16)
    extendedBitmask.set(this.pvm.state.bitmask)
    extendedBitmask.fill(1, this.pvm.state.bitmask.length)
    
    // Bounds check
    if (instructionIndex < 0 || instructionIndex >= extendedCode.length) {
      this.lastStatus = Status.PANIC
      return false
    }
    
    // Validate opcode (bounds check already done above)
    const opcode = extendedCode[instructionIndex]
    
    // Calculate Fskip(i)
    const fskip = this.skip(instructionIndex, extendedBitmask)
    const instructionLength = 1 + fskip
    
    // Extract operands
    const operands = extendedCode.slice(
      instructionIndex + 1,
      instructionIndex + instructionLength,
    )
    
    const instruction = new PVMInstruction(
      opcode,
      operands,
      fskip,
      this.pvm.state.programCounter,
    )
    
    // Execute instruction
    const resultCode = this.pvm.step(instruction)
    
    // Check result code
    // -1 means continue, >= 0 means halt with that code
    if (resultCode === -1) {
      // Continue execution - fall through to gas check
    } else if (resultCode === i32(RESULT_CODE_HALT)) {
      this.lastStatus = Status.HALT
      this.exitArg = i32(this.pvm.state.registerState[7] & u64(0xffffffff))
      return false
    } else if (resultCode === i32(RESULT_CODE_PANIC)) {
      this.lastStatus = Status.PANIC
      return false
    } else if (resultCode === i32(RESULT_CODE_OOG)) {
      this.lastStatus = Status.OOG
      return false
    } else if (resultCode === RESULT_CODE_FAULT) {
      this.lastStatus = Status.FAULT
      return false
    } else if (resultCode === i32(RESULT_CODE_HOST)) {
      this.lastStatus = Status.HOST
      return false
    } else {
      // Unknown result code - treat as continue (likely -1)
    }
    
    // Check gas
    if (this.pvm.state.gasCounter === 0) {
      this.lastStatus = Status.OOG
      return false
    }
    
    return true
  }
  
  /**
   * Skip function Fskip(i) - determines distance to next instruction
   * Gray Paper: Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1)
   */
  skip(instructionIndex: i32, opcodeBitmask: Uint8Array): i32 {
    // Append bitmask with sequence of set bits for final instruction
    const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
    extendedBitmask.set(opcodeBitmask)
    extendedBitmask.fill(1, opcodeBitmask.length)
    
    // Find next set bit starting from i+1
    for (let j: i32 = 1; j <= 24; j++) {
      const bitIndex = instructionIndex + j
      if (
        bitIndex < extendedBitmask.length &&
        extendedBitmask[bitIndex] === 1
      ) {
        return j - 1
      }
    }
    
    return 24 // Maximum skip distance
  }
  
  /**
   * Execute N instructions
   * 
   * @param steps - Number of steps to execute
   * @returns true if execution should continue, false if halted/panicked/OOG
   */
  nSteps(steps: i32): bool {
    for (let i: i32 = 0; i < steps; i++) {
      if (!this.nextStep()) {
        return false
      }
    }
    return true
  }
  
  /**
   * Execute program until termination (Gray Paper Ψ function)
   * 
   * Uses PVM's run() method to execute until halt/panic/OOG
   * 
   * @param codeBlob - Optional code blob to decode. If provided, decodes and sets state before running.
   */
  run(codeBlob: Uint8Array | null): void {
    this.pvm.run(codeBlob)
    
    // Update status based on final result code
    const resultCode = this.pvm.state.resultCode
    if (resultCode === RESULT_CODE_HALT) {
      this.lastStatus = Status.HALT
      this.exitArg = i32(this.pvm.state.registerState[7] & u64(0xffffffff))
    } else if (resultCode === RESULT_CODE_PANIC) {
      this.lastStatus = Status.PANIC
    } else if (resultCode === RESULT_CODE_OOG) {
      this.lastStatus = Status.OOG
    } else if (resultCode === RESULT_CODE_FAULT) {
      this.lastStatus = Status.FAULT
      this.exitArg = this.pvm.state.hasFaultAddress ? i32(this.pvm.state.faultAddress) : 0
    } else if (resultCode === RESULT_CODE_HOST) {
      this.lastStatus = Status.HOST
    } else {
      this.lastStatus = Status.OK
    }
  }
  
  /**
   * Decode program blob without executing (for step-by-step execution)
   * 
   * Takes raw program bytes in deblob format, decodes them, and sets up PVM state
   * without executing. This allows for step-by-step execution using nextStep().
   * 
   * @param blob - Raw program bytes (deblob format) to decode
   */
  prepareBlob(blob: Uint8Array): void {
    // Decode the blob and set state without executing
    const decoded = decodeBlob(blob)
    if (!decoded) {
      this.lastStatus = Status.PANIC
      this.pvm.state.resultCode = RESULT_CODE_PANIC
      return
    }
    
    // Set decoded program state
    this.pvm.state.code = decoded.code
    this.pvm.state.bitmask = decoded.bitmask
    this.pvm.state.jumpTable = decoded.jumpTable
    
    // Extend code and bitmask (same as run() does)
    const extendedCode = new Uint8Array(this.pvm.state.code.length + 16)
    extendedCode.set(this.pvm.state.code)
    
    const extendedBitmask = new Uint8Array(this.pvm.state.bitmask.length + 16)
    extendedBitmask.set(this.pvm.state.bitmask)
    extendedBitmask.fill(1, this.pvm.state.bitmask.length)
    
    this.pvm.state.code = extendedCode
    this.pvm.state.bitmask = extendedBitmask
    
    // Reset status to OK so we can step through
    this.lastStatus = Status.OK
    this.pvm.state.resultCode = 0
  }
  
  /**
   * Execute program with deblob format program bytes
   * 
   * Takes raw program bytes in deblob format, decodes them, and runs the program.
   * This is useful for test vectors that provide raw program bytes in deblob format.
   * 
   * Uses SimpleRAM for simplified memory management (no regions).
   * 
   * Test vectors use deblob format: encode(len(j)) || encode[1](z) || encode(len(c)) || encode[z](j) || encode(c) || encode(k)
   * 
   * @param programBytes - Raw program bytes (deblob format) to decode and execute
   */
  runBlob(blob: Uint8Array): void {
    // Run the program using the configured RAM instance
    this.pvm.run(blob)
    
    // Update status based on final result code
    const resultCode = this.pvm.state.resultCode
    if (resultCode === RESULT_CODE_HALT) {
      this.lastStatus = Status.HALT
      this.exitArg = i32(this.pvm.state.registerState[7] & u64(0xffffffff))
    } else if (resultCode === RESULT_CODE_PANIC) {
      this.lastStatus = Status.PANIC
    } else if (resultCode === RESULT_CODE_OOG) {
      this.lastStatus = Status.OOG
    } else if (resultCode === RESULT_CODE_FAULT) {
      this.lastStatus = Status.FAULT
      this.exitArg = this.pvm.state.hasFaultAddress ? i32(this.pvm.state.faultAddress) : 0
    } else if (resultCode === RESULT_CODE_HOST) {
      this.lastStatus = Status.HOST
    } else {
      this.lastStatus = Status.OK
    }
  }
  
  /**
   * Get current program counter
   */
  getProgramCounter(): u32 {
    return this.pvm.state.programCounter
  }
  
  /**
   * Set next program counter
   */
  setNextProgramCounter(pc: u32): void {
    this.pvm.state.programCounter = pc
  }
  
  /**
   * Get remaining gas
   */
  getGasLeft(): u32 {
    return this.pvm.state.gasCounter
  }
  
  /**
   * Set remaining gas
   */
  setGasLeft(gas: u32): void {
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
  getExitArg(): i32 {
    return this.exitArg
  }
  
  /**
   * Get code array (for debugging/comparison)
   * @returns Copy of the code array
   */
  getCode(): Uint8Array {
    return this.pvm.state.code.slice()
  }
  
  /**
   * Get bitmask array (for debugging/comparison)
   * @returns Copy of the bitmask array
   */
  getBitmask(): Uint8Array {
    return this.pvm.state.bitmask.slice()
  }
  
  /**
   * Get all registers as Uint8Array
   * 
   * Gray Paper: Register state serialization (little-endian)
   * 
   * Uses SimpleRAM PVM if available (for runBlob), otherwise uses default PVM
   * 
   * @returns 104 bytes (13 registers x 8 bytes each, little-endian)
   */
  getRegisters(): Uint8Array {
    const buffer = new Uint8Array(13 * 8)
    
    for (let i: i32 = 0; i < 13; i++) {
      const value = this.pvm.state.registerState[i]
      // Write little-endian u64
      const offset = i * 8
      buffer[offset] = u8(value & u64(0xff))
      buffer[offset + 1] = u8((value >> 8) & u64(0xff))
      buffer[offset + 2] = u8((value >> 16) & u64(0xff))
      buffer[offset + 3] = u8((value >> 24) & u64(0xff))
      buffer[offset + 4] = u8((value >> 32) & u64(0xff))
      buffer[offset + 5] = u8((value >> 40) & u64(0xff))
      buffer[offset + 6] = u8((value >> 48) & u64(0xff))
      buffer[offset + 7] = u8((value >> 56) & u64(0xff))
    }
    
    return buffer
  }
  
  /**
   * Set all registers from Uint8Array
   * 
   * Uses SimpleRAM PVM if available (for runBlob), otherwise uses default PVM
   * 
   * @param registers - 104 bytes (13 registers x 8 bytes each, little-endian)
   */
  setRegisters(registers: Array<u8>): void {
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
  getRegister(index: u8): u64 {
    return this.pvm.state.registerState[index]
  }
  
  /**
   * Set register value
   */
  setRegister(index: u8, value: u64): void {
    this.pvm.state.registerState[index] = value
  }
  

  getPageDump(index: u32): Uint8Array {
    // All RAM implementations now have getPageDump method
    return this.pvm.state.ram.getPageDump(index)
  }

  /**
   * Get result blob from execution
   * 
   * Gray Paper equation 831: When HALT, read result from memory at registers[7] with length registers[8]
   * This is used to extract the yield hash for accumulation (32 bytes) or other result data.
   * 
   * @returns Result blob from memory, or empty array if result is not readable
   */
  getResult(): Uint8Array {
    // Result extraction is meaningful for HALT and OK statuses (successful completion)
    // For PANIC, FAULT, HOST, OOG - result is not valid
    if (this.lastStatus !== Status.HALT && this.lastStatus !== Status.OK) {
      return new Uint8Array(0)
    }

    // Get result range from registers
    const startOffset = this.pvm.state.registerState[7]
    const length = this.pvm.state.registerState[8]

    // Empty result
    if (length === u64(0)) {
      return new Uint8Array(0)
    }

    // Validate length is reasonable (avoid overflow)
    if (length > u64(0xffffffff)) {
      return new Uint8Array(0)
    }

    // Read result from memory using RAM's readOctets
    const readResult = this.pvm.state.ram.readOctets(u32(startOffset), u32(length))
    
    // If fault or no data, return empty array
    if (readResult.faultAddress !== 0 || readResult.data === null) {
      return new Uint8Array(0)
    }

    // Safe to return data (AssemblyScript requires explicit non-null handling)
    return readResult.data!
  }
  
  /**
   * Write data to memory at address
   * 
   * Uses SimpleRAM if available (for runBlob), otherwise uses default PVM RAM
   * 
   * @param address - Starting address
   * @param data - Data to write
   */
  setMemory(address: u32, data: Uint8Array): void {
      this.pvm.state.ram.writeOctetsDuringInitialization(address, data)
  }
  
  
  /**
   * Initialize a memory page (like TypeScript ram.initializePage)
   * 
   * Sets up page access rights and grows memory arrays for the specified address range.
   * This matches the TypeScript test helper where ram.initializePage() is called first.
   * 
   * Uses SimpleRAM if available (for runBlob), otherwise uses default PVM RAM
   * 
   * @param address - Starting address
   * @param length - Page length (must be page-aligned)
   * @param accessType - Access type (0=NONE, 1=READ, 2=WRITE)
   */
  initPage(address: u32, length: u32, accessType: MemoryAccessType): void {
    // Call initPage on the current RAM instance
    // Works with PVMRAM, SimpleRAM, or MockRAM
    // MockRAM's initPage is a no-op, so this should never throw
    this.pvm.state.ram.initPage(address, length, accessType)
  }
  
  // ===== Helper Methods =====
  
  /**
   * Decode registers from Uint8Array (little-endian)
   * 
   * @param registers - 104 bytes (13 registers x 8 bytes each)
   * @returns RegisterState
   */
  /**
   * Decode registers from Array<u8>
   */
  decodeRegisters(registers: Array<u8>): StaticArray<u64> {
    if (registers.length !== 13 * 8) {
      return new StaticArray<u64>(13)
    }
    const registerValues = new StaticArray<u64>(13)
    
    for (let i: i32 = 0; i < 13; i++) {
      const offset = i * 8
      // Read little-endian u64
      let value: u64 = u64(0)
      value |= u64(registers[offset])
      value |= u64(registers[offset + 1]) << 8
      value |= u64(registers[offset + 2]) << 16
      value |= u64(registers[offset + 3]) << 24
      value |= u64(registers[offset + 4]) << 32
      value |= u64(registers[offset + 5]) << 40
      value |= u64(registers[offset + 6]) << 48
      value |= u64(registers[offset + 7]) << 56
      registerValues[i] = value
    }
    
    return registerValues
  }

  /**
   * Decode registers from Uint8Array
   */
  decodeRegistersFromUint8Array(registers: Uint8Array): StaticArray<u64> {
    if (registers.length !== 13 * 8) {
      return new StaticArray<u64>(13)
    }
    const registerValues = new StaticArray<u64>(13)
    
    for (let i: i32 = 0; i < 13; i++) {
      const offset = i * 8
      // Read little-endian u64
      let value: u64 = u64(0)
      value |= u64(registers[offset])
      value |= u64(registers[offset + 1]) << 8
      value |= u64(registers[offset + 2]) << 16
      value |= u64(registers[offset + 3]) << 24
      value |= u64(registers[offset + 4]) << 32
      value |= u64(registers[offset + 5]) << 40
      value |= u64(registers[offset + 6]) << 48
      value |= u64(registers[offset + 7]) << 56
      registerValues[i] = value
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
  restoreMemoryFromChunks(
    pageMap: Uint8Array,
    chunks: Uint8Array
  ): void {
    const pageSize: i32 = 4096
    const entrySize: i32 = 6 // 2 bytes (u16) + 4 bytes (u32)
    let chunkOffset: i32 = 0
    
    for (let mapOffset: i32 = 0; mapOffset < pageMap.length; mapOffset += entrySize) {
      // Read page index (2 bytes, little-endian)
      const pageIndex: u16 = u16(
        pageMap[mapOffset] | (pageMap[mapOffset + 1] << 8)
      )
      
      // Skip chunk offset field (4 bytes) - we read sequentially
      // (In actual WASM implementation, this would be used for random access)
      
      // Read page data from chunks
      if (chunkOffset + pageSize > chunks.length) {
        this.lastStatus = Status.PANIC
        return
      }
      const pageData = chunks.slice(chunkOffset, chunkOffset + pageSize)
      chunkOffset += pageSize
      
      // Calculate page address
      const startAddress = pageIndex * pageSize
      
      // IMPORTANT: Initialize page first before writing
      // This ensures the memory arrays are grown and access rights are set
      // Use WRITE access type (which includes READ) for pages being restored
      this.pvm.state.ram.setPageAccessRights(
          startAddress,
          pageSize,
          MemoryAccessType.WRITE,
        )
        this.pvm.state.ram.initPage(
          startAddress,
          pageSize,
          MemoryAccessType.WRITE,
        )
        
        // Write to memory using writeOctetsDuringInitialization
        // This bypasses write checks during initialization
        this.pvm.state.ram.writeOctetsDuringInitialization(startAddress, pageData)
      }
    }
  }

/**
 * Factory function to create PVM wrapper instance
 * 
 * @returns WASM-compatible PVM shell instance
 */
export function createPvmShell(): WasmPvmShellInterface {
  return new PVMWasmWrapper()
}

