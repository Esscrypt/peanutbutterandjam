/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnj/core'
import { decodeBlob, decodeProgram } from '@pbnj/serialization'
import type {
  ContextMutator,
  ImplicationsPair,
  IPVM,
  PVMInstruction,
  PVMOptions,
  PVMState,
  RefineInvocationContext,
  ResultCode,
  Safe,
  SafePromise,
  WorkError,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { GAS_CONFIG, INIT_CONFIG, RESULT_CODES } from './config'
import type { HostFunctionRegistry } from './host-functions/general/registry'
import { InstructionRegistry } from './instructions/registry'
import { PVMRAM } from './ram'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class PVM implements IPVM {
  public state: PVMState
  protected readonly registry: InstructionRegistry
  protected readonly hostFunctionRegistry: HostFunctionRegistry
  protected currentAccumulateContext?: ImplicationsPair
  protected currentRefineContext: RefineInvocationContext | null = null
  protected currentContextMutator: ContextMutator<any> | null = null
  protected currentContext: any | null = null

  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    options: PVMOptions = {},
  ) {
    // Initialize instruction registry (singleton)
    this.hostFunctionRegistry = hostFunctionRegistry
    this.registry = new InstructionRegistry()

    // Initialize state with options
    this.state = {
      resultCode: RESULT_CODES.HALT,
      instructionPointer: options.pc ?? 0n,
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
  private initializeProgram(
    programBlob: Uint8Array,
    argumentData: Uint8Array,
  ): Safe<Uint8Array> {
    // Try to decode as standard program format first (Gray Paper Y function)
    const [error, decoded] = decodeProgram(programBlob)
    if (error) {
      return safeError(error)
    }
    const { code, roData, rwData, stackSize, jumpTableEntrySize } =
      decoded.value

    // Gray Paper equation 803-811: Initialize registers
    this.state.registerState[0] = 2n ** 32n - 2n ** 16n // 2^32 - 2^16
    this.state.registerState[1] =
      2n ** 32n - 2n * INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE // 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
    this.state.registerState[7] =
      2n ** 32n - INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE // 2^32 - Cpvminitzonesize - Cpvminitinputsize
    this.state.registerState[8] = BigInt(argumentData.length) // len(argumentData)

    // Set up memory sections according to Gray Paper memory layout
    this.initializeMemoryLayout(roData, rwData, stackSize, argumentData)

    // Initialize jump table (empty for standard program format)
    // Standard program format doesn't include jump table, so we use empty array
    // jumpTableEntrySize indicates the size of each entry if present
    this.state.jumpTable = []

    logger.debug('Y function initialized program', {
      codeLength: code.length,
      roDataLength: roData.length,
      rwDataLength: rwData.length,
      stackSize,
      jumpTableEntrySize,
      jumpTableLength: this.state.jumpTable.length,
      argLength: argumentData.length,
    })

    return safeResult(code)
  }

  /**
   * Initialize memory layout according to Gray Paper equation 770-802
   *
   * @param ram - RAM instance to initialize
   * @param roData - Read-only data section
   * @param rwData - Read-write data section
   * @param stackSize - Stack size
   * @param argumentData - Argument data
   */
  private initializeMemoryLayout(
    roData: Uint8Array,
    rwData: Uint8Array,
    stackSize: number,
    argumentData: Uint8Array,
  ): void {
    // Gray Paper equation 770-802: Memory layout implementation
    // Implement proper memory layout with access rights according to Gray Paper

    // Helper function to align to page boundary
    const alignToPage = (size: number): number => {
      const pageSize = 4096 // Cpvmpagesize = 2^12
      return Math.ceil(size / pageSize) * pageSize
    }

    // 1. Read-only data section (o) - Gray Paper: R access
    if (roData.length > 0) {
      const roStart = INIT_CONFIG.INIT_ZONE_SIZE
      const roAlignedLength = alignToPage(roData.length)

      this.state.ram.writeOctets(roStart, roData)
      this.state.ram.setPageAccessRights(roStart, roAlignedLength, 'read')
    }

    // 2. Read-write data section (w) - Gray Paper: W access
    if (rwData.length > 0) {
      const rwStart = 2n * INIT_CONFIG.INIT_ZONE_SIZE
      const rwAlignedLength = alignToPage(rwData.length)

      this.state.ram.writeOctets(rwStart, rwData)
      this.state.ram.setPageAccessRights(rwStart, rwAlignedLength, 'write')
    }

    // 3. Stack section - Gray Paper: W access
    if (stackSize > 0) {
      const stackStart =
        2n ** 32n -
        2n * INIT_CONFIG.INIT_ZONE_SIZE -
        INIT_CONFIG.INIT_INPUT_SIZE -
        BigInt(alignToPage(stackSize))
      const stackAlignedLength = alignToPage(stackSize)

      this.state.ram.setPageAccessRights(
        stackStart,
        stackAlignedLength,
        'write',
      )
    }

    // 4. Argument data section (a) - Gray Paper: R access
    if (argumentData.length > 0) {
      const argStart =
        2n ** 32n - INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE
      const argAlignedLength = alignToPage(argumentData.length)

      this.state.ram.writeOctets(argStart, argumentData)
      this.state.ram.setPageAccessRights(argStart, argAlignedLength, 'read')
    }

    logger.debug('Memory layout initialized', {
      roDataLength: roData.length,
      rwDataLength: rwData.length,
      stackSize,
      argDataLength: argumentData.length,
    })
  }

  /**
   * Ψ_M - Marshalling PVM invocation function
   * Gray Paper: Ψ_M(blob, pvmreg, gas, blob, contextmutator, X) → (gas, blob ∪ {panic, oog}, X)
   *
   * This is a pure wrapper that calls the core Ψ function with proper context handling.
   * Uses the Y function to initialize registers and memory according to Gray Paper.
   *
   * @param code - Service code blob
   * @param initialPC - Initial program counter (typically 0 for refine, 5 for accumulate)
   * @param gasLimit - Gas limit for execution
   * @param encodedArgs - Encoded arguments blob
   * @param contextMutator - Context mutator function F
   * @param context - Context X (ImplicationsPair for accumulate, RefineContext for refine)
   * @returns Tuple of (gas, result, context) where result is blob ∪ {panic, oog}
   */
  protected async executeMarshallingInvocation<T>(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator<T>,
    context: T,
  ): SafePromise<void> {
    // Store context mutator and context for use during execution
    this.currentContextMutator = contextMutator
    this.currentContext = context

    // Gray Paper: Ψ_M calls the core Ψ function
    // Ψ_M(blob, pvmreg, gas, blob, contextmutator, X) → (gas, blob ∪ {panic, oog}, X)

    // Gray Paper equation 822: Use Y function to initialize program state
    // Y(programBlob, argumentData) → (code, registers, ram)?
    const [error, decodedCode] = this.initializeProgram(
      programBlob,
      encodedArgs,
    )
    if (error) {
      return safeError(error)
    }

    this.state.gasCounter = gasLimit
    this.state.instructionPointer = initialPC

    // Gray Paper: Call core Ψ function with context mutator
    // The core Ψ function (this.run) handles all PVM execution logic
    await this.run(decodedCode)

    return safeResult(undefined)
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
    this.state.gasCounter -= 1n

    // Execute instruction (Ψ₁) - gas consumption handled by instruction itself
    const resultCode = this.executeInstruction(instruction)

    if (resultCode === RESULT_CODES.HOST) {
      // Extract host call ID from registers (typically r0 or r1)
      const hostCallId = this.state.registerState[0] // Assuming host call ID is in r0
      this.state.hostCallId = hostCallId
      if (this.state.gasCounter <= 0n) {
        this.state.resultCode = RESULT_CODES.OOG
        return RESULT_CODES.OOG
      }

      // Consume 1 gas for each instruction
      this.state.gasCounter -= 10n

      // Use context mutator if available (for accumulate/refine invocations)
      if (this.currentContextMutator && this.currentContext !== undefined) {
        const mutatorResult = this.currentContextMutator(
          hostCallId,
          this.state.gasCounter,
          this.state.registerState,
          this.state.ram,
          this.currentContext,
        )

        // Update state from mutator result
        this.state.gasCounter = mutatorResult.gasCounter
        this.state.registerState = mutatorResult.registers
        this.state.ram = mutatorResult.memory
        this.currentContext = mutatorResult.context

        // Check if mutator wants to halt execution
        if (mutatorResult.resultCode !== null) {
          return mutatorResult.resultCode
        }
      } else {
        // Fallback to generic host function registry (for standalone PVM execution)
        const context = {
          gasCounter: this.state.gasCounter,
          registers: this.state.registerState,
          ram: this.state.ram,
        }

        const hostFunction = this.hostFunctionRegistry.get(hostCallId)
        if (!hostFunction) {
          return RESULT_CODES.PANIC
        }

        const mutatorResult = await hostFunction.execute(
          context,
          this.currentRefineContext,
        )

        this.state.gasCounter = context.gasCounter
        this.state.registerState = context.registers
        this.state.ram = context.ram

        // Check if mutator wants to halt execution
        if (mutatorResult.resultCode !== null) {
          return mutatorResult.resultCode
        }
      }
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
  private skip(instructionIndex: number, opcodeBitmask: Uint8Array): number {
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
   * Execute program until termination (Gray Paper Ψ function)
   *
   * Uses step() function to execute instructions one by one
   */
  public async run(programBlob: Uint8Array): Promise<void> {
    // Decode the program blob
    const [error, decoded] = decodeBlob(programBlob)
    if (error) {
      this.state.resultCode = RESULT_CODES.PANIC
      return
    }

    const { code, bitmask, jumpTable } = decoded.value

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
    while (resultCode === null) {
      const instructionIndex = Number(this.state.instructionPointer)
      const opcode = extendedCode[instructionIndex]

      // Calculate Fskip(i) according to Gray Paper specification:
      // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
      const fskip = this.skip(instructionIndex, extendedBitmask)
      const instructionLength = 1 + fskip

      // Extract operands from extended code (with zero padding)
      const operands = extendedCode.slice(
        instructionIndex + 1,
        instructionIndex + instructionLength,
      )

      const instruction: PVMInstruction = {
        opcode: BigInt(opcode),
        operands,
        fskip,
        pc: this.state.instructionPointer,
      }

      resultCode = await this.step(instruction)
      console.log('PVM.run: Result code', {
        resultCode,
        gas: this.state.gasCounter.toString(),
        pc: this.state.instructionPointer.toString(),
      })
    }

    this.state.resultCode = resultCode

    // Gray Paper: Only HALT sets PC to 0 (successful completion)
    // PANIC keeps PC at the instruction that caused the panic (for debugging)
    // TODO: Uncomment this for PRODUCTION
    // if (resultCode === RESULT_CODES.HALT || resultCode === RESULT_CODES.PANIC) {
    //   this.state.instructionPointer = 0n
    // }
  }

  /**
   * Execute single instruction (Gray Paper Ψ₁)
   * Instructions mutate the context in place
   */
  private executeInstruction(instruction: PVMInstruction): ResultCode | null {
    const handler = this.registry.getHandler(instruction.opcode)

    if (!handler) {
      return RESULT_CODES.PANIC
    }

    try {
      // Save PC before execution
      const pcBefore = this.state.instructionPointer

      // Create execution context (mutable)
      const context = {
        instruction,
        registers: this.state.registerState,
        ram: this.state.ram,
        gas: this.state.gasCounter,
        pc: this.state.instructionPointer,
        jumpTable: this.state.jumpTable, // j
        fskip: instruction.fskip,
        bitmask: this.state.bitmask, // k
        code: this.state.code, // c
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
        this.state.instructionPointer = context.pc
      } else {
        // Normal flow - advance PC by instruction length (in bytes)
        // Instruction length = 1 (opcode) + Fskip(ι) according to Gray Paper
        const instructionLength = BigInt(1 + instruction.fskip)
        this.state.instructionPointer += instructionLength

        // Next iteration will check if there's a valid instruction at new PC
        // If not, it will panic with "Invalid PC"
      }

      // Return null to continue execution
      return result.resultCode
    } catch (error) {
      logger.error('Instruction execution exception', {
        instruction: handler.name,
        error: error instanceof Error ? error.message : String(error),
        pc: this.state.instructionPointer.toString(),
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
      resultCode: RESULT_CODES.HALT,
      instructionPointer: 0n,
      registerState: new Array(13).fill(0n), // All 13 registers (r0-r12) store 64-bit values,
      ram: new PVMRAM(),
      gasCounter: GAS_CONFIG.DEFAULT_GAS_LIMIT,
      faultAddress: null,
      jumpTable: [],
      code: new Uint8Array(0),
      bitmask: new Uint8Array(0),
      hostCallId: null,
    }
  }

  /**
   * Get current state
   */
  public getState(): PVMState {
    return { ...this.state }
  }
}
