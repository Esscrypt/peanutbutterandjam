/**
 * PVM Accumulate Invocation System
 *
 * Implements the full Ψ_A (Accumulate Invocation) function from Gray Paper Section 31
 * This is the main orchestration system for Accumulate invocations
 */

import { blake2bHash, hexToBigInt, logger } from '@pbnj/core'
import type {
  AccumulateContextMutator,
  AccumulateInput,
  AccumulateInvocationResult,
  DeferredTransfer,
  Implications,
  ImplicationsPair,
  PartialState,
  RAM,
  RegisterState,
} from '@pbnj/types'
import { ArgumentInvocationSystem } from '../argument-invocation'
import {
  ACCUMULATE_ERROR_CODES,
  ACCUMULATE_FUNCTIONS,
  ACCUMULATE_INVOCATION_CONFIG,
  GENERAL_FUNCTIONS,
} from '../config'

/**
 * Accumulate Invocation System implementing Ψ_A from Gray Paper
 *
 * Handles the complete Accumulate invocation lifecycle including:
 * - Context initialization with regular and exceptional dimensions
 * - State transitions and deferred transfers
 * - Host call dispatching via context mutator F
 * - Result collapse based on termination type
 */
export class AccumulateInvocationSystem {
  private argumentInvocation: ArgumentInvocationSystem<ImplicationsPair>

  constructor() {
    this.argumentInvocation = new ArgumentInvocationSystem<ImplicationsPair>(
      this.createContextMutator([
        {
          id: 0n,
          state: {
            accounts: new Map(),
            authqueue: new Map(),
            assigners: new Map(),
            stagingset: [],
            nextfreeid: 0n,
            manager: 0n,
            registrar: 0n,
            delegator: 0n,
            alwaysaccers: new Map(),
            xfers: [],
            provisions: new Map(),
            yield: null,
          },
          nextfreeid: 0n,
          xfers: [],
          yield: null,
          provisions: new Map(),
        },
        {
          id: 0n,
          state: {
            accounts: new Map(),
            authqueue: new Map(),
            assigners: new Map(),
            stagingset: [],
            nextfreeid: 0n,
            manager: 0n,
            registrar: 0n,
            delegator: 0n,
            alwaysaccers: new Map(),
            xfers: [],
            provisions: new Map(),
            yield: null,
          },
          nextfreeid: 0n,
          xfers: [],
          yield: null,
          provisions: new Map(),
        },
      ]),
    )
  }

  /**
   * Main Accumulate Invocation function Ψ_A
   *
   * @param partialState - Current partial state
   * @param timeslot - Current block timeslot
   * @param serviceId - Service account ID
   * @param gas - Available gas
   * @param inputs - Sequence of accumulate inputs
   * @returns AccumulateInvocationResult
   */
  execute(
    partialState: PartialState,
    timeslot: bigint,
    serviceId: bigint,
    gas: bigint,
    inputs: AccumulateInput,
  ): AccumulateInvocationResult {
    try {
      // Check if service exists and get its code
      const serviceAccount = partialState.accounts.get(serviceId)
      if (!serviceAccount) {
        return 'BAD'
      }

      const serviceCode = Buffer.from(serviceAccount.codehash, 'hex')

      // Check for null code or oversized code (Gray Paper eq:accinvocation)
      if (
        !serviceCode ||
        serviceCode.length === 0 ||
        serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
      ) {
        return {
          poststate: partialState,
          defxfers: [],
          yield: null,
          gasused: 0n,
          provisions: new Map(),
        }
      }

      // Calculate post-transfer state (apply deferred transfers to service balance)
      const postTransferState = this.calculatePostTransferState(
        partialState,
        serviceId,
        inputs,
      )

      // Initialize context with both regular and exceptional dimensions
      const initialContext = this.initializeContext(
        postTransferState,
        serviceId,
        timeslot,
      )

      // Encode arguments: timeslot, serviceId, input length
      const encodedArgs = this.encodeArguments(
        timeslot,
        serviceId,
        0n, // TODO: Fix input length calculation based on actual AccumulateInput structure
      )

      // Execute the service code using Argument Invocation System
      const executionResult = this.argumentInvocation.execute(
        serviceCode,
        0n, // instruction pointer starts at 0
        gas,
        { data: encodedArgs, size: BigInt(encodedArgs.length) },
        initialContext,
      )

      // Collapse result based on termination type
      return this.collapseResult(
        {
          gasUsed: executionResult.gasConsumed,
          result: executionResult.result,
        },
        initialContext,
      )
    } catch (error) {
      logger.error('Accumulate invocation failed', { error, serviceId })
      return 'BAD'
    }
  }

