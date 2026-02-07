import type { Hex } from '@pbnjam/core'
import type {
  Accumulated,
  IConfigService,
  IReadyService,
  ReadyItem,
} from '@pbnjam/types'
/**
 * Shift ready queue according to Gray Paper equations 419-424
 * Simpler approach: clear slots that should be empty due to time advancement
 */
export function shiftReadyQueue(
  slotDelta: number,
  epochDuration: number,
  currentEpochSlot: number,
  readyService: IReadyService,
): void {
  // Gray Paper equation 419-423: ready'[m - i] = [] when 1 ≤ i < thetime' - thetime
  // This clears slots that are "slotDelta - 1" slots behind the current slot m
  // The condition is on i (not the slot index), then we compute the slot using cyclic indexing
  // For example, if m=49 and slotDelta=6, we clear slots for i=1,2,3,4,5
  // Which gives us: slots (49-1)%600=48, (49-2)%600=47, (49-3)%600=46, (49-4)%600=45, (49-5)%600=44

  const currentReady = readyService.getReady()
  const newReadySlots = [...currentReady.epochSlots]

  // Gray Paper equation 421: ready'[m - i] = [] when 1 ≤ i < thetime' - thetime
  // Clear slots that should be empty according to this equation
  for (let i = 1; i < Math.min(slotDelta, epochDuration); i++) {
    // Compute slot index using cyclic indexing: (m - i) mod epochDuration
    const slotToClear = (currentEpochSlot - i + epochDuration) % epochDuration
    newReadySlots[slotToClear] = []
  }

  readyService.setReady({ epochSlots: newReadySlots })
}

/**
 * Shift accumulated packages history and ready queue for state transition
 * Gray Paper equations 417-418: Shift is part of the state transition from τ to τ'
 * This must be called for every block, even when accumulation is skipped
 *
 * @param slot - Current block timeslot
 */
export function shiftStateForBlockTransition(
  slot: bigint,
  readyService: IReadyService,
  configService: IConfigService,
  lastProcessedSlot: bigint | null,
  accumulated: Accumulated,
): void {
  const epochDuration = configService.epochDuration

  // Determine slot delta: if lastProcessedSlot is set, calculate delta; otherwise assume delta=1
  let slotDelta = 1
  if (lastProcessedSlot !== null) {
    slotDelta = Number(slot - lastProcessedSlot)
  }

  // Handle edge cases
  if (slotDelta <= 0) {
    return
  }
  // Normal case: slot advanced, shift accumulated history and ready queue
  // Shift accumulated packages history (equation 417-418)
  // Gray Paper equation 418: accumulated'[i] = accumulated[i + 1] for i < Cepochlen - 1
  // This is ALWAYS a shift by 1, regardless of slotDelta
  // The accumulated history shifts once per block, not once per slot advanced
  shiftAccumulatedPackagesHistory(1, epochDuration, accumulated)

  // Shift ready queue - clear old slots (equation 419-424)
  const currentEpochSlot = Number(slot) % epochDuration
  shiftReadyQueue(slotDelta, epochDuration, currentEpochSlot, readyService)
}

/**
 * Shift accumulated packages history by slotDelta (non-wrapping left shift)
 * Gray Paper equations 417-418: accumulated'[i] = accumulated[i + slotDelta]
 * This is a LINEAR shift, not cyclic - old data falls off the left, empty slots appear on the right
 */
export function shiftAccumulatedPackagesHistory(
  slotDelta: number,
  epochDuration: number,
  accumulated: Accumulated,
): void {
  const newAccumulatedPackages: Set<Hex>[] = new Array(epochDuration)
    .fill(null)
    .map(() => new Set<Hex>())

  // Non-wrapping left shift: accumulated'[i] = accumulated[i + slotDelta]
  for (let i = 0; i < epochDuration; i++) {
    const oldIndex = i + slotDelta
    if (oldIndex < epochDuration) {
      // Copy from old position
      newAccumulatedPackages[i] = accumulated.packages[oldIndex]
    }
    // else: newAccumulatedPackages[i] remains empty (data fell off)
  }

  accumulated.packages = newAccumulatedPackages
}

/**
 * Collect all ready items from all epoch slots
 *
 * Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} ...)
 * This processes items from ALL slots, but only those with satisfied dependencies (via Q function).
 */
export function collectAllReadyItems(
  epochLength: number,
  currentSlot: bigint,
  readyService: IReadyService,
  excludeHashes?: Set<Hex>,
): ReadyItem[] {
  const allReadyItems: ReadyItem[] = []
  const m = Number(currentSlot) % epochLength

  // Gray Paper equation 89: q = E(concat{ready[m:]} concat concat{ready[:m]} concat justbecameavailable^Q, ...)
  // We must collect items from ALL slots in rotated order: [m:] then [:m]
  // This ensures items that have been waiting get processed in the correct order
  // Use a single loop with modulo arithmetic to iterate through slots in rotated order
  for (let i = 0; i < epochLength; i++) {
    const slotIdx = (m + i) % epochLength
    const slotItems = readyService.getReadyItemsForSlot(BigInt(slotIdx))

    if (excludeHashes && excludeHashes.size > 0) {
      for (const item of slotItems) {
        if (!excludeHashes.has(item.workReport.package_spec.hash)) {
          allReadyItems.push(item)
        }
      }
    } else {
      allReadyItems.push(...slotItems)
    }
  }

  return allReadyItems
}

