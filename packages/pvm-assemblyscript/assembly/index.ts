// =============================================================================
// Internal module exports (for use within AssemblyScript, not exported to WASM)
// =============================================================================

// Core utilities
export * from './alignment-helpers'
export * from './codec'
export * from './config'
export * from './pbnj-types-compat'

// Host functions
export * from './host-functions'

// Instructions
export * from './instructions'

// Invocations
export * from './parser'

// Core PVM implementation
export * from './pvm'
export * from './ram'
export * from './types'

// WASM wrapper (internal use)
export * from './wasm-wrapper'

export * from './test-exports'

// =============================================================================
// WASM API - Top-level exported functions for WASM usage
// Only these functions are exported to WASM, not the internal classes
// =============================================================================

import { PVMWasmWrapper, Status } from './wasm-wrapper'
import { SimpleRAM } from './simple-ram'
import { MockRAM } from './mock-ram'
import { RAM , RunProgramResult, MemoryAccessType, ExecutionResult } from './types'
import { AccumulateInvocationResult } from './pvm'

// Global PVM instance (singleton for WASM usage)
let pvmInstance: PVMWasmWrapper | null = null

/**
 * RAM type enumeration for init() function
 */
export enum RAMType {
  PVMRAM = 0,    // Default: Full PVM RAM with regions (Gray Paper compliant)
  SimpleRAM = 1, // Simple flat memory for test vectors and runBlob
  MockRAM = 2,   // No-op mock RAM for testing (does nothing)
}

/**
 * Initialize PVM (create global instance)
 * Must be called before any other PVM operations
 * Safe to call multiple times - will reset the instance if it already exists
 * 
 * @param ramType - Type of RAM to use (default: PVMRAM)
 */
export function init(ramType: i32): void {
  // Reset instance if it already exists (allows re-initialization between tests)
  let ram: RAM | null = null
  
  if (ramType === RAMType.SimpleRAM) {
    ram = new SimpleRAM()
  } else if (ramType === RAMType.MockRAM) {
    ram = new MockRAM()
  }
  // If ramType === RAMType.PVMRAM (0), ram stays null and PVMWasmWrapper will use PVMRAM
  
  pvmInstance = new PVMWasmWrapper(ram)
  // Explicitly reset PVM state to ensure clean state
  pvmInstance!.pvm.reset()
}

/**
 * Reset PVM state (explicit reset function for test cleanup)
 * Safe to call multiple times
 */
export function reset(): void {
  if (!pvmInstance) return
  // Use non-null assertion since we've checked for null above
  pvmInstance!.pvm.reset()
  pvmInstance!.lastStatus = Status.OK
  pvmInstance!.exitArg = 0
}

/**
 * Reset PVM with program and initial registers
 * 
 * @param program - Program data (host bindings handle conversion)
 * @param registers - Register data (104 bytes, 13x8 bytes little-endian, host bindings handle conversion)
 * @param gas - Initial gas amount
 */
export function resetGeneric(
  program: Uint8Array,
  registers: Uint8Array,
  gas: u32
): void {
  pvmInstance!.resetGeneric(program, registers, gas)
}

/**
 * Reset PVM with full memory state
 * 
 * @param programPtr - Pointer to program data
 * @param programLen - Length of program data
 * @param registersPtr - Pointer to registers (104 bytes)
 * @param pageMapPtr - Pointer to page map data
 * @param pageMapLen - Length of page map
 * @param chunksPtr - Pointer to memory chunks
 * @param chunksLen - Length of chunks
 * @param gas - Initial gas
 */
export function resetGenericWithMemory(
  programPtr: Uint8Array,
  registersPtr: Uint8Array,
  pageMapPtr: Uint8Array,
  chunksPtr: Uint8Array,
  gas: u32
): void {

  // Lift Uint8Arrays from pointers (from __lowerTypedArray)
  pvmInstance!.resetGenericWithMemory(programPtr, registersPtr, pageMapPtr, chunksPtr, gas)
}

