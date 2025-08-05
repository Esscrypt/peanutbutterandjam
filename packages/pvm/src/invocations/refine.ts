/**
 * Refine Invocation Implementation
 *
 * Implements the Ψ_R function for Refine Invocation as specified in Gray Paper
 * Section 55: Refine Invocation
 *
 * The Refine service-account invocation function has no general access to the state
 * of the Jam chain, with the slight exception being the ability to make a historical lookup.
 * Beyond this it is able to create inner instances of the PVM and dictate pieces of data to export.
 */

import { logger } from '@pbnj/core'
import { ArgumentInvocationSystem } from '../argument-invocation'
import { REFINE_CONFIG } from '../config'
import type {
  Accounts,
  Gas,
  RAM,
  RefineContext,
  RefineContextMutator,
  RefineResult,
  RegisterState,
  Segment,
  ServiceAccount,
  WorkPackage,
} from '../types'

/**
 * Refine Invocation System
 *
 * Implements Ψ_R: ⟨coreindex, N, workpackage, blob, sequence<sequence<segment>>, N⟩ → ⟨blob ∪ workerror, sequence<segment>, gas⟩
 *
 * @param coreIndex - The core on which it should be executed
 * @param workItemIndex - The index of the work item to be refined
 * @param workPackage - The work package
 * @param authorizerTrace - The authorizer trace blob
 * @param importSegments - All work items' import segments
 * @param exportSegmentOffset - Export segment offset
 * @param accounts - Recent service account state
 * @returns Tuple of [result, export_sequence, gas_used]
 */
export class RefineInvocationSystem {
  private argumentInvocationSystem: ArgumentInvocationSystem<RefineContext>

  constructor() {
    // Create argument invocation system with Refine context mutator
    this.argumentInvocationSystem = new ArgumentInvocationSystem(
      this.createContextMutator(),
    )
  }

  /**
   * Execute Refine invocation
   *
   * @param coreIndex - The core index
   * @param workItemIndex - The work item index
   * @param workPackage - The work package
   * @param authorizerTrace - The authorizer trace
   * @param importSegments - Import segments
   * @param exportSegmentOffset - Export segment offset
   * @param accounts - Service accounts state
   * @returns Tuple of [result, export_sequence, gas_used]
   */
  execute(
    coreIndex: number,
    workItemIndex: number,
    workPackage: WorkPackage,
    authorizerTrace: number[],
    importSegments: number[][],
    exportSegmentOffset: number,
    accounts: Accounts,
  ): [RefineResult, Segment[], Gas] {
    logger.debug('RefineInvocationSystem.execute called', {
      coreIndex,
      workItemIndex,
      workPackage: workPackage,
      authorizerTraceSize: authorizerTrace.length,
      importSegmentsCount: importSegments.length,
      exportSegmentOffset,
      accountsCount: Object.keys(accounts).length,
    })

    const workItem = workPackage.workitems[workItemIndex]
    if (!workItem) {
      logger.debug('Refine: work item not found, returning BAD')
      return ['BAD', [], 0n]
    }

    // Check if service account exists
    if (!(workItem.serviceindex in accounts)) {
      logger.debug('Refine: service account not found, returning BAD')
      return ['BAD', [], 0n]
    }

    const serviceAccount = accounts[workItem.serviceindex]

    // Historical lookup for service code
    const historicalCode = this.historicalLookup(
      serviceAccount,
      workPackage.context.lookupanchortime,
      workItem.codehash,
    )

    if (!historicalCode) {
      logger.debug('Refine: historical code lookup failed, returning BAD')
      return ['BAD', [], 0n]
    }

    // Check if code size exceeds maximum
    if (historicalCode.length > REFINE_CONFIG.MAX_SERVICE_CODE_SIZE) {
      logger.debug('Refine: code too large, returning BIG', {
        size: historicalCode.length,
        maxSize: REFINE_CONFIG.MAX_SERVICE_CODE_SIZE,
      })
      return ['BIG', [], 0n]
    }

    // Encode arguments as per Gray Paper
    const encodedArgs = this.encodeArguments(
      coreIndex,
      workItemIndex,
      workItem.serviceindex,
      workItem.payload,
      workPackage,
    )

    // Execute the argument invocation with service code
    const result = this.argumentInvocationSystem.execute(
      historicalCode,
      0, // instruction pointer starts at 0
      workItem.refgaslimit, // gas limit from work item
      { data: encodedArgs, size: encodedArgs.length }, // argument data
      [new Map(), []], // initial context: empty PVM guests map and empty segments
    )

    // Extract result and gas used
    const gasUsed = workItem.refgaslimit - result.gasConsumed

    // Handle different result types
    if (result.result === 'panic') {
      logger.debug('Refine: execution panicked')
      return ['BAD', [], gasUsed]
    }

    if (result.result === 'oog') {
      logger.debug('Refine: execution ran out of gas')
      return ['BIG', [], gasUsed]
    }

    // Success case - return the blob result and empty export sequence
    // In a full implementation, the export sequence would be extracted from the context
    logger.debug('Refine: execution successful', {
      resultSize: result.result.length,
      gasUsed: gasUsed,
    })
    return [result.result, [], gasUsed]
  }

