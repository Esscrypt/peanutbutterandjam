import type {
  AccumulateInvocationResult,
  DeferredTransfer,
} from '@pbnjam/types'

/**
 * Collect defxfers from accumulation results
 * Gray Paper equation 206: t' = concat(accone(s).defxfers for s in s)
 * Only includes NEW defxfers generated in this iteration, NOT existing ones (which were consumed)
 */
export function collectDefxfersFromResults(
  results: AccumulateInvocationResult[],
): DeferredTransfer[] {
  return results
    .filter((result) => result.ok)
    .flatMap((result) => result.value.defxfers)
}

/**
 * Calculate total gas used from accumulation results
 * Gray Paper: accseq tracks actual gas consumed across all invocations
 * Only includes gas from successful results
 */
export function calculateTotalGasUsed(
  results: AccumulateInvocationResult[],
): bigint {
  return results
    .filter((result) => result.ok)
    .reduce((sum, result) => sum + result.value.gasused, 0n)
}
