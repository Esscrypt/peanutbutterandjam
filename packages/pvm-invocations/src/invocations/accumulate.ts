/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import {
  encodeNatural,
  generateNextServiceId,
  getServicePreimageValue,
} from '@pbnjam/codec'
import { concatBytes, logger } from '@pbnjam/core'
import type {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { ACCUMULATE_INVOCATION_CONFIG } from '@pbnjam/pvm'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  DeferredTransfer,
  IConfigService,
  IEntropyService,
  Implications,
  ImplicationsPair,
  JamVersion,
  PartialState,
  PVMOptions,
  ResultCode,
  Safe,
  ServiceAccount,
} from '@pbnjam/types'
import {
  DEFAULT_JAM_VERSION,
  RESULT_CODES,
  safeError,
  safeResult,
} from '@pbnjam/types'
import {
  RustPVMExecutor,
  TypeScriptPVMExecutor,
  WasmPVMExecutor,
} from '../pvm-executor-adapters'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class AccumulatePVM {
  private readonly entropyService: IEntropyService
  private readonly configService: IConfigService
  private readonly pvmExecutor:
    | TypeScriptPVMExecutor
    | WasmPVMExecutor
    | RustPVMExecutor
  readonly useWasm: boolean
  readonly useRust: boolean
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry | null
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry | null
    configService: IConfigService
    entropyService: IEntropyService
    pvmOptions?: PVMOptions
    useWasm?: boolean
    useRust?: boolean
    traceSubfolder?: string
  }) {
    this.useWasm = options.useWasm ?? false
    this.useRust = options.useRust ?? false
    if (this.useRust) {
      this.pvmExecutor = new RustPVMExecutor(
        options.configService,
        options.entropyService,
        options.traceSubfolder,
      )
    } else if (options.useWasm) {
      this.pvmExecutor = new WasmPVMExecutor(
        options.configService,
        options.entropyService,
        null, // serviceAccountService not needed for accumulate
        options.traceSubfolder,
      )
    } else {
      if (
        !options.hostFunctionRegistry ||
        !options.accumulateHostFunctionRegistry
      ) {
        throw new Error(
          'Host function registry and accumulate host function registry are required when useWasm is false',
        )
      }
      this.pvmExecutor = new TypeScriptPVMExecutor(
        options.hostFunctionRegistry,
        options.accumulateHostFunctionRegistry,
        options.configService,
        options.entropyService,
        null, // serviceAccountService not needed for accumulate
        {
          ...options.pvmOptions,
          gasCounter:
            options.pvmOptions?.gasCounter ||
            BigInt(options.configService.maxBlockGas),
        },
        options.traceSubfolder,
      )
    }
    this.entropyService = options.entropyService
    this.configService = options.configService
  }

  /**
   * Release internal memory (executor WASM instance and mutable state).
   * Call before dropping the PVM so worker/process can free memory on shutdown.
   */
  dispose(): void {
    this.pvmExecutor.dispose()
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
   * @param inputs - Sequence of accumulation inputs (used for FETCH selectors 14/15)
   * @returns AccumulateInvocationResult
   */
  public async executeAccumulate(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput[],
    orderedIndex: number, // Ordered index for trace file naming
    entropyOverride?: Uint8Array, // When provided (e.g. by worker), use instead of entropyService.getEntropyAccumulator()
  ): Promise<AccumulateInvocationResult> {
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

    // Gray Paper: Get service code from preimages using codehash
    // Gray Paper accounts.tex equation 42-43: c = none when codehash not in preimages
    const serviceCode = getServicePreimageValue(
      serviceAccount,
      serviceId,
      serviceAccount.codehash,
    )

    // Gray Paper pvm_invocations.tex line 162: Process deferred transfers FIRST,
    // even when c = none or len(c) > Cmaxservicecodesize
    // postxferstate = basestate except balance += sum of deferred transfer amounts
    const postTransferState = this.calculatePostTransferState(
      partialState,
      serviceId,
      inputs,
    )

    // Gray Paper pvm_invocations.tex line 162: when c = none ∨ len(c) > Cmaxservicecodesize
    // Return: (poststate=postxferstate, defxfers=[], yield=none, gasused=0, provisions=[])
    if (!serviceCode) {
      logger.debug(
        '[AccumulatePVM] Service code not found in preimages - returning post-transfer state',
        {
          serviceId: serviceId.toString(),
          codeHash: serviceAccount.codehash,
        },
      )
      // Gray Paper: Return valid acconeout with post-transfer state, 0 gas, empty defxfers/provisions
      // resultCode = HALT since no execution occurred (but not an error)
      return {
        ok: true,
        value: {
          poststate: postTransferState,
          defxfers: [],
          yield: null,
          gasused: 0n,
          provisions: new Set(),
          resultCode: 0, // HALT - no execution occurred but not an error
        },
      }
    }

    // Check for null code or oversized code (Gray Paper pvm_invocations.tex line 162)
    // Gray Paper: when c = none ∨ len(c) > Cmaxservicecodesize → error result
    // reporting_assurance.tex line 115: BIG indicates code was beyond Cmaxservicecodesize
    if (serviceCode.length === 0) {
      logger.warn('[AccumulatePVM] Service code is empty', {
        serviceId: serviceId.toString(),
        codeHash: serviceAccount.codehash,
      })
      // Gray Paper: Return valid acconeout with post-transfer state, 0 gas, empty defxfers/provisions
      // resultCode = HALT since no execution occurred (but not an error)
      return {
        ok: true,
        value: {
          poststate: postTransferState,
          defxfers: [],
          yield: null,
          gasused: 0n,
          provisions: new Set(),
          resultCode: 0, // HALT - no execution occurred but not an error
        },
      }
    }

    if (
      serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
    ) {
      logger.warn('[AccumulatePVM] Service code exceeds maximum size', {
        serviceId: serviceId.toString(),
        codeLength: serviceCode.length,
        maxSize: ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
      })
      // Gray Paper: Return valid acconeout with post-transfer state, 0 gas, empty defxfers/provisions
      // Note: BIG error is for work reports, not accumulate invocation output
      // resultCode = HALT since no execution occurred (but not an error)
      return {
        ok: true,
        value: {
          poststate: postTransferState,
          defxfers: [],
          yield: null,
          gasused: 0n,
          provisions: new Set(),
          resultCode: 0, // HALT - no execution occurred but not an error
        },
      }
    }

    // Initialize Implications context
    // Get JAM version from config service for version-aware behavior
    const jamVersion = this.configService.jamVersion

    const [initError, implicationsPair] = this.initializeImplicationsContext(
      postTransferState,
      serviceId,
      timeslot,
      jamVersion,
      entropyOverride,
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

    // Gray Paper pvm_invocations.tex equation 163: encode{t, s, len(i)}
    // Where len(i) is the COUNT of elements in the sequence i, not the byte length!
    // Evidence: Line 360 uses len(i) as array index: registers[11] < len(i)
    // This means len(i) must be the count of elements, not byte length.
    //
    // Gray Paper equation 163: C(Ψ_M(c, 5, g, encode{t, s, len(i)}, F, I(...)))
    // The inputs sequence i is accessed via FETCH host function (selectors 14 and 15),
    // not from memory, so len(i) is used to validate array bounds, not to read bytes.
    const inputLength = BigInt(inputs.length)

    // Encode arguments: timeslot, serviceId, input length (count of elements, not byte length!)
    const [encodedArgsError, encodedArgs] = this.encodeAccumulateArguments(
      timeslot,
      serviceId,
      inputLength,
    )
    if (encodedArgsError) {
      logger.error('[AccumulatePVM] Failed to encode accumulate arguments', {
        error: encodedArgsError.message,
      })
      return { ok: false, err: 'BAD' }
    }
    // Execute accumulation invocation
    // Use the useWasm flag to determine which executor method to call
    let error: Error | undefined
    let marshallingResult:
      | {
          gasConsumed: bigint
          result: Uint8Array | 'PANIC' | 'OOG'
          context: ImplicationsPair
        }
      | undefined

    if (this.useRust) {
      const [rustError, rustResult] =
        await this.pvmExecutor.executeAccumulationInvocation(
          serviceCode,
          gas,
          encodedArgs,
          implicationsPair,
          timeslot,
          inputs,
          serviceId,
          orderedIndex,
          entropyOverride,
        )
      error = rustError
      marshallingResult = rustResult
    } else if (this.useWasm) {
      const [wasmError, wasmResult] =
        await this.pvmExecutor.executeAccumulationInvocation(
          serviceCode,
          gas,
          encodedArgs,
          implicationsPair,
          timeslot,
          inputs,
          serviceId,
          orderedIndex, // Pass ordered index for trace file naming
          entropyOverride, // So worker's WASM sees same entropy as in-process (WASM reads entropy in setupAccumulateInvocation)
        )
      error = wasmError
      marshallingResult = wasmResult
    } else {
      const [tsError, tsResult] =
        await this.pvmExecutor.executeAccumulationInvocation(
          serviceCode,
          gas,
          encodedArgs,
          implicationsPair,
          timeslot,
          inputs,
          serviceId,
          orderedIndex, // Pass ordered index for trace file naming
          entropyOverride, // Signature compatibility; TS path uses implicationsPair built with override
        )
      error = tsError
      marshallingResult = tsResult
    }

    if (error || !marshallingResult) {
      logger.error('[AccumulatePVM] Accumulation invocation failed', {
        serviceId: serviceId.toString(),
        error: error?.message,
      })
      return { ok: false, err: 'BAD' }
    }

    // Extract values from execution return: (gas consumed, result, updated context)
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

    // In accumulate context, the context is always ImplicationsPair
    // Gray Paper equation 217: C takes (gas, blob ∪ {oog, panic}, implicationspair)
    const collapsedResult = this.collapseAccumulateResult(
      {
        resultCode,
        gasUsed: gasConsumed,
        resultBlob:
          marshallingResultValue instanceof Uint8Array
            ? marshallingResultValue
            : null,
      },
      updatedImplicationsPair as ImplicationsPair, // Use updated context from Ψ_M
    )

    return collapsedResult
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
    // Note: Even with no transfers, we proceed to ensure proper state handling
    // The deep cloning happens in initializeImplicationsContext, not here
    if (totalTransferAmount === 0n) {
      // No incoming transfers, but we still need to return a proper state
      // The state will be deep-cloned in initializeImplicationsContext
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

    // Update only the balance field - create DEEP CLONE to preserve immutability
    // This object will be modified by host functions during execution
    // CRITICAL: Must deep clone storage, preimages, and requests Maps to prevent
    // modifications from affecting other invocations or the original state
    updatedAccounts.set(
      serviceId,
      this.deepCloneServiceAccount({
        ...serviceAccount,
        balance: serviceAccount.balance + totalTransferAmount,
      }),
    )

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
   * Generate next service ID according to Gray Paper specification
   *
   * Gray Paper: pvm_invocations.tex, equation 185
   * im_nextfreeid = check((decode[4]{blake{encode{im_id, entropyaccumulator', H_timeslot}}}
   *                        mod (2^32 - Cminpublicindex - 2^8))
   *                        + Cminpublicindex)
   *
   * Version differences:
   * - v0.7.0: (decode[4]{blake{...}} mod (2^32 - 2^9)) + 2^8
   * - v0.7.1+: (decode[4]{blake{...}} mod (2^32 - Cminpublicindex - 2^8)) + Cminpublicindex
   *
   * @param serviceId - Current service ID (im_id)
   * @param entropyAccumulator - Entropy accumulator (32 bytes)
   * @param timeslot - Current timeslot (H_timeslot)
   * @param accounts - Map of existing service accounts (for check function)
   * @param jamVersion - Optional JAM version. Defaults to DEFAULT_JAM_VERSION
   * @returns Next free service ID
   */
  public generateNextServiceId(
    serviceId: bigint,
    entropyAccumulator: Uint8Array,
    timeslot: bigint,
    accounts: Map<bigint, ServiceAccount>,
    jamVersion?: JamVersion,
  ): Safe<bigint> {
    return generateNextServiceId(
      serviceId,
      entropyAccumulator,
      timeslot,
      accounts,
      jamVersion,
    )
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
    jamVersion?: JamVersion,
    entropyOverride?: Uint8Array,
  ): Safe<ImplicationsPair> {
    const version = jamVersion ?? DEFAULT_JAM_VERSION
    // Step 1: Get entropy accumulator from override (worker) or entropy service (in-process)
    const entropyAccumulator =
      entropyOverride ??
      (this.entropyService ? this.entropyService.getEntropyAccumulator() : null)
    if (!entropyAccumulator) {
      return safeError(
        new Error(
          'Entropy required for implications context: provide entropyOverride or entropyService',
        ),
      )
    }
    if (entropyAccumulator.length !== 32) {
      return safeError(
        new Error(
          `Invalid entropy accumulator length: expected 32 bytes, got ${entropyAccumulator.length}`,
        ),
      )
    }

    // Step 2: Generate nextfreeid using extracted method
    const [nextfreeidError, nextfreeid] = this.generateNextServiceId(
      serviceId,
      entropyAccumulator,
      timeslot,
      partialState.accounts,
      version,
    )
    if (nextfreeidError) {
      return safeError(nextfreeidError)
    }

    // Step 8: Create implications structure - Gray Paper equation 177-184
    // CRITICAL: Deep clone the partial state to prevent mutations from affecting other invocations
    const clonedPartialState = this.deepClonePartialState(partialState)
    const implications: Implications = {
      id: serviceId,
      state: clonedPartialState,
      nextfreeid,
      xfers: [],
      yield: null,
      provisions: new Set(),
    }

    // Step 9: Return implications pair - Gray Paper: I(postxferstate, s)²
    // First element: regular dimension (imX)
    // Second element: exceptional dimension (imY) - initialized identically
    // CRITICAL: Each dimension needs its OWN deep-cloned state to prevent cross-contamination
    const imYState = this.deepClonePartialState(partialState) // Separate clone for imY

    return safeResult([
      implications, // Regular dimension (imX)
      {
        id: serviceId,
        state: imYState,
        nextfreeid,
        xfers: [],
        yield: null,
        provisions: new Set(),
      }, // Exceptional dimension (imY)
    ])
  }

  /**
   * Encode accumulate arguments according to Gray Paper specification
   *
   * Gray Paper pvm_invocations.tex equation 163: encode{t, s, len(i)}
   * All values use variable-length natural number encoding (encodeNatural):
   * - t (timeslot): encodeNatural
   * - s (serviceId): encodeNatural
   * - len(i) (input length): encodeNatural
   *
   * Note: This differs from fixed-length encodings used elsewhere (e.g. encode[4] in headers).
   * The general encode{} notation uses variable-length encoding.
   */
  private encodeAccumulateArguments(
    timeslot: bigint,
    serviceId: bigint,
    inputLength: bigint,
  ): Safe<Uint8Array> {
    const parts: Uint8Array[] = []

    // 1. Timeslot - Gray Paper: encode{t} (variable-length natural number)
    const [timeslotError, timeslotBytes] = encodeNatural(timeslot)
    if (timeslotError) {
      return safeError(
        new Error(`Failed to encode timeslot: ${timeslotError.message}`),
      )
    }
    parts.push(timeslotBytes)

    // 2. Service ID - Gray Paper: encode{s} (variable-length natural number)
    const [serviceIdError, serviceIdBytes] = encodeNatural(serviceId)
    if (serviceIdError) {
      return safeError(
        new Error(`Failed to encode service ID: ${serviceIdError.message}`),
      )
    }
    parts.push(serviceIdBytes)

    // 3. Input length - Gray Paper: encode{len(i)} (variable-length natural number)
    const [error, lengthEncoded] = encodeNatural(inputLength)
    if (error) {
      return safeError(
        new Error(`Failed to encode input length: ${error.message}`),
      )
    }
    parts.push(lengthEncoded)

    // Concatenate all parts
    return safeResult(concatBytes(parts))
  }

  /**
   * Collapse accumulate result
   * Gray Paper equation 217-241: C: (gas, blob ∪ {oog, panic}, implicationspair) → acconeout
   *
   * Three cases:
   * 1. When o ∈ {oog, panic}: Use imY (exceptional dimension)
   * 2. When o ∈ hash: Use imX but set yield = o (the hash from result)
   * 3. Otherwise: Use imX with yield = imX.yield
   */
  private collapseAccumulateResult(
    executionResult: {
      resultCode: ResultCode
      gasUsed: bigint
      resultBlob: Uint8Array | null
    },
    implicationsPair: ImplicationsPair,
  ): AccumulateInvocationResult {
    const [imX, imY] = implicationsPair
    const { resultCode, gasUsed, resultBlob } = executionResult

    // Gray Paper equation 217-241: Three cases for collapse function
    if (resultCode === RESULT_CODES.PANIC || resultCode === RESULT_CODES.OOG) {
      // Case 1: o ∈ {oog, panic} → Use imY (exceptional dimension)
      // Gray Paper equation 220-226: When o ∈ {oog, panic}:
      //   poststate = imY.state
      //   defxfers = imY.xfers (NOT imX.xfers - transfers in imX are discarded on panic/OOG)
      //   yield = imY.yield
      //   provisions = imY.provisions
      // Transfers executed in imX are NOT applied on panic/OOG - they are discarded

      return {
        ok: true,
        value: {
          poststate: imY.state,
          defxfers: imY.xfers, // Use imY.xfers, not imX.xfers (Gray Paper equation 222)
          yield: imY.yield,
          gasused: gasUsed,
          provisions: imY.provisions,
          resultCode,
        },
      }
    } else if (resultBlob && resultBlob.length === 32) {
      // Case 2: o ∈ hash → Use imX but set yield = o (the hash from result)
      // Gray Paper equation 232: provisions = imXY_provisions (union of both)
      // Merge provisions from both implications dimensions using Set union
      const mergedProvisions = new Set<[bigint, Uint8Array]>(imX.provisions)
      for (const provision of imY.provisions) {
        mergedProvisions.add(provision)
      }
      return {
        ok: true,
        value: {
          poststate: imX.state,
          defxfers: imX.xfers,
          yield: resultBlob, // Use the hash from result, not imX.yield
          gasused: gasUsed,
          provisions: mergedProvisions, // Gray Paper: imXY_provisions (union of both)
          resultCode,
        },
      }
    } else {
      // Case 3: Otherwise → Use imX with yield = imX.yield
      return {
        ok: true,
        value: {
          poststate: imX.state,
          defxfers: imX.xfers,
          yield: imX.yield,
          gasused: gasUsed,
          provisions: imX.provisions,
          resultCode,
        },
      }
    }
  }

  /**
   * Deep clone the partial state to prevent mutations from affecting other invocations
   *
   * @param partialState - Partial state to clone
   * @returns Deep cloned partial state with new Map instances for accounts
   */
  private deepClonePartialState(partialState: PartialState): PartialState {
    const clonedAccounts = new Map<bigint, ServiceAccount>()
    for (const [serviceId, account] of partialState.accounts) {
      clonedAccounts.set(serviceId, this.deepCloneServiceAccount(account))
    }

    return {
      ...partialState,
      accounts: clonedAccounts,
      // Note: stagingset, authqueue, etc are not modified by host functions,
      // so we can keep the same references
    }
  }

  /**
   * Deep clone a service account to prevent mutations from affecting other invocations
   *
   * CRITICAL: This is necessary because accumulation invocations share the same
   * partial state reference. Without deep cloning, WRITE/SOLICIT/etc host functions
   * in one invocation would modify storage/preimages/requests that affect subsequent
   * invocations, leading to incorrect state.
   *
   * @param account - Service account to clone
   * @returns Deep cloned service account with new Map instances
   */
  private deepCloneServiceAccount(account: ServiceAccount): ServiceAccount {
    const cloned = {
      ...account,
      rawCshKeyvals: { ...account.rawCshKeyvals }, // Deep clone rawCshKeyvals object
    }
    return cloned
  }
}
