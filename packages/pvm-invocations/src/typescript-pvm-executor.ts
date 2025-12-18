/**
 * TypeScript PVM Executor
 *
 * Extends the TypeScript PVM implementation to provide accumulation invocation support.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
  WorkItem,
  WriteParams,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'
// Import types that aren't exported from main index - use relative path to source
import { ACCUMULATE_ERROR_CODES } from '../../pvm/src/config'
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
  }

  async executeAccumulationInvocation(
    preimageBlob: Uint8Array,
    gasLimit: bigint,
    encodedArgs: Uint8Array,
    implicationsPair: ImplicationsPair,
    timeslot: bigint,
    inputs: AccumulateInput[],
    workItems: WorkItem[],
    _serviceId: bigint,
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

    // Write trace dump if we have execution logs
    const executionLogs = this.getExecutionLogs()
    if (executionLogs.length > 0) {
      // Write to pvm-traces folder in workspace root (same as WasmPVMExecutor)
      const traceOutputDir = join(this.workspaceRoot, 'pvm-traces')
      console.log(
        `[TypeScriptPVMExecutor] Writing trace to: ${traceOutputDir}, timeslot=${timeslot.toString()}`,
      )
      // Write trace with typescript executor type and block number
      const filepath = writeTraceDump(
        executionLogs,
        this.traceHostFunctionLogs.length > 0
          ? this.traceHostFunctionLogs
          : undefined,
        traceOutputDir,
        undefined,
        timeslot, // blockNumber
        'typescript', // executorType - generates typescript-{slot}.log format
        undefined, // serviceId - not needed
      )
      if (filepath) {
        console.log(`[TypeScriptPVMExecutor] Trace written to: ${filepath}`)
      } else {
        console.warn(
          `[TypeScriptPVMExecutor] Failed to write trace dump (executionLogs.length=${executionLogs.length})`,
        )
      }
    } else {
      console.warn(
        `[TypeScriptPVMExecutor] No execution logs to write (executionLogs.length=${executionLogs.length})`,
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
    _inputs: AccumulateInput[],
    workItems: WorkItem[],
  ): ContextMutator {
    return (hostCallId: bigint) => {
      // Get current step and gas before host function call
      const currentStep = this.executionStep
      const gasBefore = this.state.gasCounter
      const serviceId = implicationsPair[0].id

      // Gray Paper: Apply gas cost (10 gas for all host functions)
      const gasCost = 10n
      if (this.state.gasCounter < gasCost) {
        return RESULT_CODES.OOG
      }

      this.state.gasCounter -= gasCost

      // Try accumulate host functions first (14-26)
      if (hostCallId >= 14n && hostCallId <= 26n) {
        const result = this.handleAccumulateHostFunction(
          hostCallId,
          implicationsPair,
          timeslot,
        )

        // Log host function call (gasAfter is captured after host function execution)
        // The host function may consume additional gas beyond the base 10 gas cost
        this.traceHostFunctionLogs.push({
          step: currentStep,
          hostCallId,
          gasBefore,
          gasAfter: this.state.gasCounter,
          serviceId,
        })

        return result
      }

      // General host functions available in accumulate context (0-5)
      // Also include log (100) - JIP-1 debug/monitoring function
      if ((hostCallId >= 0n && hostCallId <= 5n) || hostCallId === 100n) {
        const result = this.handleGeneralHostFunction(
          hostCallId,
          implicationsPair,
          workItems,
        )

        // Log host function call (gasAfter is captured after host function execution)
        // The host function may consume additional gas beyond the base 10 gas cost
        this.traceHostFunctionLogs.push({
          step: currentStep,
          hostCallId,
          gasBefore,
          gasAfter: this.state.gasCounter,
          serviceId,
        })

        return result
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
    // Gray Paper pvm_invocations.tex line 359: encode(i) when i ≠ none
    // During accumulation, workItemsSequence should always be an array (never null)
    // An empty array [] is distinct from none (null):
    // - [] (empty array) = provided but empty → returns encode(var{[]}) = 0x00
    // - null (none) = not provided → returns none (null)
    // Always pass an array, even if empty, to match Gray Paper specification
    const workItemsSequence = workItems.length > 0 ? workItems : []

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

  private buildWriteParams(implicationsPair: ImplicationsPair): WriteParams {
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

  private buildInfoParams(implicationsPair: ImplicationsPair): InfoParams {
    const imX = implicationsPair[0]
    return {
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }
}
