/**
 * WASM PVM Executor
 *
 * Wraps the WASM PVM implementation to implement IPVMExecutor.
 *
 * Supports both generic marshalling invocations and accumulation-specific invocations.
 *
 * The WASM module is loaded from a file path in the constructor and initialized on first use.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decodeBlob,
  decodeImplicationsPair,
  decodeProgramFromPreimage,
  encodeAccumulateInput,
  encodeImplicationsPair,
  encodeVariableSequence,
} from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import { writeTraceDump } from '@pbnjam/pvm'
import { instantiate } from '@pbnjam/pvm-assemblyscript/wasmAsInit'
import type {
  AccumulateInput,
  IConfigService,
  IEntropyService,
  ImplicationsPair,
  PVMInstruction,
  PVMState,
  RAM,
  ResultCode,
  SafePromise,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'
// Import InstructionRegistry directly from registry file
import { InstructionRegistry } from '../../pvm/src/instructions/registry'

/**
 * WASM module exports type from instantiate function
 */
type WasmModule = Awaited<ReturnType<typeof instantiate>>

export class WasmPVMExecutor {
  private wasm: WasmModule | null = null
  private readonly wasmModuleBytes: ArrayBuffer
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService
  private readonly workspaceRoot: string
  private readonly traceSubfolder?: string

