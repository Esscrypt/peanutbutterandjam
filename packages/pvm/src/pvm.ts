/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnj/core'
import { decodeBlob, decodeProgramFromPreimage } from '@pbnj/serialization'
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
import { GAS_CONFIG, INIT_CONFIG, MEMORY_CONFIG, RESULT_CODES } from './config'
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
   * Gray Paper equation 766: Page alignment function
   * rnp(x ∈ ℕ) ≡ Cpvmpagesize * ceil(x / Cpvmpagesize)
   *
   * Aligns a size to the nearest page boundary (4096 bytes).
   * Uses number arithmetic to avoid bigint division precision loss.
   *
   * @param size - Size in bytes to align
   * @returns Aligned size as a multiple of Cpvmpagesize
   */
  private alignToPage(size: number): number {
    const pageSize = Number(MEMORY_CONFIG.PAGE_SIZE)
    return Math.ceil(size / pageSize) * pageSize
  }

  /**
   * Gray Paper equation 766: Zone alignment function
   * rnq(x ∈ ℕ) ≡ Cpvminitzonesize * ceil(x / Cpvminitzonesize)
   *
   * Aligns a size to the nearest zone boundary (65536 bytes).
   * Uses number arithmetic to avoid bigint division precision loss.
   *
   * @param size - Size in bytes to align
   * @returns Aligned size as a multiple of Cpvminitzonesize
   */
  private alignToZone(size: number): number {
    const zoneSize = INIT_CONFIG.INIT_ZONE_SIZE
    return Math.ceil(size / zoneSize) * zoneSize
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
  protected initializeProgram(
    programBlob: Uint8Array,
    argumentData: Uint8Array,
  ): Safe<Uint8Array> {
    // Try to decode as standard program format first (Gray Paper Y function)
    const [error, result] = decodeProgramFromPreimage(programBlob)
    if (error) {
      return safeError(error)
    }
    const { code, roData, rwData, stackSize, jumpTableEntrySize } = result.value

    logger.debug('Program decoded from Y function format', {
      codeLength: code.length,
      roDataLength: roData.length,
      rwDataLength: rwData.length,
      stackSize,
      jumpTableEntrySize,
      argumentDataLength: argumentData.length,
    })

    // Gray Paper equation 767: Validate condition
    // 5*Cpvminitzonesize + rnq(len(o)) + rnq(len(w) + z*Cpvmpagesize) + rnq(s) + Cpvminitinputsize <= 2^32
    const Cpvminitzonesize = INIT_CONFIG.INIT_ZONE_SIZE
    const Cpvminitinputsize = INIT_CONFIG.INIT_INPUT_SIZE
    const Cpvmpagesize = MEMORY_CONFIG.PAGE_SIZE

    const rnq_o = this.alignToZone(roData.length)
    const rnq_w_plus_z = this.alignToZone(
      rwData.length + jumpTableEntrySize * Number(Cpvmpagesize),
    )
    const rnq_s = this.alignToZone(stackSize)

    const total =
      5 * Cpvminitzonesize + rnq_o + rnq_w_plus_z + rnq_s + Cpvminitinputsize

    if (total > 2n ** 32n) {
      return safeError(
        new Error(
          `Gray Paper equation 767 condition violated: ${total} > 2^32`,
        ),
      )
    }

    // Gray Paper equation 803-811: Initialize registers
    // All registers are initialized to 0 in constructor, then specific ones are set here
    this.state.registerState[0] = BigInt(2 ** 32) - BigInt(2 ** 16) // 2^32 - 2^16
    this.state.registerState[1] = BigInt(
      2 ** 32 - 2 * INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE,
    ) // 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
    this.state.registerState[7] = BigInt(
      2 ** 32 - INIT_CONFIG.INIT_ZONE_SIZE - INIT_CONFIG.INIT_INPUT_SIZE,
    ) // 2^32 - Cpvminitzonesize - Cpvminitinputsize
    this.state.registerState[8] = BigInt(argumentData.length) // len(argumentData)
    // Registers 2-6 and 9-12 remain 0 (already initialized in constructor)

    // Set up memory sections according to Gray Paper memory layout
    this.initializeMemoryLayout(
      argumentData,
      roData,
      rwData,
      stackSize,
      jumpTableEntrySize,
    )

    return safeResult(code)
  }

  /**
   * Initialize memory layout according to Gray Paper equation 770-802
   *
   * Gray Paper equation 766: Alignment functions
   * - rnp(x ∈ ℕ) ≡ Cpvmpagesize * ceil(x / Cpvmpagesize) - page alignment
   * - rnq(x ∈ ℕ) ≡ Cpvminitzonesize * ceil(x / Cpvminitzonesize) - zone alignment
   *
   * @param argumentData - Argument data (a)
   * @param roData - Read-only data section (o)
   * @param rwData - Read-write data section (w)
   * @param stackSize - Stack size (s)
   * @param jumpTableEntrySize - Jump table entry size (z)
   */
  private initializeMemoryLayout(
    argumentData: Uint8Array,
    roData: Uint8Array,
    rwData: Uint8Array,
    stackSize: number,
    jumpTableEntrySize: number,
  ): void {
    const Cpvminitzonesize = INIT_CONFIG.INIT_ZONE_SIZE
    const Cpvminitinputsize = INIT_CONFIG.INIT_INPUT_SIZE
    const Cpvmpagesize = MEMORY_CONFIG.PAGE_SIZE

    const roLength = roData.length
    const rwLength = rwData.length
    const argLength = argumentData.length
    const s = stackSize
    const z = jumpTableEntrySize

    // Gray Paper equation 770-802: Memory layout

    // 1. Read-only data section (o): Cpvminitzonesize ≤ i < Cpvminitzonesize + len(o)
    //    Access: R, Value: o[i - Cpvminitzonesize]
    // 2. Read-only padding: Cpvminitzonesize + len(o) ≤ i < Cpvminitzonesize + rnp(len(o))
    //    Access: R, Value: 0
    // Gray Paper equation 770-802: Set access rights for rnp(len(o)) bytes
    const roStart = Cpvminitzonesize
    const roDataEnd = Cpvminitzonesize + roLength
    const roAligned = this.alignToPage(roLength)
    const roAlignedEnd = Cpvminitzonesize + roAligned

    if (roLength > 0) {
      // Set data values
      for (let i = 0; i < roData.length; i++) {
        this.state.ram.memoryData.set(BigInt(roStart + i), roData[i])
      }

      logger.debug('[PVM] Read-only data section', {
        roLength,
        roAligned,
        roStart: roStart.toString(),
        roDataEnd: roDataEnd.toString(),
        roAlignedEnd: roAlignedEnd.toString(),
      })

      // Set access rights for page-aligned region (includes padding)
      this.state.ram.setPageAccessRights(
        BigInt(roStart),
        roAligned, // Exactly rnp(len(o)) bytes
        'read',
      )
    }

    // Gray Paper equation 800: Gap region between read-only and read-write sections
    // Access: none for addresses [roAlignedEnd, rwSectionStart)
    // Calculate rnq(len(o)) once for use in gap clearing and read-write section
    const rnq_ro = this.alignToZone(roLength)
    const rwSectionStart = 2 * Cpvminitzonesize + rnq_ro
    if (roAlignedEnd < rwSectionStart) {
      const gapStartPage = Number(roAlignedEnd / Cpvmpagesize)
      const gapEndPage = Number((rwSectionStart - 1) / Cpvmpagesize)

      logger.debug('[PVM] Clearing gap region', {
        roAlignedEnd: roAlignedEnd.toString(),
        rwSectionStart: rwSectionStart.toString(),
        gapStartPage,
        gapEndPage,
        gapPages: Array.from(
          { length: gapEndPage - gapStartPage + 1 },
          (_, i) => gapStartPage + i,
        ),
      })

      for (let pageIdx = gapStartPage; pageIdx <= gapEndPage; pageIdx++) {
        this.state.ram.setPageAccessRights(
          BigInt(pageIdx * Cpvmpagesize),
          Number(Cpvmpagesize),
          'none',
        )
      }
    }

    // 3. Read-write data section (w): 2*Cpvminitzonesize + rnq(len(o)) ≤ i < 2*Cpvminitzonesize + rnq(len(o)) + len(w)
    //    Access: W, Value: w[i - (2*Cpvminitzonesize + rnq(len(o)))]
    if (rwLength > 0) {
      const rwStart = 2 * Cpvminitzonesize + rnq_ro
      for (let i = 0; i < rwData.length; i++) {
        this.state.ram.memoryData.set(BigInt(rwStart + i), rwData[i])
      }
      this.state.ram.setPageAccessRights(
        BigInt(rwStart),
        this.alignToPage(rwLength),
        'write',
      )
    }

    // 4. Read-write padding + jump table space:
    //    2*Cpvminitzonesize + rnq(len(o)) + len(w) ≤ i < 2*Cpvminitzonesize + rnq(len(o)) + rnp(len(w)) + z*Cpvmpagesize
    //    Access: W, Value: 0
    const rnp_rw = this.alignToPage(rwLength)
    const jumpTableSpaceStart = 2 * Cpvminitzonesize + rnq_ro + rwLength
    const jumpTableSpaceEnd =
      2 * Cpvminitzonesize + rnq_ro + rnp_rw + z * Cpvmpagesize
    // setPageAccessRights requires page-aligned addresses and lengths
    // Align start address down to nearest page boundary
    const pageSizeNum = Number(Cpvmpagesize)
    const startPageOffset = Number(jumpTableSpaceStart % Cpvmpagesize)
    const alignedStart = jumpTableSpaceStart - startPageOffset

    // Align end address up to nearest page boundary
    const endPageOffset = Number(jumpTableSpaceEnd % Cpvmpagesize)
    const alignedEnd =
      endPageOffset === 0
        ? jumpTableSpaceEnd
        : jumpTableSpaceEnd + pageSizeNum - endPageOffset

    // Calculate page-aligned length
    const alignedLength = alignedEnd - alignedStart

    if (alignedLength > 0) {
      this.state.ram.setPageAccessRights(
        BigInt(alignedStart),
        alignedLength,
        'write',
      )
      // Values are implicitly 0 (sparse storage)
    }

    // 5. Stack section: 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize - rnp(s) ≤ i < 2^32 - 2*Cpvminitzonesize - Cpvminitinputsize
    //    Access: W, Value: 0
    if (s > 0) {
      const rnp_s = this.alignToPage(s)
      const stackStart =
        2 ** 32 - 2 * Cpvminitzonesize - Cpvminitinputsize - rnp_s
      this.state.ram.setPageAccessRights(BigInt(stackStart), rnp_s, 'write')
      // Values are implicitly 0 (sparse storage)
    }

    // 6. Argument data section (a):
    //    2^32 - Cpvminitzonesize - Cpvminitinputsize ≤ i < 2^32 - Cpvminitzonesize - Cpvminitinputsize + len(a)
    //    Access: R, Value: a[i - (2^32 - Cpvminitzonesize - Cpvminitinputsize)]
    if (argLength > 0) {
      const argStart = 2 ** 32 - Cpvminitzonesize - Cpvminitinputsize
      for (let i = 0; i < argumentData.length; i++) {
        this.state.ram.memoryData.set(BigInt(argStart + i), argumentData[i])
      }
      this.state.ram.setPageAccessRights(
        BigInt(argStart),
        this.alignToPage(argLength),
        'read',
      )
    }

    // 7. Argument padding: 2^32 - Cpvminitzonesize - Cpvminitinputsize + len(a) ≤ i < 2^32 - Cpvminitzonesize - Cpvminitinputsize + rnp(len(a))
    //    Access: R, Value: 0
    const argAligned = this.alignToPage(argLength)
    if (argAligned > argLength) {
      const argPaddingStart =
        2 ** 32 - Cpvminitzonesize - Cpvminitinputsize + argLength
      const argPaddingLength = argAligned - argLength

      // Align start address down to nearest page boundary and align length
      const pageSizeNum = Number(Cpvmpagesize)
      const paddingStartOffset = Number(argPaddingStart % Cpvmpagesize)
      const alignedPaddingStart = argPaddingStart - paddingStartOffset
      const alignedPaddingLength =
        Math.ceil((argPaddingLength + paddingStartOffset) / pageSizeNum) *
        pageSizeNum

      this.state.ram.setPageAccessRights(
        BigInt(alignedPaddingStart),
        alignedPaddingLength,
        'read',
        true, // Mark as padding - excluded from pageMap
      )
      // Values are implicitly 0 (sparse storage)
    }

    // 8. All other addresses: Access: none, Value: 0 (implicit, sparse storage)

    // Log RAM initialization for verification
    const pageMap = this.state.ram.getPageMapJSON()

    logger.debug('[PVM] RAM initialized after Y function', {
      pageMap,
      pageCount: pageMap.length,
      registers: {
        r0: this.state.registerState[0].toString(),
        r1: this.state.registerState[1].toString(),
        r7: this.state.registerState[7].toString(),
        r8: this.state.registerState[8].toString(),
      },
    })
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
  protected async executeMarshallingInvocation<T>(
    programBlob: Uint8Array,
    initialPC: bigint,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    contextMutator: ContextMutator<T>,
    context: T,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: T
  }> {
    // Store context mutator and context for use during execution
    this.currentContextMutator = contextMutator
    this.currentContext = context

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
    this.state.instructionPointer = initialPC

    // Gray Paper: Call core Ψ function (Ψ_H) with context mutator
    // The core Ψ function (this.run) handles all PVM execution logic
    await this.run(codeBlob)

    // After execution, extract final state
    const finalGasCounter = this.state.gasCounter
    const finalResultCode = this.state.resultCode
    const finalRegisters = this.state.registerState
    const finalMemory = this.state.ram
    const finalContext = this.currentContext as T

    // Gray Paper equation 834: Calculate gas consumed
    // u = gascounter - max(gascounter', 0)
    const gasConsumed =
      initialGas - (finalGasCounter > 0n ? finalGasCounter : 0n)

    // Gray Paper equation 829-835: R function - extract result based on termination
    let result: Uint8Array | 'PANIC' | 'OOG'

    if (finalResultCode === RESULT_CODES.OOG) {
      // Gray Paper: If ε = oog: return (u, oog, x')
      result = 'OOG'
    } else if (finalResultCode === RESULT_CODES.HALT) {
      // Gray Paper: Check if registers'[7]..registers'[8] range is readable
      const startOffset = finalRegisters[7]
      const length = finalRegisters[8]

      if (length === 0n) {
        // Empty result
        result = new Uint8Array(0)
      } else {
        // Check if range is readable
        const [readable] = finalMemory.isReadableWithFault(startOffset, length)

        if (readable) {
          // Gray Paper: If ε = halt AND Nrange{registers'[7]}{registers'[8]} ⊆ readable{mem'}
          // return (u, mem'[registers'[7]..registers'[8]], x')
          const [memoryResult, readFaultAddress] = finalMemory.readOctets(
            startOffset,
            length,
          )
          if (memoryResult && !readFaultAddress) {
            result = memoryResult
          } else {
            // Should not happen if readable check passed, but handle gracefully
            result = 'PANIC'
          }
        } else {
          // Gray Paper: If ε = halt AND range not readable: return (u, [], x')
          result = new Uint8Array(0)
        }
      }
    } else {
      // Gray Paper: Otherwise: return (u, panic, x')
      result = 'PANIC'
    }

    return safeResult({
      gasConsumed,
      result,
      context: finalContext,
    })
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

    // logger.debug('Step: Instruction', {
    //   code: this.state.code,
    //   bitmask: this.state.bitmask,
    //   jumpTable: this.state.jumpTable,
    //   opcode: instruction.opcode.toString(),
    //   instructionName: this.registry.getHandler(instruction.opcode)?.name,
    //   gas: this.state.gasCounter.toString(),
    //   pc: this.state.instructionPointer.toString(),
    //   registers: this.state.registerState,
    // })

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

      logger.debug('Step: Host call', {
        hostCallId: this.hostFunctionRegistry.get(hostCallId)?.name,
        gas: this.state.gasCounter.toString(),
        registers: this.state.registerState,
      })

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
    while (resultCode === null) {
      const instructionIndex = Number(this.state.instructionPointer)

      // Bounds check: instruction pointer must be within valid code range
      if (instructionIndex < 0 || instructionIndex >= extendedCode.length) {
        logger.error('Instruction pointer out of bounds', {
          instructionIndex,
          codeLength: extendedCode.length,
          pc: this.state.instructionPointer.toString(),
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
          pc: this.state.instructionPointer.toString(),
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

      const instruction: PVMInstruction = {
        opcode: BigInt(opcode),
        operands,
        fskip,
        pc: this.state.instructionPointer,
      }

      resultCode = await this.step(instruction)
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
      logger.error('ExecuteInstruction: Instruction handler not found', {
        opcode: instruction.opcode.toString(),
      })
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
      logger.error('ExecuteInstruction: Instruction execution exception', {
        instruction: handler?.name,
        opcode: instruction.opcode.toString(),
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
