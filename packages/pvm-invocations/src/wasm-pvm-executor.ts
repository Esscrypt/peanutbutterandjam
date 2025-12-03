/**
 * WASM PVM Executor
 * 
 * Wraps the WASM PVM implementation to implement IPVMExecutor.
 * 
 * Supports both generic marshalling invocations and accumulation-specific invocations.
 * 
 * The WASM module is loaded from a file path in the constructor and initialized on first use.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  decodeBlob,
  decodeProgramFromPreimage,
  encodeImplicationsPair,
} from '@pbnj/codec'
import { writeTraceDump } from '@pbnj/pvm'
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
  WorkItem,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
// Import InstructionRegistry directly from registry file
import { InstructionRegistry } from '../../pvm/src/instructions/registry'
import { instantiate } from './wasmAsInit'

/**
 * WASM module exports type from instantiate function
 */
type WasmModule = Awaited<ReturnType<typeof instantiate>>

export class WasmPVMExecutor {
  private wasm: WasmModule | null = null
  private readonly wasmModuleBytes: ArrayBuffer
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService
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
  private readonly instructionRegistry: InstructionRegistry = new InstructionRegistry()
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
   */
  constructor(
    configService: IConfigService,
    entropyService: IEntropyService,
  ) {
    // Resolve path to WASM file in pvm-assemblyscript package
    // Path: packages/pvm-assemblyscript/build/pvm.wasm
    const currentDir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url))
    
    // Go up from src/ to packages/, then to pvm-assemblyscript/build/pvm.wasm
    // currentDir = packages/pvm-invocations/src/
    // .. = packages/pvm-invocations/
    // ../.. = packages/
    const packagesDir = join(currentDir, '..', '..')
    const wasmPath = join(packagesDir, 'pvm-assemblyscript', 'build', 'pvm.wasm')

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
    _workItems: WorkItem[],
    serviceId: bigint,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    await this.ensureInitialized()

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
    const [programError, programResult] = decodeProgramFromPreimage(preimageBlob)
    if (programError || !programResult) {
      return safeError(
        new Error(`Failed to decode program from preimage: ${programError?.message}`),
      )
    }

    // The code field from decodeProgramFromPreimage is the instruction data blob in deblob format
    // Decode it as deblob format to get bitmask and jump table (same as WASM initializeProgram)
    const [decodeError, decoded] = decodeBlob(programResult.value.code)
    if (decodeError || !decoded) {
      return safeError(
        new Error(`Failed to decode code as deblob format: ${decodeError?.message}`),
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
      
      if (pcIndex >= 0 && pcIndex < codeArray.length && pcIndex < bitmaskArray.length) {
        if (bitmaskArray[pcIndex] === 1) {
          const instructionOpcode = codeArray[pcIndex]
          // ECALLI opcode is 10 (0x0A)
          if (instructionOpcode === 10) {
            isEcalli = true
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

      // If this was an ECALLI and status is HOST, log the host function call
      // Note: Host functions are now handled internally in AssemblyScript,
      // but we still log them for trace comparison
      const status = this.wasm.getStatus()
      if (isEcalli && status === 4) {
        // Status 4 = HOST (RESULT_CODE_HOST) - handled internally, execution continues
        // Host call ID is in register[0] after ECALLI
        hostCallId = registerStateAfter[0]
        
        // Log host function call (for trace comparison with TypeScript)
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
      
      if (pcIndex >= 0 && pcIndex < codeArray.length && pcIndex < bitmaskArray.length) {
        if (bitmaskArray[pcIndex] === 1) {
          const instructionOpcode = codeArray[pcIndex]
        const handler = this.instructionRegistry.getHandler(BigInt(instructionOpcode))
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
      // so we just check if execution should continue
      if (!shouldContinue) {
        // Execution stopped (halted, panicked, OOG, or host function returned halt)
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

    // Write trace dump if we have execution logs
    if (this.executionLogs.length > 0) {
      // Use timeslot as block number for jamduna-style filename
      writeTraceDump(
        this.executionLogs,
        this.traceHostFunctionLogs.length > 0 ? this.traceHostFunctionLogs : undefined,
        undefined,
        undefined,
        timeslot,
      )
    }

    // Note: WASM clears accumulationContext after execution, so we return the original context
    // In a full implementation, we would need to decode the updated context from WASM memory
    // For now, we return the original context (it will be updated by the caller if needed)
    return safeResult({
      gasConsumed,
      result,
      context: implicationsPair,
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

