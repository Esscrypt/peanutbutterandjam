/**
 * Polkadot Virtual Machine (PVM) Refine Invocation Implementation
 *
 * Gray Paper compliant implementation
 * Gray Paper Reference: pvm_invocations.tex, equations 78-118
 */

import { encodeRefineArguments } from '@pbnjam/codec'
import { logger } from '@pbnjam/core'
import type {
  AccumulateHostFunctionRegistry,
  HostFunctionRegistry,
} from '@pbnjam/pvm'
import { REFINE_CONFIG } from '@pbnjam/pvm'
import type {
  IConfigService,
  IServiceAccountService,
  PVMOptions,
  WorkError,
  WorkPackage,
} from '@pbnjam/types'
import {
  RustPVMExecutor,
  TypeScriptPVMExecutor,
  WasmPVMExecutor,
} from '../pvm-executor-adapters'

/**
 * Refine PVM implementation
 *
 * Gray Paper Ψ_R function: Executes refine invocation for work items
 */
export class RefinePVM {
  private readonly serviceAccountService: IServiceAccountService
  private readonly pvmExecutor:
    | TypeScriptPVMExecutor
    | WasmPVMExecutor
    | RustPVMExecutor
  private readonly useWasm: boolean
  private readonly useRust: boolean

  constructor(options: {
    hostFunctionRegistry: HostFunctionRegistry
    accumulateHostFunctionRegistry: AccumulateHostFunctionRegistry
    serviceAccountService: IServiceAccountService
    configService: IConfigService
    pvmOptions?: PVMOptions
    useWasm: boolean
    useRust?: boolean
    traceSubfolder?: string
  }) {
    this.useWasm = options.useWasm
    this.useRust = options.useRust ?? false
    this.serviceAccountService = options.serviceAccountService

    if (this.useRust) {
      this.pvmExecutor = new RustPVMExecutor(
        options.configService,
        null, // entropyService not needed for refine
        options.traceSubfolder,
      )
    } else if (options.useWasm) {
      this.pvmExecutor = new WasmPVMExecutor(
        options.configService,
        null, // entropyService not needed for refine
        options.serviceAccountService,
        options.traceSubfolder,
      )
    } else {
      this.pvmExecutor = new TypeScriptPVMExecutor(
        options.hostFunctionRegistry,
        options.accumulateHostFunctionRegistry,
        options.configService,
        null, // entropyService not needed for refine
        options.serviceAccountService,
        {
          ...options.pvmOptions,
          gasCounter:
            options.pvmOptions?.gasCounter ||
            BigInt(options.configService.maxRefineGas),
        },
        options.traceSubfolder,
      )
    }
  }