/**
 * Execute one instruction step
 * @returns true if execution should continue, false if halted/panicked/OOG
 */
export function nextStep(): bool {
  if (!pvmInstance) return false
  return pvmInstance!.nextStep()
}

/**
 * Execute N instruction steps
 * @param steps - Number of steps to execute
 * @returns true if execution should continue, false if halted/panicked/OOG
 */
export function nSteps(steps: i32): bool {
  if (!pvmInstance) return false
  return pvmInstance!.nSteps(steps)
}



/**
 * Run program from blob
 * @param program - Program blob (Uint8Array, host bindings handle conversion)
 */
export function runBlob(program: Uint8Array): void {
  if (!pvmInstance) return
  pvmInstance!.runBlob(program)
}

/**
 * Prepare program blob for step-by-step execution (decode without executing)
 * @param program - Program blob bytes (deblob format)
 */
export function prepareBlob(program: Uint8Array): void {
  if (!pvmInstance) return
  pvmInstance!.prepareBlob(program)
}

//TODO: we cannot pass in closures, find another way to pass in context
// export function executeMarshallingInvocation(
//   programPtr: Uint8Array,
//   initialPC: u32,
//   gasLimit: u32,
//   encodedArgs: Uint8Array,
// ): void {
//   if (!pvmInstance) return
//   pvmInstance!.executeMarshallingInvocation(programPtr, initialPC, gasLimit, encodedArgs)
// }

export function accumulateInvocation(
  gasLimit: u32,
  program: Uint8Array,
  args: Uint8Array,
  context: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
  entropyAccumulator: Uint8Array,
  encodedWorkItems: Uint8Array,
  configNumCores: i32 = 341,
  configPreimageExpungePeriod: u32 = 19200,
  configEpochDuration: u32 = 600,
  configMaxBlockGas: u64 = u64(3500000000),
  configTicketsPerValidator: u16 = 2,
  configSlotDuration: u16 = 6,
  configRotationPeriod: u16 = 10,
  configNumValidators: u16 = 1023,
): AccumulateInvocationResult {
  if (!pvmInstance) {
    // Return error result if PVM not initialized
    return new AccumulateInvocationResult(
      0,
      ExecutionResult.fromPanic(),
      new Uint8Array(0),
    )
  }
  return pvmInstance!.pvm.accumulateInvocation(
    gasLimit,
    program,
    args,
    context,
    numCores,
    numValidators,
    authQueueSize,
    entropyAccumulator,
    encodedWorkItems,
    configNumCores,
    configPreimageExpungePeriod,
    configEpochDuration,
    configMaxBlockGas,
    configTicketsPerValidator,
    configSlotDuration,
    configRotationPeriod,
    configNumValidators,
  )
}

/**
 * Set up accumulation invocation without executing (for step-by-step execution)
 * @param gasLimit - Gas limit for execution
 * @param program - Program preimage blob
 * @param args - Encoded arguments
 * @param context - Encoded implications pair context
 * @param numCores - Number of cores
 * @param numValidators - Number of validators
 * @param authQueueSize - Auth queue size
 */
export function setupAccumulateInvocation(
  gasLimit: u32,
  program: Uint8Array,
  args: Uint8Array,
  context: Uint8Array,
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
  entropyAccumulator: Uint8Array,
  encodedWorkItems: Uint8Array,
  configNumCores: i32 = 341,
  configPreimageExpungePeriod: u32 = 19200,
  configEpochDuration: u32 = 600,
  configMaxBlockGas: u64 = u64(3500000000),
  configMaxRefineGas: u64 = u64(5000000000),
  configMaxTicketsPerExtrinsic: u16 = 16,
  configTicketsPerValidator: u16 = 2,
  configSlotDuration: u16 = 6,
  configRotationPeriod: u16 = 10,
  configNumValidators: u16 = 1023,
  configNumEcPiecesPerSegment: u32 = 6,
  configContestDuration: u32 = 500,
  configMaxLookupAnchorage: u32 = 14400,
  configEcPieceSize: u32 = 684,
): void {
  if (!pvmInstance) return
  pvmInstance!.pvm.setupAccumulateInvocation(
    gasLimit,
    program,
    args,
    context,
    numCores,
    numValidators,
    authQueueSize,
    entropyAccumulator,
    encodedWorkItems,
    configNumCores,
    configPreimageExpungePeriod,
    configEpochDuration,
    configMaxBlockGas,
    configMaxRefineGas,
    configMaxTicketsPerExtrinsic,
    configTicketsPerValidator,
    configSlotDuration,
    configRotationPeriod,
    configNumValidators,
    configNumEcPiecesPerSegment,
    configContestDuration,
    configMaxLookupAnchorage,
    configEcPieceSize,
  )
}

