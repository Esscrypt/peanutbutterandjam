/**
 * Is-Authorized Invocation Implementation
 *
 * Implements the Ψ_I function for Is-Authorized Invocation as specified in Gray Paper
 * Section 31: Is-Authorized Invocation
 *
 * The Is-Authorized invocation is a stateless PVM invocation used for work-package authorization.
 * It accepts a workpackage and coreindex and returns a blob or workerror and gas used.
 */

import { logger } from '@pbnj/core'
import type {
  IsAuthorizedContextMutator,
  IsAuthorizedResult,
  RAM,
  RegisterState,
  WorkPackage,
} from '@pbnj/types'
import { ArgumentInvocationSystem } from '../argument-invocation'
import { IS_AUTHORIZED_CONFIG } from '../config'

/**
 * Is-Authorized Invocation System
 *
 * Implements Ψ_I: ⟨workpackage, coreindex⟩ → ⟨blob ∪ workerror, gas⟩
 *
 * @param workPackage - The work package to authorize
 * @param coreIndex - The core index
 * @returns Tuple of [result, gas_used]
 */
export class IsAuthorizedInvocationSystem {
  private readonly argumentInvocationSystem: ArgumentInvocationSystem<null>

  constructor() {
    // Create argument invocation system with Is-Authorized context mutator
    this.argumentInvocationSystem = new ArgumentInvocationSystem(
      this.createContextMutator(),
    )
  }

  /**
   * Execute Is-Authorized invocation
   *
   * @param workPackage - The work package
   * @param coreIndex - The core index
   * @returns Tuple of [result, gas_used]
   */
  execute(
    workPackage: WorkPackage,
    coreIndex: number,
  ): [IsAuthorizedResult, bigint] {
    logger.debug('IsAuthorizedInvocationSystem.execute called', {
      workPackage,
      coreIndex,
    })

    // Extract authcode from work package
    const authcode = workPackage.context.lookup_anchor_slot // Simplified - in real implementation this would be extracted from work package

    // Check if authcode is null (BAD error)
    if (!authcode) {
      logger.debug('Is-Authorized: authcode is null, returning BAD')
      return ['BAD', 0n]
    }

    // Check if authcode exceeds maximum size (BIG error)
    if (authcode > IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE) {
      logger.debug('Is-Authorized: authcode too large, returning BIG', {
        size: authcode,
        maxSize: IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE,
      })
      return ['BIG', 0n]
    }

    // Encode core index as 2-octet array
    const encodedCoreIndex = this.encodeCoreIndex(coreIndex)

    // Execute the argument invocation with authcode and encoded core index
    const result = this.argumentInvocationSystem.execute(
      new Uint8Array([0x01]), // Simplified authcode - in real implementation this would be the actual authcode
      0n, // instruction pointer starts at 0
      IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS, // gas limit from config
      {
        data: new Uint8Array(encodedCoreIndex),
        size: BigInt(encodedCoreIndex.length),
      }, // argument data
      null, // context is null for Is-Authorized
    )

    // Extract gas used
    const gasUsed = IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS - result.gasConsumed

    // Handle different result types
    if (result.result === 'panic') {
      logger.debug('Is-Authorized: execution panicked, returning BAD')
      return ['BAD', gasUsed]
    }

    if (result.result === 'oog') {
      logger.debug('Is-Authorized: execution ran out of gas, returning BIG')
      return ['BIG', gasUsed]
    }

    // Success case - return the blob result
    logger.debug('Is-Authorized: execution successful', {
      resultSize: result.result.length,
      gasUsed: gasUsed,
    })
    return [result.result, gasUsed]
  }

  /**
   * Create the Is-Authorized context mutator function F
   *
   * Implements the context mutator F as specified in Gray Paper Section 31
   */
  private createContextMutator(): IsAuthorizedContextMutator {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: RegisterState,
      ram: RAM,
      context: null,
    ) => {
      logger.debug('Is-Authorized context mutator called', { hostCallId })

      // Handle different host call functions
      switch (hostCallId) {
        case 0n: // gas function
          return this.handleGasCall(gasCounter, registers, ram, context)

        case 1n: // fetch function
          return this.handleFetchCall(gasCounter, registers, ram, context)

        default:
          // Unknown function - return WHAT error in r7
          logger.debug('Is-Authorized: unknown host call function', {
            hostCallId,
          })
          return {
            resultCode: 'continue',
            gasCounter: gasCounter - 10n,
            registers: {
              ...registers,
              r7: 2n, // WHAT error code
            },
            ram,
            context: null,
          }
      }
    }
  }

  /**
   * Handle gas function call (ID 0)
   */
  private handleGasCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    _context: null,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: null
  } {
    logger.debug('Is-Authorized: handling gas call')

    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r0: gasCounter,
      },
      ram,
      context: null,
    }
  }

  /**
   * Handle fetch function call (ID 1)
   */
  private handleFetchCall(
    gasCounter: bigint,
    registers: RegisterState,
    ram: RAM,
    _context: null,
  ): {
    resultCode: 'continue' | 'halt' | 'panic' | 'oog'
    gasCounter: bigint
    registers: RegisterState
    ram: RAM
    context: null
  } {
    logger.debug('Is-Authorized: handling fetch call')

    // For Is-Authorized, fetch returns NONE (no data available)
    return {
      resultCode: 'continue',
      gasCounter: gasCounter - 10n,
      registers: {
        ...registers,
        r0: 2n ** 64n - 1n, // NONE error code
      },
      ram,
      context: null,
    }
  }

  /**
   * Encode core index as 2-octet array
   *
   * @param coreIndex - The core index to encode
   * @returns 2-octet array representation
   */
  private encodeCoreIndex(coreIndex: number): Uint8Array {
    const buffer = new ArrayBuffer(2)
    const view = new DataView(buffer)
    view.setUint16(0, coreIndex, false) // big-endian
    return new Uint8Array(buffer)
  }
}