  /**
   * Execute refine invocation (Ψ_R)
   *
   * Gray Paper Equation 78-89: Ψ_R: (coreindex, N, workpackage, blob, sequence{sequence{segment}}, N) → (blob ∪ workerror, sequence{segment}, gas)
   *
   * Refine Invocation Constituents (Gray Paper):
   * - coreIndex (c): Core performing the refinement
   * - workItemIndex (i): Index of work item to refine
   * - workPackage (p): Work package containing work items
   * - authorizerTrace (r): Authorizer trace blob
   * - importSegments (ī): Import segments for all work items
   * - exportSegmentOffset (segoff): Export segment offset
   *
   * Internal Processing (Gray Paper):
   * 1. Get work item: w = p.workitems[i]
   * 2. Get service code via historical lookup: c = histlookup(accounts[w.serviceindex], lookup_anchor_timeslot, w.codehash)
   * 3. Check for null/oversized code
   * 4. Encode arguments: encode{c, i, w.serviceindex, var{w.payload}, blake{p}}
   * 5. Initialize refine context: (∅, ∅) - empty machines dict and empty export segments
   * 6. Execute marshalling invocation: Ψ_M(c, 0, w.refgaslimit, encodedArgs, F, (∅, ∅))
   *
   * @param coreIndex - Core performing the refinement
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
    // Gray Paper equation 89: w = p.workitems[i]
    const workItem = workPackage.workItems[Number(workItemIndex)]
    if (!workItem) {
      logger.error('[RefinePVM] Work item not found', {
        workItemIndex: workItemIndex.toString(),
        workItemsCount: workPackage.workItems.length,
      })
      return { result: 'BAD', exportSegments: [], gasUsed: 0n }
    }

    // Gray Paper equation 82: Check if service exists in accounts
    // w.serviceindex ∉ keys(accounts) → return (BAD, [], 0)
    const [serviceAccountError, serviceAccount] =
      this.serviceAccountService.getServiceAccount(workItem.serviceindex)
    if (serviceAccountError || !serviceAccount) {
      logger.error('[RefinePVM] Service account not found', {
        serviceIndex: workItem.serviceindex.toString(),
        error: serviceAccountError?.message,
      })
      return { result: 'BAD', exportSegments: [], gasUsed: 0n }
    }

    // Gray Paper equation 82-83: Get service code via historical lookup
    // histlookup(accounts[w.serviceindex], (p.context).lookup_anchor_timeslot, w.codehash)
    const lookupAnchorTimeslot = workPackage.context.lookup_anchor_slot

    const [histLookupError, serviceCode] =
      this.serviceAccountService.histLookupServiceAccount(
        workItem.serviceindex,
        serviceAccount,
        workItem.codehash,
        lookupAnchorTimeslot,
      )

    // Gray Paper equation 82: If histlookup returns none → return (BAD, [], 0)
    if (histLookupError || !serviceCode) {
      logger.error('[RefinePVM] Service code not found via historical lookup', {
        serviceIndex: workItem.serviceindex.toString(),
        codehash: workItem.codehash,
        lookupAnchorTimeslot: lookupAnchorTimeslot.toString(),
        error: histLookupError?.message,
      })
      return { result: 'BAD', exportSegments: [], gasUsed: 0n }
    }

    // Gray Paper equation 83: Check for oversized code
    // len(c) > Cmaxservicecodesize → return (BIG, [], 0)
    if (serviceCode.length > Number(REFINE_CONFIG.MAX_SERVICE_CODE_SIZE)) {
      logger.warn('[RefinePVM] Service code exceeds maximum size', {
        serviceIndex: workItem.serviceindex.toString(),
        codeLength: serviceCode.length,
        maxSize: REFINE_CONFIG.MAX_SERVICE_CODE_SIZE.toString(),
      })
      return { result: 'BIG', exportSegments: [], gasUsed: 0n }
    }

    // Gray Paper equation 85: Encode arguments
    // 𝐚 = encode{c, i, w.serviceindex, var{w.payload}, blake{p}}
    const [encodedArgsError, encodedArgs] = encodeRefineArguments(
      coreIndex,
      workItemIndex,
      workItem,
      workPackage,
    )
    if (encodedArgsError) {
      logger.error('[RefinePVM] Failed to encode refine arguments', {
        error: encodedArgsError.message,
      })
      return { result: 'BAD', exportSegments: [], gasUsed: 0n }
    }

    // Execute refine invocation
    const gasLimit = workItem.refgaslimit
    if (this.useRust) {
      const [rustError, rustResult] = await (
        this.pvmExecutor as RustPVMExecutor
      ).executeRefinementInvocation(
        serviceCode,
        gasLimit,
        encodedArgs,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        serviceAccount,
        lookupAnchorTimeslot,
      )
      if (rustError || !rustResult) {
        logger.error('[RefinePVM] Rust refine invocation failed', {
          error: rustError?.message,
        })
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }
      const {
        gasConsumed,
        result: rustResultValue,
        exportSegments,
      } = rustResult
      let result: Uint8Array | WorkError
      if (rustResultValue === 'PANIC' || rustResultValue === 'OOG') {
        result = 'BAD'
        return { result, exportSegments: [], gasUsed: gasConsumed }
      }
      result = rustResultValue
      return { result, exportSegments, gasUsed: gasConsumed }
    }
    if (this.useWasm) {
      const [wasmError, wasmResult] = await (
        this.pvmExecutor as WasmPVMExecutor
      ).executeRefinementInvocation(
        serviceCode,
        gasLimit,
        encodedArgs,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        serviceAccount,
        lookupAnchorTimeslot,
      )

      if (wasmError || !wasmResult) {
        logger.error('[RefinePVM] WASM refine invocation failed', {
          error: wasmError?.message,
        })
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }

      // Extract values from execution return
      const {
        gasConsumed,
        result: wasmResultValue,
        exportSegments,
      } = wasmResult

      // Gray Paper equation 87-88: Determine result
      let result: Uint8Array | WorkError
      if (wasmResultValue === 'PANIC' || wasmResultValue === 'OOG') {
        // Gray Paper equation 87: When o ∈ {oog, panic}, return (o, [], u)
        result = 'BAD' // Both map to BAD
        return {
          result,
          exportSegments: [], // Empty export segments on error
          gasUsed: gasConsumed,
        }
      } else {
        // Gray Paper equation 88: Otherwise return (o, e, u)
        result = wasmResultValue
        return {
          result,
          exportSegments,
          gasUsed: gasConsumed,
        }
      }
    } else {
      const [tsError, tsResult] = await (
        this.pvmExecutor as TypeScriptPVMExecutor
      ).executeRefinementInvocation(
        serviceCode,
        gasLimit,
        encodedArgs,
        workPackage,
        authorizerTrace,
        importSegments,
        exportSegmentOffset,
        serviceAccount,
        lookupAnchorTimeslot,
        workItem.serviceindex,
      )

      if (tsError || !tsResult) {
        logger.error('[RefinePVM] TypeScript refine invocation failed', {
          error: tsError?.message,
        })
        return { result: 'BAD', exportSegments: [], gasUsed: 0n }
      }

      // Extract values from execution return
      const { gasConsumed, result: tsResultValue, exportSegments } = tsResult

      // Gray Paper equation 87-88: Determine result
      let result: Uint8Array | WorkError
      if (tsResultValue === 'PANIC' || tsResultValue === 'OOG') {
        // Gray Paper equation 87: When o ∈ {oog, panic}, return (o, [], u)
        result = 'BAD' // Both map to BAD
        return {
          result,
          exportSegments: [], // Empty export segments on error
          gasUsed: gasConsumed,
        }
      } else {
        // Gray Paper equation 88: Otherwise return (o, e, u)
        result = tsResultValue
        return {
          result,
          exportSegments,
          gasUsed: gasConsumed,
        }
      }
    }
  }
}
