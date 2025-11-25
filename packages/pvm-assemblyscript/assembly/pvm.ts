/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { alignToZone } from './alignment-helpers'
import {
  decodeBlob,
  decodeProgramFromPreimage,
  decodeImplicationsPair,
  decodeServiceCodeFromPreimage,
  decodeAccumulateArgs,
  encodeImplicationsPair,
} from './codec'
import { ImplicationsPair } from './codec'
import {
  ARGS_SEGMENT_START,
  DEFAULT_GAS_LIMIT,
  HALT_ADDRESS,
  INIT_INPUT_SIZE,
  PAGE_SIZE,
  RESULT_CODE_HALT,
  RESULT_CODE_HOST,
  RESULT_CODE_OOG,
  RESULT_CODE_PANIC,
  STACK_SEGMENT_END,
  ZONE_SIZE,
} from './config'
import { AccumulateHostFunctionRegistry } from './host-functions/accumulate/registry'
import { AccumulateHostFunctionContext } from './host-functions/accumulate/base'
import { HostFunctionRegistry } from './host-functions/general/registry'
import { InstructionRegistry } from './instructions/registry'
import { PVMParser } from './parser'
import { InstructionContext, RegisterState, RAM, ExecutionResult, RunProgramResult } from './types'

/**
 * PVM Instruction structure
 */
export class PVMInstruction {
  opcode: i32
  operands: Uint8Array
  fskip: i32
  pc: u32

  constructor(opcode: i32, operands: Uint8Array, fskip: i32, pc: u32) {
    this.opcode = opcode
    this.operands = operands
    this.fskip = fskip
    this.pc = pc
  }
}

/**
 * PVM State Structure
 */
export class PVMState {
  resultCode: u8 = RESULT_CODE_HALT
  programCounter: u32 = 0
  registerState: RegisterState
  ram: RAM // Initialized in constructor - no field initializer to avoid wasteful object creation
  gasCounter: u32 = u32(DEFAULT_GAS_LIMIT)
  jumpTable: u32[] = []
  code: Uint8Array = new Uint8Array(0)
  bitmask: Uint8Array = new Uint8Array(0)
  faultAddress: u32 = 0 // Fault address (0 means no fault)
  hasFaultAddress: bool = false // Whether faultAddress is valid
  hostCallId: u32 = 0 // 0 means no host call

  constructor(
    registerState: RegisterState,
    ram: RAM,
    programCounter: u32,
    gasCounter: u32,
  ) {
    // Enforce non-null invariants - all parameters must be provided
    // Initialize dynamic objects in constructor to avoid wasteful field initializers
    this.registerState = registerState
    this.ram = ram
    this.programCounter = programCounter
    this.gasCounter = gasCounter
  }
}

/**
 * Marshalling invocation result
 */
export class MarshallingInvocationResult {
  gasConsumed: u32
  result: ExecutionResult
  context: any

  constructor(gasConsumed: u32, result: ExecutionResult, context: any) {
    this.gasConsumed = gasConsumed
    this.result = result
    this.context = context
  }
}

/**
 * Accumulation invocation result
 */
export class AccumulateInvocationResult {
  gasConsumed: u32
  result: ExecutionResult
  encodedContext: Uint8Array

  constructor(gasConsumed: u32, result: ExecutionResult, encodedContext: Uint8Array) {
    this.gasConsumed = gasConsumed
    this.result = result
    this.encodedContext = encodedContext
  }
}

