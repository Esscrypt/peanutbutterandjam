import type { Accumulated, ReadyItem, WorkReport } from '@pbnjam/types'
import type { Hex } from 'viem'

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
        _originallyImmediate: true, // Internal flag for ordering
      } as ReadyItem & { _originallyImmediate: boolean })
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
        } as ReadyItem)
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
    return Number(a.workReport.core_index - b.workReport.core_index)
  })

  return { immediateItems: sortedImmediateItems, queuedItems }
}
