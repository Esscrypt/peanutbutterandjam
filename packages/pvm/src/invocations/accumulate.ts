/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { blake2bHash, hexToBytes, logger } from '@pbnj/core'
import { encodeFixedLength, encodeNatural } from '@pbnj/serialization'
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
  RAM,
  ResultCode,
  Safe,
} from '@pbnj/types'
import { safeError, safeResult } from '@pbnj/types'
import { ACCUMULATE_INVOCATION_CONFIG, RESULT_CODES } from '../config'
import type { AccumulateHostFunctionContext } from '../host-functions/accumulate/base'
import type { AccumulateHostFunctionRegistry } from '../host-functions/accumulate/registry'
import type { HostFunctionRegistry } from '../host-functions/general/registry'
import { PVM } from '../pvm'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class AccumulatePVM extends PVM {
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  private readonly entropyService: IEntropyService | null
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    configService: IConfigService
    entropyService: IEntropyService | null
    pvmOptions?: PVMOptions
  }) {
    super(options.hostFunctionRegistry, options.pvmOptions)
    this.accumulateHostFunctionRegistry = options.accumulateHostFunctionRegistry
    this.entropyService = options.entropyService
    this.state.gasCounter =
      options.pvmOptions?.gasCounter ||
      BigInt(options.configService.maxBlockGas)
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
   * @returns AccumulateInvocationResult
   */
  public async executeAccumulate(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput[],
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

      logger.debug('[AccumulatePVM] Service code found', {
        serviceId: serviceId.toString(),
        codeLength: serviceCode.length,
        maxAllowedSize:
          ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
      })

      // Check for null code or oversized code (Gray Paper eq:accinvocation)
      if (
        !serviceCode ||
        serviceCode.length === 0 ||
        serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
      ) {
        logger.warn('[AccumulatePVM] Service code validation failed', {
          serviceId: serviceId.toString(),
          codeLength: serviceCode?.length || 0,
          isEmpty: !serviceCode || serviceCode.length === 0,
          isOversized:
            serviceCode.length >
            ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE,
          maxSize:
            ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
        })
        return {
          ok: true,
          value: {
            poststate: partialState,
            defxfers: [],
            yield: null,
            gasused: 0n,
            provisions: new Map(),
          },
        }
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

      logger.debug('[AccumulatePVM] Implications context initialized', {
        serviceId: serviceId.toString(),
        nextFreeId: implicationsPair[0].nextfreeid.toString(),
      })

      // Encode arguments: timeslot, serviceId, input length
      const encodedArgs = this.encodeAccumulateArguments(
        timeslot,
        serviceId,
        BigInt(inputs.length),
      )
      logger.debug('[AccumulatePVM] Encoded arguments', {
        serviceId: serviceId.toString(),
        encodedArgsLength: encodedArgs.length,
      })

      // Create accumulate context mutator F
      const accumulateContextMutator = this.createAccumulateContextMutator(
        timeslot,
        implicationsPair,
      )
      logger.debug('[AccumulatePVM] Created context mutator', {
        serviceId: serviceId.toString(),
      })

      // Execute Ψ_M(c, 5, g, encode(t, s, len(i)), F, I(postxferstate, s)^2)
      logger.debug('[AccumulatePVM] Executing marshalling invocation', {
        serviceId: serviceId.toString(),
        codeLength: serviceCode.length,
        initialPC: '5',
        gas: gas.toString(),
      })
      const [error, marshallingResult] =
        await this.executeMarshallingInvocation(
          serviceCode,
          5n, // Initial PC = 5 (Gray Paper) // TODO: uncomment when we have a program blob to test with
          // 0n, // Initial PC = 0 , because we are directly using the blob instead of creating a program
          gas,
          encodedArgs,
          accumulateContextMutator,
          implicationsPair,
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

      logger.debug('[AccumulatePVM] Marshalling invocation completed', {
        serviceId: serviceId.toString(),
        gasConsumed: gasConsumed.toString(),
        resultType:
          typeof marshallingResultValue === 'string'
            ? marshallingResultValue
            : 'blob',
        resultLength:
          typeof marshallingResultValue === 'string'
            ? 0
            : marshallingResultValue.length,
      })

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
      const collapsedResult = this.collapseAccumulateResult(
        {
          resultCode,
          gasUsed: gasConsumed,
        },
        updatedImplicationsPair, // Use updated context from Ψ_M
      )
      logger.info('[AccumulatePVM] Accumulate invocation completed', {
        serviceId: serviceId.toString(),
        success: collapsedResult.ok,
        error: collapsedResult.ok ? undefined : collapsedResult.err,
        gasUsed: collapsedResult.ok
          ? collapsedResult.value.gasused.toString()
          : 'N/A',
      })
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
   * Create accumulate context mutator F
   * Gray Paper equation 187: F ∈ contextmutator{implicationspair}
   * Maps host call IDs to accumulate host functions
   */
  private createAccumulateContextMutator(
    timeslot: bigint,
    implicationsPair: ImplicationsPair,
  ): (
    hostCallId: bigint,
    gasCounter: bigint,
    registers: bigint[],
    memory: RAM,
    context: ImplicationsPair,
  ) => {
    resultCode: ResultCode
    gasCounter: bigint
    registers: bigint[]
    memory: RAM
    context: ImplicationsPair
  } {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: bigint[],
      memory: RAM,
      _context: ImplicationsPair,
    ) => {
      // Create refine context for host functions

      try {
        // Gray Paper: Apply gas cost (10 gas for all host functions)
        const gasCost = 10n
        if (gasCounter < gasCost) {
          return {
            resultCode: RESULT_CODES.OOG,
            gasCounter,
            registers,
            memory,
            context: implicationsPair,
          }
        }
        const newGasCounter = gasCounter - gasCost

        // Try accumulate host functions first (14-26)
        if (hostCallId >= 14n && hostCallId <= 26n) {
          const hostFunction =
            this.accumulateHostFunctionRegistry.get(hostCallId)
          if (hostFunction) {
            const hostFunctionContext: AccumulateHostFunctionContext = {
              gasCounter: gasCounter,
              registers,
              ram: memory,
              implications: implicationsPair,
              timeslot,
            }
            const result = hostFunction.execute(hostFunctionContext)
            return {
              resultCode: result.resultCode || RESULT_CODES.PANIC,
              gasCounter: newGasCounter,
              registers,
              memory,
              context: implicationsPair,
            }
          }
        }

        // Try general host functions (0-13)
        const hostFunction = this.hostFunctionRegistry.get(hostCallId)
        if (hostFunction) {
          const result = hostFunction.execute(
            {
              gasCounter: newGasCounter,
              registers,
              ram: memory,
            },
            this.currentRefineContext,
          )

          // Handle both sync and async results
          const resultCode =
            result instanceof Promise
              ? RESULT_CODES.PANIC // For now, treat async as panic - should be handled properly
              : result.resultCode || RESULT_CODES.PANIC

          return {
            resultCode,
            gasCounter: newGasCounter,
            registers,
            memory,
            context: implicationsPair,
          }
        }

        logger.error('Unknown accumulate host function', { hostCallId })
        return {
          resultCode: RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context: implicationsPair,
        }
      } catch (error) {
        logger.error('Accumulate host function execution failed', {
          error,
          hostCallId,
        })
        return {
          resultCode: RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context: implicationsPair,
        }
      } finally {
        // Clear refine context
        this.currentRefineContext = null
      }
    }
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
    // Check type: deferred transfers have type 1
    if (input.type !== 1n) {
      return false
    }

    // Check value exists and is an object
    if (!input.value || typeof input.value !== 'object') {
      return false
    }

    // Type guard: verify value is DeferredTransfer (not OperandTuple)
    // OperandTuple has fields like packageHash, segmentRoot, authorizer, etc.
    // DeferredTransfer has fields: source, dest, amount, memo, gas
    const hasOperandTupleFields =
      'packageHash' in input.value ||
      'segmentRoot' in input.value ||
      'authorizer' in input.value
    if (hasOperandTupleFields) {
      return false
    }

    // Verify all required DeferredTransfer fields exist
    const value = input.value as DeferredTransfer
    const hasSource = 'source' in value && typeof value.source === 'bigint'
    const hasDest = 'dest' in value && typeof value.dest === 'bigint'
    const hasAmount = 'amount' in value && typeof value.amount === 'bigint'
    const hasMemo = 'memo' in value && value.memo instanceof Uint8Array
    const hasGas = 'gas' in value && typeof value.gas === 'bigint'

    // All fields must be present with correct types
    if (!hasSource || !hasDest || !hasAmount || !hasMemo || !hasGas) {
      return false
    }

    // Validate memo size (Gray Paper: Cmemosize = 128 bytes)
    const C_MEMO_SIZE = 128
    if (value.memo.length !== C_MEMO_SIZE) {
      logger.warn('[AccumulatePVM] Deferred transfer memo size mismatch', {
        expected: C_MEMO_SIZE,
        actual: value.memo.length,
      })
      return false
    }

    // Validate service IDs are non-negative and within valid range
    // Gray Paper: serviceid ≡ Nbits{32} (0 ≤ id < 2^32)
    const MAX_SERVICE_ID = 2n ** 32n
    if (
      value.source < 0n ||
      value.source >= MAX_SERVICE_ID ||
      value.dest < 0n ||
      value.dest >= MAX_SERVICE_ID
    ) {
      logger.warn('[AccumulatePVM] Deferred transfer has invalid service ID', {
        source: value.source.toString(),
        dest: value.dest.toString(),
      })
      return false
    }

    // Validate amount is non-negative
    if (value.amount < 0n) {
      logger.warn('[AccumulatePVM] Deferred transfer has negative amount', {
        amount: value.amount.toString(),
      })
      return false
    }

    // Validate gas is non-negative
    if (value.gas < 0n) {
      logger.warn('[AccumulatePVM] Deferred transfer has negative gas', {
        gas: value.gas.toString(),
      })
      return false
    }

    return true
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

    logger.debug('[AccumulatePVM] Calculated nextfreeid', {
      serviceId: serviceId.toString(),
      decodedHash: decodedHash.toString(),
      modulus: MODULUS.toString(),
      minPublicIndex: MIN_PUBLIC_INDEX.toString(),
      nextfreeid: nextfreeid.toString(),
    })

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
    logger.debug(
      '[AccumulatePVM] Implications context initialized successfully',
      {
        serviceId: serviceId.toString(),
        nextfreeid: nextfreeid.toString(),
      },
    )
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
  ): Uint8Array {
    const parts: Uint8Array[] = []

    // 1. Timeslot (4 bytes) - Gray Paper: encode[4]{thetime}
    const timeslotBytes = new Uint8Array(4)
    const timeslotView = new DataView(timeslotBytes.buffer)
    timeslotView.setUint32(0, Number(timeslot), true) // little-endian
    parts.push(timeslotBytes)

    // 2. Service ID (4 bytes) - Gray Paper: encode[4]{serviceid}
    const serviceIdBytes = new Uint8Array(4)
    const serviceIdView = new DataView(serviceIdBytes.buffer)
    serviceIdView.setUint32(0, Number(serviceId), true) // little-endian
    parts.push(serviceIdBytes)

    // 3. Input length (variable) - Gray Paper: encodeNatural pattern
    const [error, lengthEncoded] = encodeNatural(inputLength)
    if (error) {
      throw new Error(`Failed to encode input length: ${error.message}`)
    }
    parts.push(lengthEncoded)

    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    return result
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
    const poststateAccountBalances = Array.from(
      finalImplications.state.accounts.entries(),
    ).map(([id, account]) => ({
      serviceId: id.toString(),
      balance: account.balance.toString(),
    }))
    logger.debug('[AccumulatePVM] Poststate account balances', {
      accountBalances: poststateAccountBalances,
      defxfersCount: finalImplications.xfers.length,
      accumulatedServiceId: finalImplications.id.toString(),
      // Verify reference chain: check if the account object in poststate is the same as in imX
      accumulatedServiceBalance: finalImplications.state.accounts
        .get(finalImplications.id)
        ?.balance.toString(),
    })

    return {
      ok: true,
      value: {
        poststate: finalImplications.state,
        defxfers: finalImplications.xfers,
        yield: finalImplications.yield,
        gasused: executionResult.gasUsed,
        provisions: finalImplications.provisions,
      },
    }
  }
}