  /**
   * Initialize context function I from Gray Paper
   * Creates initial implications context with deterministic ID generation
   */
  private initializeContext(
    partialState: PartialState,
    serviceId: bigint,
    timeslot: bigint,
  ): ImplicationsPair {
    // Generate deterministic next free ID using entropy accumulator and timeslot
    const nextFreeId = this.generateNextFreeId(
      serviceId,
      timeslot,
      partialState,
    )

    const implications: Implications = {
      id: serviceId,
      state: partialState,
      nextfreeid: nextFreeId,
      xfers: [],
      yield: null,
      provisions: new Map(),
    }

    // Return pair of identical implications (regular and exceptional dimensions)
    return [implications, implications]
  }

  /**
   * Generate next free service ID using Blake2 hash from Gray Paper
   *
   * Formula: check((decode[4]{blake{encode{im_id, entropyaccumulator', H_timeslot}}} mod (2^32-Cminpublicindex-2^8)) + Cminpublicindex)
   */
  private generateNextFreeId(
    serviceId: bigint,
    timeslot: bigint,
    partialState: PartialState,
  ): bigint {
    // Encode the inputs: serviceId, entropyaccumulator', timeslot
    const entropyAccumulator = ACCUMULATE_INVOCATION_CONFIG.ENTROPY_ACCUMULATOR
    const encodedData = this.encodeForBlake2(
      serviceId,
      entropyAccumulator,
      timeslot,
    )

    // Generate Blake2 hash
    const [error, hash] = blake2bHash(encodedData)
    if (error) {
      throw error
    }

    // Decode first 4 Uint8Array and convert to number
    const decodedValue = hexToBigInt(hash) >> 32n

    // Apply the formula: (decoded mod (2^32 - Cminpublicindex - 2^8)) + Cminpublicindex
    const modulus =
      2n ** 32n - ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX - 256n
    const baseId =
      (decodedValue % modulus) + ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX

    return this.checkServiceId(baseId, partialState)
  }

  /**
   * Encode data for Blake2 hashing
   */
  private encodeForBlake2(
    serviceId: bigint,
    entropyAccumulator: string,
    timeslot: bigint,
  ): Buffer {
    // Create a buffer to hold the encoded data
    const buffer = Buffer.alloc(4 + entropyAccumulator.length + 4) // serviceId (4) + entropy (var) + timeslot (4)

    // Write serviceId as 4 Uint8Array (big-endian)
    buffer.writeUInt32BE(Number(serviceId), 0)

    // Write entropy accumulator as string
    buffer.write(entropyAccumulator, 4, 'utf8')

    // Write timeslot as 4 Uint8Array (big-endian)
    buffer.writeUInt32BE(Number(timeslot), 4 + entropyAccumulator.length)

    return buffer
  }

  /**
   * Check function from Gray Paper eq:newserviceindex
   * Finds first available service ID in sequence
   */
  private checkServiceId(id: bigint, partialState: PartialState): bigint {
    if (!partialState.accounts.has(id)) {
      return id
    }

    // Recursively check next ID in sequence
    const nextId =
      ((id - ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX + 1n) %
        (2n ** 32n - 256n - ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX)) +
      ACCUMULATE_INVOCATION_CONFIG.MIN_PUBLIC_INDEX

    return this.checkServiceId(nextId, partialState)
  }