/**
 * Extract work-package hashes function P (local¬fnsrmap)
 *
 * Gray Paper equation 77-83: P extracts package hashes from work-reports
 * P: protoset{workreport} → protoset{hash}
 * P(r) = {(r_avspec)_packagehash : r ∈ r}
 *
 * @param items - Sequence of ready items
 * @returns Set of work-package hashes
 */
export function extractPackageHashes(items: ReadyItem[]): Set<Hex> {
  return new Set<Hex>(items.map((item) => item.workReport.package_spec.hash))
}

/**
 * Filter dependencies for all ready items against the accumulated set
 *
 * This is critical when loading from pre_state - the ready items may have stale dependencies
 * that have been accumulated in prior blocks but weren't filtered when serialized.
 *
 * Gray Paper: The E function removes dependencies that are in accumulatedcup
 */
export function filterReadyItemDependencies(
  readyService: IReadyService,
  accumulated: Accumulated,
  configService: IConfigService,
): void {
  // Build accumulatedcup from all accumulated packages
  const accumulatedcup = new Set<Hex>()
  for (const packageSet of accumulated.packages) {
    if (packageSet) {
      for (const hash of packageSet) {
        accumulatedcup.add(hash)
      }
    }
  }

  if (accumulatedcup.size === 0) {
    return // Nothing accumulated, no filtering needed
  }

  const epochLength = configService.epochDuration

  // Filter dependencies in all ready slots
  for (let slotIdx = 0; slotIdx < epochLength; slotIdx++) {
    const slotItems = readyService.getReadyItemsForSlot(BigInt(slotIdx))

    for (const item of slotItems) {
      // Remove dependencies that are already accumulated
      for (const dep of Array.from(item.dependencies)) {
        if (accumulatedcup.has(dep)) {
          item.dependencies.delete(dep)
        }
      }
    }
  }
}

/**
 * Find maximum prefix of work reports that fits within gas limit.
 *
 * Gray Paper: accumulation.tex eq:accseq (accseq \where clause):
 *   i = max(0..len(r)) such that
 *   sum_{r ∈ r[:i], d ∈ r.digests}(d.gaslimit) ≤ g
 *
 * Here r = work report, r.digests = work-report digests (one per work-item),
 * d.gaslimit = wd¬gaslimit = wi¬accgaslimit (work_packages_and_reports.tex itemtodigest).
 * We map: r ↔ item.workReport, r.digests ↔ workReport.results, d.gaslimit ↔ result.accumulate_gas.
 *
 * @param items - Ready items to process (each wraps a work report)
 * @param remainingGas - Remaining gas g
 * @returns Prefix items and their total gas limit
 */
export function findItemsWithinGasLimit(
  items: ReadyItem[],
  remainingGas: bigint,
): { prefixItems: ReadyItem[]; prefixGasLimit: bigint } {
  const prefixItems: ReadyItem[] = []
  let cumulativeGasLimit = 0n

  for (const item of items) {
    // sum_{d ∈ r.digests}(d.gaslimit) for this work report r
    const results = item.workReport.results ?? []
    const workReportGasLimit = results.reduce(
      (sum, result) => sum + BigInt(result.accumulate_gas),
      0n,
    )

    if (cumulativeGasLimit + workReportGasLimit > remainingGas) {
      continue
    }

    prefixItems.push(item)
    cumulativeGasLimit += workReportGasLimit
  }

  return { prefixItems, prefixGasLimit: cumulativeGasLimit }
}

/**
 * Finalize slot m after accumulation processing
 * Gray Paper equation 420: ready'[m] = E(justbecameavailable^Q, accumulated'[E-1]) when i = 0
 * Slot m should ONLY contain items that came from justbecameavailable^Q (new queued items)
 */
export function finalizeSlot(
  slot: bigint,
  readyService: IReadyService,
  configService: IConfigService,
  newQueuedItemsForSlotM: Set<Hex>,
): void {
  const epochDuration = configService.epochDuration
  const m = Number(slot) % epochDuration

  const slotItems = readyService.getReadyItemsForSlot(BigInt(m))
  const itemsToKeep: ReadyItem[] = []

  for (const item of slotItems) {
    const packageHash = item.workReport.package_spec.hash
    // Only keep items that came from justbecameavailable^Q (new queued items)
    if (newQueuedItemsForSlotM.has(packageHash)) {
      itemsToKeep.push(item)
    }
  }

  // Replace slot m with only the items from justbecameavailable^Q
  readyService.clearSlot(BigInt(m))
  for (const item of itemsToKeep) {
    readyService.addReadyItemToSlot(BigInt(m), item)
  }

  // Clear the tracking set
  newQueuedItemsForSlotM.clear()
}
