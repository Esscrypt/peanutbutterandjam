/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { decodeBlob, decodeProgramFromPreimage } from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import type {
  ContextMutator,
  ImplicationsPair,
  IPVM,
  PVMInstruction,
  PVMOptions,
  PVMState,
  RAM,
  RefineInvocationContext,
  ResultCode,
  Safe,
  SafePromise,
  WorkError,
} from '@pbnjam/types'
import { safeError, safeResult } from '@pbnjam/types'
import { alignToZone } from './alignment-helpers'
import {
  GAS_CONFIG,
  INIT_CONFIG,
  MEMORY_CONFIG,
  REGISTER_INIT,
  RESULT_CODES,
} from './config'
import type { HostFunctionRegistry } from './host-functions/general/registry'
import { InstructionRegistry } from './instructions/registry'
import { PVMParser } from './parser'
import { PVMRAM } from './ram'

/**
 * PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class PVM implements IPVM {
  public state: PVMState
  protected readonly registry: InstructionRegistry
  protected readonly hostFunctionRegistry: HostFunctionRegistry
  protected context: RefineInvocationContext | ImplicationsPair | null = null
  protected contextMutator: ContextMutator = () => null
  /** Step counter for execution traces (per execution run) */
  protected executionStep = 0

  /** Global log collection for instruction execution (per execution run) */
  protected executionLogs: Array<{
    step: number
    pc: bigint
    instructionName: string
    opcode: string
    gas: bigint
    registers: string[]
    // JIP-6 trace support: load/store tracking
    loadAddress: number
    loadValue: bigint
    storeAddress: number
    storeValue: bigint
  }> = []

  /** Global log collection for host function execution (per execution run) */
  protected hostFunctionLogs: Array<{
    timestamp: number
    functionName: string
    functionId: bigint
    message: string
    data?: Record<string, unknown>
    registers: string[]
    pc: bigint | null
  }> = []

  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    options: PVMOptions = {},
  ) {
    // Initialize instruction registry (singleton)
    this.hostFunctionRegistry = hostFunctionRegistry
    this.registry = new InstructionRegistry()

    // Initialize state with options
    this.state = {
      instructions: new Map(),
      resultCode: RESULT_CODES.HALT,
      programCounter: options.pc ?? 0n,
      registerState: options.registerState ?? new Array(13).fill(0n), // All 13 registers (r0-r12) store 64-bit values,
      ram: options.ram ?? new PVMRAM(),
      gasCounter: options.gasCounter ?? GAS_CONFIG.DEFAULT_GAS_LIMIT,
      jumpTable: [], // Jump table for dynamic jumps
      code: options.code ?? new Uint8Array(0), // code
      bitmask: new Uint8Array(0), // opcode bitmask
      faultAddress: null,
      hostCallId: null,
    }
  }

  /**
   * Invoke PVM execution with specific parameters
   * This is used by the INVOKE host function to execute a PVM machine
   * with custom gas limit and register state
   */
  public async invoke(
    gasLimit: bigint,
    registers: bigint[],
    programBlob: Uint8Array,
  ): Promise<void> {
    this.reset()
    // Set invocation parameters
    this.state.gasCounter = gasLimit
    this.state.registerState = [...registers]

    // Execute until termination
    await this.run(programBlob)
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
   * @returns Tuple of (code, registers, ram) or null if invalid
   */
  public initializeProgram(
    programBlob: Uint8Array,
    argumentData: Uint8Array,
  ): Safe<Uint8Array> {
    // Try to decode as standard program format first (Gray Paper Y function)
    const [error, result] = decodeProgramFromPreimage(programBlob)
    if (error) {
      return safeError(error)
    }
    const { code, roData, rwData, stackSize, heapZeroPaddingSize } =
      result.value

    // Gray Paper equation 767: Validate condition
    // 5*Cpvminitzonesize + rnq(len(o)) + rnq(len(w) + z*Cpvmpagesize) + rnq(s) + Cpvminitinputsize <= 2^32

    const alignedReadOnlyDataLength = alignToZone(roData.length)
    const alignedHeapLength = alignToZone(
      rwData.length + heapZeroPaddingSize * MEMORY_CONFIG.PAGE_SIZE,
    )
    const alignedStackSize = alignToZone(stackSize)

    const total =
      5 * INIT_CONFIG.ZONE_SIZE +
      alignedReadOnlyDataLength +
      alignedHeapLength +
      alignedStackSize +
      INIT_CONFIG.INIT_INPUT_SIZE

    if (total > 2 ** 32) {
      return safeError(
        new Error(
          `Gray Paper equation 767 condition violated: ${total} > 2^32`,
        ),
      )
    }

    // Initialize registers according to Gray Paper equation 803-811
    this.initializeRegisters(argumentData.length)

    // Set up memory sections according to Gray Paper memory layout
    this.initializeMemoryLayout(
      argumentData,
      roData,
      rwData,
      stackSize,
      heapZeroPaddingSize,
    )

    return safeResult(code)
  }

  /**
   * Initialize PVM registers according to Gray Paper equation 803-811
   * Reference: https://graypaper.fluffylabs.dev/#/579bd12/2c7c012cb101
   *
   * All registers are explicitly set for each invocation:
   * - r0: HALT address (2^32 - 2^16)
   * - r1: Stack segment end address (2^32 - 2*Cpvminitzonesize - Cpvminitinputsize)
   * - r7: Arguments segment start address (2^32 - Cpvminitzonesize - Cpvminitinputsize)
   * - r8: Argument data length
   * - r2-r6, r9-r12: Set to 0
   *
   * @param argumentDataLength - Length of argument data (a) in bytes
   */
  private initializeRegisters(argumentDataLength: number): void {
    // First, clear ALL registers to 0 (important when PVM instance is reused)
    // This ensures no leftover values from previous invocations
    for (let i = 0; i < 13; i++) {
      this.state.registerState[i] = 0n
    }

    // r0: HALT address - jumping to this address causes the PVM to halt gracefully
    // Gray Paper equation 803: registers[0] = 2^32 - 2^16
    // This is equivalent to the HALT_ADDRESS constant (0xffff0000)
    this.state.registerState[0] = BigInt(REGISTER_INIT.HALT_ADDRESS)

    // r1: Stack segment end address (exclusive)
    // Gray Paper equation 803: registers[1] = 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
    // This is equivalent to the STACK_SEGMENT_END constant (0xfefe0000)
    // Represents the end address of the stack region (exclusive boundary)
    this.state.registerState[1] = BigInt(REGISTER_INIT.STACK_SEGMENT_END())

    // r7: Arguments segment start address
    // Gray Paper equation 803: registers[7] = 2^32 - Cpvminitzonesize - Cpvminitinputsize
    // This is equivalent to the ARGS_SEGMENT_START constant (0xfeff0000)
    // Represents the start address of the arguments/output region
    this.state.registerState[7] = BigInt(REGISTER_INIT.ARGS_SEGMENT_START())

    // r8: Argument data length
    // Gray Paper equation 803: registers[8] = len(argumentData)
    // Stores the length of the argument data in bytes
    this.state.registerState[8] = BigInt(argumentDataLength)

    // r2-r6 and r9-r12 are now 0 (explicitly cleared above)
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
  private initializeMemoryLayout(
    argumentData: Uint8Array,
    readOnlyData: Uint8Array,
    readWriteData: Uint8Array,
    stackSize: number,
    heapZeroPaddingSize: number,
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

  /**
   * Ψ_M - Marshalling PVM invocation function
   * Gray Paper: Ψ_M(blob, pvmreg, gas, blob, contextmutator, X) → (gas, blob ∪ {panic, oog}, X)
   *
   * Gray Paper equation 817-839:
   * - If Y(p, a) = none: return (0, panic, x)
   * - If Y(p, a) = (c, registers, mem): call R(gascounter, Ψ_H(...))
   *
   * R function (equation 829-835):
   * - If ε = oog: return (u, oog, x')
   * - If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}: return (u, mem'[registers'[7]..registers'[8]], x')
   * - If ε = halt AND range not readable: return (u, [], x')
   * - Otherwise: return (u, panic, x')
   * Where u = gascounter - max(gascounter', 0)
   *
   * @param code - Service code blob
   * @param initialPC - Initial program counter (typically 0 for refine, 5 for accumulate)
   * @param gasLimit - Gas limit for execution
   * @param encodedArgs - Encoded arguments blob
   * @param contextMutator - Context mutator function F
   * @param context - Context X (ImplicationsPair for accumulate, RefineContext for refine)
   * @returns Tuple of (gas consumed, result, updated context) where result is blob ∪ {panic, oog}
   */
  protected async executeMarshallingInvocation(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator,
    context: RefineInvocationContext | ImplicationsPair,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: RefineInvocationContext | ImplicationsPair
  }> {
    // Store context mutator and context for use during execution
    this.contextMutator = contextMutator
    this.context = context

    // Gray Paper equation 822: Use Y function to initialize program state
    // Y(programBlob, argumentData) → (code, registers, ram)?
    const [error, codeBlob] = this.initializeProgram(programBlob, encodedArgs)
    if (error) {
      // Gray Paper: If Y(p, a) = none: return (0, panic, x)
      logger.error(
        'ExecuteMarshallingInvocation: Program initialization error',
        {
          error: error.message,
        },
      )
      return safeResult({
        gasConsumed: 0n,
        result: 'PANIC',
        context,
      })
    }

    // Store initial gas for calculation
    const initialGas = gasLimit
    this.state.gasCounter = gasLimit
    this.state.programCounter = initialPC

    // Gray Paper: Call core Ψ function (Ψ_H) with context mutator
    // The core Ψ function (this.run) handles all PVM execution logic
    await this.run(codeBlob)

    // After execution, extract final state
    const finalGasCounter = this.state.gasCounter
    const finalResultCode = this.state.resultCode
    const finalRegisters = this.state.registerState
    const finalMemory = this.state.ram

    // Gray Paper equation 834: Calculate gas consumed
    // u = gascounter - max(gascounter', 0)
    const gasConsumed =
      initialGas - (finalGasCounter > 0n ? finalGasCounter : 0n)

    // Gray Paper equation 829-835: R function - extract result based on termination
    const result = this.extractResultFromExecution(
      finalResultCode,
      finalRegisters,
      finalMemory,
    )

    return safeResult({
      gasConsumed,
      result,
      context: this.context as RefineInvocationContext | ImplicationsPair,
    })
  }

  /**
   * R function - Extract result from execution based on termination condition
   *
   * Gray Paper equation 829-835 (pvm.tex):
   * R(gascounter, Ψ_H(...)) → (gas, result, context)
   *
   * Where result is determined by:
   * - Gray Paper equation 829: If ε = oog: return (u, oog, x')
   * - Gray Paper equation 831: If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}:
   *   return (u, mem'[registers'[7]..registers'[7]+registers'[8]], x')
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
  private extractResultFromExecution(
    resultCode: ResultCode,
    finalRegisters: bigint[],
    finalMemory: RAM,
  ): Uint8Array | 'PANIC' | 'OOG' {
    // Gray Paper equation 829: If ε = oog: return (u, oog, x')
    if (resultCode === RESULT_CODES.OOG) {
      return 'OOG'
    }

    // Gray Paper equation 830-832: Handle HALT case
    if (resultCode === RESULT_CODES.HALT) {
      // Extract result range from registers
      // registers'[7] = arguments segment start address
      // registers'[8] = argument data length
      const startOffset = finalRegisters[7]
      const length = finalRegisters[8]

      // Empty range is trivially readable - return empty blob
      if (length === 0n) {
        return new Uint8Array(0)
      }

      // Gray Paper equation 831-832: Check if Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}
      // Nrange{registers'[7]}{registers'[8]} means range from startOffset to startOffset+length

      // Gray Paper equation 831: If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}
      // return (u, mem'[registers'[7]..registers'[7]+registers'[8]], x')
      const [memoryResult, readFaultAddress] = finalMemory.readOctets(
        startOffset,
        length,
      )

      // If readOctets returns a fault, this is an inconsistency (range was readable but read failed)
      // Gray Paper equation 832: If ε = halt AND range not readable: return (u, [], x')
      if (readFaultAddress) {
        return new Uint8Array(0)
      }

      // If memoryResult is null, also treat as error (should not happen if range is readable)
      if (!memoryResult) {
        logger.error('ExtractResultFromExecution: Memory result is null', {
          startOffset: startOffset.toString(),
          length: length.toString(),
          faultAddress: readFaultAddress?.toString() ?? 'null',
        })
        return 'PANIC'
      }

      return memoryResult
    }

    // Gray Paper equation 833: Otherwise: return (u, panic, x')
    // This covers PANIC and any other unexpected result codes
    return 'PANIC'
  }

  /**
   * Execute a single instruction step (Gray Paper Ψ₁)
   * Returns the result code and whether execution should continue
   */
  public async step(instruction: PVMInstruction): Promise<ResultCode | null> {
    // Check for halt conditions
    if (this.state.gasCounter <= 0n) {
      this.state.resultCode = RESULT_CODES.OOG
      return RESULT_CODES.OOG
    }

    // Consume 1 gas for each instruction
    // Note: ECALLI instructions cost 1 gas just like any other instruction.
    // The host function's gas cost (10+) is handled separately in the context mutator.
    // The host function will OOG if there's not enough gas for its operation.
    this.state.gasCounter -= 1n

    // logger.debug('Step: Instruction', {
    //   code: this.state.code,
    //   bitmask: this.state.bitmask,
    //   jumpTable: this.state.jumpTable,
    //   opcode: instruction.opcode.toString(),
    //   instructionName: this.registry.getHandler(instruction.opcode)?.name,
    //   gas: this.state.gasCounter.toString(),
    //   pc: this.state.programCounter.toString(),
    //   registers: this.state.registerState,
    // })

    // Execute instruction (Ψ₁) - gas consumption handled by instruction itself
    const resultCode = this.executeInstruction(instruction)

    if (resultCode === RESULT_CODES.HOST) {
      // Extract host call ID from instruction operands (Gray Paper: immed_X from ECALLI)
      // Gray Paper pvm.tex §7.4.1: ε = host × immed_X, where immed_X is the immediate operand
      // For ECALLI, the host function ID is in operands[0] (sign-extended, but IDs are small)
      const operand0 = instruction.operands[0]
      // Gray Paper pvm.tex line 251-255: immed_X with l_X=0 bytes defaults to 0
      // If fskip=0, there are no operand bytes, so host call ID is 0
      // This is valid per the Gray Paper - host call ID 0 (READ) will be handled by contextMutator
      const hostCallId = operand0 !== undefined && operand0 !== null ? BigInt(operand0) : 0n
      this.state.hostCallId = hostCallId
      if (this.state.gasCounter <= 0n) {
        this.state.resultCode = RESULT_CODES.OOG
        return RESULT_CODES.OOG
      }

      // Use context mutator if available (for accumulate/refine invocations)
      const resultCode = this.contextMutator(hostCallId)

      // If host function returns null (continue), advance PC by instruction length
      // The PC was not advanced in executeInstruction() because it returned HOST early
      if (resultCode === null) {
        const instructionLength = BigInt(1 + instruction.fskip)
        this.state.programCounter += instructionLength
      }

      // Check if mutator wants to halt execution
      return resultCode
    }

    return resultCode
  }

  /**
   * Extract result from memory - placeholder implementation
   */
  protected extractResultFromMemory(): Uint8Array | WorkError {
    const start = this.state.registerState[7]
    const length = this.state.registerState[8]
    const [response, faultAddress] = this.state.ram.readOctets(start, length)
    if (faultAddress) {
      return 'PANIC'
    }
    if (!response) {
      return 'PANIC'
    }
    return response
  }

  /**
   * Skip function Fskip(i) - determines distance to next instruction
   *
   * Gray Paper Equation 7.1:
   * Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
   *
   * @param instructionIndex - Index of instruction opcode in instruction data
   * @param opcodeBitmask - Bitmask indicating valid instruction boundaries
   * @returns Number of octets minus 1 to next instruction's opcode
   */
  protected skip(instructionIndex: number, opcodeBitmask: Uint8Array): number {
    // Append bitmask with sequence of set bits for final instruction
    const extendedBitmask = new Uint8Array(opcodeBitmask.length + 25)
    extendedBitmask.set(opcodeBitmask)
    extendedBitmask.fill(1, opcodeBitmask.length)

    // Find next set bit starting from i+1
    for (let j = 1; j <= 24; j++) {
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
   * Get execution logs collected during the last run
   */
  /**
   * Get execution logs in execution order (not sorted by PC)
   * Logs are appended during instruction execution, preserving execution sequence
   * Note: PC values may go backwards due to branches/jumps, but logs remain in execution order
   */
  public getExecutionLogs(): Array<{
    step: number
    pc: bigint
    instructionName: string
    opcode: string
    gas: bigint
    registers: string[]
    loadAddress: number
    loadValue: bigint
    storeAddress: number
    storeValue: bigint
  }> {
    // Return copy without sorting - logs are already in execution order
    return [...this.executionLogs]
  }

  /**
   * Get host function logs in execution order
   * Logs are appended during host function execution, preserving execution sequence
   */
  public getHostFunctionLogs(): Array<{
    timestamp: number
    functionName: string
    functionId: bigint
    message: string
    data?: Record<string, unknown>
    registers: string[]
    pc: bigint | null
  }> {
    return [...this.hostFunctionLogs]
  }

  /**
   * Execute program until termination (Gray Paper Ψ function)
   *
   * Uses step() function to execute instructions one by one
   */
  public async run(programBlob: Uint8Array): Promise<void> {
    // Clear logs and step counter at the start of each execution run
    this.executionLogs = []
    this.hostFunctionLogs = []
    this.executionStep = 0

    // Decode the program blob
    const [error, decoded] = decodeBlob(programBlob)
    if (error) {
      logger.error('Run: Program decode error', {
        error: error.message,
      })
      this.state.resultCode = RESULT_CODES.PANIC
      return
    }

    const { code, bitmask, jumpTable } = decoded.value

    // logger.debug('Run: Program decoded', {
    //   code: code.toString(),
    //   bitmask: bitmask.toString(),
    //   jumpTable: jumpTable.toString(),
    // })

    this.state.jumpTable = jumpTable
    // Gray Paper pvm.tex equation: ζ ≡ c ⌢ [0, 0, . . . ]
    // Append 16 zeros to ensure no out-of-bounds access and trap behavior
    // This implements the infinite sequence of zeros as specified in the Gray Paper
    const extendedCode = new Uint8Array(code.length + 16)
    extendedCode.set(code)
    // Zeros are already initialized by Uint8Array constructor

    // Extend bitmask to cover the padded zeros (all 1s = valid opcode positions)
    // Gray Paper: "appends k with a sequence of set bits in order to ensure a well-defined result"
    const extendedBitmask = new Uint8Array(code.length + 16)
    extendedBitmask.set(bitmask)
    extendedBitmask.fill(1, bitmask.length) // Fill remaining positions with 1s

    this.state.code = extendedCode
    this.state.bitmask = extendedBitmask

    let resultCode: ResultCode | null = null
    // Gray Paper uses gas as the bound - execution continues until gas is exhausted or a halting condition is reached

    while (resultCode === null) {
      const instructionIndex = Number(this.state.programCounter)

      // Bounds check: instruction pointer must be within valid code range
      if (instructionIndex < 0 || instructionIndex >= extendedCode.length) {
        logger.error('Instruction pointer out of bounds', {
          instructionIndex,
          codeLength: extendedCode.length,
          pc: this.state.programCounter.toString(),
        })
        this.state.resultCode = RESULT_CODES.PANIC
        return
      }

      const opcode = extendedCode[instructionIndex]

      // Validate opcode is not undefined
      if (opcode === undefined) {
        logger.error('Invalid opcode read from code', {
          instructionIndex,
          codeLength: extendedCode.length,
          pc: this.state.programCounter.toString(),
        })
        this.state.resultCode = RESULT_CODES.PANIC
        return
      }

      // Calculate Fskip(i) according to Gray Paper specification:
      // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
      const fskip = this.skip(instructionIndex, extendedBitmask)
      const instructionLength = 1 + fskip

      // Extract operands from extended code (with zero padding)
      const operands = extendedCode.slice(
        instructionIndex + 1,
        instructionIndex + instructionLength,
      )

      // Save PC before instruction execution (for trace logging)
      const pcBefore = this.state.programCounter

      const instruction: PVMInstruction = {
        opcode: BigInt(opcode),
        operands,
        fskip,
        pc: this.state.programCounter,
      }

      // Get instruction handler for trace logging
      const handler = this.registry.getHandler(instruction.opcode)
      const instructionName = handler?.name ?? 'UNKNOWN'

      // Save gas before step to detect if instruction was actually executed
      // If gas is 0, step() returns OOG immediately without executing
      const gasBeforeStep = this.state.gasCounter

      // Clear load/store tracking before each instruction (JIP-6 trace support)
      this.state.ram.clearLastMemoryOp()

      resultCode = await this.step(instruction)

      // Only log if the instruction was actually executed
      // If gas was 0 before step(), step() returns OOG immediately without executing
      // In that case, we shouldn't log a "phantom" instruction
      // For ECALLI (host calls), distinguish between base-cost OOG vs additionalGasCost OOG:
      // - Base-cost OOG (gas < 11): Don't log (instruction didn't fully execute)
      // - additionalGasCost OOG (gas >= 11): Log (host function succeeded, then OOG'd on extra cost)
      const shouldLog =
        gasBeforeStep > 0n &&
        (resultCode !== RESULT_CODES.OOG || gasBeforeStep >= 11n)
      if (shouldLog) {
        // Log execution step with PC before instruction execution
        // This shows where the instruction was executed, not where it jumped to
        this.executionLogs.push({
          step: this.executionStep,
          pc: pcBefore,
          instructionName,
          opcode: `0x${instruction.opcode.toString(16)}`,
          gas: this.state.gasCounter,
          registers: Array.from(this.state.registerState.slice(0, 13)).map((r) =>
            r.toString(),
          ),
          // JIP-6 trace support: capture load/store from RAM
          loadAddress: this.state.ram.lastLoadAddress,
          loadValue: this.state.ram.lastLoadValue,
          storeAddress: this.state.ram.lastStoreAddress,
          storeValue: this.state.ram.lastStoreValue,
        })
      }
    }

    // At this point, resultCode must be non-null (we exited the while loop with a result)
    this.state.resultCode = resultCode!
  }

  /**
   * Execute single instruction (Gray Paper Ψ₁)
   * Instructions mutate the context in place
   */
  private executeInstruction(instruction: PVMInstruction): ResultCode | null {
    const handler = this.registry.getHandler(instruction.opcode)

    if (!handler) {
      logger.error('ExecuteInstruction: Instruction handler not found', {
        opcode: instruction.opcode.toString(),
      })
      return RESULT_CODES.PANIC
    }

    try {
      // Save PC before execution
      const pcBefore = this.state.programCounter

      // Initialize logs array if not already present (per execution run)
      if (!this.executionLogs) {
        this.executionLogs = []
      }

      // Increment step counter for this instruction execution
      this.executionStep++

      // Create instruction logs array for this instruction (separate from trace logs)
      const instructionLogs: Array<{
        pc: bigint
        instructionName: string
        opcode: string
        message: string
        data?: Record<string, unknown>
        timestamp: number
      }> = []

      // Create execution context (mutable)
      const context = {
        instruction,
        registers: this.state.registerState,
        ram: this.state.ram,
        gas: this.state.gasCounter,
        pc: this.state.programCounter,
        jumpTable: this.state.jumpTable, // j
        fskip: instruction.fskip,
        bitmask: this.state.bitmask, // k
        code: this.state.code, // c
        logs: instructionLogs,
        log: (message: string, data?: Record<string, unknown>) => {
          instructionLogs.push({
            pc: this.state.programCounter,
            instructionName: handler.name,
            opcode: `0x${instruction.opcode.toString(16)}`,
            message,
            data,
            timestamp: Date.now(),
          })
        },
      }

      // Execute instruction (mutates context)
      const result = handler.execute(context)
      if (result.faultInfo) {
        this.state.faultAddress = result.faultInfo.address ?? null
      }

      // Check result code BEFORE advancing PC
      if (result.resultCode !== null) {
        // Instruction returned a terminal result - don't advance PC
        return result.resultCode
      }

      // Check if instruction modified PC (branches/jumps)
      if (context.pc !== pcBefore) {
        // Instruction modified PC (branch/jump)
        this.state.programCounter = context.pc
      } else {
        // Normal flow - advance PC by instruction length (in bytes)
        // Instruction length = 1 (opcode) + Fskip(ι) according to Gray Paper
        const instructionLength = BigInt(1 + instruction.fskip)
        this.state.programCounter += instructionLength

        // Next iteration will check if there's a valid instruction at new PC
        // If not, it will panic with "Invalid PC"
      }

      // Return null to continue execution
      return result.resultCode
    } catch (error) {
      // Exception occurred during instruction execution
      logger.error('ExecuteInstruction: Instruction execution exception', {
        instruction: handler?.name,
        opcode: instruction.opcode.toString(),
        error: error instanceof Error ? error.message : String(error),
        pc: this.state.programCounter.toString(),
        gas: this.state.gasCounter.toString(),
      })
      return RESULT_CODES.PANIC
    }
  }

  /**
   * Reset to initial state
   */
  public reset(): void {
    this.state = {
      instructions: new Map(),
      resultCode: RESULT_CODES.HALT,
      programCounter: 0n,
      registerState: new Array(13).fill(0n), // All 13 registers (r0-r12) store 64-bit values,
      ram: new PVMRAM(),
      gasCounter: GAS_CONFIG.DEFAULT_GAS_LIMIT,
      faultAddress: null,
      jumpTable: [],
      code: new Uint8Array(0),
      bitmask: new Uint8Array(0),
      hostCallId: null,
    }
    // Clear execution logs and step counter on reset
    this.executionLogs = []
    this.hostFunctionLogs = []
    this.executionStep = 0
  }

  /**
   * Get current state
   */
  public getState(): PVMState {
    return { ...this.state }
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

  /**
   * Execute single instruction step
   *
   * Gray Paper: Ψ_1 - Execute one instruction and return result code
   *
   * This method executes exactly one PVM instruction and returns the result code.
   * Used by the WASM wrapper for step-by-step execution.
   *
   * @returns Safe<ResultCode | null> - Result code or null to continue
   */
  public executeSingleStep(): Safe<ResultCode | null> {
    try {
      // Check if we're out of gas before executing
      if (this.state.gasCounter < 0n) {
        return safeResult(RESULT_CODES.OOG)
      }

      // Get current instruction
      const instruction = this.state.instructions.get(
        Number(this.state.programCounter),
      )

      if (!instruction) {
        logger.error('PVM: No instruction at PC', {
          pc: this.state.programCounter.toString(),
        })
        return safeResult(RESULT_CODES.PANIC)
      }

      // Execute instruction
      const resultCode = this.executeInstruction(instruction)

      // Return the result code
      // null means continue execution
      // Non-null means halt, panic, oog, fault, or host
      return safeResult(resultCode)
    } catch (error) {
      logger.error('PVM: executeSingleStep error', {
        error: error instanceof Error ? error.message : String(error),
        pc: this.state.programCounter.toString(),
      })
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }
}