  /**
   * Create the Refine context mutator function F
   *
   * Implements equation eq:refinemutator from Gray Paper
   */
  private createContextMutator(): RefineContextMutator {
    return (
      hostCallId: number,
      gasCounter: Gas,
      registers: RegisterState,
      ram: RAM,
      context: RefineContext,
    ) => {
      logger.debug('Refine context mutator called', { hostCallId })

      // Handle different host call functions
      switch (hostCallId) {
        case 0: // gas function
          return this.handleGasCall(gasCounter, registers, ram, context)

        case 1: // fetch function
          return this.handleFetchCall(gasCounter, registers, ram, context)

        case 6: // historical_lookup function
          return this.handleHistoricalLookupCall(
            gasCounter,
            registers,
            ram,
            context,
          )

        case 7: // export function
          return this.handleExportCall(gasCounter, registers, ram, context)

        case 8: // machine function
          return this.handleMachineCall(gasCounter, registers, ram, context)

        case 9: // peek function
          return this.handlePeekCall(gasCounter, registers, ram, context)

        case 10: // poke function
          return this.handlePokeCall(gasCounter, registers, ram, context)

        case 11: // pages function
          return this.handlePagesCall(gasCounter, registers, ram, context)

        case 12: // invoke function
          return this.handleInvokeCall(gasCounter, registers, ram, context)

        case 13: // expunge function
          return this.handleExpungeCall(gasCounter, registers, ram, context)

        default:
          // Unknown function - return WHAT error in r7
          logger.debug('Refine: unknown host call function', { hostCallId })
          return {
            resultCode: 'continue',
            gasCounter: gasCounter - 10n,
            registers: {
              ...registers,
              r7: 2n, // WHAT error code
            },
            ram,
            context,
          }
      }
    }
  }

  /**
   * Handle gas function call (Ω_G)
   */
  private handleGasCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling gas call')

    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r0: gasCounter,
      },
      ram,
      context,
    }
  }

  /**
   * Handle fetch function call (Ω_Y)
   */
  private handleFetchCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling fetch call')

    // For Refine, fetch returns NONE (no data available)
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r0: 2n ** 64n - 1n, // NONE error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle historical lookup function call (Ω_H)
   */
  private handleHistoricalLookupCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling historical lookup call')

    // Simplified implementation - return NONE
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 1n, // NONE error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle export function call (Ω_E)
   */
  private handleExportCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling export call')

    // Simplified implementation - return FULL error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 2n, // FULL error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle machine function call (Ω_M)
   */
  private handleMachineCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling machine call')

    // Simplified implementation - return HUH error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 3n, // HUH error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle peek function call (Ω_P)
   */
  private handlePeekCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling peek call')

    // Simplified implementation - return WHO error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 4n, // WHO error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle poke function call (Ω_O)
   */
  private handlePokeCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling poke call')

    // Simplified implementation - return WHO error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 4n, // WHO error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle pages function call (Ω_Z)
   */
  private handlePagesCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling pages call')

    // Simplified implementation - return WHO error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 4n, // WHO error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle invoke function call (Ω_K)
   */
  private handleInvokeCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling invoke call')

    // Simplified implementation - return WHO error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 4n, // WHO error code
      },
      ram,
      context,
    }
  }

  /**
   * Handle expunge function call (Ω_X)
   */
  private handleExpungeCall(
    gasCounter: Gas,
    registers: RegisterState,
    ram: RAM,
    context: RefineContext,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: Gas
    registers: RegisterState
    ram: RAM
    context: RefineContext
  } {
    logger.debug('Refine: handling expunge call')

    // Simplified implementation - return WHO error
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r7: 2n ** 64n - 4n, // WHO error code
      },
      ram,
      context,
    }
  }

  /**
   * Historical lookup function as per Gray Paper
   *
   * @param serviceAccount - The service account
   * @param _lookupAnchorTime - The lookup anchor time (unused in simplified implementation)
   * @param codehash - The code hash to lookup
   * @returns The historical code or null if not found
   */
  private historicalLookup(
    serviceAccount: ServiceAccount,
    _lookupAnchorTime: number,
    codehash: number[],
  ): number[] | null {
    // Simplified implementation - return the service account code if codehash matches
    if (this.arraysEqual(serviceAccount.codehash, codehash)) {
      return serviceAccount.codehash
    }
    return null
  }

  /**
   * Encode arguments as per Gray Paper
   *
   * @param coreIndex - The core index
   * @param workItemIndex - The work item index
   * @param serviceIndex - The service index
   * @param payload - The payload
   * @param _workPackage - The work package (unused in simplified implementation)
   * @returns Encoded arguments
   */
  private encodeArguments(
    coreIndex: number,
    workItemIndex: number,
    serviceIndex: number,
    payload: number[],
    _workPackage: WorkPackage,
  ): number[] {
    // Simplified encoding - concatenate all values
    const coreBytes = this.encodeUint32(coreIndex)
    const workItemBytes = this.encodeUint32(workItemIndex)
    const serviceBytes = this.encodeUint32(serviceIndex)
    const payloadLengthBytes = this.encodeUint32(payload.length)

    return [
      ...coreBytes,
      ...workItemBytes,
      ...serviceBytes,
      ...payloadLengthBytes,
      ...payload,
    ]
  }

  /**
   * Encode 32-bit unsigned integer
   */
  private encodeUint32(value: number): number[] {
    const buffer = new ArrayBuffer(4)
    const view = new DataView(buffer)
    view.setUint32(0, value, false) // big-endian
    return Array.from(new Uint8Array(buffer))
  }

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
}
