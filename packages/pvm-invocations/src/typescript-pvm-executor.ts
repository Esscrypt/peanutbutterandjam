/**
 * TypeScript PVM Executor
 *
 * Extends the TypeScript PVM implementation to provide accumulation invocation support.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeAccumulateInput, encodeVariableSequence } from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import {
  type AccumulateHostFunctionRegistry,
  type HostFunctionRegistry,
  PVM,
  writeTraceDump,
} from '@pbnjam/pvm'
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
  PVMOptions,
  ResultCode,
  SafePromise,
  ServiceAccount,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'
// Import types that aren't exported from main index - use relative path to source
import {
  ACCUMULATE_ERROR_CODES,
  ACCUMULATE_FUNCTIONS,
  GENERAL_FUNCTIONS,
} from '../../pvm/src/config'
import type { AccumulateHostFunctionContext } from '../../pvm/src/host-functions/accumulate/base'

/**
 * TypeScript PVM Adapter
 *
 * Extends the TypeScript PVM implementation to provide accumulation invocation support.
 */
export class TypeScriptPVMExecutor extends PVM {
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly configService: IConfigService
  private readonly entropyService: IEntropyService
  private readonly workspaceRoot: string
  private readonly traceSubfolder?: string
  private accumulateInputs: AccumulateInput[] | null = null // Accumulate inputs for FETCH selectors 14 and 15
  private traceHostFunctionLogs: Array<{
    step: number
    hostCallId: bigint
    gasBefore: bigint
    gasAfter: bigint
    serviceId?: bigint
  }> = []
  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry,
    configService: IConfigService,
    entropyService: IEntropyService,
    pvmOptions?: PVMOptions,
    traceSubfolder?: string,
  ) {
    super(hostFunctionRegistry, pvmOptions)
    this.accumulateHostFunctionRegistry = accumulateHostFunctionRegistry
    this.configService = configService
    this.entropyService = entropyService
    // Calculate workspace root (same logic as WasmPVMExecutor)
    const currentDir =
      typeof __dirname !== 'undefined'
        ? __dirname
        : dirname(fileURLToPath(import.meta.url))

    // Go up from src/ to packages/, then to workspace root
    // currentDir = packages/pvm-invocations/src/
    // .. = packages/pvm-invocations/
    // ../.. = packages/
    // ../../.. = workspace root
    const packagesDir = join(currentDir, '..', '..')
    this.workspaceRoot = join(packagesDir, '..')
    this.traceSubfolder = traceSubfolder
  }

  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
    inputs: AccumulateInput[],
    _serviceId: bigint,
    invocationIndex: number, // Invocation index (accseq iteration) for trace file naming - same for all services in a batch
    _entropyOverride?: Uint8Array, // Unused; TS path uses implicationsPair built with override. Kept for executor signature compatibility.
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    context: ImplicationsPair
  }> {
    // Store accumulate inputs for FETCH host function (selectors 14 and 15)
    // Gray Paper pvm_invocations.tex lines 359-360:
    // - Selector 14: encode{var{i}} - returns encoded sequence of AccumulateInputs
    // - Selector 15: encode{i[registers[11]]} - returns single encoded AccumulateInput
    // Gray Paper equation 126: accinput = operandtuple ∪ defxfer
    this.accumulateInputs = inputs.length > 0 ? inputs : []

    // Create accumulate context mutator F
    const accumulateContextMutator = this.createAccumulateContextMutator(
      timeslot,
      implicationsPair,
    )

    // Clear host function logs at the start of each execution run
    this.traceHostFunctionLogs = []

    // Execute Ψ_M(c, 5, g, encode(t, s, len(i)), F, I(postxferstate, s)^2)
    const [error, marshallingResult] = await this.executeMarshallingInvocation(
      preimageBlob,
      5n, // Initial PC = 5 (Gray Paper)
      gasLimit,
      encodedArgs,
      accumulateContextMutator,
      implicationsPair,
    )

    // Write trace dump if we have execution logs AND traceSubfolder is configured
    // When traceSubfolder is undefined, trace dumping is disabled
    const executionLogs = this.getExecutionLogs()
    if (executionLogs.length > 0 && this.traceSubfolder) {
      // Extract yield based on Gray Paper collapse rules:
      // 1. If result is PANIC/OOG: use imY.yield (exceptional dimension)
      // 2. If result is 32-byte blob: use resultBlob as yield (not imX.yield)
      // 3. Otherwise: use imX.yield
      const updatedContext = marshallingResult?.context as
        | ImplicationsPair
        | undefined
      let yieldHash: Uint8Array | null | undefined

      if (
        marshallingResult?.result === 'PANIC' ||
        marshallingResult?.result === 'OOG'
      ) {
        // Gray Paper: When o ∈ {oog, panic}, use imY.yield
        yieldHash = updatedContext?.[1]?.yield ?? undefined
      } else if (
        marshallingResult?.result instanceof Uint8Array &&
        marshallingResult.result.length === 32
      ) {
        // Gray Paper: When o ∈ hash (32-byte blob), use the result blob as yield
        yieldHash = marshallingResult.result
      } else {
        // Gray Paper: Otherwise use imX.yield
        yieldHash = updatedContext?.[0]?.yield ?? undefined
      }

      // Determine error code based on result
      // result is Uint8Array (success), 'PANIC', or 'OOG'
      // Error codes match Gray Paper pvm_invocations.tex section 6.1:
      // HALT = 0, PANIC = 1, FAULT = 2, HOST = 3, OOG = 4
      let errorCode: number | undefined
      if (error) {
        errorCode = RESULT_CODES.PANIC // General error maps to PANIC
      } else if (marshallingResult?.result === 'PANIC') {
        errorCode = RESULT_CODES.PANIC // PANIC = error code 1
      } else if (marshallingResult?.result === 'OOG') {
        errorCode = RESULT_CODES.OOG // OOG = error code 4 (not 2!)
      }
      // If result is Uint8Array, it's a success - no error code

      this.writeTraceDumpWithOutput(
        executionLogs,
        inputs,
        timeslot,
        _serviceId,
        invocationIndex ?? 0,
        yieldHash,
        errorCode,
      )
    }

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
  ): ContextMutator {
    return (hostCallId: bigint) => {
      // Get current step and gas before host function call
      const currentStep = this.executionStep
      const gasBefore = this.state.gasCounter
      const serviceId = implicationsPair[0].id

      // JIP-1: LOG host function (100) costs 0 gas for JAM version 0.7.1
      // For other host functions or versions, use standard 10 gas cost
      const jamVersion = this.configService.jamVersion
      const isLogFunction = hostCallId === GENERAL_FUNCTIONS.LOG
      const isJamVersion071 =
        jamVersion.major === 0 &&
        jamVersion.minor === 7 &&
        jamVersion.patch === 1
      const gasCost = isLogFunction && isJamVersion071 ? 0n : 10n
      const isOOG = gasCost > 0n && this.state.gasCounter < gasCost

      // Log host function call BEFORE execution (even if OOG) so it appears in trace dump
      // This ensures we see which host function was attempted even if it fails
      const hostLogEntry = {
        step: currentStep,
        hostCallId,
        gasBefore,
        gasAfter: isOOG
          ? this.state.gasCounter
          : gasCost > 0n
            ? this.state.gasCounter - gasCost // Will be updated after execution if not OOG
            : this.state.gasCounter, // LOG costs 0 gas for JAM 0.7.1
        serviceId,
      }
      this.traceHostFunctionLogs.push(hostLogEntry)

      if (isOOG) {
        // Gray Paper: On OOG, all remaining gas is consumed
        this.state.gasCounter = 0n
        return RESULT_CODES.OOG
      }

      // Only deduct gas if gasCost > 0 (LOG costs 0 gas for JAM 0.7.1)
      if (gasCost > 0n) {
        this.state.gasCounter -= gasCost
      }
      // Update gasAfter now that we've deducted the base cost (or not, if gasCost was 0)
      hostLogEntry.gasAfter = this.state.gasCounter

      // Try accumulate host functions first (14-26)
      if (hostCallId >= 14n && hostCallId <= 26n) {
        const result = this.handleAccumulateHostFunction(
          hostCallId,
          implicationsPair,
          timeslot,
        )

        // Update gasAfter after host function execution (even if it panicked or OOG)
        // The host function may consume additional gas beyond the base 10 gas cost
        hostLogEntry.gasAfter = this.state.gasCounter

        // Log panic for debugging
        if (result === RESULT_CODES.PANIC) {
          const hostFunctionName = this.getHostFunctionName(hostCallId)
          logger.error(
            '[TypeScriptPVMExecutor] Accumulate host function PANIC',
            {
              hostFunctionId: hostCallId.toString(),
              hostFunctionName,
              serviceId: serviceId.toString(),
              step: currentStep,
              pc: this.state.programCounter.toString(),
              gasBefore: gasBefore.toString(),
              gasAfter: this.state.gasCounter.toString(),
              registers: this.state.registerState.map((r) => r.toString()),
              faultAddress: this.state.faultAddress?.toString() ?? null,
            },
          )
        }

        return result
      }

      // General host functions available in accumulate context (0-5 only)
      // Gray Paper pvm_invocations.tex line 188-194:
      //   0=gas, 1=fetch, 2=lookup, 3=read, 4=write, 5=info
      // NOTE: 6-13 (historical_lookup, export, machine, peek, poke, pages, invoke, expunge)
      //       are NOT available in accumulation context - only in refine context
      // Also include log (100) - JIP-1 debug/monitoring function
      if ((hostCallId >= 0n && hostCallId <= 5n) || hostCallId === 100n) {
        const result = this.handleGeneralHostFunction(
          hostCallId,
          implicationsPair,
          timeslot,
        )

        // Update gasAfter after host function execution (even if it panicked or OOG)
        // The host function may consume additional gas beyond the base 10 gas cost
        hostLogEntry.gasAfter = this.state.gasCounter

        // Log panic for debugging
        if (result === RESULT_CODES.PANIC) {
          const hostFunctionName = this.getHostFunctionName(hostCallId)
          logger.error('[TypeScriptPVMExecutor] General host function PANIC', {
            hostFunctionId: hostCallId.toString(),
            hostFunctionName,
            serviceId: serviceId.toString(),
            step: currentStep,
            pc: this.state.programCounter.toString(),
            gasBefore: gasBefore.toString(),
            gasAfter: this.state.gasCounter.toString(),
            registers: this.state.registerState.map((r) => r.toString()),
            faultAddress: this.state.faultAddress?.toString() ?? null,
          })
        }

        return result
      }

      // Gray Paper pvm_invocations.tex lines 206-210:
      // Unknown host function in accumulation context:
      // - Gas already deducted (10 gas at line 244-246)
      // - Check if gascounter' < 0 (after deduction)
      // - If yes, return \oog (and set registers'_7 = WHAT)
      // - If no, return \continue (and set registers'_7 = WHAT)
      // - In BOTH cases, set registers'_7 = WHAT
      this.state.registerState[7] = ACCUMULATE_ERROR_CODES.WHAT

      // Check for OOG AFTER deducting gas (Gray Paper: \otherwhen \gascounter' < 0)
      if (this.state.gasCounter < 0n) {
        // Gray Paper: On OOG, all remaining gas is consumed
        this.state.gasCounter = 0n
        hostLogEntry.gasAfter = this.state.gasCounter

        // Log the unknown host function call
        this.traceHostFunctionLogs.push({
          step: currentStep,
          hostCallId,
          gasBefore,
          gasAfter: this.state.gasCounter,
          serviceId,
        })

        return RESULT_CODES.OOG
      }

      // Log the unknown host function call
      this.traceHostFunctionLogs.push({
        step: currentStep,
        hostCallId,
        gasBefore,
        gasAfter: this.state.gasCounter,
        serviceId,
      })

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

    // Deduct additional gas cost if specified (e.g., TRANSFER deducts gas_limit on success)
    // Gray Paper: TRANSFER gas cost is 10 + l on success (base 10 already deducted in context mutator)
    if (
      result.additionalGasCost !== undefined &&
      result.additionalGasCost > 0n
    ) {
      if (this.state.gasCounter < result.additionalGasCost) {
        // Gray Paper: On OOG, all remaining gas is consumed
        this.state.gasCounter = 0n
        return RESULT_CODES.OOG
      }
      this.state.gasCounter -= result.additionalGasCost
    }

    // Log panic for debugging
    if (result.resultCode === RESULT_CODES.PANIC) {
      const hostFunctionName = this.getHostFunctionName(hostCallId)
      logger.error(
        '[TypeScriptPVMExecutor] Accumulate host function PANIC in handler',
        {
          hostFunctionId: hostCallId.toString(),
          hostFunctionName,
          serviceId: implicationsPair[0].id.toString(),
          step: this.executionStep,
          pc: this.state.programCounter.toString(),
          gasCounter: this.state.gasCounter.toString(),
          registers: this.state.registerState.map((r) => r.toString()),
          faultAddress: this.state.faultAddress?.toString() ?? null,
          faultInfo: result.faultInfo,
        },
      )
    }

    return result.resultCode
  }

  private handleGeneralHostFunction(
    hostCallId: bigint,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
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
      serviceId: implicationsPair[0].id,
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
        const fetchParams = this.buildFetchParams()
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
        const infoParams = this.buildInfoParams(implicationsPair, timeslot)
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

    // Log panic for debugging
    if (result?.resultCode === RESULT_CODES.PANIC) {
      const hostFunctionName = this.getHostFunctionName(hostCallId)
      logger.error(
        '[TypeScriptPVMExecutor] General host function PANIC in handler',
        {
          hostFunctionId: hostCallId.toString(),
          hostFunctionName,
          serviceId: implicationsPair[0].id.toString(),
          step: this.executionStep,
          pc: this.state.programCounter.toString(),
          gasCounter: this.state.gasCounter.toString(),
          registers: this.state.registerState.map((r) => r.toString()),
          faultAddress: this.state.faultAddress?.toString() ?? null,
          faultInfo: result.faultInfo,
        },
      )
    }

    return result?.resultCode ?? null
  }

  /**
   * Get host function name from function ID for logging
   */
  private getHostFunctionName(hostCallId: bigint): string {
    // Check general functions
    for (const [name, id] of Object.entries(GENERAL_FUNCTIONS)) {
      if (id === hostCallId) {
        return name.toUpperCase()
      }
    }

    // Check accumulate functions
    for (const [name, id] of Object.entries(ACCUMULATE_FUNCTIONS)) {
      if (id === hostCallId) {
        return name.toUpperCase()
      }
    }

    return `UNKNOWN_${hostCallId.toString()}`
  }

  private buildFetchParams(): FetchParams {
    // Gray Paper pvm_invocations.tex lines 359-360:
    // - Selector 14: encode{var{i}} when i ≠ none - encoded sequence of AccumulateInputs
    // - Selector 15: encode{i[registers[11]]} when i ≠ none - single encoded AccumulateInput
    // Gray Paper equation 126: accinput = operandtuple ∪ defxfer
    //
    // During accumulation, accumulateInputs should always be an array (never null)
    // An empty array [] is distinct from none (null):
    // - [] (empty array) = provided but empty → returns encode(var{[]}) = 0x00
    // - null (none) = not provided → returns none (null)
    // Always pass an array, even if empty, to match Gray Paper specification
    const accumulateInputs = this.accumulateInputs ?? []

    return {
      workPackage: null,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      accumulateInputs,
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
      throw new Error(
        `Service account not found for read: ${imX.id.toString()}`,
      )
    }
    return {
      serviceAccount,
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }

  private buildWriteParams(implicationsPair: ImplicationsPair): {
    serviceAccount: ServiceAccount
    serviceId: bigint
  } {
    const imX = implicationsPair[0]
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      throw new Error(
        `Service account not found for write: ${imX.id.toString()}`,
      )
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

  private buildInfoParams(
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
  ): InfoParams {
    const imX = implicationsPair[0]
    return {
      serviceId: imX.id,
      accounts: imX.state.accounts,
      currentTimeslot: timeslot,
    }
  }

  /**
   * Write trace dump with output/error files for jamduna format
   */
  private writeTraceDumpWithOutput(
    executionLogs: Array<{
      step: number
      pc: bigint
      instructionName: string
      opcode: string
      gas: bigint
      registers: string[]
      loadAddress?: number
      loadValue?: bigint
      storeAddress?: number
      storeValue?: bigint
    }>,
    inputs: AccumulateInput[],
    timeslot: bigint,
    serviceId: bigint,
    invocationIndex: number,
    yieldHash: Uint8Array | undefined,
    errorCode: number | undefined,
  ): void {
    const baseTraceDir = join(this.workspaceRoot, 'pvm-traces')
    const traceOutputDir = join(baseTraceDir, this.traceSubfolder!)

    // Encode full accumulate inputs for comparison with jamduna traces
    const [encodeError, encodedInputs] = encodeVariableSequence(
      inputs,
      encodeAccumulateInput,
    )

    const filepath = writeTraceDump(
      executionLogs,
      this.traceHostFunctionLogs.length > 0
        ? this.traceHostFunctionLogs
        : undefined,
      traceOutputDir,
      undefined,
      timeslot, // blockNumber
      'typescript', // executorType
      serviceId, // serviceId
      encodeError ? undefined : encodedInputs, // accumulate_input
      invocationIndex, // invocation index
      yieldHash, // accumulate output (yield hash)
      errorCode, // error code
    )

    if (!filepath) {
      logger.warn(
        `[TypeScriptPVMExecutor] Failed to write trace dump (executionLogs.length=${executionLogs.length})`,
      )
    }
  }

  /**
   * Release internal mutable state. Call before dropping the executor.
   */
  dispose(): void {
    this.accumulateInputs = null
    this.traceHostFunctionLogs = []
  }
}