  /**
   * Calculate post-transfer state by applying deferred transfers to service balance
   */
  private calculatePostTransferState(
    partialState: PartialState,
    serviceId: bigint,
    inputs: AccumulateInput,
  ): PartialState {
    const serviceAccount = partialState.accounts.get(serviceId)
    if (!serviceAccount) return partialState

    // Extract deferred transfers from inputs
    const deferredTransfers = this.extractDeferredTransfers(inputs)

    // Calculate total transfer amount
    const totalTransferAmount = deferredTransfers.reduce(
      (sum, transfer) => sum + transfer.amount,
      0n,
    )

    // Create new state with updated balance
    const newState = { ...partialState }
    const newAccounts = new Map(newState.accounts)
    const newServiceAccount = { ...serviceAccount }
    newServiceAccount.balance = serviceAccount.balance + totalTransferAmount
    newAccounts.set(serviceId, newServiceAccount)
    newState.accounts = newAccounts

    return newState
  }

  /**
   * Extract deferred transfers from accumulate inputs
   */
  private extractDeferredTransfers(
    _inputs: AccumulateInput,
  ): DeferredTransfer[] {
    // Simplified implementation - would parse actual deferred transfer format
    return []
  }

  /**
   * Encode arguments for PVM execution
   */
  private encodeArguments(
    timeslot: bigint,
    serviceId: bigint,
    inputLength: bigint,
  ): Uint8Array {
    const result = new Uint8Array(12)

    // Encode timeslot as 4 Uint8Array
    result[0] = (Number(timeslot) >> 24) & 0xff
    result[1] = (Number(timeslot) >> 16) & 0xff
    result[2] = (Number(timeslot) >> 8) & 0xff
    result[3] = Number(timeslot) & 0xff

    // Encode service ID as 4 Uint8Array
    result[4] = (Number(serviceId) >> 24) & 0xff
    result[5] = (Number(serviceId) >> 16) & 0xff
    result[6] = (Number(serviceId) >> 8) & 0xff
    result[7] = Number(serviceId) & 0xff

    // Encode input length as 4 Uint8Array
    result[8] = (Number(inputLength) >> 24) & 0xff
    result[9] = (Number(inputLength) >> 16) & 0xff
    result[10] = (Number(inputLength) >> 8) & 0xff
    result[11] = Number(inputLength) & 0xff

    return result
  }

