import type { Hex } from 'viem'
import type { WorkPackage } from './block-authoring'
import type { AccumulateInput, RefineInvocationContext } from './pvm'
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
 *
 * The 10th parameter 'i' (mathbf{i}) is:
 * - In Refine context: none
 * - In Accumulate context: sequence{accinput} (AccumulateInput[])
 *
 * Gray Paper pvm_invocations.tex lines 189, 359-360:
 * - Selector 14: encode{var{i}} - encoded sequence of AccumulateInputs
 * - Selector 15: encode{i[registers[11]]} - single encoded AccumulateInput
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
  // i (mathbf{i}): accumulate inputs sequence (or null)
  // Gray Paper pvm_invocations.tex line 150: sequence{accinput}
  // Used by selectors 14 and 15 in accumulation context
  accumulateInputs: AccumulateInput[] | null
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
