/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { blake2bHash, logger } from '@pbnj/core'
import { decodePreimage } from '@pbnj/serialization'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  DeferredTransfer,
  IConfigService,
  Implications,
  ImplicationsPair,
  IPreimageHolderService,
  PartialState,
  PVMOptions,
  RAM,
  ResultCode,
} from '@pbnj/types'
import { ACCUMULATE_INVOCATION_CONFIG, RESULT_CODES } from '../config'
import { PVM } from '../pvm'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class AccumulatePVM extends PVM {
  constructor(
    preimageService: IPreimageHolderService,
    configService: IConfigService,
    options: PVMOptions = {},
  ) {
    super(options)
    this.preimageService = preimageService
    this.state.gasCounter =
      options.gasCounter || BigInt(configService.maxBlockGas)
  }

  /**
   * Execute accumulate invocation (Ψ_A)
   *
   * @param partialState - Current partial state
   * @param timeslot - Current block timeslot
   * @param serviceId - Service account ID
   * @param gas - Available gas
   * @param inputs - Sequence of accumulation inputs
   * @returns AccumulateInvocationResult
   */
  public executeAccumulate(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput[],
  ): AccumulateInvocationResult {
    try {
      // Check if service exists and get its code
      const serviceAccount = partialState.accounts.get(serviceId)
      if (!serviceAccount) {
        return { ok: false, err: 'BAD' }
      }

      const preimageData = serviceAccount.preimages.get(serviceAccount.codehash)
      if (!preimageData) {
        return { ok: false, err: 'BAD' }
      }

      // Decode the preimage to extract metadata + code
      const [error, preimageResult] = decodePreimage(preimageData)
      if (error) {
        return { ok: false, err: 'BAD' }
      }
      const { blob: codeHex } = preimageResult.value
      // Convert hex string to Uint8Array
      const serviceCode = new Uint8Array(Buffer.from(codeHex.slice(2), 'hex'))

      // Check for null code or oversized code (Gray Paper eq:accinvocation)
      if (
        !serviceCode ||
        serviceCode.length === 0 ||
        serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
      ) {
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
      const postTransferState = this.calculatePostTransferState(
        partialState,
        serviceId,
        inputs,
      )

      // Initialize Implications context
      const initialContext = this.initializeImplicationsContext(
        postTransferState,
        serviceId,
        timeslot,
      )

      // Encode arguments: timeslot, serviceId, input length
      const encodedArgs = this.encodeAccumulateArguments(
        timeslot,
        serviceId,
        BigInt(inputs.length),
      )

      // Create accumulate context mutator F
      const accumulateContextMutator = this.createAccumulateContextMutator(
        postTransferState,
        serviceId,
        timeslot,
      )

      // Execute Ψ_M(c, 5, g, encode(t, s, len(i)), F, I(postxferstate, s)^2)
      const marshallingResult = this.executeMarshallingInvocation(
        serviceCode,
        5n, // Initial PC = 5 (Gray Paper)
        gas,
        encodedArgs,
        accumulateContextMutator,
        initialContext,
      )

      // Collapse result based on termination type
      return this.collapseAccumulateResult(
        {
          resultCode: marshallingResult.result as ResultCode,
          gasUsed: marshallingResult.gasUsed,
        },
        marshallingResult.finalContext,
      )
    } catch (error) {
      logger.error('Accumulate invocation failed', { error, serviceId })
      return { ok: false, err: 'BAD' }
    }
  }

  /**
   * Create accumulate context mutator F
   * Gray Paper equation 187: F ∈ contextmutator{implicationspair}
   * Maps host call IDs to accumulate host functions
   */
  private createAccumulateContextMutator(
    _partialState: PartialState,
    _serviceId: bigint,
    timeslot: bigint,
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
      context: ImplicationsPair,
    ) => {
      // Create refine context for host functions

      try {
        // Get accumulate host function by ID
        const hostFunction = this.accumulateHostFunctionRegistry.get(hostCallId)

        if (!hostFunction) {
          logger.error('Unknown accumulate host function', { hostCallId })
          return {
            resultCode: RESULT_CODES.PANIC,
            gasCounter,
            registers,
            memory,
            context,
          }
        }

        // Execute host function
        const result = hostFunction.execute(
          gasCounter,
          registers,
          memory,
          context,
          timeslot,
        )

        return {
          resultCode: result.resultCode || RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context,
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
          context,
        }
      } finally {
        // Clear refine context
        this.currentRefineContext = undefined
      }
    }
  }

  /**
   * Calculate post-transfer state
   */
  private calculatePostTransferState(
    partialState: PartialState,
    serviceId: bigint,
    inputs: AccumulateInput[],
  ): PartialState {
    // Extract deferred transfers
    const deferredTransfers = inputs
      .filter((input) => input.type === 1n)
      .map((input) => input.value as DeferredTransfer)

    // Calculate total transfer amount to service
    const totalTransferAmount = deferredTransfers
      .filter((transfer) => transfer.dest === serviceId)
      .reduce((sum, transfer) => sum + transfer.amount, 0n)

    // Update service balance
    const updatedAccounts = new Map(partialState.accounts)
    const serviceAccount = updatedAccounts.get(serviceId)
    if (serviceAccount) {
      updatedAccounts.set(serviceId, {
        ...serviceAccount,
        balance: serviceAccount.balance + totalTransferAmount,
      })
    }

    return {
      ...partialState,
      accounts: updatedAccounts,
    }
  }

  /**
   * Initialize Implications context
   */
  private initializeImplicationsContext(
    partialState: PartialState,
    serviceId: bigint,
    _timeslot: bigint,
  ): ImplicationsPair {
    // Calculate nextfreeid using Gray Paper formula
    const entropy = new Uint8Array(32) // Simplified - would use actual entropy
    const entropyAccumulator = blake2bHash(entropy)
    // Convert hex string to number for calculation
    const entropyNum = BigInt(`0x${entropyAccumulator.slice(0, 8)}`)
    const nextfreeid = BigInt(
      (entropyNum % (2n ** 32n - 1_000_000n - 2n ** 8n)) + 1_000_000n,
    )

    const implications: Implications = {
      id: serviceId,
      state: partialState,
      nextfreeid,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    // Return both regular and exceptional dimensions
    return [
      implications, // Regular dimension (imX)
      { ...implications, xfers: [], yield: null, provisions: new Map() }, // Exceptional dimension (imY)
    ]
  }

  /**
   * Encode accumulate arguments
   */
  private encodeAccumulateArguments(
    timeslot: bigint,
    serviceId: bigint,
    inputLength: bigint,
  ): Uint8Array {
    const buffer = new ArrayBuffer(24) // 8 + 8 + 8 bytes
    const view = new DataView(buffer)

    view.setBigUint64(0, timeslot, true) // Little endian
    view.setBigUint64(8, serviceId, true)
    view.setBigUint64(16, inputLength, true)

    return new Uint8Array(buffer)
  }

  /**
   * Collapse accumulate result
   */
  private collapseAccumulateResult(
    executionResult: { resultCode: ResultCode; gasUsed: bigint },
    implicationsPair: ImplicationsPair,
  ): AccumulateInvocationResult {
    const [imX, imY] = implicationsPair

    // Use regular dimension for normal termination, exceptional for panic/oog
    const finalImplications =
      executionResult.resultCode === RESULT_CODES.HALT ? imX : imY
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