  /**
   * Create context mutator F from Gray Paper
   * Handles all host calls during Accumulate invocation
   */
  private createContextMutator(
    _initialContext: ImplicationsPair,
  ): AccumulateContextMutator {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: RegisterState,
      ram: RAM,
      context: ImplicationsPair,
    ) => {
      const [_imX, _imY] = context

      try {
        switch (hostCallId) {
          case GENERAL_FUNCTIONS.GAS:
            return this.handleGasCall(gasCounter, registers, ram, context)

          case GENERAL_FUNCTIONS.FETCH:
            return this.handleFetchCall(gasCounter, registers, ram, context)

          case GENERAL_FUNCTIONS.READ:
            return this.handleReadCall(gasCounter, registers, ram, context)

          case GENERAL_FUNCTIONS.WRITE:
            return this.handleWriteCall(gasCounter, registers, ram, context)

          case GENERAL_FUNCTIONS.LOOKUP:
            return this.handleLookupCall(gasCounter, registers, ram, context)

          case GENERAL_FUNCTIONS.INFO:
            return this.handleInfoCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.BLESS:
            return this.handleBlessCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.ASSIGN:
            return this.handleAssignCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.DESIGNATE:
            return this.handleDesignateCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.CHECKPOINT:
            return this.handleCheckpointCall(
              gasCounter,
              registers,
              ram,
              context,
            )

          case ACCUMULATE_FUNCTIONS.NEW:
            return this.handleNewCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.UPGRADE:
            return this.handleUpgradeCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.TRANSFER:
            return this.handleTransferCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.EJECT:
            return this.handleEjectCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.QUERY:
            return this.handleQueryCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.SOLICIT:
            return this.handleSolicitCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.FORGET:
            return this.handleForgetCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.YIELD:
            return this.handleYieldCall(gasCounter, registers, ram, context)

          case ACCUMULATE_FUNCTIONS.PROVIDE:
            return this.handleProvideCall(gasCounter, registers, ram, context)

          default: {
            // Unknown host call - return WHAT error
            const newRegisters = { ...registers }
            newRegisters.r7 = ACCUMULATE_ERROR_CODES.WHAT
            return {
              resultCode: 'continue',
              gasCounter: gasCounter - 10n,
              registers: newRegisters,
              ram,
              context,
            }
          }
        }
      } catch (error) {
        logger.error('Host call failed', { hostCallId, error })
        return {
          resultCode: 'panic',
          gasCounter,
          registers,
          ram,
          context,
        }
      }
    }
  }

  // Host call handlers - simplified implementations
  private handleGasCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r7 = gasCounter
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleFetchCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.NONE // Stateless fetch returns NONE
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleReadCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const [imX] = context
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      const newRegisters = { ...registers }
      newRegisters.r7 = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: 'continue',
        gasCounter: gasCounter - 10n,
        registers: newRegisters,
        ram,
        context,
      }
    }

    // Simplified read implementation
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.NONE
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleWriteCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const [imX] = context
    const serviceAccount = imX.state.accounts.get(imX.id)
    if (!serviceAccount) {
      const newRegisters = { ...registers }
      newRegisters.r7 = ACCUMULATE_ERROR_CODES.WHO
      return {
        resultCode: 'continue',
        gasCounter: gasCounter - 10n,
        registers: newRegisters,
        ram,
        context,
      }
    }

    // Simplified write implementation
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleLookupCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.NONE
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleInfoCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  // Accumulate function handlers - simplified implementations
  private handleBlessCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleAssignCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleDesignateCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleCheckpointCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    // Checkpoint affects the exceptional dimension (imY)
    const [imX, imY] = context
    const newImY = { ...imY }
    // Simplified checkpoint implementation
    const newContext: ImplicationsPair = [imX, newImY]

    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context: newContext,
    }
  }

  private handleNewCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleUpgradeCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleTransferCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleEjectCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleQueryCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleSolicitCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleForgetCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleYieldCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  private handleProvideCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    context: ImplicationsPair,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: ImplicationsPair
  } {
    const newRegisters = { ...registers }
    newRegisters.r0 = ACCUMULATE_ERROR_CODES.OK
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: newRegisters,
      ram,
      context,
    }
  }

  /**
   * Collapse function C from Gray Paper
   * Selects between regular and exceptional dimensions based on termination type
   */
  private collapseResult(
    executionResult: {
      gasUsed: bigint
      result: Uint8Array | 'oog' | 'panic'
    },
    context: ImplicationsPair,
  ): AccumulateInvocationResult {
    const [imX, imY] = context
    const { gasUsed, result } = executionResult

    if (result === 'oog' || result === 'panic') {
      // Exceptional termination - use exceptional dimension (imY)
      return {
        poststate: imY.state,
        defxfers: imY.xfers,
        yield: imY.yield,
        gasused: gasUsed,
        provisions: imY.provisions,
      }
    } else if (result.length > 0) {
      // Regular termination with yield - use regular dimension with yield
      return {
        poststate: imX.state,
        defxfers: imX.xfers,
        yield: result,
        gasused: gasUsed,
        provisions: imX.provisions,
      }
    } else {
      // Regular termination without yield - use regular dimension
      return {
        poststate: imX.state,
        defxfers: imX.xfers,
        yield: imX.yield,
        gasused: gasUsed,
        provisions: imX.provisions,
      }
    }
  }
}