/**
 * Set accumulate inputs for FETCH host function
 * This is called from the WASM executor to provide accumulate inputs for selectors 14 and 15
 */
export function setAccumulateInputs(inputs: Array<AccumulateInput> | null): void {
  if (!pvmInstance) return
  pvmInstance!.pvm.setAccumulateInputs(inputs)
}

export function runProgram(
): RunProgramResult {
  if (!pvmInstance) {
    return new RunProgramResult(0, ExecutionResult.fromPanic())
  }
  return pvmInstance!.pvm.runProgram()
}

/**
 * Get current program counter
 * @returns Current PC value
 */
export function getProgramCounter(): u32 {
  if (!pvmInstance) return 0
  return pvmInstance!.getProgramCounter()
}


/**
 * Set next program counter
 * @param pc - New PC value
 */
export function setNextProgramCounter(pc: u32): void {
  if (!pvmInstance) return
  pvmInstance!.setNextProgramCounter(pc)
}

/**
 * Get remaining gas
 * @returns Gas left
 */
export function getGasLeft(): u32 {
  if (!pvmInstance) return 0
  return pvmInstance!.getGasLeft()
}

/**
 * Set remaining gas
 * @param gas - New gas value
 */
export function setGasLeft(gas: i64): void {
  if (!pvmInstance) return
  pvmInstance!.setGasLeft(u32(gas))
}

/**
 * Get current execution status
 * @returns Status code (0=OK, 1=HALT, 2=PANIC, 3=FAULT, 4=HOST, 5=OOG)
 */
export function getStatus(): Status {
  if (!pvmInstance) return Status.PANIC
  return pvmInstance!.getStatus()
}

/**
 * Get exit argument (value in r7 when halted)
 * @returns Exit code from r7
 */
export function getExitArg(): u32 {
  if (!pvmInstance) return 0
  return pvmInstance!.getExitArg()
}

/**
 * Get result code from last execution
 * @returns Result code (0=OK, 1=HALT, 2=PANIC, 3=FAULT, 4=HOST, 5=OOG)
 */
export function getResultCode(): u32 {
  if (!pvmInstance) return 2 // PANIC
  return pvmInstance!.pvm.state.resultCode
}

/**
 * Get code array (for debugging/comparison)
 * @returns Copy of the code array
 */
export function getCode(): Uint8Array {
  if (!pvmInstance) return new Uint8Array(0)
  return pvmInstance!.getCode()
}

/**
 * Get bitmask array (for debugging/comparison)
 * @returns Copy of the bitmask array
 */
export function getBitmask(): Uint8Array {
  if (!pvmInstance) return new Uint8Array(0)
  return pvmInstance!.getBitmask()
}

/**
 * Get all registers as bytes (104 bytes = 13 registers x 8 bytes each, little-endian)
 * @returns Uint8Array - loader automatically handles TypedArray returns
 */
export function getRegisters(): Uint8Array {
  if (!pvmInstance) return new Uint8Array(0)
  return pvmInstance!.getRegisters()
}

/**
 * Set all registers from Array<u8>
 * @param registers - Array<u8> (104 bytes) - loader automatically converts Uint8Array
 */
