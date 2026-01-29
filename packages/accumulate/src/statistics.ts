import { bytesToHex, type Hex } from '@pbnjam/core'
import type { AccumulateOutput, IStatisticsService } from '@pbnjam/types'

/**
 * Track accumulation output for local_fnservouts
 * Gray Paper: local_fnservouts ≡ protoset{tuple{serviceid, hash}}
 */
export function trackAccumulationOutput(
  serviceId: bigint,
  output: AccumulateOutput,
  accumulationOutputs: [bigint, Hex][],
): void {
  const { yield: yieldHash } = output

  if (yieldHash && yieldHash.length > 0) {
    const yieldHex = bytesToHex(yieldHash)
    accumulationOutputs.push([serviceId, yieldHex])
  }
}

/**
 * Track accumulation statistics for all accumulations (including panics/OOG)
 * Gray Paper equation 390-404: accumulationstatistics[s] = tuple{G(s), N(s)}
 * where G(s) = sum of gas used from all accumulations (including panics)
 * and N(s) = count of work-items accumulated
 *
 * Gray Paper equation 217-241: C function always returns ao_gasused regardless of result
 * Gray Paper equation 196-200: u includes gas from all accone calls
 */
export function trackAccumulationStatistics(
  serviceId: bigint,
  output: AccumulateOutput,
  workItemCount: number,
  accumulationStatistics: Map<bigint, [number, number]>,
  statisticsService: IStatisticsService,
): void {
  const { gasused } = output

  // Track statistics for ALL accumulations (including panics/OOG)
  // Gray Paper equation 397-403:
  // - G(s) = sum of gas used from all accumulations (regardless of result)
  // - N(s) = count of work-digests in input (regardless of result)
  // N(s) counts work-digests in the INPUT, not successful results!
  const currentStats = accumulationStatistics.get(serviceId) || [0, 0]

  const newStats: [number, number] = [
    currentStats[0] + workItemCount, // N(s): count work-digests in input (regardless of result)
    currentStats[1] + Number(gasused), // G(s): always add gas used (even for panics/OOG)
  ]
  accumulationStatistics.set(serviceId, newStats)

  // Update serviceStats.accumulation in activity state
  statisticsService.updateServiceAccumulationStats(serviceId, newStats)
}

/**
 * Track onTransfers statistics for a service
 * Tracks the count of deferred transfers received and gas used processing them
 * Only tracked for JAM versions < 0.7.1
 *
 * @param serviceId - Service ID that received the transfers
 * @param transferCount - Number of deferred transfers received
 * @param gasUsed - Gas used processing the transfers
 */
export function trackOnTransfersStatistics(
  serviceId: bigint,
  transferCount: number,
  gasUsed: bigint,
  onTransfersStatistics: Map<bigint, [number, number]>,
  statisticsService: IStatisticsService,
): void {
  const currentStats = onTransfersStatistics.get(serviceId) || [0, 0]

  const newStats: [number, number] = [
    currentStats[0] + transferCount, // Count of deferred transfers received
    currentStats[1] + Number(gasUsed), // Total gas used processing transfers
  ]
  onTransfersStatistics.set(serviceId, newStats)

  // Update serviceStats.onTransfersCount and onTransfersGasUsed in activity state
  // Only for versions < 0.7.1 (checked inside updateServiceOnTransfersStats)
  statisticsService.updateServiceOnTransfersStats(serviceId, newStats)
}
