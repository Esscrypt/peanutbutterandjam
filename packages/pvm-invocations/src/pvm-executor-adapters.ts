/**
 * PVM Executor Adapters
 * 
 * Provides adapters for both TypeScript and WASM PVM implementations
 * to implement the common IPVMExecutor interface.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeImplicationsPair } from '@pbnj/codec'
import {
  type AccumulateHostFunctionRegistry,
  type HostFunctionRegistry,
  PVM,
} from '@pbnj/pvm'
import type {
  AccumulateInput,
  ContextMutator,
  FetchParams,
  HostFunctionContext,
  HostFunctionResult,
  IConfigService,
  IEntropyService,
  ImplicationsPair,
  InfoParams,
  LookupParams,
  PVMInstruction,
  PVMOptions,
  PVMState,
  RAM,
  ResultCode,
  SafePromise,
  ServiceAccount,
  WorkItem,
  WriteParams,
} from '@pbnj/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnj/types'
// Import types that aren't exported from main index - use relative path to source
import { ACCUMULATE_ERROR_CODES } from '../../pvm/src/config'
import type { AccumulateHostFunctionContext } from '../../pvm/src/host-functions/accumulate/base'
import { instantiate } from './wasmAsInit'


/**
 * TypeScript PVM Adapter
 * 
 * Extends the TypeScript PVM implementation to provide accumulation invocation support.
 */
export class TypeScriptPVMExecutor extends PVM {
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService

  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry,
    configService: IConfigService,
    entropyService: IEntropyService,
    pvmOptions?: PVMOptions,
  ) {
    super(hostFunctionRegistry, pvmOptions)
    this.accumulateHostFunctionRegistry = accumulateHostFunctionRegistry
    this.configService = configService
    this.entropyService = entropyService
  }

  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
    inputs: AccumulateInput[],
    workItems: WorkItem[],
    serviceId: bigint,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    // Create accumulate context mutator F
    const accumulateContextMutator = this.createAccumulateContextMutator(
      timeslot,
      implicationsPair,
      inputs,
      workItems,
    )

    // Execute Ψ_M(c, 5, g, encode(t, s, len(i)), F, I(postxferstate, s)^2)
    const [error, marshallingResult] = await this.executeMarshallingInvocation(
      preimageBlob,
      5n, // Initial PC = 5 (Gray Paper)
      gasLimit,
      encodedArgs,
      accumulateContextMutator,
      implicationsPair,
      true, // buildPanicDump
      serviceId, // serviceId for panic dump and host function logs
      true, // writeHostFunctionLogs
    )

    if (error || !marshallingResult) {
      return safeError(
        error || new Error('Marshalling invocation returned no result'),
      )
    }

    return safeResult({
      gasConsumed: marshallingResult.gasConsumed,
      result: marshallingResult.result,
      context: marshallingResult.context as ImplicationsPair,
    })
  }

  /**
   * Create accumulate context mutator F
   * Gray Paper equation 187-211: F ∈ contextmutator{implicationspair}
   */
  private createAccumulateContextMutator(
    timeslot: bigint,
    implicationsPair: ImplicationsPair,
    _inputs: AccumulateInput[],
    workItems: WorkItem[],
  ): ContextMutator {
    return (hostCallId: bigint) => {
      // Gray Paper: Apply gas cost (10 gas for all host functions)
      const gasCost = 10n
      if (this.state.gasCounter < gasCost) {
        return RESULT_CODES.OOG
      }

      this.state.gasCounter -= gasCost

      // Try accumulate host functions first (14-26)
      if (hostCallId >= 14n && hostCallId <= 26n) {
        return this.handleAccumulateHostFunction(
          hostCallId,
          implicationsPair,
          timeslot,
        )
      }

      // General host functions available in accumulate context (0-5)
      // Also include log (100) - JIP-1 debug/monitoring function
      if ((hostCallId >= 0n && hostCallId <= 5n) || hostCallId === 100n) {
        return this.handleGeneralHostFunction(hostCallId, implicationsPair, workItems)
      }

      return null
    }
  }

  private handleAccumulateHostFunction(
    hostCallId: bigint,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
  ): ResultCode | null {
    const hostFunction = this.accumulateHostFunctionRegistry.get(hostCallId)
    if (!hostFunction) {
      return null
    }

    const accumulateHostFunctionLog = (
      _message: string,
      _data?: Record<string, unknown>,
    ) => {
      // Logging handled by PVM's host function logs
    }

    const hostFunctionContext: AccumulateHostFunctionContext = {
      gasCounter: this.state.gasCounter,
      registers: this.state.registerState,
      ram: this.state.ram,
      implications: implicationsPair,
      timeslot,
      expungePeriod: BigInt(this.configService.preimageExpungePeriod),
      log: accumulateHostFunctionLog,
    }

    const result = hostFunction.execute(hostFunctionContext)
    return result.resultCode
  }

  private handleGeneralHostFunction(
    hostCallId: bigint,
    implicationsPair: ImplicationsPair,
    workItems: WorkItem[],
  ): ResultCode | null {
    const hostFunction = this.hostFunctionRegistry.get(hostCallId)
    if (!hostFunction) {
      return null
    }

    const generalHostFunctionLog = (
      _message: string,
      _data?: Record<string, unknown>,
    ) => {
      // Logging handled by PVM's host function logs
    }

    const hostFunctionContext: HostFunctionContext = {
      gasCounter: this.state.gasCounter,
      registers: this.state.registerState,
      ram: this.state.ram,
      log: generalHostFunctionLog,
    }

    let result: HostFunctionResult | null = null
    switch (hostCallId) {
      case 0n: {
        // gas
        result = hostFunction.execute(hostFunctionContext, null)
        break
      }
      case 1n: {
        // fetch
        const fetchParams = this.buildFetchParams(workItems)
        result = hostFunction.execute(hostFunctionContext, fetchParams)
        break
      }
      case 2n: {
        // lookup
        const lookupParams = this.buildLookupParams(implicationsPair)
        result = hostFunction.execute(hostFunctionContext, lookupParams)
        break
      }
      case 3n: {
        // read
        const readParams = this.buildReadParams(implicationsPair)
        result = hostFunction.execute(hostFunctionContext, readParams)
        break
      }
      case 4n: {
        // write
        const writeParams = this.buildWriteParams(implicationsPair)
        result = hostFunction.execute(hostFunctionContext, writeParams)
        break
      }
      case 5n: {
        // info
        const infoParams = this.buildInfoParams(implicationsPair)
        result = hostFunction.execute(hostFunctionContext, infoParams)
        break
      }
      case 100n: {
        // log (JIP-1)
        const logParams = {
          serviceId: implicationsPair[0].id,
          coreIndex: null,
        }
        result = hostFunction.execute(hostFunctionContext, logParams)
        break
      }
      default: {
        this.state.registerState[7] = ACCUMULATE_ERROR_CODES.WHAT
        return null
      }
    }

    return result?.resultCode ?? null
  }

  private buildFetchParams(workItems: WorkItem[]): FetchParams {
    const workItemsSequence = workItems.length > 0 ? workItems : null

    return {
      workPackage: null,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      workItemsSequence,
      entropyService: this.entropyService,
    }
  }

  private buildReadParams(implicationsPair: ImplicationsPair): {
    serviceAccount: ServiceAccount
    serviceId: bigint
    accounts: Map<bigint, ServiceAccount>
  } {
    const imX = implicationsPair[0]
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      throw new Error(`Service account not found for read: ${imX.id.toString()}`)
    }
    return {
      serviceAccount,
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }

  private buildWriteParams(implicationsPair: ImplicationsPair): WriteParams {
    const imX = implicationsPair[0]
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      throw new Error(`Service account not found for write: ${imX.id.toString()}`)
    }
    return {
      serviceAccount,
      serviceId: imX.id,
    }
  }

  private buildLookupParams(implicationsPair: ImplicationsPair): LookupParams {
    const imX = implicationsPair[0]
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      throw new Error(
        `Service account not found for lookup: ${imX.id.toString()}`,
      )
    }
    return {
      serviceAccount,
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }

  private buildInfoParams(implicationsPair: ImplicationsPair): InfoParams {
    const imX = implicationsPair[0]
    return {
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }
}

