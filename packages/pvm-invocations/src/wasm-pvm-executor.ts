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
import { safeError, safeResult } from '@pbnjam/types'
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
  private initializationPromise: Promise<void> | null = null

  private currentState: PVMState | null = null
  private executionLogs: Array<{
    step: number
    pc: bigint
    instructionName: string
    opcode: string
    gas: bigint
    registers: string[]
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
    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : dirname(fileURLToPath(import.meta.url))

    // Go up from src/ to packages/, then to pvm-assemblyscript/build/pvm.wasm
    // currentDir = packages/pvm-invocations/src/
    // .. = packages/pvm-invocations/
    // ../.. = packages/
    // ../../.. = workspace root
    const packagesDir = join(currentDir, '..', '..')
    this.workspaceRoot = join(packagesDir, '..')
    this.traceSubfolder = traceSubfolder

    // Try to load from pvm-assemblyscript build directory first
    // Path: packages/pvm-assemblyscript/build/pvm.wasm
    const buildWasmPath = join(
      packagesDir,
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
    this.wasmModuleBytes = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength,
    )

    this.configService = configService
    this.entropyService = entropyService
  }

  /**
   * Ensure WASM module is initialized (lazy initialization)
   */
  private async ensureInitialized(): Promise<void> {
    if (this.wasm) {
      return
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    // Start initialization
    this.initializationPromise = (async () => {
      // Instantiate WASM module using wasmAsInit
      const wasm = await instantiate(this.wasmModuleBytes, {})

      // Initialize PVM with PVMRAM
      wasm.init(wasm.RAMType.PVMRAM)

      this.wasm = wasm
    })()

    await this.initializationPromise
  }

  /**
   * Force re-instantiation of WASM module
   * This ensures completely fresh state between invocations
   */
  private async reinitializeWasm(): Promise<void> {
    // Clear existing module
    this.wasm = null
    this.initializationPromise = null

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
    const entropyAccumulator = this.entropyService.getEntropyAccumulator()

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
    // Always encode the sequence, even if empty (to match Rust reference expectations)
    // An empty sequence is encoded as: encode(0) = 0x00 (length prefix for 0 items)
    // Gray Paper pvm_invocations.tex lines 359-360: i = sequence{accinput}
    const inputsToEncode = _inputs && _inputs.length > 0 ? _inputs : []
    const [encodeError, encoded] = encodeVariableSequence(
      inputsToEncode,
      encodeAccumulateInput,
    )
    if (encodeError || !encoded) {
      return safeError(
        new Error(`Failed to encode accumulate inputs: ${encodeError?.message}`),
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
      this.configService.slotDuration,
      this.configService.rotationPeriod,
      this.configService.numValidators,
      this.configService.numEcPiecesPerSegment,
      this.configService.contestDuration,
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
            let fskip = 0
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
            if (fskip === 0 && pcIndex + 1 < codeArray.length) {
              fskip = Math.min(24, codeArray.length - pcIndex - 1)
            }
            // Extract operands (Gray Paper: operands are at instructions[i+1:i+1+l_X])
            // For ECALLI, the immediate is typically just 1 byte (host function IDs are 0-26)
            // Gray Paper: l_X = min(4, ℓ), but for host function IDs, it's just 1 byte
            const operandStart = pcIndex + 1
            if (operandStart < codeArray.length) {
              // Read the first byte (host function ID)
              hostCallId = BigInt(codeArray[operandStart])
            }
          }
        }
      }

      // Execute one step
      const shouldContinue = this.wasm.nextStep()
      steps++

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
        this.traceHostFunctionLogs.push({
          step: steps,
          hostCallId,
          gasBefore,
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
      })

      // Check if execution should stop
      // Host function calls are now handled internally in AssemblyScript,
      // but nextStep() returns false for HOST status, so we need to continue manually
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
    const gasConsumed = initialGas - (finalGas > 0n ? finalGas : 0n)
    const status = this.wasm.getStatus()

    // Determine result
    let result: Uint8Array | 'PANIC' | 'OOG'
    if (status === 5) {
      // OOG
      result = 'OOG'
    } else if (status === 2) {
      // PANIC
      result = 'PANIC'
    } else {
      // HALT - extract result from memory
      // TODO: Read result from memory using registers[7] and registers[8]
      result = new Uint8Array(0)
    }

    // Update state
    this.updateStateFromWasm()

    if (this.executionLogs.length > 0) {
      // Write to pvm-traces folder in workspace root
      // If traceSubfolder is provided, write to pvm-traces/{traceSubfolder}/
      const baseTraceDir = join(this.workspaceRoot, 'pvm-traces')
      const traceOutputDir = this.traceSubfolder
        ? join(baseTraceDir, this.traceSubfolder)
        : baseTraceDir
      // For block-based traces (like preimages-light-all-blocks.test.ts), use jamduna format (00000043.log)
      // Don't pass executorType to get jamduna format when blockNumber is provided
      // For comparison traces, pass executorType to get trace-wasm-{serviceId}-{timestamp}.log format
      // Since we always have timeslot (block number), we use jamduna format by default
      // If trace format is needed, it can be enabled via a flag or by not passing timeslot
      // Include serviceId to avoid collisions when multiple services execute in the same slot
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
      )
      if (!filepath) {
        console.warn(
          `[WasmPVMExecutor] Failed to write trace dump (executionLogs.length=${this.executionLogs.length})`,
        )
      }
    } else {
      console.warn(
        `[WasmPVMExecutor] No execution logs to write (executionLogs.length=${this.executionLogs.length}, steps=${steps})`,
      )
    }

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
        console.warn(
          `[WasmPVMExecutor] Failed to decode updated implications: ${decodeError?.message}`,
        )
      }
    } else {
      console.warn(
        `[WasmPVMExecutor] No updated implications from WASM (updatedEncodedContext.length=${updatedEncodedContext?.length ?? 0})`,
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
}
