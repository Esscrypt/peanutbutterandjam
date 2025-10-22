/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { logger } from '@pbnj/core'
import { encodeRefineArguments } from '@pbnj/serialization'
import type {
  IPreimageHolderService,
  RAM,
  RefineContextPVM,
  ResultCode,
  WorkError,
  WorkItem,
  WorkPackage,
} from '@pbnj/types'

import { ACCUMULATE_INVOCATION_CONFIG, RESULT_CODES } from '../config'

import { PVM } from '../pvm'

/**
 * Simplified PVM implementation
 *
 * Gray Paper Ψ function: Executes instructions until a halting condition
 */
export class RefinePVM extends PVM {
  constructor(options: PVMOptions, preimageService: IPreimageHolderService) {
    super(options)
    this.preimageService = preimageService
  }

  /**
   * Ψ_R - Refine Invocation
   * Gray Paper equation 78-80: Ψ_R(coreindex, N, workpackage, blob, sequence<sequence<segment>>, N) → (blob | workerror, sequence<segment>, gas)
   *
   * @param coreIndex - Core doing the refining
   * @param workItemIndex - Index of work item to refine
   * @param workPackage - Work package
   * @param authorizerTrace - Authorizer trace blob
   * @param importSegments - Import segments for all work items
   * @param exportSegmentOffset - Export segment offset
   * @returns Tuple of (result, exportSegments, gasUsed)
   */
  public executeRefine(
    coreIndex: bigint,
    workItemIndex: bigint,
    workPackage: WorkPackage,
    authorizerTrace: Uint8Array,
    importSegments: Uint8Array[][],
    exportSegmentOffset: bigint,
  ): {
    result: Uint8Array | WorkError
    exportSegments: Uint8Array[]
    gasUsed: bigint
  } {
    try {
      // Get the work item to refine
      const workItem = workPackage.workItems[Number(workItemIndex)]
      if (!workItem) {
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }

      // Get service code from work item
      const serviceCode = this.getServiceCodeFromWorkItem(workItem)
      if (!serviceCode) {
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }

      // Check for oversized service code
      if (
        serviceCode.length > ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE
      ) {
        return { result: 'BIG', exportSegments: [], gasUsed: 0n }
      }

      // Encode arguments for refine invocation
      const encodedArgs = this.encodeRefineArguments(
        coreIndex,
        workItemIndex,
        workPackage,
        workItem,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
      )

      // Create refine context
      const refineContext = this.createRefineContext(
        workPackage,
        workItemIndex,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
      )

      // Create Refine context mutator F
      const refineContextMutator =
        this.createRefineContextMutator(refineContext)

      // Execute Ψ_M(serviceCode, 0, Cpackagerefgas, encodedArgs, F, refineContext)
      const marshallingResult = this.executeMarshallingInvocation(
        serviceCode,
        0n, // Initial PC = 0 (Gray Paper)
        ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE, // Use accumulate config for now
        encodedArgs,
        refineContextMutator,
        refineContext,
      )

      // Extract export segments from context
      const exportSegments = refineContext.exportSegments

      // Return result, export segments, and gas used
      return {
        result:
          marshallingResult.result === RESULT_CODES.HALT
            ? this.extractResultFromMemory()
            : 'BAD',
        exportSegments,
        gasUsed: marshallingResult.gasUsed,
      }
    } catch (error) {
      logger.error('Refine invocation failed', {
        error,
        coreIndex,
        workItemIndex,
      })
      return { result: 'BAD', exportSegments: [], gasUsed: 0n }
    }
  }

  /**
   * Get service code from work item
   * In practice, this would retrieve from service preimages using codeHash
   */
  private getServiceCodeFromWorkItem(_workItem: WorkItem): Uint8Array | null {
    // TODO: Implement proper preimage lookup using workItem.codeHash
    // For now, return a placeholder
    return new Uint8Array([0x00, 0x01, 0x02, 0x03]) // Placeholder
  }

  /**
   * Create Refine context mutator F
   * Gray Paper equation 93-118: F ∈ contextmutator{tuple{dictionary{N}{pvmguest}, sequence{segment}}}
   */
  private createRefineContextMutator(_refineContext: RefineContextPVM): (
    hostCallId: bigint,
    gasCounter: bigint,
    registers: bigint[],
    memory: RAM,
    context: RefineContextPVM,
  ) => {
    resultCode: ResultCode
    gasCounter: bigint
    registers: bigint[]
    memory: RAM
    context: RefineContextPVM
  } {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: bigint[],
      memory: RAM,
      context: RefineContextPVM,
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
            context,
          }
        }

        // Execute host function with Refine context
        const result = hostFunction.execute({
          gasCounter,
          registers,
          ram: memory,
        })

        return {
          resultCode: result.resultCode || RESULT_CODES.PANIC,
          gasCounter,
          registers,
          memory,
          context,
        }
      } catch (error) {
        logger.error('Refine host function execution failed', {
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
      }
    }
  }

  /**
   * Encode arguments for refine invocation using proper serialization
   * Gray Paper equation 85: 𝐚 = encode{c, i, w_wi¬serviceindex, var{w_wi¬payload}, blake{p}}
   */
  private encodeRefineArguments(
    coreIndex: bigint,
    workItemIndex: bigint,
    workPackage: WorkPackage,
    workItem: WorkItem,
    authorizerTrace: Uint8Array,
    _importSegments: Uint8Array[][],
    _exportSegmentOffset: bigint,
  ): Uint8Array {
    // Create a work item with the authorizer trace as payload
    const workItemWithTrace: WorkItem = {
      ...workItem,
      payload: authorizerTrace,
    }

    const [error, encodedArgs] = encodeRefineArguments(
      coreIndex,
      workItemIndex,
      workItemWithTrace,
      workPackage,
    )

    if (error) {
      logger.error('Failed to encode refine arguments', {
        error: error.message,
      })
      throw new Error(`Failed to encode refine arguments: ${error.message}`)
    }

    return encodedArgs
  }

  /**
   * Create refine context
   */
  private createRefineContext(
    _workPackage: WorkPackage,
    _workItemIndex: bigint,
    _authorizerTrace: Uint8Array,
    _importSegments: Uint8Array[][],
    _exportSegmentOffset: bigint,
  ): RefineContextPVM {
    return {
      currentServiceId: 0n, // Will be set from work item
      accountsDictionary: new Map(), // Will be populated from recent state
      lookupTimeslot: 0n, // Will be set from work package context
      machines: new Map(),
      exportSegments: [],
    }
  }
}
