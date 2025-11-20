/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { encodeFixedLength, encodeNatural } from '@pbnj/codec'
import { blake2bHash, concatBytes, hexToBytes, logger } from '@pbnj/core'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  ContextMutator,
  DeferredTransfer,
  FetchParams,
  HostFunctionContext,
  HostFunctionResult,
  IConfigService,
  IEntropyService,
  Implications,
  ImplicationsPair,
  InfoParams,
  LookupParams,
  PartialState,
  PVMOptions,
  ResultCode,
  Safe,
  ServiceAccount,
  WorkItem,
  WriteParams,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import {
  ACCUMULATE_ERROR_CODES,
  ACCUMULATE_INVOCATION_CONFIG,
  RESULT_CODES,
} from '../config'
import type { AccumulateHostFunctionContext } from '../host-functions/accumulate/base'
import type { AccumulateHostFunctionRegistry } from '../host-functions/accumulate/registry'
import type { HostFunctionRegistry } from '../host-functions/general/registry'
import {
  TypeScriptPVMExecutor,
  WasmPVMExecutor,
} from '../pvm-executor-adapters'
import type { IPVMExecutor } from '../pvm-executor-interface'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class AccumulatePVM {
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly entropyService: IEntropyService
  private readonly configService: IConfigService
  private readonly pvmExecutor: IPVMExecutor
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    configService: IConfigService
    entropyService: IEntropyService
    pvmOptions?: PVMOptions
    useWasm?: boolean
    wasmShell?: any // WasmPvmShellInterface - optional WASM shell instance
  }) {
    // Create PVM executor based on useWasm flag
    if (options.useWasm && options.wasmShell) {
      this.pvmExecutor = new WasmPVMExecutor(
        options.wasmShell,
        options.hostFunctionRegistry,
      )
    } else {
      this.pvmExecutor = new TypeScriptPVMExecutor(
        options.hostFunctionRegistry,
        {
          ...options.pvmOptions,
          gasCounter:
            options.pvmOptions?.gasCounter ||
            BigInt(options.configService.maxBlockGas),
        },
      )
    }
    this.accumulateHostFunctionRegistry = options.accumulateHostFunctionRegistry
    this.entropyService = options.entropyService
    this.configService = options.configService
  }

  /**
   * Execute accumulate invocation (Ψ_A)
   *
   * Gray Paper Equation 148: Ψ_A: (partialstate, timeslot, serviceid, gas, sequence{accinput}) → acconeout
   *
   * Accumulate Invocation Constituents (Gray Paper):
   * - partialstate: Current partial state of the system
   * - timeslot: Current block timeslot (t)
   * - serviceid: Service account ID (s)
   * - gas: Available gas for execution (g)
   * - sequence{accinput}: Sequence of accumulation inputs (i)
   *
   * Internal Processing (Gray Paper):
   * 1. Extract service code: c = partialstate.accounts[s].code
   * 2. Process deferred transfers: Update service balance with deferred transfer amounts
   * 3. Create post-transfer state: postxferstate with updated balances
   * 4. Initialize implications context: I(postxferstate, s)²
   * 5. Encode arguments: encode(timeslot, serviceid, len(inputs))
   * 6. Execute marshalling invocation: Ψ_M(c, 5, g, encodedArgs, F, initialContext)
   *
   * @param partialState - Current partial state
   * @param timeslot - Current block timeslot
   * @param serviceId - Service account ID
   * @param gas - Available gas
   * @param inputs - Sequence of accumulation inputs
   * @param workItems - Work items from work packages being accumulated (for fetch host function)
   * @returns AccumulateInvocationResult
   */
  public async executeAccumulate(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput[],
    workItems: WorkItem[] = [],
  ): Promise<AccumulateInvocationResult> {
    logger.debug('[AccumulatePVM] executeAccumulate called', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputCount: inputs.length,
      totalAccounts: partialState.accounts.size,
    })
    try {
      // Gray Paper equation 166: c = local¬basestate_ps¬accounts[s]_sa¬code
      const serviceAccount = partialState.accounts.get(serviceId)
      if (!serviceAccount) {
        logger.error('[AccumulatePVM] Service account not found', {
          serviceId: serviceId.toString(),
          availableServiceIds: Array.from(partialState.accounts.keys()).map(
            (id) => id.toString(),
          ),
        })
        return { ok: false, err: 'BAD' }
      }

      logger.debug('[AccumulatePVM] Service account found', {
        serviceId: serviceId.toString(),
        codeHash: serviceAccount.codehash,
        preimagesCount: serviceAccount.preimages.size,
        storageSize: serviceAccount.storage.size,
      })

      // Gray Paper: Get service code from preimages using codehash
      const serviceCode = serviceAccount.preimages.get(serviceAccount.codehash)
      if (!serviceCode) {
        logger.error('[AccumulatePVM] Service code not found in preimages', {
          serviceId: serviceId.toString(),
          codeHash: serviceAccount.codehash,
          availablePreimageHashes: Array.from(serviceAccount.preimages.keys()),
        })
        return { ok: false, err: 'BAD' }
      }

      // Check for null code or oversized code (Gray Paper pvm_invocations.tex line 162)
      // Gray Paper: when c = none ∨ len(c) > Cmaxservicecodesize → error result
      // reporting_assurance.tex line 115: BIG indicates code was beyond Cmaxservicecodesize
      if (!serviceCode || serviceCode.length === 0) {
        logger.warn('[AccumulatePVM] Service code not found or empty', {
          serviceId: serviceId.toString(),
          codeHash: serviceAccount.codehash,
        })
        return { ok: false, err: 'BAD' }
      }

      if (
        serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
      ) {
        logger.warn('[AccumulatePVM] Service code exceeds maximum size', {
          serviceId: serviceId.toString(),
          codeLength: serviceCode.length,
          maxSize:
            ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
        })
        // Gray Paper: BIG error when code > Cmaxservicecodesize
        return { ok: false, err: 'BIG' }
      }

      // Calculate post-transfer state (apply deferred transfers to service balance)
      logger.debug('[AccumulatePVM] Calculating post-transfer state', {
        serviceId: serviceId.toString(),
        inputCount: inputs.length,
        currentBalance: serviceAccount.balance?.toString() || 'N/A',
      })
      const postTransferState = this.calculatePostTransferState(
        partialState,
        serviceId,
        inputs,
      )

      // Initialize Implications context
      logger.debug('[AccumulatePVM] Initializing implications context', {
        serviceId: serviceId.toString(),
        timeslot: timeslot.toString(),
      })
      const [initError, implicationsPair] = this.initializeImplicationsContext(
        postTransferState,
        serviceId,
        timeslot,
      )
      if (initError) {
        logger.error(
          '[AccumulatePVM] Failed to initialize implications context',
          {
            serviceId: serviceId.toString(),
            timeslot: timeslot.toString(),
            error: initError.message,
          },
        )
        return { ok: false, err: 'BAD' }
      }

      // logger.debug('[AccumulatePVM] Implications context initialized', {
      //   serviceId: serviceId.toString(),
      //   nextFreeId: implicationsPair[0].nextfreeid.toString(),
      // })

      // Encode arguments: timeslot, serviceId, input length
      const [encodedArgsError, encodedArgs] = this.encodeAccumulateArguments(
        timeslot,
        serviceId,
        BigInt(inputs.length),
      )
      if (encodedArgsError) {
        logger.error('[AccumulatePVM] Failed to encode accumulate arguments', {
          error: encodedArgsError.message,
        })
        return { ok: false, err: 'BAD' }
      }
      // Create accumulate context mutator F
      // Gray Paper: F needs access to inputs (i) and work items for fetch
      // partialState and serviceId are already in ImplicationsPair[0].state and ImplicationsPair[0].id
      const accumulateContextMutator = this.createAccumulateContextMutator(
        timeslot,
        implicationsPair,
        inputs,
        workItems,
      )

      // Execute Ψ_M(c, 5, g, encode(t, s, len(i)), F, I(postxferstate, s)^2)
      const [error, marshallingResult] =
        await this.pvmExecutor.executeMarshallingInvocation(
          serviceCode,
          // 5n, // Initial PC = 5 (Gray Paper)
          5n,
          gas,
          encodedArgs,
          accumulateContextMutator,
          implicationsPair,
          true, // buildPanicDump
          serviceId, // serviceId for panic dump and host function logs
          true, // writeHostFunctionLogs
        )
      if (error) {
        logger.error('[AccumulatePVM] Marshalling invocation failed', {
          serviceId: serviceId.toString(),
          error: error.message,
        })
        return { ok: false, err: 'BAD' }
      }

      // Extract values from Ψ_M return: (gas consumed, result, updated context)
      const {
        gasConsumed,
        result: marshallingResultValue,
        context: updatedImplicationsPair,
      } = marshallingResult

      // Panic dump and host function logs are now handled inside executeMarshallingInvocation in the PVM class

      // Determine result code from marshalling result
      let resultCode: ResultCode
      if (marshallingResultValue === 'OOG') {
        resultCode = RESULT_CODES.OOG
      } else if (marshallingResultValue === 'PANIC') {
        resultCode = RESULT_CODES.PANIC
      } else {
        // Valid blob result means HALT
        resultCode = RESULT_CODES.HALT
      }

      // Collapse result based on termination type using updated context from Ψ_M
      logger.debug('[AccumulatePVM] Collapsing accumulate result', {
        serviceId: serviceId.toString(),
        resultCode,
        gasConsumed: gasConsumed.toString(),
      })
      // In accumulate context, the context is always ImplicationsPair
      const collapsedResult = this.collapseAccumulateResult(
        {
          resultCode,
          gasUsed: gasConsumed,
        },
        updatedImplicationsPair as ImplicationsPair, // Use updated context from Ψ_M
      )

      return collapsedResult
    } catch (error) {
      logger.error(
        '[AccumulatePVM] Accumulate invocation failed with exception',
        {
          serviceId: serviceId.toString(),
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      )
      return { ok: false, err: 'BAD' }
    }
  }


  /**
   * Build FetchParams for accumulate context
   * Gray Paper equation 189: Ω_Y(..., none, entropyaccumulator', none, none, none, none, i, imXY)
   *
   * @param workItems - Work items from work packages being accumulated (i in Gray Paper)
   * @param _entropyService - Entropy service to get entropy accumulator (not used directly here, but available for fetch)
   * @returns FetchParams for accumulate context
   */
  private buildFetchParams(
    workItems: WorkItem[]
  ): FetchParams {
    // Work items come from the work packages being accumulated in the current batch
    const workItemsSequence = workItems.length > 0 ? workItems : null

    return {
      workPackage: null, // accumulate context: none
      workPackageHash: null,
      authorizerTrace: null,
      workItemIndex: null,
      importSegments: null,
      exportSegments: null,
      workItemsSequence,
      entropyService: this.entropyService,
    }
  }

  /**
   * Build parameters for read host function in accumulate context
   * Gray Paper equation 190: Ω_R needs imX_self, imX_id, (imX_state)_accounts
   *
   * @param implicationsPair - Implications pair context
   * @returns Parameters for read host function
   */
  private buildReadParams(implicationsPair: ImplicationsPair): {
    serviceAccount: ServiceAccount
    serviceId: bigint
    accounts: Map<bigint, ServiceAccount>
  } {
    const imX = implicationsPair[0] // Regular dimension
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

  /**
   * Build parameters for write host function in accumulate context
   * Gray Paper equation 191: Ω_W needs imX_self, imX_id
   *
   * @param implicationsPair - Implications pair context
   * @returns Parameters for write host function
   */
  private buildWriteParams(implicationsPair: ImplicationsPair): WriteParams {
    const imX = implicationsPair[0] // Regular dimension
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

  /**
   * Build parameters for lookup host function in accumulate context
   * Gray Paper equation 192: Ω_L needs imX_self, imX_id, (imX_state)_accounts
   *
   * @param implicationsPair - Implications pair context
   * @returns Parameters for lookup host function
   */
  private buildLookupParams(implicationsPair: ImplicationsPair): LookupParams {
    const imX = implicationsPair[0] // Regular dimension
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

  /**
   * Build parameters for info host function in accumulate context
   * Gray Paper equation 193: Ω_I needs imX_id, (imX_state)_accounts
   *
   * @param implicationsPair - Implications pair context
   * @returns Parameters for info host function
   */
  private buildInfoParams(implicationsPair: ImplicationsPair): InfoParams {
    const imX = implicationsPair[0] // Regular dimension
    return {
      serviceId: imX.id,
      accounts: imX.state.accounts,
    }
  }

  /**
   * Create accumulate context mutator F
   * Gray Paper equation 187-211: F ∈ contextmutator{implicationspair}
   *
   * Available general host functions in accumulate context:
   * - gas (0): Ω_G
   * - fetch (1): Ω_Y - needs: none, entropyaccumulator', none, none, none, none, i, imXY
   * - read (3): Ω_R - needs: imX_self, imX_id, (imX_state)_accounts
   * - write (4): Ω_W - needs: imX_self, imX_id
   * - lookup (2): Ω_L - needs: imX_self, imX_id, (imX_state)_accounts
   * - info (5): Ω_I - needs: imX_id, (imX_state)_accounts
   *
   * Note: partialState and serviceId are already available in ImplicationsPair[0].state and ImplicationsPair[0].id
   * Host functions can extract them from the context when needed.
   *
   * @param timeslot - Current timeslot
   * @param implicationsPair - Initial implications pair context (contains state and service ID)
   * @param inputs - Accumulation inputs (i) - needed for fetch (Gray Paper equation 189)
   * @param workItems - Work items from work packages being accumulated (for fetch host function)
   */
  private createAccumulateContextMutator(
    timeslot: bigint,
    implicationsPair: ImplicationsPair,
    _inputs: AccumulateInput[],
    workItems: WorkItem[],
  ): ContextMutator {
    return (
      hostCallId: bigint,
    ) => {
        // Gray Paper: Apply gas cost (10 gas for all host functions)
        const gasCost = 10n
        if (this.pvmExecutor.state.gasCounter < gasCost) {
          return RESULT_CODES.OOG
        }

        this.pvmExecutor.state.gasCounter -= gasCost

        // Try accumulate host functions first (14-26)
        if (hostCallId >= 14n && hostCallId <= 26n) {
          return this.handleAccumulateHostFunction(hostCallId, implicationsPair, timeslot)
          
        }
        // General host functions available in accumulate context (0-5)
        // Also include log (100) - JIP-1 debug/monitoring function
        if((hostCallId >= 0n && hostCallId <= 5n) || hostCallId === 100n) {
          return this.handleGeneralHostFunction(hostCallId, implicationsPair, workItems)
        }
        return null
    }
  }

  private handleAccumulateHostFunction(hostCallId: bigint, implicationsPair: ImplicationsPair, timeslot: bigint): ResultCode | null {
    const hostFunction =
    this.accumulateHostFunctionRegistry.get(hostCallId)
  if (!hostFunction) {
    return null
  }
    // Create log function for accumulate host function context
    const accumulateHostFunctionLog = (
      message: string,
      data?: Record<string, unknown>,
    ) => {
      if (!this.hostFunctionLogs) {
        this.hostFunctionLogs = []
      }
      this.hostFunctionLogs.push({
        functionName: hostFunction.name,
        functionId: hostCallId,
        message,
        data,
        timestamp: Date.now(),
        pc: this.pvmExecutor.state.programCounter,
      })
    }

    const hostFunctionContext: AccumulateHostFunctionContext = {
      gasCounter: this.pvmExecutor.state.gasCounter,
      registers: this.pvmExecutor.state.registerState,
      ram: this.pvmExecutor.state.ram,
      implications: implicationsPair,
      timeslot,
      expungePeriod: BigInt(this.configService.preimageExpungePeriod),
      log: accumulateHostFunctionLog,
    }
    const result = hostFunction.execute(hostFunctionContext)
    // Return null to continue execution, or terminal code to stop
    return result.resultCode
  }

  private handleGeneralHostFunction(hostCallId: bigint, implicationsPair: ImplicationsPair, workItems: WorkItem[]): ResultCode | null {
   
        // Try general host functions (0-13)
        // Gray Paper: Available general host functions in accumulate context:
        // - gas (0): Ω_G
        // - fetch (1): Ω_Y - needs accumulate-specific params
        // - lookup (2): Ω_L - needs accumulate-specific params
        // - read (3): Ω_R - needs accumulate-specific params
        // - write (4): Ω_W - needs accumulate-specific params
        // - info (5): Ω_I - needs accumulate-specific params
        // Use registry to build parameters and execute host function
        const hostFunction = this.pvmExecutor.hostFunctionRegistry.get(hostCallId)
        if (!hostFunction) {
          return null
        }

        const generalHostFunctionLog = (
          message: string,
          data?: Record<string, unknown>,
        ) => {
          if (!this.hostFunctionLogs) {
            this.hostFunctionLogs = []
          }
          this.hostFunctionLogs.push({
            functionName: hostFunction.name,
            functionId: hostCallId,
            message,
            data,
            timestamp: Date.now(),
            pc: this.pvmExecutor.state.programCounter,
          })
        }

        const hostFunctionContext: HostFunctionContext = {
          gasCounter: this.pvmExecutor.state.gasCounter,
          registers: this.pvmExecutor.state.registerState,
          ram: this.pvmExecutor.state.ram,
          log: generalHostFunctionLog,
        }

        let result: HostFunctionResult | null = null
        switch(hostCallId) {
          case 0n: { // gas
            result = hostFunction.execute(hostFunctionContext, null)
            break
          }
          case 1n: { // fetch
            const fetchParams = this.buildFetchParams(workItems)
            result = hostFunction.execute(hostFunctionContext, fetchParams)
            break
          }
          case 2n: { // lookup
            const lookupParams = this.buildLookupParams(implicationsPair)
            result = hostFunction.execute(hostFunctionContext, lookupParams)
            break
          }
          case 3n: { // read
            const readParams = this.buildReadParams(implicationsPair)
            result = hostFunction.execute(hostFunctionContext, readParams)
            break
          }
          case 4n: { // write
            const writeParams = this.buildWriteParams(implicationsPair)
            result = hostFunction.execute(hostFunctionContext, writeParams)
            break
          }
          case 5n: { // info
            const infoParams = this.buildInfoParams(implicationsPair)
            result = hostFunction.execute(hostFunctionContext, infoParams)
            break
          }
          case 100n: { // log (JIP-1)
            const logParams = {
              serviceId: implicationsPair[0].id,
              coreIndex: null, // No core context in accumulate
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

  /**
   * Calculate post-transfer state
   * Gray Paper equation 167: postxferstate = basestate exc postxferstate.accounts[s].balance = basestate.accounts[s].balance + sum{x in defxfers where x.dest = s}(x.amount)
   * Gray Paper equation 168-171: x = sequence of inputs i where i ∈ defxfer
   *
   * This function applies INCOMING deferred transfers to the service's balance BEFORE execution.
   * OUTGOING transfers (created during execution via TRANSFER host function) deduct balance immediately.
   */
  private calculatePostTransferState(
    partialState: PartialState,
    serviceId: bigint,
    inputs: AccumulateInput[],
  ): PartialState {
    // Gray Paper equation 168-171: Extract deferred transfers from inputs
    // x = sq{build{i}{i ∈ i, i ∈ defxfer}}
    const deferredTransfers = inputs
      .filter((input) => this.isDeferredTransfer(input))
      .map((input) => input.value as DeferredTransfer)

    // Gray Paper equation 167: Sum amounts where destination is this service
    // sum_{r ∈ x, r.dest = s}(r.amount)
    const totalTransferAmount = deferredTransfers
      .filter((transfer) => transfer.dest === serviceId)
      .reduce((sum, transfer) => sum + transfer.amount, 0n)

    // Gray Paper equation 167: Only update if there are incoming transfers
    // Create minimal copy: only the accounts Map and only the service account that needs updating
    if (totalTransferAmount === 0n) {
      // No incoming transfers, return state as-is (preserve reference)
      return partialState
    }

    // Gray Paper: postxferstate = basestate exc postxferstate.accounts[s].balance = basestate.accounts[s].balance + sum
    // Create new Map to avoid mutating original
    const updatedAccounts = new Map(partialState.accounts)
    const serviceAccount = updatedAccounts.get(serviceId)
    if (!serviceAccount) {
      // Service doesn't exist, return state as-is
      logger.warn(
        '[AccumulatePVM] Service account not found for post-transfer state calculation',
        {
          serviceId: serviceId.toString(),
        },
      )
      return partialState
    }

    // Update only the balance field - create new account object to preserve immutability
    // This object will be modified by transfer host function during execution
    updatedAccounts.set(serviceId, {
      ...serviceAccount,
      balance: serviceAccount.balance + totalTransferAmount,
    })

    // Return new PartialState with updated accounts Map
    // All other fields (stagingset, authqueue, privileges) are preserved by reference
    return {
      ...partialState,
      accounts: updatedAccounts,
    }
  }

  /**
   * Check if input is a deferred transfer according to Gray Paper defxfer pattern
   *
   * Gray Paper equation 117-124: defxfer ≡ tuple{
   *   DX_source: serviceid,
   *   DX_dest: serviceid,
   *   DX_amount: balance,
   *   DX_memo: memo (128 bytes),
   *   DX_gas: gas
   * }
   *
   * Gray Paper equation 126: accinput ≡ operandtuple ∪ defxfer
   * - type 0 = operandtuple
   * - type 1 = defxfer (deferred transfer)
   *
   * @param input - Accumulation input to check
   * @returns true if input is a deferred transfer, false otherwise
   */
  private isDeferredTransfer(input: AccumulateInput): boolean {
    return input.type === 1
  }

  /**
   * Initialize Implications context
   *
   * *** GRAY PAPER FORMULA ***
   * Gray Paper: pvm_invocations.tex, equations 175-186
   *
   * Formula:
   * I: (partialstate, serviceid) → implications
   * I(im_state, im_id) ↦ tuple{
   *   im_id,
   *   im_state,
   *   im_nextfreeid = check((decode[4]{blake{encode{im_id, entropyaccumulator', H_timeslot}}}
   *                          mod (2^32 - Cminpublicindex - 2^8))
   *                          + Cminpublicindex),
   *   im_xfers = [],
   *   im_yield = none,
   *   im_provisions = []
   * }
   *
   * Returns: I(postxferstate, s)² = (implications, implications)
   * - First element: regular dimension (imX)
   * - Second element: exceptional dimension (imY)
   */
  private initializeImplicationsContext(
    partialState: PartialState,
    serviceId: bigint,
    timeslot: bigint,
  ): Safe<ImplicationsPair> {
    // Step 1: Get entropy accumulator from entropy service
    if (!this.entropyService) {
      return safeError(
        new Error(
          'Entropy service required for implications context initialization',
        ),
      )
    }
    const entropyAccumulator = this.entropyService.getEntropyAccumulator()
    if (entropyAccumulator.length !== 32) {
      return safeError(
        new Error(
          `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
        ),
      )
    }

    // Step 2: Encode serviceid (4 bytes) - Gray Paper: encode[4]{im_id}
    const [serviceIdError, encodedServiceId] = encodeFixedLength(serviceId, 4n)
    if (serviceIdError) {
      return safeError(
        new Error(`Failed to encode service ID: ${serviceIdError.message}`),
      )
    }

    // Step 3: Encode timeslot (4 bytes) - Gray Paper: encode[4]{H_timeslot}
    const [timeslotError, encodedTimeslot] = encodeFixedLength(timeslot, 4n)
    if (timeslotError) {
      return safeError(
        new Error(`Failed to encode timeslot: ${timeslotError.message}`),
      )
    }

    // Step 4: Concatenate: encode{im_id, entropyaccumulator', H_timeslot}
    const inputToHash = new Uint8Array(
      encodedServiceId.length +
        entropyAccumulator.length +
        encodedTimeslot.length,
    )
    let offset = 0
    inputToHash.set(encodedServiceId, offset)
    offset += encodedServiceId.length
    inputToHash.set(entropyAccumulator, offset)
    offset += entropyAccumulator.length
    inputToHash.set(encodedTimeslot, offset)

    // Step 5: Blake2b hash - Gray Paper: blake{encode{im_id, entropyaccumulator', H_timeslot}}
    const [hashError, hashHex] = blake2bHash(inputToHash)
    if (hashError) {
      return safeError(
        new Error(`Failed to compute Blake2b hash: ${hashError.message}`),
      )
    }

    // Step 6: Decode first 4 bytes as uint32 (big-endian) - Gray Paper: decode[4]{...}
    const hash = hexToBytes(hashHex)
    if (hash.length < 4) {
      return safeError(
        new Error(
          `Hash too short: expected at least 4 bytes, got ${hash.length}`,
        ),
      )
    }
    const hashView = new DataView(hash.buffer, hash.byteOffset, hash.byteLength)
    const decodedHash = BigInt(hashView.getUint32(0, false)) // big-endian

    // Step 7: Calculate nextfreeid - Gray Paper formula
    // im_nextfreeid = (decode[4]{blake{...}} mod (2^32 - Cminpublicindex - 2^8)) + Cminpublicindex
    const MIN_PUBLIC_INDEX = ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX // 2^16 = 65,536
    const MODULUS_BASE = 2n ** 32n // 2^32
    const MODULUS = MODULUS_BASE - MIN_PUBLIC_INDEX - 2n ** 8n // 2^32 - 65536 - 256
    const nextfreeid = (decodedHash % MODULUS) + MIN_PUBLIC_INDEX

    // logger.debug('[AccumulatePVM] Calculated nextfreeid', {
    //   serviceId: serviceId.toString(),
    //   decodedHash: decodedHash.toString(),
    //   modulus: MODULUS.toString(),
    //   minPublicIndex: MIN_PUBLIC_INDEX.toString(),
    //   nextfreeid: nextfreeid.toString(),
    // })

    // Step 8: Create implications structure - Gray Paper equation 177-184
    const implications: Implications = {
      id: serviceId,
      state: partialState,
      nextfreeid,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    // Step 9: Return implications pair - Gray Paper: I(postxferstate, s)²
    // First element: regular dimension (imX)
    // Second element: exceptional dimension (imY) - initialized identically
    return safeResult([
      implications, // Regular dimension (imX)
      {
        ...implications,
        xfers: [],
        yield: null,
        provisions: new Map(),
      }, // Exceptional dimension (imY)
    ])
  }

  /**
   * Encode accumulate arguments according to Gray Paper specification
   *
   * Gray Paper: encode(timeslot, serviceid, len(inputs))
   * - timeslot: encode[4]{thetime} (4 bytes) - merklization.tex C(11)
   * - serviceid: encode[4]{serviceid} (4 bytes) - work package/item patterns
   * - len(inputs): encodeNatural (variable) - sequence length pattern
   */
  private encodeAccumulateArguments(
    timeslot: bigint,
    serviceId: bigint,
    inputLength: bigint,
  ): Safe<Uint8Array> {
    const parts: Uint8Array[] = []

    // 1. Timeslot (4 bytes) - Gray Paper: encode[4]{thetime}
    const [timeslotError, timeslotBytes] = encodeFixedLength(timeslot, 4n)
    if (timeslotError) {
      return safeError(new Error(`Failed to encode timeslot: ${timeslotError.message}`))
    }
    parts.push(timeslotBytes)

    // 2. Service ID (4 bytes) - Gray Paper: encode[4]{serviceid}
    const [serviceIdError, serviceIdBytes] = encodeFixedLength(serviceId, 4n)
    if (serviceIdError) {
      return safeError(new Error(`Failed to encode service ID: ${serviceIdError.message}`))
    }
    parts.push(serviceIdBytes)

    // 3. Input length (variable) - Gray Paper: encodeNatural pattern
    const [error, lengthEncoded] = encodeNatural(inputLength)
    if (error) {
      throw new Error(`Failed to encode input length: ${error.message}`)
    }
    parts.push(lengthEncoded)

    // Concatenate all parts
    return safeResult(concatBytes(parts))
  }

  /**
   * Collapse accumulate result
   * Gray Paper equation 217: C: (gas, blob ∪ {oog, panic}, implicationspair) → acconeout
   */
  private collapseAccumulateResult(
    executionResult: { resultCode: ResultCode; gasUsed: bigint },
    implicationsPair: ImplicationsPair,
  ): AccumulateInvocationResult {
    const [imX, imY] = implicationsPair

    // Gray Paper: Use exceptional dimension (imY) for panic/oog, regular dimension (imX) for normal termination
    const finalImplications =
      executionResult.resultCode === RESULT_CODES.PANIC ||
      executionResult.resultCode === RESULT_CODES.OOG
        ? imY
        : imX

    // Debug: Check account balances in poststate
    // const poststateAccountBalances = Array.from(
    //   finalImplications.state.accounts.entries(),
    // ).map(([id, account]) => ({
    //   serviceId: id.toString(),
    //   balance: account.balance.toString(),
    // }))
    // logger.debug('[AccumulatePVM] Poststate account balances', {
    //   accountBalances: poststateAccountBalances,
    //   defxfersCount: finalImplications.xfers.length,
    //   accumulatedServiceId: finalImplications.id.toString(),
    //   // Verify reference chain: check if the account object in poststate is the same as in imX
    //   accumulatedServiceBalance: finalImplications.state.accounts
    //     .get(finalImplications.id)
    //     ?.balance.toString(),
    // })

    return {
      ok: true,
      value: {
        poststate: finalImplications.state,
        defxfers: finalImplications.xfers,
        yield: finalImplications.yield,
        gasused: executionResult.gasUsed,
        provisions: finalImplications.provisions,
        resultCode: executionResult.resultCode,
      },
    }
  }
}