/**
 * WASM PVM Adapter
 * 
 * Wraps the WASM PVM implementation to implement IPVMExecutor.
 * 
 * Supports both generic marshalling invocations and accumulation-specific invocations.
 * 
 * The WASM module is loaded from a file path in the constructor and initialized on first use.
 */
/**
 * WASM module exports type from instantiate function
 */
type WasmModule = Awaited<ReturnType<typeof instantiate>>

export class WasmPVMExecutor {
  private wasm: WasmModule | null = null
  private readonly wasmModuleBytes: ArrayBuffer
  private readonly configService?: IConfigService
  private readonly entropyService?: IEntropyService
  private initializationPromise: Promise<void> | null = null

  private currentState: PVMState | null = null

  /**
   * Create a new WasmPVMExecutor instance
   * 
   * The WASM module is loaded from the file path in the constructor and will be instantiated
   * on first use (lazy initialization).
   * 
   * @param wasmPath - Path to WASM module file (relative to package root or absolute)
   * @param configService - Configuration service (required for accumulation invocations)
   * @param entropyService - Entropy service (required for accumulation invocations)
   * @param _hostFunctionRegistry - Host function registry (optional, not used in WASM mode)
   */
  constructor(
    wasmPath: string,
    configService?: IConfigService,
    entropyService?: IEntropyService,
    _hostFunctionRegistry?: HostFunctionRegistry,
  ) {
    // Load WASM file from path
    // Resolve path relative to this file's directory (src/)
    const currentDir = typeof __dirname !== 'undefined'
      ? __dirname
      : dirname(fileURLToPath(import.meta.url))
    
    // Resolve relative to src/ directory (e.g., 'wasm/pvm.wasm' -> 'src/wasm/pvm.wasm')
    const resolvedPath = wasmPath.startsWith('/')
      ? wasmPath // Absolute path
      : join(currentDir, wasmPath) // Relative to src/

    // Read WASM file
    const wasmBytes = readFileSync(resolvedPath)
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

    // Set up accumulation invocation
    // Note: setupAccumulateInvocation in wasmAsInit.ts doesn't take entropyAccumulator
    // It's handled internally by the WASM module
    try {
      this.wasm.setupAccumulateInvocation(
        Number(gasLimit),
        preimageBlob,
        encodedArgs,
        encodedContext,
        numCores,
        numValidators,
        authQueueSize,
      )
    } catch (error) {
      return safeError(
        new Error(
          `Failed to setup accumulation invocation: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      )
    }

    // Execute step-by-step until completion
    const initialGas = gasLimit
    let steps = 0
    const maxSteps = 1_000_000 // Safety limit

    while (steps < maxSteps) {
      const shouldContinue = this.wasm.nextStep()
      steps++

      const status = this.wasm.getStatus()
      if (!shouldContinue || status !== 0) {
        // Execution stopped (halted, panicked, OOG, or host call)
        break
      }

      // TODO: Handle host function calls (status === 4) via contextMutator
      // For now, we continue execution
    }

    const finalGas = this.wasm.getGasLeft()
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

