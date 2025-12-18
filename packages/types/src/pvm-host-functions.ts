import type { Hex } from '@pbnjam/core'
import type { WorkItem, WorkPackage } from './block-authoring'
import type { RefineInvocationContext } from './pvm'
import type { ServiceAccount } from './serialization'
import type { IEntropyService } from './services'

export interface ExportParams {
  refineContext: RefineInvocationContext
  segmentOffset: bigint
}

export interface ExpungeParams {
  refineContext: RefineInvocationContext
  machineId: bigint
}

/**
 * FETCH host function parameters matching Gray Paper signature
 * Gray Paper: Ω_Y(gascounter, registers, memory, p, n, r, i, ī, x̄, i, ...)
 */
export interface FetchParams {
  // p: work package (or null)
  workPackage: WorkPackage | null
  // n: work package hash (or null)
  workPackageHash: Hex | null
  // r: authorizer trace (or null)
  authorizerTrace: Hex | null
  // i: work item index (or null)
  workItemIndex: bigint | null
  // ī: import segments (or null) - nested by work item
  importSegments: Uint8Array[][] | null
  // x̄: export segments/extrinsics (or null) - nested by work item
  exportSegments: Uint8Array[][] | null
  // i: work items sequence (or null) - second 'i' parameter
  // exists in accumulation context
  workItemsSequence: WorkItem[] | null
  // entropyService: IEntropyService
  entropyService: IEntropyService
}

/**
 * Historical lookup host function parameters matching Gray Paper signature
 * Gray Paper: Ω_H(gascounter, registers, memory, (m, e), s, d, t)
 *
 * @param refineContext - Refine context pair (m, e) - machines and export segments
 * @param serviceId - Service index/ID (s) - the service to look up
 * @param accounts - Accounts dictionary (d) - service accounts
 * @param timeslot - Timeslot for historical lookup (t) - lookup anchor timeslot
 */
export interface HistoricalLookupParams {
  refineContext: RefineInvocationContext
  serviceId: bigint
  accounts: Map<bigint, ServiceAccount>
  timeslot: bigint
}

/**
 * Info host function parameters matching Gray Paper signature
 * Gray Paper: Ω_I(gascounter, registers, memory, s, d)
 *
 * @param serviceId - Service ID (s) - the service to get info for
 * @param accounts - Accounts dictionary (d) - service accounts
 */
export interface InfoParams {
  serviceId: bigint
  accounts: Map<bigint, ServiceAccount>
}

/**
 * Invoke host function parameters matching Gray Paper signature
 * Gray Paper: Ω_K(gascounter, registers, memory, (m, e))
 *
 * @param refineContext - Refine context pair (m, e) - machines and export segments
 */
export interface InvokeParams {
  refineContext: RefineInvocationContext
}

/**
 * Log host function parameters matching JIP-1 signature
 * JIP-1: Ω_100(gascounter, registers, memory, level, target, message)
 *
 * @param level - Log level (ω7)
 * @param target - Log target (μ[ω8..+ω9])
 * @param message - Log message (μ[ω10..+ω11])
 */
export interface LogParams {
  serviceId: bigint | null
  coreIndex: bigint | null
}

export interface LookupParams {
  serviceAccount: ServiceAccount
  serviceId: bigint
  accounts: Map<bigint, ServiceAccount>
}

export interface WriteParams {
  serviceAccount: ServiceAccount
  serviceId: bigint
}

export interface ReadParams {
  serviceAccount: ServiceAccount
  serviceId: bigint
  accounts: Map<bigint, ServiceAccount>
}
