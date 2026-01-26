import type {
  DeferredTransfer,
  IPrivilegesService,
  ReadyItem,
} from '@pbnjam/types'

/**
 * Group items by service ID
 * Gray Paper: accumulate each service once with all its inputs
 * NOTE: A work report can have multiple results with different service_ids
 */
export function groupItemsByServiceId(
  items: ReadyItem[],
): Map<bigint, ReadyItem[]> {
  const serviceToItems = new Map<bigint, ReadyItem[]>()

  // Single pass: for each item, add it to buckets for all services it contains
  for (const item of items) {
    // Collect unique service IDs from this item's results
    const serviceIds = new Set(
      item.workReport.results.map((result) => result.service_id),
    )

    // Add item to each service's bucket
    for (const serviceId of serviceIds) {
      if (!serviceToItems.has(serviceId)) {
        serviceToItems.set(serviceId, [])
      }
      serviceToItems.get(serviceId)!.push(item)
    }
  }

  return serviceToItems
}

/**
 * Calculate gas limit for a single service accumulation
 * Gray Paper equation 315-317:
 * g = subifnone(f[s], 0) + sum_{t in t, t.dest = s}(t.gas) + sum_{r in r, d in r.digests, d.serviceindex = s}(d.gaslimit)
 *
 * @param serviceId - Service ID
 * @param serviceItems - Work reports for this service
 * @param pendingDefxfers - Deferred transfers
 * @param privilegesService - Privileges service to get free gas
 * @returns Gas limit for this service accumulation
 */
export function calculateServiceGasLimit(
  serviceId: bigint,
  serviceItems: ReadyItem[],
  pendingDefxfers: DeferredTransfer[],
  privilegesService: IPrivilegesService,
): bigint {
  // Free gas from alwaysaccers (if privileged)
  const freeGas = privilegesService.getAlwaysAccers().get(serviceId) ?? 0n

  // Sum gas from deferred transfers to this service
  const defxferGas = pendingDefxfers
    .filter((d) => d.dest === serviceId)
    .reduce((sum, d) => sum + d.gasLimit, 0n)

  // Sum gas limits from work digests for this service
  const workDigestGas = serviceItems
    .flatMap((item) => item.workReport.results)
    .filter((result) => result.service_id === serviceId)
    .reduce((sum, r) => sum + BigInt(r.accumulate_gas), 0n)

  // Gray Paper: g = freeGas + defxferGas + workDigestGas
  return freeGas + defxferGas + workDigestGas
}

/**
 * Calculate available gas for accumulation
 * Gray Paper equation 167: g* = g + sum_{t in t}(t.gas)
 * Available gas = totalGasLimit + defxferGas - totalGasUsed
 *
 * @param totalGasLimit - Total gas limit for the block
 * @param pendingDefxfers - Deferred transfers
 * @param totalGasUsed - Total gas already used
 * @returns Available gas and defxfer gas
 */
export function calculateAvailableGas(
  totalGasLimit: bigint,
  pendingDefxfers: DeferredTransfer[],
  totalGasUsed: bigint,
): { availableGas: bigint; defxferGas: bigint } {
  // Calculate total gas from deferred transfers
  const defxferGas = pendingDefxfers.reduce((sum, d) => sum + d.gasLimit, 0n)

  // Gray Paper equation 167: g* = g + sum_{t in t}(t.gas)
  // Available gas = totalGasLimit + defxferGas - totalGasUsed
  const availableGas = totalGasLimit + defxferGas - totalGasUsed

  return { availableGas, defxferGas }
}
