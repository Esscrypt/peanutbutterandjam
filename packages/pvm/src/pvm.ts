/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnj/core'
import { decodeBlob } from '@pbnj/serialization'
import type {
  ContextMutator,
  ImplicationsPair,
  PVMInstruction,
  PVMOptions,
  PVMState,
  RefineContextPVM,
  ResultCode,
} from '@pbnj/types'
import { GAS_CONFIG, INIT_CONFIG, RESULT_CODES } from './config'
import { AccumulateHostFunctionRegistry } from './host-functions/accumulate/registry'
import { HostFunctionRegistry } from './host-functions/general/registry'
import { InstructionRegistry } from './instructions/registry'
import { PVMRAM } from './ram'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class PVM {
  protected state: PVMState
  protected readonly registry: InstructionRegistry
  protected readonly hostFunctionRegistry: HostFunctionRegistry
  protected readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  protected currentAccumulateContext?: ImplicationsPair
  protected currentRefineContext?: RefineContextPVM

  constructor(options: PVMOptions = {}) {
    // Initialize instruction registry (singleton)
    this.hostFunctionRegistry = new HostFunctionRegistry()
    this.accumulateHostFunctionRegistry = new AccumulateHostFunctionRegistry()
    this.registry = new InstructionRegistry()

    // Initialize state with options
    this.state = {
      resultCode: null,
      instructionPointer: options.pc ?? 0n,
      registerState: options.registerState ?? new Array(13).fill(0n), // All 13 registers (r0-r12) store 64-bit values,
      ram: options.ram ?? new PVMRAM(),
      gasCounter: options.gasCounter ?? GAS_CONFIG.DEFAULT_GAS_LIMIT,
      jumpTable: [], // Jump table for dynamic jumps
      code: new Uint8Array(0), // code
      bitmask: new Uint8Array(0), // opcode bitmask
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
  ): Promise<{
    resultCode: ResultCode
    finalRegisters: bigint[]
    finalPC: bigint
    finalGas: bigint
  }> {
    // Save current state
    const originalGasCounter = this.state.gasCounter
    const originalRegisters = [...this.state.registerState]
    const originalPC = this.state.instructionPointer

    try {
      // Set invocation parameters
      this.state.gasCounter = gasLimit
      this.state.registerState = [...registers]

      // Execute until termination
      const resultCode = await this.run(programBlob)

      // Return results
      return {
        resultCode,
        finalRegisters: [...this.state.registerState],
        finalPC: this.state.instructionPointer,
        finalGas: this.state.gasCounter,
      }
    } finally {
      // Restore original state
      this.state.gasCounter = originalGasCounter
      this.state.registerState = originalRegisters
      this.state.instructionPointer = originalPC
    }
  }

  /**
   * Ψ_M - Marshalling PVM invocation function
   * Gray Paper equation 817: Ψ_M(blob, pvmreg, gas, blob, contextmutator, X) → (gas, blob ∪ {panic, oog}, X)
   *
   * @param code - Service code blob
   * @param initialPC - Initial program counter (typically 5 for accumulate)
   * @param gasLimit - Gas limit for execution
   * @param encodedArgs - Encoded arguments blob
   * @param contextMutator - Context mutator function F
   * @param context - Context X (ImplicationsPair for accumulate)
   * @returns Tuple of (gas, result, context)
   */
  protected async executeMarshallingInvocation<T>(
    code: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    _contextMutator: ContextMutator<T>,
    context: T,
  ): Promise<{
    gasUsed: bigint
    result: ResultCode | Uint8Array
    finalContext: T
  }> {
    // Save current state
    const originalState = { ...this.state }
    const originalAccumulateContext = this.currentAccumulateContext
    const originalRefineContext = this.currentRefineContext

    try {
      // Load the service code

      // Set initial state according to Gray Paper equation 803-810
      this.state.instructionPointer = initialPC
      this.state.gasCounter = gasLimit
      this.state.registerState = new Array(13).fill(0n)

      // Set up registers according to Gray Paper equation 803-810
      this.state.registerState[0] = 2n ** 32n - 2n ** 16n // r0 = 2^32 - 2^16
      this.state.registerState[1] =
        2n ** 32n -
        2n * INIT_CONFIG.INIT_ZONE_SIZE -
        INIT_CONFIG.INIT_INPUT_SIZE
      this.state.registerState[7] =
        2n ** 32n - INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE
      this.state.registerState[8] = BigInt(encodedArgs.length) // Length of arguments

      // Write encoded arguments to memory at the init zone
      const initZoneStart = 2n ** 32n - INIT_CONFIG.INIT_ZONE_SIZE
      this.state.ram.writeOctets(initZoneStart, encodedArgs)

      // Execute with context mutator
      // const result = this.runWithContextMutator(contextMutator, context)
      const result = await this.run(code)

      return {
        gasUsed: originalState.gasCounter - this.state.gasCounter,
        result: result,
        finalContext: context,
      }
    } catch (error) {
      logger.error('Marshalling invocation failed', { error })
      return {
        gasUsed: originalState.gasCounter - this.state.gasCounter,
        result: RESULT_CODES.PANIC,
        finalContext: context,
      }
    } finally {
      // Restore original state
      this.state = originalState
      this.currentAccumulateContext = originalAccumulateContext
      this.currentRefineContext = originalRefineContext
    }
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

    // Execute instruction (Ψ₁) - gas consumption handled by instruction itself
    const resultCode = this.executeInstruction(instruction)

    // Consume 1 gas for each instruction
    this.state.gasCounter -= 1n

    if (resultCode === RESULT_CODES.HOST) {
      // Extract host call ID from registers (typically r0 or r1)
      const hostCallId = this.state.registerState[0] // Assuming host call ID is in r0

      const context = {
        gasCounter: this.state.gasCounter,
        registers: this.state.registerState,
        ram: this.state.ram,
      }
      // Call context mutator to handle the host call
      const hostFunction = this.hostFunctionRegistry.get(hostCallId)

      if (!hostFunction) {
        return RESULT_CODES.PANIC
      }

      const mutatorResult = await hostFunction.execute(context)

      this.state.gasCounter = context.gasCounter
      this.state.registerState = context.registers
      this.state.ram = context.ram

      // Check if mutator wants to halt execution
      if (mutatorResult.resultCode !== null) {
        return mutatorResult.resultCode
      }
    }

    return resultCode
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
  public async run(programBlob: Uint8Array): Promise<ResultCode> {
    // Decode the program blob
    const [error, decoded] = decodeBlob(programBlob)
    if (error) {
      return RESULT_CODES.PANIC
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
      }

      resultCode = await this.step(instruction)
      console.log('PVM.run: Result code', {
        resultCode,
        gas: this.state.gasCounter.toString(),
        pc: this.state.instructionPointer.toString(),
      })
    }

    this.state.resultCode = resultCode
    return resultCode
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

    console.log('PVM.executeInstruction: Executing instruction', {
      handler: handler.name,
      operands: Array.from(instruction.operands),
      gasBefore: this.state.gasCounter.toString(),
      pc: this.state.instructionPointer.toString(),
      fskip: instruction.fskip,
    })

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

      // Context was mutated - sync back to state
      // (registers/ram/callStack are already references, so already synced)
      // this.state.gasCounter = context.gas

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
      resultCode: null,
      instructionPointer: 0n,
      registerState: new Array(13).fill(0n), // All 13 registers (r0-r12) store 64-bit values,
      ram: new PVMRAM(),
      gasCounter: GAS_CONFIG.DEFAULT_GAS_LIMIT,
      jumpTable: [],
      code: new Uint8Array(0),
      bitmask: new Uint8Array(0),
    }
  }

  /**
   * Get current state
   */
  public getState(): PVMState {
    return { ...this.state }
  }
}
