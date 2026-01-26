import type {
  Accumulated,
  IConfigService,
  IReadyService,
  ReadyItem,
  WorkReport,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import { applyQueueEditingFunctionE } from './accumulatable'

/**
 * Separate new reports into justbecameavailable^! and justbecameavailable^Q
 * Gray Paper equation 39-40:
 * - justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup (accumulated immediately)
 * - justbecameavailable^Q = E(sq{D(r) | r in justbecameavailable, ...}, accumulatedcup)
 *   where D(r) = (r, set{prerequisites} ∪ keys{segment_root_lookup})
 *
 * IMPORTANT: The E function removes dependencies that are already in accumulatedcup.
 * This means if a prerequisite is already accumulated, it should be removed from dependencies.
 */
export function separateReportsIntoImmediateAndQueued(
  reports: WorkReport[],
  accumulated: Accumulated,
): { immediateItems: ReadyItem[]; queuedItems: ReadyItem[] } {
  const immediateItems: ReadyItem[] = []
  const queuedItems: ReadyItem[] = []

  // Get accumulatedcup (union of all accumulated packages) for E function
  // Gray Paper: accumulatedcup is the union of all accumulated packages (before processing new reports)
  const accumulatedcup = new Set<Hex>()
  for (const packageSet of accumulated.packages) {
    if (packageSet) {
      for (const hash of packageSet) {
        accumulatedcup.add(hash)
      }
    }
  }

  for (const report of reports) {
    const prerequisites = report.context.prerequisites || []
    const hasPrerequisites = prerequisites.length > 0
    const hasSegmentRootLookup =
      report.segment_root_lookup && report.segment_root_lookup.length > 0

    // Gray Paper equation 39: justbecameavailable^! = reports with zero prerequisites AND empty segment_root_lookup
    // Track if originally had prerequisites for ordering
    if (!hasPrerequisites && !hasSegmentRootLookup) {
      // Store with flag for sorting - true immediate items come first
      immediateItems.push({
        workReport: report,
        dependencies: new Set<Hex>(),
        originallyImmediate: true, // Internal flag for ordering
      } as ReadyItem & { originallyImmediate: boolean })
    } else {
      // Gray Paper equation 40-44: D(r) = (r, set{prerequisites} ∪ keys{segment_root_lookup})
      // Gray Paper equation 45: justbecameavailable^Q = E(D(r) for r with dependencies, accumulatedcup)
      //
      // IMPORTANT: Reports that ORIGINALLY had prerequisites ALWAYS go to queuedItems (justbecameavailable^Q),
      // even if dependencies are now satisfied after E function filtering.
      // The Q function will extract them from the queue when their dependencies are empty.
      // This ensures ordering: justbecameavailable^! items come first, then Q(q) items.
      const dependencies = new Set<Hex>(prerequisites)
      if (report.segment_root_lookup) {
        for (const lookupItem of report.segment_root_lookup) {
          dependencies.add(lookupItem.work_package_hash)
        }
      }

      // Apply E function: remove dependencies that are already accumulated
      // Gray Paper equation 50-60: E removes dependencies that appear in accumulatedcup
      const filteredDependencies = new Set<Hex>()
      for (const dep of dependencies) {
        if (!accumulatedcup.has(dep)) {
          filteredDependencies.add(dep)
        }
      }

      // If all dependencies are satisfied (filtered to empty), treat as immediate
      // Gray Paper: Items with no remaining dependencies can be accumulated immediately
      // This ensures work items for the same service are combined into a single invocation
      if (filteredDependencies.size === 0) {
        // Items that originally had prerequisites should come AFTER true immediate items
        immediateItems.push({
          workReport: report,
          dependencies: new Set<Hex>(),
          originallyImmediate: false, // Was originally queued, now immediate
        } as ReadyItem & { originallyImmediate: boolean })
      } else {
        // Queue items that still have unsatisfied dependencies
        queuedItems.push({
          workReport: report,
          dependencies: filteredDependencies,
        })
      }
    }
  }

  // Sort immediate items: true immediate (no original prerequisites) first,
  // then items that were originally queued but now have empty dependencies
  // This ensures correct ordering for accumulate inputs
  const sortedImmediateItems = immediateItems.sort((a, b) => {
    const aOrigImmediate =
      (a as ReadyItem & { originallyImmediate?: boolean })
        .originallyImmediate ?? false
    const bOrigImmediate =
      (b as ReadyItem & { originallyImmediate?: boolean })
        .originallyImmediate ?? false
    if (aOrigImmediate && !bOrigImmediate) return -1
    if (!aOrigImmediate && bOrigImmediate) return 1
    // Within same category, sort by core index for determinism
    return Number(a.workReport.core_index - b.workReport.core_index)
  })

  return { immediateItems: sortedImmediateItems, queuedItems }
}

/**
 * Build queue q = E(rotated ready queue + queued items, P(justbecameavailable^!))
 * Gray Paper equation 89: q = E(concatall{ready[m:]} concat concatall{ready[:m]} concat justbecameavailable^Q, P(justbecameavailable^!))
 *
 * IMPORTANT: This is called AFTER accumulateImmediateItems, so immediate items are already accumulated
 * and NOT in the ready queue. The E function uses P(justbecameavailable^!) to edit dependencies in the
 * existing queue, removing dependencies that are satisfied by the newly accumulated immediate items.
 */
export async function buildAndEditQueue(
  queuedItems: ReadyItem[],
  accumulatedFromImmediate: Set<Hex>,
  slot: bigint,
  readyService: IReadyService,
  configService: IConfigService,
  newQueuedItemsForSlotM: Set<Hex>,
): Promise<void> {
  const epochDuration = configService.epochDuration
  const m = Number(slot) % epochDuration

  // Gray Paper equation 89: q = E(concat{ready[m:]} ∥ concat{ready[:m]} ∥ justbecameavailable^Q, P(justbecameavailable^!))
  // IMPORTANT: q is computed from the PRE-state ready queue (including slot m).
  // The items currently in slot m need to be collected for Q(q) processing.
  // We apply E function to update dependencies based on newly accumulated immediate items.

  // Apply E function to ALL slots (including m) to update dependencies
  // This removes items whose package hash is in accumulatedFromImmediate
  // and removes dependencies that are in accumulatedFromImmediate
  for (let slotIdx = 0; slotIdx < epochDuration; slotIdx++) {
    readyService.applyQueueEditingFunctionEToSlot(
      BigInt(slotIdx),
      accumulatedFromImmediate,
    )
  }

  // Apply E function to new queued items using accumulatedFromImmediate
  // Gray Paper equation 89: q = E(... ∥ justbecameavailable^Q, P(justbecameavailable^!))
  const editedQueuedItems = applyQueueEditingFunctionE(
    queuedItems,
    accumulatedFromImmediate,
  )

  // Store the package hashes of new queued items for later filtering
  // Gray Paper equation 420: ready'[m] = E(justbecameavailable^Q, accumulated'[E-1]) when i = 0
  // After processAccumulation, slot m should ONLY contain items from justbecameavailable^Q
  // Clear and populate the Set (mutate it) instead of reassigning the parameter
  newQueuedItemsForSlotM.clear()
  for (const item of editedQueuedItems) {
    newQueuedItemsForSlotM.add(item.workReport.package_spec.hash)
  }

  // Add edited queued items to slot m
  // Note: Old items in slot m are preserved for now - they'll be collected by processAccumulation
  // After processing, finalizeSlot will ensure only new queued items remain
  for (const item of editedQueuedItems) {
    readyService.addReadyItemToSlot(BigInt(m), item)
  }
}
