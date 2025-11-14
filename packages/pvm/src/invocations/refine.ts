/**
 * Polkadot Virtual Machine (PVM) Implementation
 *
 * Simplified Gray Paper compliant implementation
 * Gray Paper Reference: pvm.tex
 */

import { bytesToHex, logger } from '@pbnj/core'
import { encodeRefineArguments } from '@pbnj/codec'
import type {
  IServiceAccountService,
  PVMOptions,
  RAM,
  RefineInvocationContext,
  ResultCode,
  Segment,
  WorkError,
  WorkItem,
  WorkPackage,
} from '@pbnj/types'

import { ACCUMULATE_INVOCATION_CONFIG, RESULT_CODES } from '../config'
import type { HostFunctionRegistry } from '../host-functions/general/registry'
import { PVM } from '../pvm'

export class RefinePVM extends PVM {
  private readonly serviceAccountService: IServiceAccountService
  constructor(
    hostFunctionRegistry: HostFunctionRegistry,
    serviceAccountService: IServiceAccountService,
    options: PVMOptions = {},
  ) {
    super(hostFunctionRegistry, options)
    this.serviceAccountService = serviceAccountService
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
  public async executeRefine(
    coreIndex: bigint,
    workItemIndex: bigint,
    workPackage: WorkPackage,
    authorizerTrace: Uint8Array,
    importSegments: Uint8Array[][],
    exportSegmentOffset: bigint,
  ): Promise<{
    result: Uint8Array | WorkError
    exportSegments: Uint8Array[]
    gasUsed: bigint
  }> {
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
      const [error, marshallingResult] =
        await this.executeMarshallingInvocation(
          serviceCode,
          0n, // Initial PC = 0 (Gray Paper)
          ACCUMULATE_INVOCATION_CONFIG.MAX_SERVICE_CODE_SIZE, // Use accumulate config for now
          encodedArgs,
          refineContextMutator,
          refineContext,
        )
      if (error) {
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }

      // Extract values from Ψ_M return: (gas consumed, result, updated context)
      const {
        gasConsumed,
        result: marshallingResultValue,
        context: updatedRefineContext,
      } = marshallingResult

      // Extract export segments from updated context
      const exportSegments = updatedRefineContext.exportSegments

      // Return result, export segments, and gas used
      // marshallingResultValue is already Uint8Array | 'PANIC' | 'OOG'
      let result: Uint8Array | 'BAD'
      if (
        marshallingResultValue === 'PANIC' ||
        marshallingResultValue === 'OOG'
      ) {
        result = 'BAD'
      } else {
        result = marshallingResultValue
      }

      return {
        result,
        exportSegments,
        gasUsed: gasConsumed,
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
  private getServiceCodeFromWorkItem(workItem: WorkItem): Uint8Array | null {
    // For now, return a placeholder
    const [error, serviceAccount] =
      this.serviceAccountService.getServiceAccount(workItem.serviceindex)
    if (error) {
      return null
    }
    if (!serviceAccount) {
      return null
    }
    const preimage = serviceAccount.preimages.get(workItem.codehash)
    if (!preimage) {
      return null
    }
    return preimage
  }

  /**
   * Create Refine context mutator F
   * Gray Paper equation 93-118: F ∈ contextmutator{tuple{dictionary{N}{pvmguest}, sequence{segment}}}
   */
  private createRefineContextMutator(_refineContext: RefineInvocationContext): (
    hostCallId: bigint,
    gasCounter: bigint,
    registers: bigint[],
    memory: RAM,
    context: RefineInvocationContext,
  ) => {
    resultCode: ResultCode
    gasCounter: bigint
    registers: bigint[]
    memory: RAM
    context: RefineInvocationContext
  } {
    return (
      hostCallId: bigint,
      gasCounter: bigint,
      registers: bigint[],
      memory: RAM,
      context: RefineInvocationContext,
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

        // Create log function for refine host function context
        const refineHostFunctionLog = (
          message: string,
          data?: Record<string, unknown>,
        ) => {
          if (!this.executionLogs) {
            this.executionLogs = []
          }
          this.executionLogs.push({
            pc: this.state.instructionPointer,
            instructionName: `HOST_${hostFunction.name}`,
            opcode: `0x${hostCallId.toString(16)}`,
            message,
            data,
            timestamp: Date.now(),
          })
        }

        // Execute host function with Refine context
        const result = hostFunction.execute(
          {
            gasCounter,
            registers,
            ram: memory,
            log: refineHostFunctionLog,
          },
          context,
        )

        return {
          resultCode:
            result instanceof Promise
              ? RESULT_CODES.PANIC
              : result.resultCode || RESULT_CODES.PANIC,
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
    workPackage: WorkPackage,
    workItemIndex: bigint,
    authorizerTrace: Uint8Array,
    importSegments: Uint8Array[][],
    exportSegmentOffset: bigint,
  ): RefineInvocationContext {
    return {
      // Core refine context pair (Gray Paper: (m, e))
      machines: new Map(),
      exportSegments: [],
      // Refine invocation parameters (Gray Paper: c, i, p, r, ī, segoff)
      coreIndex: 0n, // c: Core index - will be set from work package
      workItemIndex, // i: Work item index
      workPackage, // p: Work package
      authorizerTrace: bytesToHex(authorizerTrace), // r: Authorizer trace
      importSegments: importSegments as Segment[][], // ī: Import segments by work item (Segment = Uint8Array)
      exportSegmentOffset, // segoff: Export segment offset
      // Additional context from refine invocation
      accountsDictionary: new Map(), // Will be populated from recent state
      lookupTimeslot: 0n, // Will be set from work package context
      currentServiceId: 0n, // Will be set from work item
    }
  }
}
