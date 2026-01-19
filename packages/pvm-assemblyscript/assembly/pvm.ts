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
  decodeAccumulateArgs,
  encodeImplicationsPair,
  PartialState,
  CompleteServiceAccount,
  decodeVariableSequence,
  AccumulateInput,
  decodeAccumulateInput,
  WorkPackage,
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
  GENERAL_FUNCTIONS,
} from './config'
import { FetchHostFunction } from './host-functions/general/fetch'
import { LookupHostFunction } from './host-functions/general/lookup'
import { ReadHostFunction } from './host-functions/general/read'
import { WriteHostFunction } from './host-functions/general/write'
import { InfoHostFunction } from './host-functions/general/info'
import { LogHostFunction } from './host-functions/general/log'
import { AccumulateHostFunctionRegistry } from './host-functions/accumulate/registry'
import { AccumulateHostFunctionContext, ACCUMULATE_ERROR_WHAT } from './host-functions/accumulate/base'
import { BlessHostFunction } from './host-functions/accumulate/bless'
import { AssignHostFunction } from './host-functions/accumulate/assign'
import { DesignateHostFunction } from './host-functions/accumulate/designate'
import { CheckpointHostFunction } from './host-functions/accumulate/checkpoint'
import { NewHostFunction } from './host-functions/accumulate/new'
import { UpgradeHostFunction } from './host-functions/accumulate/upgrade'
import { TransferHostFunction } from './host-functions/accumulate/transfer'
import { EjectHostFunction } from './host-functions/accumulate/eject'
import { QueryHostFunction } from './host-functions/accumulate/query'
import { SolicitHostFunction } from './host-functions/accumulate/solicit'
import { ForgetHostFunction } from './host-functions/accumulate/forget'
import { YieldHostFunction } from './host-functions/accumulate/yield'
import { ProvideHostFunction } from './host-functions/accumulate/provide'
import { HostFunctionRegistry } from './host-functions/general/registry'
import { HostFunctionContext, HostFunctionParams, ReadParams, WriteParams, LookupParams, InfoParams, LogParams, FetchParams, RefineInvocationContext } from './host-functions/general/base'
import { ServiceAccount } from './pbnj-types-compat'
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
  entropyAccumulator: Uint8Array | null = null // Entropy accumulator for FETCH host function
  accumulateInputs: Array<AccumulateInput> | null = null // Accumulate inputs for FETCH host function (selectors 14, 15)
  refineContext: RefineInvocationContext | null = null // Refine context (m, e) for refine invocation
  // Refine invocation parameters (needed by host functions)
  refineWorkPackage: WorkPackage | null = null // Work package for FETCH host function
  refineAuthorizerTrace: Uint8Array | null = null // Authorizer trace for FETCH host function
  refineImportSegments: Array<Array<Uint8Array>> | null = null // Import segments for FETCH host function
  refineExportSegmentOffset: u32 = 0 // Export segment offset for EXPORT host function
  refineServiceAccount: CompleteServiceAccount | null = null // Service account for HISTORICAL_LOOKUP host function
  refineLookupAnchorTimeslot: u64 = u64(0) // Lookup anchor timeslot for HISTORICAL_LOOKUP host function
  
  // Config parameters (set during setupAccumulateInvocation)
  configNumCores: i32 = 341
  configPreimageExpungePeriod: u32 = 19200
  configEpochDuration: u32 = 600
  configMaxBlockGas: u64 = u64(3500000000)
  configMaxRefineGas: u64 = u64(5000000000)
  configMaxTicketsPerExtrinsic: u16 = 16
  configTicketsPerValidator: u16 = 2
  configSlotDuration: u16 = 6
  configRotationPeriod: u16 = 10
  configNumValidators: u16 = 1023
  configNumEcPiecesPerSegment: u32 = 6
  configContestDuration: u32 = 500
  configMaxLookupAnchorage: u32 = 14400
  configEcPieceSize: u32 = 684
  
  // JAM version (for version-aware encoding)
  jamVersionMajor: u8 = 0
  jamVersionMinor: u8 = 7
  jamVersionPatch: u8 = 2

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
    this.run(null)
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
    // Try to decode as standard program format first (Gray Paper Y function)
    // Note: decodeProgramFromPreimage internally calls decodeServiceCodeFromPreimage
    // to extract metadata and codeBlob, then decodes the codeBlob as Y function format
    const result = decodeProgramFromPreimage(programBlob)
    if (!result) {
      abort(
        `initializeProgram: Failed to decode program from preimage: programBlob length=${programBlob.length}`
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
        `initializeProgram: Failed to decode code as deblob format: code length=${code.length}`
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
      // Extract host call ID from instruction operands (Gray Paper: immed_X from ECALLI)
      // Gray Paper pvm.tex §7.4.1: ε = host × immed_X, where immed_X is the immediate operand
      // Gray Paper pvm.tex line 251-255: If l_X=0 (no operand bytes), immed_X defaults to 0
      // This happens when fskip=0, meaning operands array is empty
      let hostCallId: u64 = 0
      if (instruction.operands.length > 0) {
        hostCallId = u64(instruction.operands[0])
      }
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
   * - Accumulation-specific functions: bless (14), assign (15), designate (16), checkpoint (17), 
   *   new (18), upgrade (19), transfer (20), eject (21), query (22), solicit (23), forget (24), 
   *   yield (25), provide (26)
   * 
   * Similar to TypeScript createAccumulateContextMutator and handleAccumulateHostFunction
   * 
   * @param hostCallId - Host function ID
   * @param instruction - Current instruction (for PC advancement)
   * @returns Result code (-1 = continue, >= 0 = halt)
   */
  private handleAccumulationHostCall(hostCallId: u64, instruction: PVMInstruction): i32 {
    // Gray Paper: Apply base gas cost (10 gas for all host functions)
    const gasCost: u32 = 10
    if (this.state.gasCounter < gasCost) {
      this.state.resultCode = RESULT_CODE_OOG
      return i32(RESULT_CODE_OOG)
    }
    
    // Deduct base gas cost before calling host function
    this.state.gasCounter -= gasCost
    
    // Try accumulate host functions first (14-26)
    // Gray Paper: Accumulation-specific functions are in range 14-26
    if (hostCallId >= u64(14) && hostCallId <= u64(26)) {
      const result = this.handleAccumulateHostFunction(hostCallId, instruction)
      
      // If result code is 255 (sentinel for null), continue execution
      if (result === -1) {
        // Advance PC by instruction length (host function handled it)
        const instructionLength = u32(1 + instruction.fskip)
        this.state.programCounter += instructionLength
        return -1 // Continue
      }
      
      // Otherwise, halt with the result code
      this.state.resultCode = u8(result)
      return result
    }
    
    // General host functions available in accumulate context (0-5)
    // Also include log (100) - JIP-1 debug/monitoring function
    if ((hostCallId >= u64(0) && hostCallId <= u64(5)) || hostCallId === u64(100)) {
      const result = this.handleGeneralHostFunction(hostCallId, instruction)
      
      // If result code is -1 (continue), advance PC
      if (result === -1) {
        // Advance PC by instruction length (host function handled it)
        const instructionLength = u32(1 + instruction.fskip)
        this.state.programCounter += instructionLength
        return -1 // Continue
      }
      
      // Otherwise, halt with the result code
      this.state.resultCode = u8(result)
      return result
    }
    
    // Gray Paper pvm_invocations.tex lines 206-210:
    // Unknown host function in accumulation context:
    // - Gas already deducted (10 gas above)
    // - Set registers[7] = WHAT (name unknown)
    // - Continue execution
    this.state.registerState[7] = ACCUMULATE_ERROR_WHAT
    
    // Advance PC by instruction length
    const instructionLength = u32(1 + instruction.fskip)
    this.state.programCounter += instructionLength
    return -1 // Continue execution
  }

  /**
   * Handle accumulation-specific host function (similar to TypeScript handleAccumulateHostFunction)
   * 
   * Gray Paper: Functions 14-26 (bless, assign, designate, checkpoint, new, upgrade, transfer, eject, query, solicit, forget, yield, provide)
   * 
   * @param hostCallId - Host function ID (should be 14-26)
   * @param instruction - Current instruction (for PC advancement)
   * @returns Result code (-1 = continue, >= 0 = halt)
   */
  private handleAccumulateHostFunction(hostCallId: u64, instruction: PVMInstruction): i32 {
    // NOTE: AssemblyScript doesn't support runtime polymorphism, so we use explicit dispatch
    
    // Create accumulation host function context
    if (!this.accumulationContext) {
      this.state.resultCode = RESULT_CODE_PANIC
      return i32(RESULT_CODE_PANIC)
    }
    
    const context = new AccumulateHostFunctionContext(
      this.state.gasCounter,
      this.state.registerState,
      this.state.ram,
      this.accumulationContext!,
      this.timeslot,
      u64(this.configPreimageExpungePeriod),
      u32(this.configNumCores), // Pass numCores from config
      u32(this.configNumValidators), // Pass numValidators from config
      this.jamVersionMajor, // Pass JAM version for version-aware behavior
      this.jamVersionMinor,
      this.jamVersionPatch,
    )
    
    let resultCode: u8 = 255
    
    switch (u32(hostCallId)) {
      case u32(14): {
        // BLESS
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const bless = changetype<BlessHostFunction>(handler)
        const result = bless.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(15): {
        // ASSIGN
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const assign = changetype<AssignHostFunction>(handler)
        const result = assign.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(16): {
        // DESIGNATE
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const designate = changetype<DesignateHostFunction>(handler)
        const result = designate.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(17): {
        // CHECKPOINT
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const checkpoint = changetype<CheckpointHostFunction>(handler)
        const result = checkpoint.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(18): {
        // NEW
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const newFn = changetype<NewHostFunction>(handler)
        const result = newFn.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(19): {
        // UPGRADE
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const upgrade = changetype<UpgradeHostFunction>(handler)
        const result = upgrade.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(20): {
        // TRANSFER
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const transfer = changetype<TransferHostFunction>(handler)
        const result = transfer.execute(context)
        resultCode = result.resultCode
        // Gray Paper: On success, TRANSFER deducts gasLimit (additionalGasCost) from gas counter
        if (result.additionalGasCost > u64(0)) {
          if (u64(context.gasCounter) < result.additionalGasCost) {
            // OOG - not enough gas for additional cost
            this.state.gasCounter = 0
            this.state.resultCode = RESULT_CODE_OOG
            return i32(RESULT_CODE_OOG)
          }
          context.gasCounter -= u32(result.additionalGasCost)
        }
        break
      }
      case u32(21): {
        // EJECT
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const eject = changetype<EjectHostFunction>(handler)
        const result = eject.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(22): {
        // QUERY
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const query = changetype<QueryHostFunction>(handler)
        const result = query.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(23): {
        // SOLICIT
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const solicit = changetype<SolicitHostFunction>(handler)
        const result = solicit.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(24): {
        // FORGET
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const forget = changetype<ForgetHostFunction>(handler)
        const result = forget.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(25): {
        // YIELD
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const yieldFn = changetype<YieldHostFunction>(handler)
        const result = yieldFn.execute(context)
        resultCode = result.resultCode
        break
      }
      case u32(26): {
        // PROVIDE
        const handler = this.accumulateHostFunctionRegistry.get(hostCallId)
        if (handler === null) { this.state.resultCode = RESULT_CODE_PANIC; return i32(RESULT_CODE_PANIC) }
        const provide = changetype<ProvideHostFunction>(handler)
        const result = provide.execute(context)
        resultCode = result.resultCode
        break
      }
      default: {
        // Gray Paper: Unknown accumulation host function
        // - Set registers[7] = WHAT (name unknown)
        // - Continue execution
        this.state.registerState[7] = ACCUMULATE_ERROR_WHAT
        return -1 // Continue execution
      }
    }
    
    // Update gas counter from context
    this.state.gasCounter = context.gasCounter
    
    // If result code is 255 (sentinel for null), continue execution
    if (resultCode === u8(255)) {
      return -1 // Continue
    }
    
    // Otherwise, return the result code
    return i32(resultCode)
  }

  /**
   * Handle general host function (similar to TypeScript handleGeneralHostFunction)
   * 
   * Gray Paper: gas (0), fetch (1), read (3), write (4), lookup (2), info (5), log (100)
   * 
   * @param hostCallId - Host function ID
   * @param instruction - Current instruction (for PC advancement)
   * @returns Result code (-1 = continue, >= 0 = halt)
   */
  private handleGeneralHostFunction(hostCallId: u64, instruction: PVMInstruction): i32 {
    // NOTE: AssemblyScript doesn't support runtime polymorphism, so we use explicit dispatch
    // like TypeScript does in typescript-pvm-executor.ts handleGeneralHostFunction
    
    // Create host function context once (shared for all cases that need it)
    const hostContext = new HostFunctionContext(
      this.state.gasCounter,
      this.state.registerState,
      this.state.ram,
    )
    
    switch (u32(hostCallId)) {
      case u32(0): {
        // GAS - inline implementation (Gray Paper: set registers[7] = gasCounter)
        this.state.registerState[7] = u64(this.state.gasCounter)
        return -1 // Continue
      }
      case u32(1): {
        // FETCH
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
    const params = this.buildGeneralHostFunctionParams(hostCallId)
        const fetch = changetype<FetchHostFunction>(handler)
        const result = fetch.execute(hostContext, params)
    this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      case u32(2): {
        // LOOKUP
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
        const params = this.buildGeneralHostFunctionParams(hostCallId)
        const lookup = changetype<LookupHostFunction>(handler)
        const result = lookup.execute(hostContext, params)
        this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      case u32(3): {
        // READ
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
        const params = this.buildGeneralHostFunctionParams(hostCallId)
        const read = changetype<ReadHostFunction>(handler)
        const result = read.execute(hostContext, params)
        this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      case u32(4): {
        // WRITE
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
        const params = this.buildGeneralHostFunctionParams(hostCallId)
        const write = changetype<WriteHostFunction>(handler)
        const result = write.execute(hostContext, params)
        this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      case u32(5): {
        // INFO
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
        const params = this.buildGeneralHostFunctionParams(hostCallId)
        const info = changetype<InfoHostFunction>(handler)
        const result = info.execute(hostContext, params)
        this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      case u32(100): {
        // LOG (JIP-1)
        const handler = this.hostFunctionRegistry.get(hostCallId)
        if (handler === null) {
          this.state.resultCode = RESULT_CODE_PANIC
          return i32(RESULT_CODE_PANIC)
        }
        const params = this.buildGeneralHostFunctionParams(hostCallId)
        const log = changetype<LogHostFunction>(handler)
        const result = log.execute(hostContext, params)
        this.state.gasCounter = hostContext.gasCounter
        return result.resultCode === u8(255) ? -1 : i32(result.resultCode)
      }
      default: {
        // Gray Paper: Unknown general host function
        // - Set registers[7] = WHAT (name unknown)
        // - Continue execution
        this.state.registerState[7] = ACCUMULATE_ERROR_WHAT
        return -1 // Continue execution
      }
    }
  }

  /**
   * Build params for general host functions (similar to TypeScript handleGeneralHostFunction)
   * Gray Paper: gas (0), fetch (1), read (3), write (4), lookup (2), info (5), log (100)
   */
  private buildGeneralHostFunctionParams(hostCallId: u64): HostFunctionParams | null {
    if (!this.accumulationContext) {
      return null
    }

    const imX = this.accumulationContext!.regular

    switch (u32(hostCallId)) {
      case u32(0): {
        // gas - no params needed
        return null
      }
      case u32(1): {
        // fetch - FetchParams with timeslot and accumulateInputs
        const fetchParams = new FetchParams(this.timeslot, u64(0))
        fetchParams.accumulateInputs = this.accumulateInputs
        return fetchParams
      }
      case u32(2): {
        // lookup - LookupParams with service ID and accounts Map
        const accountsMap = this.buildAccountsMap(imX.state)
        return new LookupParams(u64(imX.id), accountsMap)
      }
      case u32(3): {
        // read - ReadParams with service account and accounts
        const serviceAccount = this.findServiceAccount(imX.state, u32(imX.id))
        const accountsMap = this.buildAccountsMap(imX.state)
        return new ReadParams(u64(imX.id), serviceAccount, accountsMap)
      }
      case u32(4): {
        // write - WriteParams with service ID and service account
        const serviceAccount = this.findServiceAccount(imX.state, u32(imX.id))
        if (!serviceAccount) {
          return null
        }
        return new WriteParams(u64(imX.id), serviceAccount)
      }
      case u32(5): {
        // info - InfoParams with service ID and accounts Map
        const accountsMap = this.buildAccountsMap(imX.state)
        return new InfoParams(u64(imX.id), accountsMap)
      }
      case u32(100): {
        // log (JIP-1) - LogParams (no properties needed)
        return new LogParams()
      }
      default: {
        return null
      }
    }
  }

  /**
   * Build accounts Map from PartialState accounts array
   */
  private buildAccountsMap(state: PartialState): Map<u64, CompleteServiceAccount> {
    const accountsMap = new Map<u64, CompleteServiceAccount>()
    for (let i = 0; i < state.accounts.length; i++) {
      const entry = state.accounts[i]
      accountsMap.set(u64(entry.serviceId), entry.account)
    }
    return accountsMap
  }

  /**
   * Find service account in partial state by service ID
   */
  private findServiceAccount(state: PartialState, serviceId: u32): CompleteServiceAccount | null {
    // Search through accounts array to find matching serviceId
    for (let i = 0; i < state.accounts.length; i++) {
      if (state.accounts[i].serviceId === u32(serviceId)) {
        return state.accounts[i].account
      }
    }
    return null
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
    // Use 25 to match skip function's maximum distance (24 + 1 for safety)
    const extendedBitmask = new Uint8Array(this.state.bitmask.length + 25)
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
    const initialGas = gasLimit
    
    // Set up accumulation invocation (decodes context, initializes program, sets up state, extracts timeslot)
    // setupAccumulateInvocation already decodes args and sets this.timeslot according to Gray Paper
    this.setupAccumulateInvocation(
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
    jamVersionMajor: u8 = 0,
    jamVersionMinor: u8 = 7,
    jamVersionPatch: u8 = 2,
  ): void {
    // CRITICAL: Reset PVM state completely before each accumulation invocation
    // This ensures no state leaks between invocations
    this.reset()
    
    // Also clear accumulation-specific state
    this.accumulationContext = null
    this.entropyAccumulator = null
    this.accumulateInputs = null
    this.timeslot = u64(0)
    
    // Store config parameters
    this.configNumCores = configNumCores
    this.configPreimageExpungePeriod = configPreimageExpungePeriod
    this.configEpochDuration = configEpochDuration
    this.configMaxBlockGas = configMaxBlockGas
    this.configMaxRefineGas = configMaxRefineGas
    this.configMaxTicketsPerExtrinsic = configMaxTicketsPerExtrinsic
    this.configTicketsPerValidator = configTicketsPerValidator
    this.configSlotDuration = configSlotDuration
    this.configRotationPeriod = configRotationPeriod
    this.configNumValidators = configNumValidators
    this.configNumEcPiecesPerSegment = configNumEcPiecesPerSegment
    this.configContestDuration = configContestDuration
    this.configMaxLookupAnchorage = configMaxLookupAnchorage
    this.configEcPieceSize = configEcPieceSize
    this.jamVersionMajor = jamVersionMajor
    this.jamVersionMinor = jamVersionMinor
    this.jamVersionPatch = jamVersionPatch
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
    
    // Store entropy accumulator for FETCH host function
    this.entropyAccumulator = entropyAccumulator
    
    // Decode and store accumulate inputs for FETCH host function (selectors 14 and 15)
    // encodedWorkItems is now actually encoded AccumulateInputs
    // Gray Paper pvm_invocations.tex lines 359-360:
    // - Selector 14: encode{var{i}} - sequence of AccumulateInputs
    // - Selector 15: encode{i[registers[11]]} - single AccumulateInput
    // Should always be present (even if empty, it's encoded as length prefix 0 = 0x00)
    if (encodedWorkItems.length === 0) {
      // Truly empty (no data at all) - this shouldn't happen if we always encode
      // But handle it gracefully by setting empty array
      this.accumulateInputs = new Array<AccumulateInput>()
    } else {
      const inputsResult = decodeVariableSequence<AccumulateInput>(
        encodedWorkItems,
        (data: Uint8Array) => decodeAccumulateInput(data),
      )
      if (inputsResult) {
        this.accumulateInputs = inputsResult.value
        // accumulateInputs is now an array (possibly empty, but never null)
      } else {
        // Decoding failed - this is a problem
        abort(
          `setupAccumulateInvocation: decodeVariableSequence failed for encodedAccumulateInputs.length=${encodedWorkItems.length}`
        )
        unreachable()
      }
    }
    
    // Set PVM instance on FetchHostFunction so it can access config values
    const fetchHandler = this.hostFunctionRegistry.get(GENERAL_FUNCTIONS.FETCH)
    if (fetchHandler) {
      const fetchHostFunction = fetchHandler as FetchHostFunction
      fetchHostFunction.setPvmInstance(this)
    }
    
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
   * Set accumulate inputs for FETCH host function
   * This is called from the WASM executor to provide accumulate inputs for selectors 14 and 15
   */
  public setAccumulateInputs(inputs: Array<AccumulateInput> | null): void {
    this.accumulateInputs = inputs
  }

  /**
   * Set up refine invocation without executing
   * Gray Paper equation 78-89: Ψ_R(coreIndex, workItemIndex, workPackage, authorizerTrace, importSegments, exportSegmentOffset)
   * 
   * This sets up the refine context and initializes the program for step-by-step execution.
   * Host functions will access the refine context through this.refineContext.
   * 
   * @param gasLimit - Gas limit for execution (from work item refgaslimit)
   * @param program - Service code blob (preimage format)
   * @param args - Encoded refine arguments: encode{c, i, w.serviceindex, var{w.payload}, blake{p}}
   * @param workPackage - Work package (for FETCH host function)
   * @param authorizerTrace - Authorizer trace (for FETCH host function)
   * @param importSegments - Import segments (for FETCH host function)
   * @param exportSegmentOffset - Export segment offset (for EXPORT host function)
   * @param serviceAccount - Service account (for HISTORICAL_LOOKUP host function)
   * @param lookupAnchorTimeslot - Lookup anchor timeslot (for HISTORICAL_LOOKUP host function)
   */
  public setupRefineInvocation(
    gasLimit: u32,
    program: Uint8Array,
    args: Uint8Array,
    workPackage: WorkPackage | null,
    authorizerTrace: Uint8Array | null,
    importSegments: Array<Array<Uint8Array>> | null,
    exportSegmentOffset: u32,
    serviceAccount: CompleteServiceAccount | null,
    lookupAnchorTimeslot: u64,
  ): void {
    // CRITICAL: Reset PVM state completely before each refine invocation
    // This ensures no state leaks between invocations
    this.reset()
    
    // Clear refine-specific state
    this.refineContext = null
    this.refineWorkPackage = null
    this.refineAuthorizerTrace = null
    this.refineImportSegments = null
    this.refineExportSegmentOffset = 0
    this.refineServiceAccount = null
    this.refineLookupAnchorTimeslot = u64(0)
    this.accumulationContext = null
    this.entropyAccumulator = null
    this.accumulateInputs = null
    this.timeslot = u64(0)
    
    // Store refine invocation parameters for host functions
    this.refineWorkPackage = workPackage
    this.refineAuthorizerTrace = authorizerTrace
    this.refineImportSegments = importSegments
    this.refineExportSegmentOffset = exportSegmentOffset
    this.refineServiceAccount = serviceAccount
    this.refineLookupAnchorTimeslot = lookupAnchorTimeslot
    
    // Initialize refine context (Gray Paper: (∅, ∅) - empty machines dict and empty export segments)
    this.refineContext = new RefineInvocationContext()
    
    // Set gas and program counter
    // Gray Paper equation 86: Initial PC = 0 (not 5 like accumulate)
    this.state.gasCounter = gasLimit
    this.state.programCounter = 0
    
    // Initialize program using Gray Paper Y function
    // This decodes the preimage blob and sets up code, bitmask, and jumpTable
    const codeBlob = this.initializeProgram(program, args)
    
    if (!codeBlob) {
      abort(
        `setupRefineInvocation: initializeProgram failed: program length=${program.length}, args length=${args.length}`
      )
      unreachable()
    }
    
    // Verify that state.code and state.bitmask were set by initializeProgram
    if (this.state.code.length === 0 || this.state.bitmask.length === 0) {
      abort(
        `setupRefineInvocation: initializeProgram succeeded but state not set: code.length=${this.state.code.length}, bitmask.length=${this.state.bitmask.length}`
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