export function setRegisters(registers: Array<u8>): void {
  if (!pvmInstance) return
  pvmInstance!.setRegisters(registers)
}

/**
 * Get single register value
 * @param index - Register index (0-12)
 * @returns Register value
 */
export function getRegister(index: u8): u64 {
  if (!pvmInstance || index < 0 || index >= 13) return 0
  return pvmInstance!.getRegister(index)
}

/**
 * Set single register value
 * @param index - Register index (0-12)
 * @param value - New register value
 */
export function setRegister(index: u8, value: u64): void {
  if (!pvmInstance || index < 0 || index >= 13) return
  pvmInstance!.setRegister(index, value)
}

/**
 * Get memory page dump (4KB)
 * @param pageIndex - Page index (page address = index * 4096)
 * @returns Pointer to 4096 bytes of page data in WASM memory (header pointer from __lowerTypedArray)
 */
export function getPageDump(pageIndex: i32): i32 {
  if (!pvmInstance) return 0
  const page = pvmInstance!.getPageDump(pageIndex)
  // Allocate new Uint8Array in WASM memory and copy data
  // This ensures the data is in WASM linear memory and can be read by the test helper
  const pageCopy = new Uint8Array(page.length)
  pageCopy.set(page)
  // Return header pointer (similar to getRegisters)
  return changetype<i32>(pageCopy)
}

/**
 * Write data to memory at address
 * @param address - Starting address
 * @param data - Data to write (Array<u8>) - loader automatically converts Uint8Array
 */
export function setMemory(address: u32, data: Uint8Array): void {
  if (!pvmInstance) return
  pvmInstance!.setMemory(address, data)
}

/**
 * Get the current accumulation context (ImplicationsPair) after execution
 * 
 * This function encodes the current ImplicationsPair from the PVM's accumulationContext
 * and returns it as bytes, which can be decoded by the TypeScript side.
 * 
 * @param numCores - Number of cores for encoding
 * @param numValidators - Number of validators for encoding
 * @param authQueueSize - Auth queue size for encoding
 * @returns Encoded ImplicationsPair bytes, or empty array if no context
 */
export function getAccumulationContext(
  numCores: i32,
  numValidators: i32,
  authQueueSize: i32,
): Uint8Array {
  if (!pvmInstance) return new Uint8Array(0)
  const context = pvmInstance!.pvm.accumulationContext
  if (context === null) return new Uint8Array(0)
  
  // Encode the ImplicationsPair using the codec
  const encoded = encodeImplicationsPair(context, numCores, numValidators, authQueueSize)
  return encoded
}

/**
 * Check if accumulation context is set
 * @returns true if accumulationContext is not null
 */
export function hasAccumulationContext(): bool {
  if (!pvmInstance) return false
  return pvmInstance!.pvm.accumulationContext !== null
}

/**
 * Initialize a memory page (like TypeScript ram.initializePage)
 * Sets up page access rights and grows memory arrays.
 * @param address - Starting address
 * @param length - Page length (must be page-aligned)
 * @param accessType - Access type (0=NONE, 1=READ, 2=WRITE)
 */
export function initPage(address: u32, length: u32, accessType: MemoryAccessType): void {
  if (!pvmInstance) return
  pvmInstance!.initPage(address, length, accessType)
}


/**
 * Prepare a program for execution
 * Sets up internal PVM state with decoded program, memory, and registers
 * 
 * @param program - Program blob bytes
 * @param initialRegisters - Initial register state (13 registers as u64[])
 * @param initialPageMap - Initial page map (memory pages to initialize)
 * @param initialMemory - Initial memory chunks (data to write)
 * @param args - Argument data (for SPI programs)
 */
export function initializeProgram(
  program: Uint8Array,
  args: Uint8Array,
): void {
  if (!pvmInstance) {
    // Initialize with PVMRAM if not already initialized
    init(RAMType.PVMRAM)
  }
  // All parameters are already Uint8Array, use directly
  pvmInstance!.pvm.initializeProgram(program, args)
}

