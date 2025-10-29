/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnj/core'
import type {
  IServiceAccountService,
  PVMOptions,
  RAM,
  ResultCode,
  WorkError,
  WorkPackage,
} from '@pbnj/types'
import {
  IS_AUTHORIZED_CONFIG,
  RESULT_CODES,
} from '../config'

import { PVM } from '../pvm'
import type { HostFunctionRegistry } from '../host-functions/general/registry'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class IsAuthorizedPVM extends PVM {
  private readonly serviceAccountService: IServiceAccountService

  constructor(options: {hostFunctionRegistry: HostFunctionRegistry
    serviceAccountService: IServiceAccountService
    pvmOptions?: PVMOptions
  }) {
    super(options.hostFunctionRegistry, options.pvmOptions)
    this.serviceAccountService = options.serviceAccountService
  }

  /**
   * Ψ_I - Is-Authorized Invocation
   * Gray Paper equation 37-38: Ψ_I(workpackage, coreindex) → (blob | workerror, gas)
   *
   * @param workPackage - The work package containing authorization code
   * @param coreIndex - The core index on which to execute
   * @returns Tuple of (result, gasUsed)
   */
  public async executeIsAuthorized(
    workPackage: WorkPackage,
    coreIndex: bigint,
  ): Promise<{
    result: Uint8Array | WorkError
    gasUsed: bigint
  }> {
      // Check if auth code exists (Gray Paper eq:isauthinvocation)
      if (!workPackage.authCodeHash) {
        return { result: 'BAD', gasUsed: 0n }
      }

      // do a lookup in the service account service
      const [error, authCode] = this.serviceAccountService.histLookup(workPackage.authCodeHash, workPackage.context.lookup_anchor_slot)
      if (error) {
        return { result: 'BAD', gasUsed: 0n }
      }

      // Get auth code from work package
      // Note: In practice, this would need to be retrieved from the service's preimages
      // using workPackage.authCodeHash as the key
      const [error, authCode] = this.serviceAccountService.getPreimage(
        workPackage.context.lookup_anchor_slot,
        workPackage.authCodeHash,
      )
      if (error) {
        return { result: 'BAD', gasUsed: 0n }
      }

      if (!authCode) {
        return { result: 'BAD', gasUsed: 0n }
      }

      // Check for oversized auth code (Gray Paper eq:isauthinvocation)
      if (authCode.blob.length > IS_AUTHORIZED_CONFIG.MAX_AUTH_CODE_SIZE) {
        return { result: 'BIG', gasUsed: 0n }
      }

      // Encode core index as 2-byte argument
      const encodedArgs = new ArrayBuffer(2)
      const view = new DataView(encodedArgs)
      view.setUint16(0, Number(coreIndex), true) // Little endian

      // Create Is-Authorized context mutator F
      const isAuthorizedContextMutator =
        this.createIsAuthorizedContextMutator(workPackage)

      // Execute Ψ_M(authCode, 0, Cpackageauthgas, encode[2]{c}, F, none)
      await this.executeMarshallingInvocation(
        authCode.blob,
        0n, // Initial PC = 0 (Gray Paper)
        IS_AUTHORIZED_CONFIG.PACKAGE_AUTH_GAS,
        new Uint8Array(encodedArgs),
        isAuthorizedContextMutator,
        null, // Context is none for Is-Authorized
      )

      if(this.state.resultCode === RESULT_CODES.PANIC) {
        return {
          gasUsed: this.state.gasCounter,
          result: 'PANIC',
        }
      }

      if(this.state.resultCode === RESULT_CODES.OOG) {
        return {
          gasUsed: this.state.gasCounter,
          result: 'OOG',
        }
      }

      return {
        gasUsed: this.state.gasCounter,
        result: this.state.resultCode === RESULT_CODES.HALT ? this.extractResultFromMemory() : 'BAD',
      }

  }

  /**
   * Create Is-Authorized context mutator F
   * Gray Paper equation 46-54: F ∈ contextmutator{emptyset}
   */
  private createIsAuthorizedContextMutator(_workPackage: WorkPackage): (
    hostCallId: bigint,
    gasCounter: bigint,
    registers: bigint[],
    memory: RAM,
    context: null,
  ) => {
    resultCode: ResultCode
    gasCounter: bigint
    registers: bigint[]
    memory: RAM
    context: null
  } {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: bigint[],
      memory: RAM,
      _context: null,
    ) => {
      try {
        // Get general host function by ID
        const hostFunction = this.hostFunctionRegistry.get(hostCallId)

        if (!hostFunction) {
          logger.error('Unknown general host function', { hostCallId })
          return {
            resultCode: RESULT_CODES.PANIC,
            gasCounter,
            registers,
            memory,
            context: null,
          }
        }

        // Execute host function with Is-Authorized context
        const result = hostFunction.execute({
          gasCounter,
          registers,
          ram: memory,
        }, null)

        return {
          resultCode: result instanceof Promise ? RESULT_CODES.PANIC : result.resultCode || RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context: null,
        }
      } catch (error) {
        logger.error('Is-Authorized host function execution failed', {
          error,
          hostCallId,
        })
        return {
          resultCode: RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context: null,
        }
      }
    }
  }

}
