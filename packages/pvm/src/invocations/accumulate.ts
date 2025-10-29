/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { blake2bHash, logger } from '@pbnj/core'
import { encodeNatural } from '@pbnj/serialization'
import type {
  AccumulateInput,
  AccumulateInvocationResult,
  DeferredTransfer,
  IConfigService,
  Implications,
  ImplicationsPair,
  PartialState,
  PVMOptions,
  RAM,
  ResultCode,
} from '@pbnj/types'
import { ACCUMULATE_INVOCATION_CONFIG, RESULT_CODES } from '../config'
import { PVM } from '../pvm'
import type { HostFunctionRegistry } from '../host-functions/general/registry'
import type { AccumulateHostFunctionRegistry } from '../host-functions/accumulate/registry'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class AccumulatePVM extends PVM {
  private readonly accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    configService: IConfigService
    pvmOptions?: PVMOptions
  }) {
    super(options.hostFunctionRegistry, options.pvmOptions)
    this.accumulateHostFunctionRegistry = options.accumulateHostFunctionRegistry
    this.state.gasCounter = options.pvmOptions?.gasCounter || BigInt(options.configService.maxBlockGas)
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
    try {
      // Gray Paper equation 166: c = local¬basestate_ps¬accounts[s]_sa¬code
      const serviceAccount = partialState.accounts.get(serviceId)
      if (!serviceAccount) {
        return { ok: false, err: 'BAD' }
      }

      // Gray Paper: Get service code from preimages using codehash
      const serviceCode = serviceAccount.preimages.get(serviceAccount.codehash)
      if (!serviceCode) {
        return { ok: false, err: 'BAD' }
      }

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
      const implicationsPair = this.initializeImplicationsContext(
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
      const [error, _] = await this.executeMarshallingInvocation(
        serviceCode,
        5n, // Initial PC = 5 (Gray Paper)
        gas,
        encodedArgs,
        accumulateContextMutator,
        implicationsPair,
      )
      if (error) {
        return { ok: false, err: 'BAD' }
      }

      // Collapse result based on termination type
      return this.collapseAccumulateResult(
        {
          resultCode: this.state.resultCode,
          gasUsed: this.state.gasCounter,
        },
        implicationsPair,
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
        // Gray Paper: Apply gas cost (10 gas for all host functions)
        const gasCost = 10n
        if (gasCounter < gasCost) {
          return {
            resultCode: RESULT_CODES.OOG,
            gasCounter,
            registers,
            memory,
            context,
          }
        }
        const newGasCounter = gasCounter - gasCost

        // Try accumulate host functions first (14-26)
        if (hostCallId >= 14n && hostCallId <= 26n) {
          const hostFunction =
            this.accumulateHostFunctionRegistry.get(hostCallId)
          if (hostFunction) {
            const result = hostFunction.execute(
              newGasCounter,
              registers,
              memory,
              context,
              timeslot,
            )
            return {
              resultCode: result.resultCode || RESULT_CODES.PANIC,
              gasCounter: newGasCounter,
              registers,
              memory,
              context,
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
            context,
          }
        }

        logger.error('Unknown accumulate host function', { hostCallId })
        return {
          resultCode: RESULT_CODES.PANIC,
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
        this.currentRefineContext = null
      }
    }
  }

  /**
   * Calculate post-transfer state
   * Gray Paper equation 168: x = sq{build{i}{i ∈ i, i ∈ defxfer}}
   */
  private calculatePostTransferState(
    partialState: PartialState,
    serviceId: bigint,
    inputs: AccumulateInput[],
  ): PartialState {
    // Gray Paper: Extract deferred transfers (defxfer pattern)
    // For now, assume all inputs are deferred transfers - this should be refined based on actual defxfer definition
    const deferredTransfers = inputs
      .filter((input) => this.isDeferredTransfer(input))
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
   * Check if input is a deferred transfer according to Gray Paper defxfer pattern
   * This is a placeholder - the actual defxfer pattern needs to be defined
   */
  private isDeferredTransfer(input: AccumulateInput): boolean {
    // TODO: Implement proper defxfer pattern matching
    // For now, use a simple heuristic
    return (
      input.type === 1n &&
      input.value &&
      typeof input.value === 'object' &&
      'dest' in input.value
    )
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
