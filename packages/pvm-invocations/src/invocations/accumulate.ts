/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { encodeFixedLength, encodeNatural } from '@pbnjam/codec'
import { blake2bHash, concatBytes, hexToBytes, logger } from '@pbnjam/core'
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
  PartialState,
  PVMOptions,
  ResultCode,
  Safe,
  WorkItem,
} from '@pbnjam/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnjam/types'
import {
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
  private readonly pvmExecutor: TypeScriptPVMExecutor | WasmPVMExecutor
  private readonly useWasm: boolean
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    configService: IConfigService
    entropyService: IEntropyService
    pvmOptions?: PVMOptions
    useWasm: boolean
  }) {
    this.useWasm = options.useWasm

    // Create PVM executor based on useWasm flag
    if (options.useWasm) {
      // Create WASM executor - module will be loaded from pvm-assemblyscript/build/pvm.wasm
      // and instantiated lazily on first use
      this.pvmExecutor = new WasmPVMExecutor(
        options.configService,
        options.entropyService,
      )
    } else {
      this.pvmExecutor = new TypeScriptPVMExecutor(
        options.hostFunctionRegistry,
        options.accumulateHostFunctionRegistry,
        options.configService,
        options.entropyService,
        {
          ...options.pvmOptions,
          gasCounter:
            options.pvmOptions?.gasCounter ||
            BigInt(options.configService.maxBlockGas),
        },
      )
    }
    this.entropyService = options.entropyService
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
        maxSize: ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
      })
      // Gray Paper: BIG error when code > Cmaxservicecodesize
      return { ok: false, err: 'BIG' }
    }

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

    if (this.useWasm) {
      // WASM executor - use direct accumulation method
      const [wasmError, wasmResult] =
        await this.pvmExecutor.executeAccumulationInvocation(
          serviceCode,
          gas,
          encodedArgs,
          implicationsPair,
          timeslot,
          inputs,
          workItems,
          serviceId,
        )
      error = wasmError
      marshallingResult = wasmResult
    } else {
      // TypeScript executor - use executeAccumulationInvocation
      const [tsError, tsResult] =
        await this.pvmExecutor.executeAccumulationInvocation(
          serviceCode,
          gas,
          encodedArgs,
          implicationsPair,
          timeslot,
          inputs,
          workItems,
          serviceId,
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

    // Collapse result based on termination type using updated context from Ψ_M
    logger.debug('[AccumulatePVM] Collapsing accumulate result', {
      serviceId: serviceId.toString(),
      resultCode,
      gasConsumed: gasConsumed.toString(),
      resultIsBlob: marshallingResultValue instanceof Uint8Array,
      resultLength:
        marshallingResultValue instanceof Uint8Array
          ? marshallingResultValue.length
          : 0,
    })
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
      return {
        ok: true,
        value: {
          poststate: imY.state,
          defxfers: imY.xfers,
          yield: imY.yield,
          gasused: gasUsed,
          provisions: imY.provisions,
          resultCode,
        },
      }
    } else if (resultBlob && resultBlob.length === 32) {
      // Case 2: o ∈ hash → Use imX but set yield = o (the hash from result)
      // Gray Paper equation 232: provisions = imXY_provisions (union of both)
      // Merge provisions from both implications dimensions
      const mergedProvisions = new Map(imX.provisions)
      for (const [serviceId, blob] of imY.provisions) {
        mergedProvisions.set(serviceId, blob)
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
}
