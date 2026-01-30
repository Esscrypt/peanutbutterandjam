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
  ExportParams,
  ExpungeParams,
  FetchParams,
  HistoricalLookupParams,
  HostFunctionContext,
  HostFunctionResult,
  IConfigService,
  IEntropyService,
  ImplicationsPair,
  InfoParams,
  InvokeParams,
  IServiceAccountService,
  LookupParams,
  PVMOptions,
  RefineInvocationContext,
  ResultCode,
  SafePromise,
  ServiceAccount,
  WorkPackage,
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
  private readonly entropyService: IEntropyService | null
  private readonly serviceAccountService: IServiceAccountService | null
  private readonly workspaceRoot: string
  private readonly traceSubfolder?: string
  private accumulateInputs: AccumulateInput[] | null = null // Accumulate inputs for FETCH selectors 14 and 15
  private refineContext: RefineInvocationContext | null = null
  private refineWorkPackage: WorkPackage | null = null
  private refineAuthorizerTrace: Uint8Array | null = null
  private refineImportSegments: Uint8Array[][] | null = null
  private refineExportSegmentOffset = 0n
  private refineServiceAccount: ServiceAccount | null = null
  private refineServiceId: bigint | null = null
  private refineAccounts: Map<bigint, ServiceAccount> | null = null
  private refineLookupAnchorTimeslot = 0n
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
    entropyService: IEntropyService | null,
    serviceAccountService: IServiceAccountService | null,
    pvmOptions?: PVMOptions,
    traceSubfolder?: string,
  ) {
    super(hostFunctionRegistry, pvmOptions)
    this.accumulateHostFunctionRegistry = accumulateHostFunctionRegistry
    this.configService = configService
    this.entropyService = entropyService
    this.serviceAccountService = serviceAccountService
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

  async executeRefinementInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    workPackage: WorkPackage,
    authorizerTrace: Uint8Array,
    importSegments: Uint8Array[][],
    exportSegmentOffset: bigint,
    serviceAccount: ServiceAccount,
    lookupAnchorTimeslot: bigint,
    serviceId?: bigint,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
    exportSegments: Uint8Array[]
  }> {
    if (!this.configService || !this.serviceAccountService) {
      return safeError(
        new Error(
          'ConfigService and ServiceAccountService required for refine invocation',
        ),
      )
    }

    // Store refine invocation parameters for host functions
    this.refineWorkPackage = workPackage
    this.refineAuthorizerTrace = authorizerTrace
    this.refineImportSegments = importSegments
    this.refineExportSegmentOffset = exportSegmentOffset
    this.refineServiceAccount = serviceAccount
    this.refineServiceId = serviceId ?? null
    this.refineAccounts = new Map()
    if (serviceId !== undefined && serviceAccount) {
      this.refineAccounts.set(serviceId, serviceAccount)
    }
    this.refineLookupAnchorTimeslot = lookupAnchorTimeslot

    // Initialize refine context: (∅, ∅) - empty machines dict and empty export segments
    // Gray Paper equation 86: Initialize refine context as empty
    this.refineContext = {
      machines: new Map(),
      exportSegments: [],
    }

    // Create refine context mutator F
    const refineContextMutator = this.createRefineContextMutator()

    // Clear host function logs at the start of each execution run
    this.traceHostFunctionLogs = []

    // Execute Ψ_M(c, 0, w.refgaslimit, encodedArgs, F, (∅, ∅))
    // Gray Paper equation 86: Initial PC = 0 for refine invocation
    const [error, marshallingResult] = await this.executeMarshallingInvocation(
      preimageBlob,
      0n, // Initial PC = 0 (Gray Paper)
      gasLimit,
      encodedArgs,
      refineContextMutator,
      this.refineContext,
    )

    // Extract export segments from updated refine context
    const exportSegments =
      (marshallingResult?.context as RefineInvocationContext | undefined)
        ?.exportSegments ?? []

    // Clear refine invocation parameters
    this.refineWorkPackage = null
    this.refineAuthorizerTrace = null
    this.refineImportSegments = null
    this.refineExportSegmentOffset = 0n
    this.refineServiceAccount = null
    this.refineLookupAnchorTimeslot = 0n
    this.refineContext = null

    if (error || !marshallingResult) {
      return safeError(
        error || new Error('Marshalling invocation returned no result'),
      )
    }

    return safeResult({
      gasConsumed: marshallingResult.gasConsumed,
      result: marshallingResult.result,
      exportSegments,
    })
  }

  /**
   * Execute is-authorized invocation using executeMarshallingInvocation
   * Gray Paper equation 37-38: Ψ_I(workpackage, coreindex) → (blob | workerror, gas)
   *
   * This is the public method that IsAuthorizedPVM should call directly for TypeScript execution.
   * Host functions are handled via the context mutator.
   */
  async executeIsAuthorizedInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    workPackage: WorkPackage,
  ): SafePromise<{
    gasConsumed: bigint
    result: Uint8Array | 'PANIC' | 'OOG'
  }> {
    if (!this.serviceAccountService) {
      return safeError(
        new Error(
          'ServiceAccountService required for is-authorized invocation',
        ),
      )
    }

    // Store work package for FETCH host function
    this.refineWorkPackage = workPackage
    this.refineAuthorizerTrace = null
    this.refineImportSegments = null
    this.refineExportSegmentOffset = 0n
    this.refineServiceAccount = null
    this.refineServiceId = null
    this.refineAccounts = null
    this.refineLookupAnchorTimeslot = workPackage.context.lookup_anchor_slot

    // Create is-authorized context mutator F
    // Gray Paper equation 46-54: F ∈ contextmutator{emptyset}
    const isAuthorizedContextMutator =
      this.createIsAuthorizedContextMutator(workPackage)

    // Clear host function logs at the start of each execution run
    this.traceHostFunctionLogs = []

    // Execute Ψ_M(authCode, 0, Cpackageauthgas, encode[2]{c}, F, none)
    // Gray Paper equation 37-38: Initial PC = 0 for is-authorized invocation
    const [error, marshallingResult] = await this.executeMarshallingInvocation(
      preimageBlob,
      0n, // Initial PC = 0 (Gray Paper)
      gasLimit,
      encodedArgs,
      isAuthorizedContextMutator,
      {
        machines: new Map(),
        exportSegments: [],
      }, // Context is (∅, ∅) for Is-Authorized
    )

    // Clear is-authorized invocation parameters
    this.refineWorkPackage = null
    this.refineAuthorizerTrace = null
    this.refineImportSegments = null
    this.refineExportSegmentOffset = 0n
    this.refineServiceAccount = null
    this.refineServiceId = null
    this.refineAccounts = null
    this.refineLookupAnchorTimeslot = 0n

    if (error || !marshallingResult) {
      return safeError(
        error || new Error('Marshalling invocation returned no result'),
      )
    }

    return safeResult({
      gasConsumed: marshallingResult.gasConsumed,
      result: marshallingResult.result,
    })
  }

  /**
   * Create is-authorized context mutator F
   * Gray Paper equation 46-54: F ∈ contextmutator{emptyset}
   *
   * Supports only:
   * - gas (ID = 0): Ω_G
   * - fetch (ID = 1): Ω_Y(..., wpX, none, none, none, none, none, none, none)
   *
   * For unknown host calls:
   * - Set registers[7] = WHAT
   * - Subtract 10 gas
   * - If gas < 0: return oog
   * - Otherwise: continue
   */
  private createIsAuthorizedContextMutator(
    workPackage: WorkPackage,
  ): ContextMutator {
    return (hostCallId: bigint) => {
      // Get current step and gas before host function call
      const currentStep = this.executionStep
      const gasBefore = this.state.gasCounter

      const gasCost = 10n
      const isOOG = this.state.gasCounter < gasCost

      // Log host function call BEFORE execution
      const hostLogEntry = {
        step: currentStep,
        hostCallId,
        gasBefore,
        gasAfter: isOOG
          ? this.state.gasCounter
          : this.state.gasCounter - gasCost,
      }
      this.traceHostFunctionLogs.push(hostLogEntry)

      if (isOOG) {
        // Gray Paper: On OOG, all remaining gas is consumed
        this.state.gasCounter = 0n
        return RESULT_CODES.OOG
      }

      // Deduct base gas cost
      this.state.gasCounter -= gasCost
      hostLogEntry.gasAfter = this.state.gasCounter

      // Gray Paper eq 46-54: Only support gas (0) and fetch (1)
      if (hostCallId === GENERAL_FUNCTIONS.GAS) {
        // Ω_G(gascounter, registers, memory)
        const result = this.handleGeneralHostFunctionForIsAuthorized(hostCallId)
        hostLogEntry.gasAfter = this.state.gasCounter
        return result
      }

      if (hostCallId === GENERAL_FUNCTIONS.FETCH) {
        // Ω_Y(gascounter, registers, memory, wpX, none, none, none, none, none, none, none)
        const result = this.handleFetchForIsAuthorized(workPackage)
        hostLogEntry.gasAfter = this.state.gasCounter
        return result
      }

      // Unknown host call: Gray Paper default behavior
      // registers' = registers except registers'[7] = WHAT
      // gascounter' = gascounter - 10 (already deducted)
      this.state.registerState[7] = ACCUMULATE_ERROR_CODES.WHAT

      // If gas < 0: return oog (already checked above)
      // Otherwise: continue (Gray Paper: continue means execution continues)
      return null
    }
  }

  /**
   * Handle GAS host function for is-authorized context
   */
  private handleGeneralHostFunctionForIsAuthorized(
    hostCallId: bigint,
  ): ResultCode | null {
    const hostFunction = this.hostFunctionRegistry.get(hostCallId)
    if (!hostFunction) {
      return null
    }

    const hostFunctionContext: HostFunctionContext = {
      gasCounter: this.state.gasCounter,
      registers: this.state.registerState,
      ram: this.state.ram,
      log: () => {
        // Logging handled by PVM's host function logs
      },
    }

    // GAS host function takes null context
    const result = hostFunction.execute(hostFunctionContext, null)

    return result?.resultCode ?? null
  }

  /**
   * Handle FETCH host function for is-authorized context
   * Gray Paper: Ω_Y(..., wpX, none, none, none, none, none, none, none)
   */
  private handleFetchForIsAuthorized(
    workPackage: WorkPackage,
  ): ResultCode | null {
    const hostFunction = this.hostFunctionRegistry.get(GENERAL_FUNCTIONS.FETCH)
    if (!hostFunction) {
      return null
    }

    const hostFunctionContext: HostFunctionContext = {
      gasCounter: this.state.gasCounter,
      registers: this.state.registerState,
      ram: this.state.ram,
      log: () => {
        // Logging handled by PVM's host function logs
      },
    }

    // Create fetch params with work package and all other params as null/none
    // Gray Paper: Ω_Y(..., wpX, none, none, none, none, none, none, none)
    const fetchParams: FetchParams = {
      workPackage,
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      accumulateInputs: null,
      entropyService: null, // Not needed for is-authorized
    }

    const result = hostFunction.execute(hostFunctionContext, fetchParams)

    return result?.resultCode ?? null
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

  /**
   * Create refine context mutator F
   * Gray Paper equation 92-118: F ∈ contextmutator{refineinvocationcontext}
   */
  private createRefineContextMutator(): ContextMutator {
    return (hostCallId: bigint) => {
      // Get current step and gas before host function call
      const currentStep = this.executionStep
      const gasBefore = this.state.gasCounter

      // JIP-1: LOG host function (100) costs 0 gas for JAM version 0.7.1
      const jamVersion = this.configService.jamVersion
      const isLogFunction = hostCallId === GENERAL_FUNCTIONS.LOG
      const isJamVersion071 =
        jamVersion.major === 0 &&
        jamVersion.minor === 7 &&
        jamVersion.patch === 1
      const gasCost = isLogFunction && isJamVersion071 ? 0n : 10n
      const isOOG = gasCost > 0n && this.state.gasCounter < gasCost

      // Log host function call BEFORE execution
      const hostLogEntry = {
        step: currentStep,
        hostCallId,
        gasBefore,
        gasAfter: isOOG
          ? this.state.gasCounter
          : gasCost > 0n
            ? this.state.gasCounter - gasCost
            : this.state.gasCounter,
      }
      this.traceHostFunctionLogs.push(hostLogEntry)

      if (isOOG) {
        this.state.gasCounter = 0n
        return RESULT_CODES.OOG
      }

      // Only deduct gas if gasCost > 0
      if (gasCost > 0n) {
        this.state.gasCounter -= gasCost
      }
      hostLogEntry.gasAfter = this.state.gasCounter

      // Handle refine-specific host functions
      // Gray Paper pvm_invocations.tex lines 92-118:
      // 0=gas, 1=fetch, 2=lookup, 3=read, 4=write, 5=info,
      // 6=historical_lookup, 7=export, 8=machine, 9=peek, 10=poke, 11=pages, 12=invoke, 13=expunge
      // Also include log (100) - JIP-1 debug/monitoring function
      if ((hostCallId >= 0n && hostCallId <= 13n) || hostCallId === 100n) {
        const result = this.handleRefineHostFunction(hostCallId)

        // Update gasAfter after host function execution
        hostLogEntry.gasAfter = this.state.gasCounter

        // Log panic for debugging
        if (result === RESULT_CODES.PANIC) {
          const hostFunctionName = this.getHostFunctionName(hostCallId)
          logger.error('[TypeScriptPVMExecutor] Refine host function PANIC', {
            hostFunctionId: hostCallId.toString(),
            hostFunctionName,
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

      // Unknown host function in refine context
      this.state.registerState[7] = ACCUMULATE_ERROR_CODES.WHAT

      // Log the unknown host function call
      this.traceHostFunctionLogs.push({
        step: currentStep,
        hostCallId,
        gasBefore,
        gasAfter: this.state.gasCounter,
      })

      return null
    }
  }

  private handleRefineHostFunction(hostCallId: bigint): ResultCode | null {
    const hostFunction = this.hostFunctionRegistry.get(hostCallId)
    if (!hostFunction) {
      return null
    }

    const hostFunctionContext: HostFunctionContext = {
      gasCounter: this.state.gasCounter,
      registers: this.state.registerState,
      ram: this.state.ram,
      log: () => {
        // Logging handled by PVM's host function logs
      },
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
        const fetchParams = this.buildRefineFetchParams()
        result = hostFunction.execute(hostFunctionContext, fetchParams)
        break
      }
      case 2n: {
        // lookup
        const lookupParams = this.buildRefineLookupParams()
        result = hostFunction.execute(hostFunctionContext, lookupParams)
        break
      }
      case 3n: {
        // read
        const readParams = this.buildRefineReadParams()
        result = hostFunction.execute(hostFunctionContext, readParams)
        break
      }
      case 4n: {
        // write
        const writeParams = this.buildRefineWriteParams()
        result = hostFunction.execute(hostFunctionContext, writeParams)
        break
      }
      case 5n: {
        // info
        const infoParams = this.buildRefineInfoParams()
        result = hostFunction.execute(hostFunctionContext, infoParams)
        break
      }
      case 6n: {
        // historical_lookup
        const historicalLookupParams = this.buildHistoricalLookupParams()
        result = hostFunction.execute(
          hostFunctionContext,
          historicalLookupParams,
        )
        break
      }
      case 7n: {
        // export
        const exportParams = this.buildExportParams()
        result = hostFunction.execute(hostFunctionContext, exportParams)
        break
      }
      case 8n: {
        // machine
        // TODO: Implement machine host function
        return null
      }
      case 9n: {
        // peek
        // TODO: Implement peek host function
        return null
      }
      case 10n: {
        // poke
        // TODO: Implement poke host function
        return null
      }
      case 11n: {
        // pages
        // TODO: Implement pages host function
        return null
      }
      case 12n: {
        // invoke
        const invokeParams = this.buildInvokeParams()
        result = hostFunction.execute(hostFunctionContext, invokeParams)
        break
      }
      case 13n: {
        // expunge
        const expungeParams = this.buildExpungeParams()
        result = hostFunction.execute(hostFunctionContext, expungeParams)
        break
      }
      case 100n: {
        // log (JIP-1)
        const logParams = {
          serviceId: null,
          coreIndex: null,
        }
        result = hostFunction.execute(hostFunctionContext, logParams)
        break
      }
      default: {
        return null
      }
    }

    // Log panic for debugging
    if (result?.resultCode === RESULT_CODES.PANIC) {
      const hostFunctionName = this.getHostFunctionName(hostCallId)
      logger.error(
        '[TypeScriptPVMExecutor] Refine host function PANIC in handler',
        {
          hostFunctionId: hostCallId.toString(),
          hostFunctionName,
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

  private buildRefineFetchParams(): FetchParams {
    if (!this.entropyService) {
      throw new Error('EntropyService not available for fetch')
    }
    return {
      workPackage: this.refineWorkPackage,
      workPackageHash: null,
      authorizerTrace: this.refineAuthorizerTrace
        ? (`0x${Buffer.from(this.refineAuthorizerTrace).toString('hex')}` as `0x${string}`)
        : null,
      workItemIndex: null,
      importSegments: this.refineImportSegments,
      exportSegments: null,
      accumulateInputs: null,
      entropyService: this.entropyService,
    }
  }

  private buildRefineLookupParams(): LookupParams {
    if (!this.refineServiceAccount || this.refineServiceId === null) {
      throw new Error('Service account and service ID not available for lookup')
    }
    return {
      serviceAccount: this.refineServiceAccount,
      serviceId: this.refineServiceId,
      accounts: this.refineAccounts ?? new Map(),
    }
  }

  private buildRefineReadParams(): {
    serviceAccount: ServiceAccount
    serviceId: bigint
    accounts: Map<bigint, ServiceAccount>
  } {
    if (!this.refineServiceAccount || this.refineServiceId === null) {
      throw new Error('Service account and service ID not available for read')
    }
    return {
      serviceAccount: this.refineServiceAccount,
      serviceId: this.refineServiceId,
      accounts: this.refineAccounts ?? new Map(),
    }
  }

  private buildRefineWriteParams(): {
    serviceAccount: ServiceAccount
    serviceId: bigint
  } {
    if (!this.refineServiceAccount || this.refineServiceId === null) {
      throw new Error('Service account and service ID not available for write')
    }
    return {
      serviceAccount: this.refineServiceAccount,
      serviceId: this.refineServiceId,
    }
  }

  private buildRefineInfoParams(): InfoParams {
    if (this.refineServiceId === null) {
      throw new Error('Service ID not available for info')
    }
    return {
      serviceId: this.refineServiceId,
      accounts: this.refineAccounts ?? new Map(),
      currentTimeslot: this.refineLookupAnchorTimeslot,
    }
  }

  private buildHistoricalLookupParams(): HistoricalLookupParams {
    if (
      !this.refineContext ||
      this.refineServiceId === null ||
      !this.refineAccounts
    ) {
      throw new Error(
        'Refine context, service ID, and accounts not available for historical lookup',
      )
    }
    return {
      refineContext: this.refineContext,
      serviceId: this.refineServiceId,
      accounts: this.refineAccounts,
      timeslot: this.refineLookupAnchorTimeslot,
    }
  }

  private buildExportParams(): ExportParams {
    if (!this.refineContext) {
      throw new Error('Refine context not available for export')
    }
    return {
      refineContext: this.refineContext,
      segmentOffset: this.refineExportSegmentOffset,
    }
  }

  private buildInvokeParams(): InvokeParams {
    if (!this.refineContext) {
      throw new Error('Refine context not available for invoke')
    }
    return {
      refineContext: this.refineContext,
    }
  }

  private buildExpungeParams(): ExpungeParams {
    if (!this.refineContext || this.refineServiceId === null) {
      throw new Error('Refine context and service ID not available for expunge')
    }
    return {
      refineContext: this.refineContext,
      machineId: this.refineServiceId,
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