/**
 * PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class PVM {
  public state: PVMState
  registry: InstructionRegistry
  hostFunctionRegistry: HostFunctionRegistry
  accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  accumulationContext: ImplicationsPair | null = null
  timeslot: u64 = u64(0) // Current timeslot for accumulation

  constructor(
    registerState: RegisterState,
    ram: RAM,
    programCounter: u32,
    gasCounter: u32,
    hostFunctionRegistry: HostFunctionRegistry,
  ) {
    // Initialize instruction registry (singleton)
    this.registry = new InstructionRegistry()

    // Initialize host function registry (optional)
    this.hostFunctionRegistry = hostFunctionRegistry

    // Initialize accumulation host function registry
    this.accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry()

    // Initialize state
    this.state = new PVMState(registerState, ram, programCounter, gasCounter)
  }


  /**
   * Invoke PVM execution with specific parameters
   * This is used by the INVOKE host function to execute a PVM machine
   * with custom gas limit and register state
   */
  public invoke(
    gasLimit: u32,
    registers: RegisterState,
    code: Uint8Array,
    bitmask: Uint8Array,
    jumpTable: u32[],
  ): void {
    this.reset()
    // Set invocation parameters
    this.state.gasCounter = gasLimit
    this.state.registerState = registers
    this.state.code = code
    this.state.bitmask = bitmask
    this.state.jumpTable = jumpTable

    // Execute until termination
    this.run()
  }

  /**
   * Y - Standard initialization function
   * Gray Paper equation 753-760: Y(blob, blob) → (blob, registers, ram)?
   *
   * Decodes program blob and argument data to yield program code, registers, and RAM.
   * Returns null if the conditions cannot be satisfied with unique values.
   *
   * @param programBlob - Program blob containing code, output, writable, and init data
   * @param argumentData - Argument data blob (max Cpvminitinputsize)
   * @returns Code blob or null if invalid
   */
  public initializeProgram(
    programBlob: Uint8Array,
    argumentData: Uint8Array,
  ): Uint8Array | null {
    // Extract codeBlob from preimage first (needed for both Y function and deblob decoding)
    const preimageResult = decodeServiceCodeFromPreimage(programBlob)
    if (!preimageResult) {
      abort(
        `initializeProgram: Failed to decode service code from preimage: programBlob length=${programBlob.length}`
      )
      unreachable()
    }
    const codeBlob = preimageResult!.value.codeBlob

    // Try to decode as standard program format first (Gray Paper Y function)
    const result = decodeProgramFromPreimage(programBlob)
    if (!result) {
      abort(
        `initializeProgram: Failed to decode program from preimage: programBlob length=${programBlob.length}, codeBlob length=${codeBlob.length}`
      )
      unreachable()
    }

    const code = result!.code
    const roData = result!.roData
    const rwData = result!.rwData
    const stackSize = result!.stackSize
    const heapZeroPaddingSize = result!.heapZeroPaddingSize

    // Gray Paper equation 767: Validate condition
    // 5*Cpvminitzonesize + rnq(len(o)) + rnq(len(w) + z*Cpvmpagesize) + rnq(s) + Cpvminitinputsize <= 2^32

    const alignedReadOnlyDataLength = alignToZone(i32(roData.length))
    const alignedHeapLength = alignToZone(
      i32(rwData.length + heapZeroPaddingSize * PAGE_SIZE),
    )
    const alignedStackSize = alignToZone(i32(stackSize))

    const total: u32 =
      u32(5 * ZONE_SIZE +
      alignedReadOnlyDataLength +
      alignedHeapLength +
      alignedStackSize +
      INIT_INPUT_SIZE)

    // Gray Paper equation 767: total must be <= 2^32
    // Use u32.MAX_VALUE (2^32 - 1) for comparison since 2^32 cannot be represented as u32
    // If total > u32.MAX_VALUE, then total >= 2^32, which violates the condition
    const MAX_U32: u32 = 0xFFFFFFFF // 2^32 - 1 = 4294967295
    if (total > MAX_U32) {
      abort(
        `initializeProgram: Gray Paper equation 767 condition violated: total=${total} > 2^32 (${MAX_U32 + 1}), roDataLength=${roData.length}, rwDataLength=${rwData.length}, heapZeroPaddingSize=${heapZeroPaddingSize}, stackSize=${stackSize}, alignedReadOnlyDataLength=${alignedReadOnlyDataLength}, alignedHeapLength=${alignedHeapLength}, alignedStackSize=${alignedStackSize}`
      )
      unreachable()
    }

    // Initialize registers according to Gray Paper equation 803-811
    this.initializeRegisters(u32(argumentData.length))

    // Set up memory sections according to Gray Paper memory layout
    this.initializeMemoryLayout(
      argumentData,
      roData,
      rwData,
      stackSize,
      heapZeroPaddingSize,
    )

    // The code field from decodeProgramFromPreimage is the instruction data blob in deblob format
    // Decode it as deblob format to get bitmask and jump table
    const decodedBlob = decodeBlob(code)
    if (!decodedBlob) {
      abort(
        `initializeProgram: Failed to decode code as deblob format: code length=${code.length}, codeBlob length=${codeBlob.length}`
      )
      unreachable()
    }
    // Set decoded program state so run() can use it
    this.state.code = decodedBlob!.code
    this.state.bitmask = decodedBlob!.bitmask
    this.state.jumpTable = decodedBlob!.jumpTable

    return code
  }

  /**
   * Initialize PVM registers according to Gray Paper equation 803-811
   * Reference: https://graypaper.fluffylabs.dev/#/579bd12/2c7c012cb101
   *
   * All registers are initialized to 0 in constructor, then specific ones are set here:
   * - r0: HALT address (2^32 - 2^16)
   * - r1: Stack segment end address (2^32 - 2*Cpvminitzonesize - Cpvminitinputsize)
   * - r7: Arguments segment start address (2^32 - Cpvminitzonesize - Cpvminitinputsize)
   * - r8: Argument data length
   * - r2-r6, r9-r12: Remain 0
   *
   * @param argumentDataLength - Length of argument data (a) in bytes
   */
  initializeRegisters(argumentDataLength: u32): void {
    // r0: HALT address - jumping to this address causes the PVM to halt gracefully
    // Gray Paper equation 803: registers[0] = 2^32 - 2^16
    // This is equivalent to the HALT_ADDRESS constant (0xffff0000)
    this.state.registerState[0] = u64(HALT_ADDRESS)

    // r1: Stack segment end address (exclusive)
    // Gray Paper equation 803: registers[1] = 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
    // This is equivalent to the STACK_SEGMENT_END constant (0xfefe0000)
    // Represents the end address of the stack region (exclusive boundary)
    this.state.registerState[1] = u64(STACK_SEGMENT_END)

    // r7: Arguments segment start address
    // Gray Paper equation 803: registers[7] = 2^32 - Cpvminitzonesize - Cpvminitinputsize
    // This is equivalent to the ARGS_SEGMENT_START constant (0xfeff0000)
    // Represents the start address of the arguments/output region
    this.state.registerState[7] = u64(ARGS_SEGMENT_START)

    // r8: Argument data length
    // Gray Paper equation 803: registers[8] = len(argumentData)
    // Stores the length of the argument data in bytes
    this.state.registerState[8] = u64(argumentDataLength)

    // Registers r2-r6 and r9-r12 remain 0 (already initialized in constructor)
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
    readWriteData: Uint8Array,
    stackSize: u32,
    heapZeroPaddingSize: u32,
  ): void {
    // This sets up address boundaries, allocates contiguous arrays, and sets data
    this.state.ram.initializeMemoryLayout(
      argumentData,
      readOnlyData,
      readWriteData,
      stackSize,
      heapZeroPaddingSize,
    )
  }

  runProgram(): RunProgramResult {
    const initialGas = this.state.gasCounter
    this.run(null)

    // After execution, extract final state
    const finalGasCounter = this.state.gasCounter
    const finalResultCode = this.state.resultCode
    const finalRegisters = this.state.registerState
    const finalMemory = this.state.ram

    // Gray Paper equation 834: Calculate gas consumed
    // u = gascounter - max(gascounter', 0)
    const gasConsumed = initialGas - (finalGasCounter > 0 ? finalGasCounter : 0)

    const result = this.extractResultFromExecution(
      finalResultCode,
      finalRegisters,
      finalMemory,
    )

    return new RunProgramResult(gasConsumed, result)
  }

  /**
   * R function - Extract result from execution based on termination condition
   *
   * Gray Paper equation 829-835 (pvm.tex):
   * R(gascounter, Ψ_H(.)) → (gas, result, context)
   *
   * Where result is determined by:
   * - Gray Paper equation 829: If ε = oog: return (u, oog, x')
   * - Gray Paper equation 831: If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}:
   *   return (u, mem'[registers'[7].registers'[7]+registers'[8]], x')
   * - Gray Paper equation 832: If ε = halt AND range not readable: return (u, [], x')
   * - Gray Paper equation 833: Otherwise: return (u, panic, x')
   *
   * Where:
   * - ε = resultCode (termination condition: halt, panic, or oog)
   * - u = gas consumed (calculated in executeMarshallingInvocation)
   * - registers'[7] = start offset of result range (arguments segment start)
   * - registers'[8] = length of result range (argument data length)
   * - mem' = final memory state after execution
   * - Nrange{a}{b} = range from address a to a+b (inclusive start, exclusive end)
   * - readable{mem'} = set of readable memory addresses
   *
   * @param resultCode - Termination condition (HALT, PANIC, or OOG)
   * @param finalRegisters - Final register state after execution
   * @param finalMemory - Final memory state after execution
   * @returns Result blob, 'PANIC', or 'OOG'
   */
  extractResultFromExecution(
    resultCode: u8,
    finalRegisters: RegisterState,
    finalMemory: RAM,
  ): ExecutionResult {
    // Gray Paper equation 829: If ε = oog: return (u, oog, x')
    if (resultCode === RESULT_CODE_OOG) {
      return ExecutionResult.fromOOG()
    }

    // Gray Paper equation 830-832: Handle HALT case
    if (resultCode === RESULT_CODE_HALT) {
      // Extract result range from registers
      // registers'[7] = arguments segment start address
      // registers'[8] = argument data length
      const startOffset = finalRegisters[7]
      const length = finalRegisters[8]

      // Empty range is trivially readable - return empty blob
      if (length === u64(0)) {
        return ExecutionResult.fromData(new Uint8Array(0))
      }

      // Gray Paper equation 831-832: Check if Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}
      // Nrange{registers'[7]}{registers'[8]} means range from startOffset to startOffset+length

      // Gray Paper equation 831: If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}
      // return (u, mem'[registers'[7].registers'[7]+registers'[8]], x')
      const readResult = finalMemory.readOctets(u32(startOffset), u32(length))

      // If readOctets returns a fault, this is an inconsistency (range was readable but read failed)
      // Gray Paper equation 832: If ε = halt AND range not readable: return (u, [], x')
      if (readResult.faultAddress !== 0) {
        return ExecutionResult.fromData(new Uint8Array(0))
      }

      // If memoryResult is null, also treat as error (should not happen if range is readable)
      if (readResult.data === null) {
        return ExecutionResult.fromPanic()
      }

      return ExecutionResult.fromData(readResult.data!)
    }

    // Gray Paper equation 833: Otherwise: return (u, panic, x')
    // This covers PANIC and any other unexpected result codes
    return ExecutionResult.fromPanic()
  }

  /**
   * Execute a single instruction step (Gray Paper Ψ₁)
   * Returns the result code and whether execution should continue
   */
  public step(instruction: PVMInstruction): i32 {
    // Check for halt conditions
    if (this.state.gasCounter === 0) {
      this.state.resultCode = RESULT_CODE_OOG
      return i32(RESULT_CODE_OOG)
    }

    // Consume 1 gas for each instruction
    this.state.gasCounter -= 1

    // Execute instruction (Ψ₁) - gas consumption handled by instruction itself
    const resultCode = this.executeInstruction(instruction)

    // -1 = continue, >= 0 = halt with that result code
    if (resultCode === -1) {
      // Continue execution
      return -1
    }

    // Check if it's a HOST result code
    if (resultCode === i32(RESULT_CODE_HOST)) {
      // Extract host call ID from registers (typically r0 or r1)
      const hostCallId = u64(this.state.registerState[0]) // Host call ID is in r0
      this.state.hostCallId = u32(hostCallId)
      
      if (this.state.gasCounter === 0) {
        this.state.resultCode = RESULT_CODE_OOG
        return i32(RESULT_CODE_OOG)
      }

      // Handle HOST calls according to pvm_invocations.tex
      // If in accumulation context, route to accumulation host functions
      if (this.accumulationContext !== null) {
        return this.handleAccumulationHostCall(hostCallId, instruction)
      }

      // Otherwise, return HOST result code to indicate host call needed (general functions)
      return i32(RESULT_CODE_HOST)
    }

    // Return the result code (halt/panic/oog/etc)
    return resultCode
  }

  /**
   * Handle HOST calls during accumulation invocation
   * 
   * Gray Paper pvm_invocations.tex equation 187-211:
   * Routes host calls to appropriate handlers based on function ID
   * - General functions: gas, fetch, read, write, lookup, info
   * - Accumulation-specific functions: bless, assign, designate, checkpoint, new, upgrade, transfer, eject, query, solicit, forget, yield, provide
   * 
   * @param hostCallId - Host function ID
   * @param instruction - Current instruction (for PC advancement)
   * @returns Result code (-1 = continue, >= 0 = halt)
   */
  private handleAccumulationHostCall(hostCallId: u64, instruction: PVMInstruction): i32 {
    // Check if it's an accumulation-specific function
    const accumulateHandler = this.accumulateHostFunctionRegistry.get(hostCallId)
    
    if (accumulateHandler !== null) {
      // Create accumulation host function context
      const context = new AccumulateHostFunctionContext(
        this.state.gasCounter,
        this.state.registerState,
        this.state.ram,
        this.accumulationContext!,
        this.timeslot,
        u64(19200), // Cexpungeperiod = 19200
      )
      
      // Execute accumulation host function
      const result = accumulateHandler.execute(context)
      
      // Update gas counter from context
      this.state.gasCounter = context.gasCounter
      
      // Update implications from context (mutations are done in-place)
      // The context.implications is the same reference, so mutations are already reflected
      
      // If result code is null, continue execution
      if (result.resultCode === null) {
        // Advance PC by instruction length (host function handled it)
        const instructionLength = u32(1 + instruction.fskip)
        this.state.programCounter += instructionLength
        return -1 // Continue
      }
      
      // Otherwise, halt with the result code
      this.state.resultCode = result.resultCode
      return i32(result.resultCode)
    }
    
    // Check if it's a general function that's available in accumulation context
    // Gray Paper: gas (0), fetch (1), read (3), write (4), lookup (2), info (5)
    const generalHandler = this.hostFunctionRegistry.get(hostCallId)
    if (generalHandler !== null) {
      // For general functions in accumulation context, we still need to handle them
      // but they don't have access to accumulation context
      // For now, return HOST to indicate it needs external handling
      // TODO: Implement general function execution with accumulation context if needed
      return i32(RESULT_CODE_HOST)
    }
    
    // Unknown host function
    this.state.resultCode = RESULT_CODE_PANIC
    return i32(RESULT_CODE_PANIC)
  }

  /**
   * Extract result from memory - placeholder implementation
   */
  extractResultFromMemory(): Uint8Array | null {
    const start = this.state.registerState[7]
    const length = this.state.registerState[8]
    const readResult = this.state.ram.readOctets(u32(start), u32(length))
    if (readResult.faultAddress !== 0) {
      return null
    }
    if (readResult.data === null) {
      return null
    }
    return readResult.data
  }

  /**
   * Skip function Fskip(i) - determines distance to next instruction
   *
   * Gray Paper Equation 7.1:
   * Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1)
   *
   * @param instructionIndex - Index of instruction opcode in instruction data
   * @param opcodeBitmask - Bitmask indicating valid instruction boundaries
   * @returns Number of octets minus 1 to next instruction's opcode
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
   * Execute program until termination (Gray Paper Ψ function)
   *
   * Uses step() function to execute instructions one by one
   * 
   * @param codeBlob - Optional code blob to decode. If provided, decodes and sets state before running.
   */
  public run(codeBlob: Uint8Array | null): void {
    // If program blob provided, decode it first
    if (codeBlob) {
      const decoded = decodeBlob(codeBlob)
      if (!decoded) {
        this.state.resultCode = RESULT_CODE_PANIC
        return
      }
      this.state.code = decoded.code
      this.state.bitmask = decoded.bitmask
      this.state.jumpTable = decoded.jumpTable
    }
    
    // Ensure code and bitmask are set (should be set by runBlob or previous decode)
    // If codeBlob was null, we expect state to already be set
    if (this.state.code.length === 0 || this.state.bitmask.length === 0) {
      this.state.resultCode = RESULT_CODE_PANIC
      return
    }
    
    // Gray Paper pvm.tex equation: ζ ≡ c ⌢ [0, 0, . . . ]
    // Append 16 zeros to ensure no out-of-bounds access and trap behavior
    // This implements the infinite sequence of zeros as specified in the Gray Paper
    const extendedCode = new Uint8Array(this.state.code.length + 16)
    extendedCode.set(this.state.code)
    // Zeros are already initialized by Uint8Array constructor

    // Extend bitmask to cover the padded zeros (all 1s = valid opcode positions)
    // Gray Paper: "appends k with a sequence of set bits in order to ensure a well-defined result"
    const extendedBitmask = new Uint8Array(this.state.bitmask.length + 16)
    extendedBitmask.set(this.state.bitmask)
    extendedBitmask.fill(1, this.state.bitmask.length) // Fill remaining positions with 1s

    this.state.code = extendedCode
    this.state.bitmask = extendedBitmask

    let resultCode: i32 = -1 // -1 means continue
    while (resultCode === -1) {
      const instructionIndex = this.state.programCounter

      // Bounds check: instruction pointer must be within valid code range
      if (instructionIndex < 0 || u32(instructionIndex) >= u32(extendedCode.length)) {
        this.state.resultCode = RESULT_CODE_PANIC
        return
      }

      const opcode = extendedCode[instructionIndex]

      // Calculate Fskip(i) according to Gray Paper specification:
      // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,.})_{i+1+j} = 1)
      const fskip = this.skip(instructionIndex, extendedBitmask)
      const instructionLength = 1 + fskip

      // Extract operands from extended code (with zero padding)
      const operands = extendedCode.slice(
        instructionIndex + 1,
        instructionIndex + instructionLength,
      )

      const instruction = new PVMInstruction(
        opcode,
        operands,
        fskip,
        this.state.programCounter,
      )

      resultCode = this.step(instruction)
    }

    // Convert i32 result code to u8 (resultCode >= 0 means halt with that code)
    this.state.resultCode = resultCode >= 0 ? u8(resultCode) : RESULT_CODE_PANIC
  }

  /**
   * Execute single instruction (Gray Paper Ψ₁)
   * Instructions mutate the context in place
   */
  executeInstruction(instruction: PVMInstruction): i32 {
    const handler = this.registry.getHandler(instruction.opcode)

    if (!handler) {
      return RESULT_CODE_PANIC
    }

    // Save PC before execution
    const pcBefore = this.state.programCounter

    // Create execution context (mutable)
    const context = new InstructionContext(
      this.state.code,
      this.state.bitmask,
      this.state.registerState,
      this.state.programCounter,
      this.state.gasCounter,
      instruction.operands,
      instruction.fskip,
      this.state.jumpTable,
      this.state.ram,
    )

    // Execute instruction (mutates context)
    const result = handler.execute(context)

    // Check result code BEFORE advancing PC
    // -1 = continue, >= 0 = halt with that result code
    if (result.resultCode !== -1) {
      // Instruction returned a terminal result - don't advance PC
      // If there's a fault address, store it in state
      if (result.hasFaultAddress) {
        this.state.faultAddress = result.faultAddress
        this.state.hasFaultAddress = true
      } else {
        this.state.faultAddress = 0
        this.state.hasFaultAddress = false
      }
      return u8(result.resultCode)
    }

    // Check if instruction modified PC (branches/jumps)
    if (context.programCounter !== pcBefore) {
      // Instruction modified PC (branch/jump) - already updated above
      // Return -1 to continue execution (will be converted to null in TS)
      this.state.programCounter = context.programCounter
    } else {
      // Normal flow - advance PC by instruction length (in bytes)
      // Instruction length = 1 (opcode) + Fskip(ι) according to Gray Paper
      const instructionLength = 1 + instruction.fskip
      this.state.programCounter += instructionLength
    }

    // Return -1 to continue execution
    return -1
  }

  /**
   * Reset to initial state
   * Preserves the existing RAM instance but resets its state
   * Resets all properties in-place for better performance
   */
  public reset(): void {
    // Reset result code
    this.state.resultCode = RESULT_CODE_HALT
    
    // Reset program counter
    this.state.programCounter = 0
    
    // Reset all registers to zero (preserve registerState array)
    for (let i = 0; i < 13; i++) {
      this.state.registerState[i] = u64(0)
    }
    
    // Reset RAM state (preserves RAM instance but clears its memory)
    this.state.ram.reset()
    
    // Reset gas counter
    this.state.gasCounter = u32(DEFAULT_GAS_LIMIT)
    
    // Reset jump table (clear array)
    this.state.jumpTable = []
    
    // Reset code and bitmask (clear arrays)
    this.state.code = new Uint8Array(0)
    this.state.bitmask = new Uint8Array(0)
    
    // Reset fault address
    this.state.faultAddress = 0
    this.state.hasFaultAddress = false
    
    // Reset host call ID
    this.state.hostCallId = 0
  }

  /**
   * Get current state
   */
  public getState(): PVMState {
    // Create a new PVMState with copied values
    const newState = new PVMState(
      this.state.registerState,
      this.state.ram,
      this.state.programCounter,
      this.state.gasCounter,
    )
    newState.resultCode = this.state.resultCode
    newState.jumpTable = this.state.jumpTable.slice()
    newState.code = this.state.code.slice()
    newState.bitmask = this.state.bitmask.slice()
    newState.faultAddress = this.state.faultAddress
    newState.hasFaultAddress = this.state.hasFaultAddress
    newState.hostCallId = this.state.hostCallId
    return newState
  }


  public accumulateInvocation(
    gasLimit: u32,
    program: Uint8Array,
    args: Uint8Array,
    context: Uint8Array,
    numCores: i32,
    numValidators: i32,
    authQueueSize: i32,
  ): AccumulateInvocationResult {
    const initialGas = gasLimit
    
    // Set up accumulation invocation (decodes context, initializes program, sets up state, extracts timeslot)
    // setupAccumulateInvocation already decodes args and sets this.timeslot according to Gray Paper
    this.setupAccumulateInvocation(gasLimit, program, args, context, numCores, numValidators, authQueueSize)

    // Gray Paper: Call core Ψ function (Ψ_H) with context mutator
    // The core Ψ function (this.run) handles all PVM execution logic
    // Pass null because setupAccumulateInvocation already set up state.code, state.bitmask, etc.
    this.run(null) // null means use existing state.code (set by setupAccumulateInvocation)
    
    // After execution, extract final state
    const finalGasCounter = this.state.gasCounter
    const finalResultCode = this.state.resultCode
    const finalRegisters = this.state.registerState
    const finalMemory = this.state.ram

    // Gray Paper equation 834: Calculate gas consumed
    // u = gascounter - max(gascounter', 0)
    const gasConsumed = initialGas - (finalGasCounter > 0 ? finalGasCounter : 0)

    // Gray Paper equation 829-835: R function - extract result based on termination
    const result = this.extractResultFromExecution(
      finalResultCode,
      finalRegisters,
      finalMemory,
    )
    
    // Encode final context (ImplicationsPair) - use the updated accumulationContext
    if (!this.accumulationContext) {
      abort(
        `accumulateInvocation: accumulationContext is null after execution`
      )
      unreachable()
    }
    
    const encodedContext = encodeImplicationsPair(
      this.accumulationContext!,
      numCores,
      numValidators,
      authQueueSize,
    )
    
    // Clear accumulation context after execution
    this.accumulationContext = null
    
    return new AccumulateInvocationResult(gasConsumed, result, encodedContext)
  }

  /**
   * Set up accumulation invocation without executing
   * This allows step-by-step execution after setup
   */
  public setupAccumulateInvocation(
    gasLimit: u32,
    program: Uint8Array,
    args: Uint8Array,
    context: Uint8Array,
    numCores: i32,
    numValidators: i32,
    authQueueSize: i32,
  ): void {
    this.state.gasCounter = gasLimit
    this.state.programCounter = 5 // initial PC for accumulate invocation
    
    // Decode accumulation context (ImplicationsPair)
    const contextResult = decodeImplicationsPair(context, numCores, numValidators, authQueueSize)
    if (!contextResult) {
      abort(
        `setupAccumulateInvocation: decodeImplicationsPair failed: context length=${context.length}, numCores=${numCores}, numValidators=${numValidators}, authQueueSize=${authQueueSize}`
      )
      unreachable()
    }
    
    // Store accumulation context for HOST call handling
    this.accumulationContext = contextResult!.value
    
    // Decode arguments to extract timeslot according to Gray Paper
    // Gray Paper: encode(timeslot, serviceid, len(inputs))
    const argsResult = decodeAccumulateArgs(args)
    if (!argsResult) {
      abort(
        `setupAccumulateInvocation: Failed to decode arguments: args length=${args.length}`
      )
      unreachable()
    }
    
    // Extract timeslot from decoded arguments
    // argsResult is guaranteed to be non-null after the check above
    this.timeslot = argsResult!.value.timeslot
    
    // Initialize program (decodes preimage and sets up memory/registers)
    const codeBlob = this.initializeProgram(program, args)
    if (!codeBlob) {
      abort(
        `setupAccumulateInvocation: initializeProgram failed: program length=${program.length}, args length=${args.length}`
      )
      unreachable()
    }
    
    // Verify that state.code and state.bitmask were set by initializeProgram
    if (this.state.code.length === 0 || this.state.bitmask.length === 0) {
      abort(
        `setupAccumulateInvocation: initializeProgram succeeded but state not set: code.length=${this.state.code.length}, bitmask.length=${this.state.bitmask.length}`
      )
      unreachable()
    }
    
    // Don't call run() - caller will step through manually
  }

  /**
   * Reset PVM with program, registers, and gas
   * 
   * Resets the PVM state and sets up a new program execution context.
   * Uses preimage format for program decoding (Gray Paper Y function).
   * 
   * @param programBlob - Program blob in preimage format to decode
   * @param registers - Initial register values (13 x 8 bytes = 104 bytes, little-endian)
   * @param gas - Initial gas amount
   */
  public resetGeneric(programBlob: Uint8Array, registers: Uint8Array, gas: u32): void {
    // First reset the PVM state
    this.reset()
    
    // Use initializeProgram (Gray Paper Y function) to decode the program
    // Pass empty argument data for now (WASM wrapper doesn't use marshalling invocation)
    const argumentData = new Uint8Array(0)
    const codeBlob = this.initializeProgram(programBlob, argumentData)
    
    if (!codeBlob) {
      this.state.resultCode = RESULT_CODE_PANIC
      return
    }
    
    // Decode the code blob to get code, bitmask, and jumpTable
    const decoded = decodeBlob(codeBlob)
    if (!decoded) {
      this.state.resultCode = RESULT_CODE_PANIC
      return
    }
    
    // Set decoded program state
    this.state.code = decoded.code
    this.state.bitmask = decoded.bitmask
    this.state.jumpTable = decoded.jumpTable
    
    // Decode registers from Uint8Array (13 registers x 8 bytes each, little-endian)
    if (registers.length === 13 * 8) {
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
        this.state.registerState[i] = value
      }
    }
    
    // Set gas and program counter
    this.state.gasCounter = gas
    this.state.programCounter = 0
  }

  /**
   * Get parser instance
   * 
   * Returns a PVMParser instance for parsing program blobs.
   * Used by WASM wrapper to parse programs before execution.
   * 
   * @returns PVMParser instance
   */
  public getParser(): PVMParser {
    return new PVMParser()
  }
}
