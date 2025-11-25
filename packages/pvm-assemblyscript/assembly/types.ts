/**
 * PVM Type Definitions (AssemblyScript)
 *
 * Core types used throughout the PVM implementation
 */

// Register indices (r0-r12) - use u8 directly

// Register state - array of 13 64-bit registers
export type RegisterState = StaticArray<u64> // [13]

/**
 * Instruction execution result
 * - resultCode: null = continue execution, otherwise halt with code
 */
export class InstructionResult {
  // Use i32 where -1 = continue, >= 0 = result code (0=HALT, 1=PANIC, etc.)
  // This allows us to distinguish between "continue" and "halt with code 0"
  resultCode: i32 = -1 // -1 = continue, >= 0 = halt/panic/etc
  faultAddress: u32 = 0 // Fault address (only valid if hasFaultAddress is true)
  hasFaultAddress: bool = false // Whether faultAddress is valid
  
  constructor(resultCode: i32 = -1, faultAddress: u32 = 0) {
    this.resultCode = resultCode
    this.faultAddress = faultAddress
    this.hasFaultAddress = faultAddress !== 0
  }
  
  // Helper to check if execution should continue
  shouldContinue(): bool {
    return this.resultCode === -1
  }
  
  // Get the actual result code (returns -1 if continuing, otherwise the code)
  getCode(): i32 {
    return this.resultCode
  }
}

/**
 * Instruction execution context
 * Contains all state needed to execute an instruction
 */
/**
 * Read result for RAM operations
 */
export class ReadResult {
  data: Uint8Array | null
  faultAddress: u32 // 0 means no fault, otherwise the fault address

  constructor(data: Uint8Array | null, faultAddress: u32) {
    this.data = data
    this.faultAddress = faultAddress
  }
}

/**
 * Fault check result for RAM operations
 */
export class FaultCheckResult {
  success: bool
  faultAddress: u32 // 0 means no fault, otherwise the fault address

  constructor(success: bool, faultAddress: u32) {
    this.success = success
    this.faultAddress = faultAddress
  }
}

/**
 * Write result for RAM operations
 */
export class WriteResult {
  hasFault: bool
  faultAddress: u32 // Only valid if hasFault is true

  constructor(hasFault: bool, faultAddress: u32) {
    this.hasFault = hasFault
    this.faultAddress = faultAddress
  }
}

// RAM interface for memory operations
export interface RAM {
  readOctets(address: u32, count: u32): ReadResult
  writeOctets(address: u32, values: Uint8Array): WriteResult
  currentHeapPointer: u32
  allocatePages(startPage: u32, count: u32): void
  isReadableWithFault(address: u32, size: u32): FaultCheckResult
  initializeMemoryLayout(argumentData: Uint8Array, readOnlyData: Uint8Array, readWriteData: Uint8Array, stackSize: u32, heapZeroPaddingSize: u32): void
  isWritableWithFault(address: u32, size: u32): FaultCheckResult
  // Methods for memory initialization (used by WASM wrapper)
  setPageAccessRights(address: u32, length: u32, accessType: MemoryAccessType): void
  initPage(address: u32, length: u32, accessType: MemoryAccessType): void
  writeOctetsDuringInitialization(address: u32, values: Uint8Array): void
  // Get page dump for a specific page index (4KB)
  getPageDump(pageIndex: u32): Uint8Array
  // Reset RAM to initial state
  reset(): void
}

/**
 * Execution result for marshalling invocations
 * Replaces union type `Uint8Array | string` for AssemblyScript compatibility
 */
export class ExecutionResult {
  /** Result type: 0 = data (Uint8Array), 1 = PANIC, 2 = OOG */
  resultType: u8
  /** Result data (only valid if resultType === 0) */
  data: Uint8Array

  constructor(resultType: u8, data: Uint8Array) {
    this.resultType = resultType
    this.data = data
  }

  static fromData(data: Uint8Array): ExecutionResult {
    return new ExecutionResult(0, data)
  }

  static fromPanic(): ExecutionResult {
    return new ExecutionResult(1, new Uint8Array(0))
  }

  static fromOOG(): ExecutionResult {
    return new ExecutionResult(2, new Uint8Array(0))
  }

  isPanic(): bool {
    return this.resultType === 1
  }

  isOOG(): bool {
    return this.resultType === 2
  }

  isData(): bool {
    return this.resultType === 0
  }
}


export class RunProgramResult {
  gasConsumed: u32
  result: ExecutionResult

  constructor(gasConsumed: u32, result: ExecutionResult) {
    this.gasConsumed = gasConsumed
    this.result = result
  }
}

export class InstructionContext {
  code: Uint8Array // Program code
  bitmask: Uint8Array // Instruction bitmask
  registers: RegisterState // Register state
  programCounter: u32 // Current program counter
  gasRemaining: u32 // Remaining gas
  operands: Uint8Array // Pre-parsed instruction operands
  fskip: i32 // Skip distance to next instruction (pre-calculated)
  jumpTable: u32[] // Jump table for dynamic jumps
  ram: RAM // RAM interface for memory operations
  
  constructor(
    code: Uint8Array,
    bitmask: Uint8Array,
    registers: RegisterState,
    programCounter: u32,
    gasRemaining: u32,
    operands: Uint8Array,
    fskip: i32,
    jumpTable: u32[],
    ram: RAM
  ) {
    this.code = code
    this.bitmask = bitmask
    this.registers = registers
    this.programCounter = programCounter
    this.gasRemaining = gasRemaining
    this.operands = operands
    this.fskip = fskip
    this.jumpTable = jumpTable
    this.ram = ram
  }
}

/**
 * Helper: Convert bytes to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    const hex = bytes[i].toString(16)
    result += (bytes[i] < 16 ? '0' : '') + hex
  }
  return result
}

// Memory access types (using enum instead of string union for AS compatibility)
export enum MemoryAccessType {
  NONE = 0,
  READ = 1,
  WRITE = 2,
}


/**
 * VmOutput structure for runProgram result
 */
export class VmOutput {
  status: i32 // Status code (0=OK, 1=HALT, 2=PANIC, 3=FAULT, 4=HOST, 5=OOG)
  registers: u64[] // Final register state (13 registers)
  pc: u32 // Final program counter
  memory: InitialChunk[] // Final memory state (chunks)
  gas: i64 // Final gas (can be negative if OOG)
  exitCode: u32 // Exit code (fault address for FAULT status)

  constructor(
    status: i32,
    registers: u64[],
    pc: u32,
    memory: InitialChunk[],
    gas: i64,
    exitCode: u32,
  ) {
    this.status = status
    this.registers = registers
    this.pc = pc
    this.memory = memory
    this.gas = gas
    this.exitCode = exitCode
  }
}