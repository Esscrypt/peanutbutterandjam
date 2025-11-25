/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { encodeFixedLength, encodeNatural } from '@pbnj/codec'
import { blake2bHash, concatBytes, hexToBytes, logger } from '@pbnj/core'
import type {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnj/pvm'
import { ACCUMULATE_INVOCATION_CONFIG } from '@pbnj/pvm'
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
} from '@pbnj/types'
import { RESULT_CODES, safeError, safeResult } from '@pbnj/types'
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
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    configService: IConfigService
    entropyService: IEntropyService
    pvmOptions?: PVMOptions
    useWasm?: boolean
    wasmPath?: string // Path to WASM module file (e.g., 'src/wasm/pvm.wasm')
  }) {
    // Create PVM executor based on useWasm flag
    if (options.useWasm && options.wasmPath) {
      // Create WASM executor - module will be loaded from path and instantiated lazily on first use
      this.pvmExecutor = new WasmPVMExecutor(
        options.wasmPath,
        options.configService,
        options.entropyService,
        options.hostFunctionRegistry,
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
    logger.debug('[AccumulatePVM] executeAccumulate called', {
      serviceId: serviceId.toString(),
      timeslot: timeslot.toString(),
      gas: gas.toString(),
      inputCount: inputs.length,
      totalAccounts: partialState.accounts.size,
    })
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
      // Execute accumulation invocation
      // Both executors now support executeAccumulationInvocation
      let error: Error | undefined
      let marshallingResult: {
        gasConsumed: bigint
        result: Uint8Array | 'PANIC' | 'OOG'
        context: ImplicationsPair
      } | undefined

      if (this.pvmExecutor instanceof WasmPVMExecutor) {
        // WASM executor - use direct accumulation method
        const [wasmError, wasmResult] =
          await this.pvmExecutor.executeAccumulationInvocation(
            serviceCode,
            gas,
            encodedArgs,
            implicationsPair,
          )
        error = wasmError
        marshallingResult = wasmResult
      } else if (this.pvmExecutor instanceof TypeScriptPVMExecutor) {
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
      } else {
        logger.error(
          '[AccumulatePVM] Executor does not support accumulation',
          {
            serviceId: serviceId.toString(),
          },
        )
        return { ok: false, err: 'BAD' }
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