  private currentState: PVMState | null = null
  private executionLogs: Array<{
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
  private traceHostFunctionLogs: Array<{
    step: number
    hostCallId: bigint
    gasBefore: bigint
    gasAfter: bigint
    serviceId?: bigint
  }> = []
  private readonly instructionRegistry: InstructionRegistry =
    new InstructionRegistry()
  private code: Uint8Array = new Uint8Array(0)
  private bitmask: Uint8Array = new Uint8Array(0)

  /**
   * Create a new WasmPVMExecutor instance
   *
   * The WASM module is loaded from the pvm-assemblyscript package's build directory
   * and will be instantiated on first use (lazy initialization).
   *
   * Host function handling is now done internally in AssemblyScript, so no registries are needed.
   *
   * @param configService - Configuration service (required for accumulation invocations)
   * @param entropyService - Entropy service (required for accumulation invocations)
   * @param traceSubfolder - Optional subfolder name for trace output (e.g., 'preimages_light', 'storage_light')
   */
  constructor(
    configService: IConfigService,
    entropyService: IEntropyService,
    traceSubfolder?: string,
  ) {
    // Resolve path to WASM file in pvm-assemblyscript package
    // Path: packages/pvm-assemblyscript/build/pvm.wasm

    // Find workspace root by looking for turbo.json or package.json
    // This works both in development and when compiled
    let workspaceRoot: string
    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : dirname(fileURLToPath(import.meta.url))

    // Try to find workspace root by looking for marker files
    let searchDir = currentDir
    let found = false
    for (let i = 0; i < 10; i++) {
      // Check if we're at the workspace root (has turbo.json or package.json with workspaces)
      if (
        existsSync(join(searchDir, 'turbo.json')) ||
        (existsSync(join(searchDir, 'package.json')) &&
          existsSync(join(searchDir, 'packages')))
      ) {
        workspaceRoot = searchDir
        found = true
        break
      }
      const parent = dirname(searchDir)
      if (parent === searchDir) {
        // Reached filesystem root
        break
      }
      searchDir = parent
    }

    // Fallback to process.cwd() if we couldn't find workspace root
    if (!found) {
      workspaceRoot = process.cwd()
    }

    this.workspaceRoot = workspaceRoot!
    this.traceSubfolder = traceSubfolder

    // Try to load from pvm-assemblyscript build directory first
    // Path: packages/pvm-assemblyscript/build/pvm.wasm
    const buildWasmPath = join(
      workspaceRoot!,
      'packages',
      'pvm-assemblyscript',
      'build',
      'pvm.wasm',
    )

    // Fallback to local wasm directory if build directory doesn't exist
    // Local path: packages/pvm-invocations/src/wasm/pvm.wasm (for development/testing)
    const localWasmPath = join(currentDir, 'wasm', 'pvm.wasm')

    let wasmPath: string
    if (existsSync(buildWasmPath)) {
      wasmPath = buildWasmPath
    } else if (existsSync(localWasmPath)) {
      wasmPath = localWasmPath
    } else {
      // If neither exists, try the build path anyway (will throw a clear error)
      wasmPath = buildWasmPath
    }

    // Read WASM file
    const wasmBytes = readFileSync(wasmPath)
    // Convert Buffer to ArrayBuffer
    // Create a new ArrayBuffer and copy the data to ensure it's not a SharedArrayBuffer
    const uint8Array = new Uint8Array(
      wasmBytes.buffer,
      wasmBytes.byteOffset,
      wasmBytes.byteLength,
    )
    // Create a new ArrayBuffer by copying the data
    this.wasmModuleBytes = new ArrayBuffer(uint8Array.length)
    new Uint8Array(this.wasmModuleBytes).set(uint8Array)

    this.configService = configService
    this.entropyService = entropyService
  }

  /**
   * Ensure WASM module is initialized (lazy initialization)
   */
  // private async ensureInitialized(): Promise<void> {
  //   if (this.wasm) {
  //     return
  //   }

  //   // If initialization is already in progress, wait for it
  //   if (this.initializationPromise) {
  //     return this.initializationPromise
  //   }

  //   // Start initialization
  //   this.initializationPromise = (async () => {
  //     // Instantiate WASM module using wasmAsInit
  //     const wasm = await instantiate(this.wasmModuleBytes, {})

  //     // Initialize PVM with PVMRAM
  //     wasm.init(wasm.RAMType.PVMRAM)

  //     this.wasm = wasm
  //   })()

  //   await this.initializationPromise
  // }

  /**
   * Force re-instantiation of WASM module
   * This ensures completely fresh state between invocations
   */
  private async reinitializeWasm(): Promise<void> {
    // Clear existing module
    this.wasm = null

    // Instantiate fresh WASM module
    const wasm = await instantiate(this.wasmModuleBytes, {})

    // Initialize PVM with PVMRAM
    wasm.init(wasm.RAMType.PVMRAM)

    this.wasm = wasm
  }

  /**
   * Execute accumulation invocation using setupAccumulateInvocation
   * Similar to accumulate-wasm.test.ts
   *
   * This is the public method that AccumulatePVM should call directly for WASM execution.
   */
  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
    _inputs: AccumulateInput[],
    serviceId: bigint,
    invocationIndex?: number, // Invocation index (accseq iteration) for trace file naming - same for all services in a batch
    entropyOverride?: Uint8Array, // When provided (e.g. by worker from main-process snapshot), use instead of entropyService for WASM setup
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    // CRITICAL: Re-instantiate WASM module for each invocation to ensure completely fresh state
    // This prevents any state leakage between accumulation invocations
    await this.reinitializeWasm()

    if (!this.wasm) {
      return safeError(new Error('Failed to initialize WASM module'))
    }

    if (!this.configService || !this.entropyService) {
      return safeError(
        new Error(
          'ConfigService and EntropyService required for accumulation invocation',
        ),
      )
    }

    // Encode implications pair for context
    const [contextError, encodedContext] = encodeImplicationsPair(
      implicationsPair,
      this.configService,
    )
    if (contextError || !encodedContext) {
      return safeError(
        new Error(`Failed to encode context: ${contextError?.message}`),
      )
    }

    // Get config values
    const numCores = this.configService.numCores
    const numValidators = this.configService.numValidators
    const authQueueSize = 80 // Standard auth queue size
    // Use override when provided (e.g. worker receives main-process snapshot) so in-process and worker see same entropy in WASM
    const entropyAccumulator =
      entropyOverride && entropyOverride.length === 32
        ? entropyOverride
        : this.entropyService.getEntropyAccumulator()

    if (entropyAccumulator.length !== 32) {
      return safeError(
        new Error(
          `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
        ),
      )
    }

    // Decode preimage blob to get code and bitmask for instruction decoding
    // Follow the same flow as WASM: decodeProgramFromPreimage → decodeBlob(code)
    // This matches what initializeProgram does in AssemblyScript
    const [programError, programResult] =
      decodeProgramFromPreimage(preimageBlob)
    if (programError || !programResult) {
      return safeError(
        new Error(
          `Failed to decode program from preimage: ${programError?.message}`,
        ),
      )
    }

    // The code field from decodeProgramFromPreimage is the instruction data blob in deblob format
    // Decode it as deblob format to get bitmask and jump table (same as WASM initializeProgram)
    const [decodeError, decoded] = decodeBlob(programResult.value.code)
    if (decodeError || !decoded) {
      return safeError(
        new Error(
          `Failed to decode code as deblob format: ${decodeError?.message}`,
        ),
      )
    }
    const { code, bitmask } = decoded.value

    // Extend code with zeros (Gray Paper: ζ ≡ c ⌢ [0, 0, . . . ])
    const extendedCode = new Uint8Array(code.length + 16)
    extendedCode.set(code)
    extendedCode.fill(0, code.length)

    // Extend bitmask with ones (for final instruction)
    const extendedBitmask = new Uint8Array(bitmask.length + 25)
    extendedBitmask.set(bitmask)
    extendedBitmask.fill(1, bitmask.length)

    this.code = extendedCode
    this.bitmask = extendedBitmask

    // Encode accumulate inputs sequence for FETCH host function (selectors 14 and 15)
    const inputsToEncode = _inputs && _inputs.length > 0 ? _inputs : []
    const [encodeError, encoded] = encodeVariableSequence(
      inputsToEncode,
      encodeAccumulateInput,
    )
    if (encodeError || !encoded) {
      return safeError(
        new Error(
          `Failed to encode accumulate inputs: ${encodeError?.message}`,
        ),
      )
    }
    const encodedAccumulateInputs = encoded

    // Set up accumulation invocation with config parameters
    this.wasm.setupAccumulateInvocation(
      Number(gasLimit),
      preimageBlob,
      encodedArgs,
      encodedContext,
      numCores,
      numValidators,
      authQueueSize,
      entropyAccumulator,
      encodedAccumulateInputs,
      this.configService.numCores,
      this.configService.preimageExpungePeriod,
      this.configService.epochDuration,
      BigInt(this.configService.maxBlockGas),
      BigInt(this.configService.maxRefineGas),
      this.configService.maxTicketsPerExtrinsic,
      this.configService.ticketsPerValidator,
      Math.floor(this.configService.slotDuration / 1000), // Convert from milliseconds to seconds
      this.configService.rotationPeriod,
      this.configService.numValidators,
      this.configService.numEcPiecesPerSegment,
      this.configService.contestDuration,
      this.configService.maxLookupAnchorage,
      this.configService.ecPieceSize,
      this.configService.jamVersion.major,
      this.configService.jamVersion.minor,
      this.configService.jamVersion.patch,
    )

    // Clear execution logs at the start of each execution run
    this.executionLogs = []
    this.traceHostFunctionLogs = []

    // Get WASM's code and bitmask arrays after first step (they're extended in run())
    let wasmCode: Uint8Array | null = null
    let wasmBitmask: Uint8Array | null = null

    // Execute step-by-step until completion
    const initialGas = gasLimit
    let steps = 0
    const maxSteps = this.configService.maxBlockGas

    while (steps < maxSteps) {
      const pcBefore = BigInt(this.wasm.getProgramCounter())
      const gasBefore = BigInt(this.wasm.getGasLeft())

      // On first step, get WASM code/bitmask arrays (they're extended in run())
      if (steps === 0 && this.wasm.getCode && this.wasm.getBitmask) {
        wasmCode = this.wasm.getCode()
        wasmBitmask = this.wasm.getBitmask()
      }

      // Decode instruction at PC BEFORE step to check if it's ECALLI
      const codeArray = wasmCode || this.code
      const bitmaskArray = wasmBitmask || this.bitmask
      const pcIndex = Number(pcBefore)
      let isEcalli = false
      let hostCallId: bigint | null = null

      if (
        pcIndex >= 0 &&
        pcIndex < codeArray.length &&
        pcIndex < bitmaskArray.length
      ) {
        if (bitmaskArray[pcIndex] === 1) {
          const instructionOpcode = codeArray[pcIndex]
          // ECALLI opcode is 10 (0x0A)
          if (instructionOpcode === 10) {
            isEcalli = true
            // Extract host call ID from instruction operands (Gray Paper: immed_X from ECALLI)
            // Gray Paper pvm.tex §7.4.1: l_X = min(4, ℓ), immed_X = sext(l_X, decode[l_X](instructions[i+1:i+1+l_X]))
            // For ECALLI, we need to calculate Fskip to get the operand length
            // Fskip(i) = min(24, j ∈ N : (k ∥ {1,1,...})_{i+1+j} = 1)
            let fskip = -1 // -1 means "not found yet"
            for (
              let j = 0;
              j < 24 && pcIndex + 1 + j < bitmaskArray.length;
              j++
            ) {
              if (bitmaskArray[pcIndex + 1 + j] === 1) {
                fskip = j
                break
              }
            }
            // If we didn't find a 1 in the bitmask, use the remaining code length
            // This only applies when we scanned the full 24 bytes without finding a 1
            if (fskip === -1 && pcIndex + 1 < codeArray.length) {
              fskip = Math.min(24, codeArray.length - pcIndex - 1)
            } else if (fskip === -1) {
              fskip = 0
            }
            // Extract operands (Gray Paper: operands are at instructions[i+1:i+1+l_X])
            // For ECALLI, the immediate is typically just 1 byte (host function IDs are 0-26)
            // Gray Paper: l_X = min(4, ℓ), where ℓ = fskip
            // Gray Paper pvm.tex line 251-255: If l_X=0 (no operand bytes), immed_X defaults to 0
            if (fskip > 0) {
              const operandStart = pcIndex + 1
              if (operandStart < codeArray.length) {
                // Read the first byte (host function ID)
                hostCallId = BigInt(codeArray[operandStart])
              }
            } else {
              // No operand bytes - host call ID defaults to 0
              // This matches TypeScript executor behavior
              hostCallId = 0n
            }
          }
        }
      }

      // Clear last memory operation tracking before step (JIP-6 trace support)
      this.wasm.clearLastMemoryOp()

      // Execute one step
      const shouldContinue = this.wasm.nextStep()
      steps++

      // Capture load/store values after step (JIP-6 trace support)
      const loadAddress = this.wasm.getLastLoadAddress()
      const loadValue = this.wasm.getLastLoadValue()
      const storeAddress = this.wasm.getLastStoreAddress()
      const storeValue = this.wasm.getLastStoreValue()

      // Get state after step (for trace logging)
      const gasAfter = BigInt(this.wasm.getGasLeft())
      const registersAfter = this.wasm.getRegisters()
      const registerStateAfter: bigint[] = []
      const registerViewAfter = new DataView(registersAfter.buffer)
      for (let i = 0; i < 13; i++) {
        registerStateAfter[i] = registerViewAfter.getBigUint64(i * 8, true)
      }

      // Get status after step (needed for host function detection and loop control)
      const status = this.wasm.getStatus()

      // If this was an ECALLI, log the host function call
      // Note: Host functions are handled internally in AssemblyScript during accumulation,
      // so status might not be HOST (4) - it could be OK (0) or HALT (1) after handling.
      // We detect host function calls by checking if ECALLI was executed.
      if (isEcalli && hostCallId !== null) {
        // Host call ID was extracted from instruction operands above (Gray Paper: immed_X from ECALLI)
        // Log host function call (for trace comparison with TypeScript)
        // Even if status is not HOST (4), we still log it because the host function
        // was handled internally and execution continued
        //
        // Note: We use gasBefore - 1n to match TypeScript's behavior:
        // TypeScript captures gasBefore INSIDE the context mutator, which is called
        // AFTER the 1-gas instruction cost is deducted in step(). So gasBefore
        // in TypeScript is actually after the instruction cost.
        // WASM captures gasBefore BEFORE nextStep(), which includes both the
        // instruction cost and host function cost.
        // By subtracting 1n, we align with TypeScript's "gasBefore" value.
        this.traceHostFunctionLogs.push({
          step: steps,
          hostCallId,
          gasBefore: gasBefore - 1n, // Subtract 1 gas for instruction cost to match TypeScript
          gasAfter,
          serviceId,
        })
      }

      let instructionName = 'UNKNOWN'
      let opcode = '0x00'

      if (
        pcIndex >= 0 &&
        pcIndex < codeArray.length &&
        pcIndex < bitmaskArray.length
      ) {
        if (bitmaskArray[pcIndex] === 1) {
          const instructionOpcode = codeArray[pcIndex]
          const handler = this.instructionRegistry.getHandler(
            BigInt(instructionOpcode),
          )
          instructionName = handler?.name ?? 'UNKNOWN'
          opcode = `0x${instructionOpcode.toString(16)}`
        } else {
          instructionName = 'INVALID_POSITION'
          opcode = `0x${codeArray[pcIndex]?.toString(16) || 'undefined'}`
        }
      }

      // Log execution step with PC before instruction execution
      // This shows where the instruction was executed, not where it jumped to
      this.executionLogs.push({
        step: steps,
        pc: pcBefore,
        instructionName,
        opcode,
        gas: gasAfter,
        registers: registerStateAfter.map((r) => r.toString()),
        // JIP-6 trace support: load/store tracking
        loadAddress,
        loadValue,
        storeAddress,
        storeValue,
      })

      // Check if execution should stop
      // Host function calls are now handled internally in AssemblyScript,
      // but nextStep() returns false for HOST status, so we need to continue manually
      // Status enum from wasm-wrapper.ts (different from internal RESULT_CODES!):
      // OK = 0, HALT = 1, PANIC = 2, FAULT = 3, HOST = 4, OOG = 5
      if (!shouldContinue) {
        // If status is HOST (4), we should continue execution after the host function
        // Host functions are handled internally, so we resume execution by calling nextStep() again
        if (status === 4) {
          // HOST status - host function was called, continue execution
          // The host function has been handled internally, so we continue the loop
          // Note: We don't increment steps here because we already did above
          continue
        }
        // Otherwise, execution stopped (halted, panicked, OOG)
        break
      }

      // Status 0 = OK, continue execution
      // Status 4 = HOST (handled internally in AssemblyScript, execution continues automatically)
      if (status !== 0 && status !== 4) {
        // Non-zero status that's not OK or HOST means halt/panic/OOG
        break
      }
    }

    const finalGas = BigInt(this.wasm.getGasLeft())
    const status = this.wasm.getStatus()

    // Calculate gas consumed based on status
    // Gray Paper equation 834: u = gascounter - max(gascounter', 0)
    // For OOG (status === 5): All gas is consumed, including what was left before the failed operation
    // This matches TypeScript behavior where gasCounter is decremented before OOG check
    let gasConsumed: bigint
    if (status === 5) {
      // OOG: All initial gas is consumed
      gasConsumed = initialGas
    } else {
      // Normal execution: subtract remaining gas
      gasConsumed = initialGas - (finalGas > 0n ? finalGas : 0n)
    }

    // Determine result
    // Status enum from wasm-wrapper.ts:
    // OK = 0, HALT = 1, PANIC = 2, FAULT = 3, HOST = 4, OOG = 5
    // Gray Paper: instruction-level FAULT (e.g. write to read-only region) leads to invocation panic.
    let result: Uint8Array | 'PANIC' | 'OOG'
    if (status === 5) {
      // OOG
      result = 'OOG'
    } else if (status === 2 || status === 3) {
      // PANIC (2) or FAULT (3) → treat as PANIC for accumulation (invocation panics)
      result = 'PANIC'
    } else {
      // HALT or OK - extract result from memory using registers[7] and registers[8]
      // Gray Paper equation 831: When HALT, read result blob from memory
      // Note: For accumulation, even OK status means successful completion
      const rawResult = this.wasm.getResult()
      // Handle case where WASM returns undefined/null instead of empty array
      // AssemblyScript loader returns null for null pointers
      if (!rawResult || !(rawResult instanceof Uint8Array)) {
        result = new Uint8Array(0)
      } else {
        result = rawResult
      }
    }

    // Update state
    this.updateStateFromWasm()

    // Get the updated implications from WASM after execution
    // This is critical for host functions like SOLICIT that modify service account state
    const updatedEncodedContext = this.wasm.getAccumulationContext(
      numCores,
      numValidators,
      authQueueSize,
    )

    let updatedContext: ImplicationsPair = implicationsPair
    if (updatedEncodedContext && updatedEncodedContext.length > 0) {
      const [decodeError, decodeResult] = decodeImplicationsPair(
        updatedEncodedContext,
        this.configService,
      )
      if (!decodeError && decodeResult) {
        updatedContext = decodeResult.value
      } else {
        logger.warning(
          `[WasmPVMExecutor] Failed to decode updated implications: ${decodeError?.message}`,
        )
      }
    } else {
      logger.warning(
        `[WasmPVMExecutor] No updated implications from WASM (updatedEncodedContext.length=${updatedEncodedContext?.length ?? 0})`,
      )
    }

    // Only write trace dump if traceSubfolder is configured (enables trace dumping)
    // When traceSubfolder is undefined, trace dumping is disabled
    // NOTE: Trace dump must be written AFTER context decoding to extract yieldHash
    if (this.executionLogs.length > 0 && this.traceSubfolder) {
      // Write to pvm-traces folder in workspace root
      // traceSubfolder is provided, write to pvm-traces/{traceSubfolder}/
      const baseTraceDir = join(this.workspaceRoot, 'pvm-traces')
      const traceOutputDir = join(baseTraceDir, this.traceSubfolder)

      const [encodeError, encodedInputs] = encodeVariableSequence(
        _inputs,
        encodeAccumulateInput,
      )

      // Determine error code based on status (same as TypeScript executor)
      // WASM status enum: OK = 0, HALT = 1, PANIC = 2, FAULT = 3, HOST = 4, OOG = 5
      // Error codes for trace files match Gray Paper: HALT = 0, PANIC = 1, FAULT = 2, HOST = 3, OOG = 4
      let errorCode: number | undefined
      if (status === 2) {
        // PANIC
        errorCode = RESULT_CODES.PANIC
      } else if (status === 3) {
        // FAULT (e.g. write to read-only region)
        errorCode = RESULT_CODES.FAULT
      } else if (status === 5) {
        // OOG (WASM status 5, not 4!)
        errorCode = RESULT_CODES.OOG
      }
      // If status is 1 (HALT), it's success - no error code

      // Extract yield based on Gray Paper collapse rules (same as TypeScript executor):
      // 1. If result is PANIC/OOG: use imY.yield (exceptional dimension)
      // 2. If result is 32-byte blob: use resultBlob as yield (not imX.yield)
      // 3. Otherwise: use imX.yield
      let yieldHash: Uint8Array | null | undefined
      if (result === 'PANIC' || result === 'OOG') {
        // Gray Paper: When o ∈ {oog, panic}, use imY.yield
        yieldHash = updatedContext?.[1]?.yield ?? undefined
      } else if (result instanceof Uint8Array && result.length === 32) {
        // Gray Paper: When o ∈ hash (32-byte blob), use the result blob as yield
        yieldHash = result
      } else {
        // Gray Paper: Otherwise use imX.yield
        yieldHash = updatedContext?.[0]?.yield ?? undefined
      }

      const filepath = writeTraceDump(
        this.executionLogs,
        this.traceHostFunctionLogs.length > 0
          ? this.traceHostFunctionLogs
          : undefined,
        traceOutputDir,
        undefined,
        timeslot, // blockNumber
        'wasm', // executorType - generates wasm-{slot}-{serviceId}.log format
        serviceId, // serviceId - included to prevent file collisions
        encodeError ? undefined : encodedInputs, // accumulate_input (same as TypeScript)
        invocationIndex ?? 0, // invocation index (same as TypeScript)
        yieldHash, // accumulate output (yield hash, same as TypeScript)
        errorCode, // error code for PANIC/OOG
      )
      if (!filepath) {
        logger.warning(
          `[WasmPVMExecutor] Failed to write trace dump (executionLogs.length=${this.executionLogs.length})`,
        )
      }
    } else {
      logger.warning(
        `[WasmPVMExecutor] No execution logs to write (executionLogs.length=${this.executionLogs.length}, steps=${steps})`,
      )
    }

    return safeResult({
      gasConsumed,
      result,
      context: updatedContext,
    })
  }

  getState(): PVMState {
    if (!this.currentState) {
      this.updateStateFromWasm()
    }
    return this.currentState!
  }

  get state(): PVMState {
    return this.getState()
  }

  private updateStateFromWasm(): void {
    if (!this.wasm) {
      return
    }

    const registers = this.wasm.getRegisters()
    const registerState: bigint[] = []
    const registerView = new DataView(registers.buffer)
    for (let i = 0; i < 13; i++) {
      registerState[i] = registerView.getBigUint64(i * 8, true)
    }

    // Create minimal PVMState with required fields
    this.currentState = {
      instructions: new Map<number, PVMInstruction>(),
      resultCode: 0 as ResultCode,
      programCounter: BigInt(this.wasm.getProgramCounter()),
      registerState,
      ram: null as unknown as RAM, // RAM state not directly accessible from WASM
      gasCounter: this.wasm.getGasLeft(),
      jumpTable: [],
      code: new Uint8Array(0),
      bitmask: new Uint8Array(0),
      faultAddress: null,
      hostCallId: null,
    }
  }

  /**
   * Release internal memory (WASM instance and mutable state).
   * Call before dropping the executor so WASM linear memory can be GC'd.
   */
  dispose(): void {
    this.wasm = null
    this.currentState = null
    this.executionLogs = []
    this.traceHostFunctionLogs = []
    this.code = new Uint8Array(0)
    this.bitmask = new Uint8Array(0)
  }
}
