import type { Accumulated, ReadyItem } from '@pbnjam/types'
import type { Hex } from 'viem'
import { extractPackageHashes } from './ready'
/**
 * Queue editing function E
 *
 * Gray Paper equation 50-60: E removes items whose package hash is in the accumulated set,
 * and removes any dependencies which appear in said set.
 *
 * Formally: E(𝐫, 𝐱) = items from 𝐫 where:
 * - Package hash is not in 𝐱 (not already accumulated)
 * - Dependencies are filtered to remove those in 𝐱 (satisfied dependencies)
 *
 * @param items - Sequence of ready items (work report, dependency set) pairs
 * @param accumulatedPackages - Set of accumulated work-package hashes
 * @returns Edited sequence with accumulated items removed and satisfied dependencies filtered
 */
export function applyQueueEditingFunctionE(
  items: ReadyItem[],
  accumulatedPackages: Set<Hex>,
): ReadyItem[] {
  return items
    .filter(
      (item) => !accumulatedPackages.has(item.workReport.package_spec.hash),
    )
    .map((item) => ({
      workReport: item.workReport,
      dependencies: new Set(
        Array.from(item.dependencies).filter(
          (dep) => !accumulatedPackages.has(dep),
        ),
      ),
    }))
}

/**
 * Accumulation priority queue function Q
 *
 * Gray Paper equation 63-73: Q provides the sequence of work-reports which are able
 * to be accumulated given a set of not-yet-accumulated work-reports and their dependencies.
 *
 * Formally: Q(𝐫) = {
 *   [] if g = []
 *   g concat Q(E(𝐫, P(g))) otherwise
 *   where g = items with empty dependencies
 * }
 *
 * This is implemented iteratively (not recursively) for efficiency.
 * The function processes all items with satisfied dependencies in one conceptual pass.
 *
 * @param items - Sequence of ready items (work report, dependency set) pairs
 * @param accumulated - Current accumulated packages history
 * @returns Sequence of work-reports that can be accumulated (items with empty dependencies)
 */
export function getAccumulatableItemsQ(
  items: ReadyItem[],
  accumulated: Accumulated,
  accumulatedSoFar?: Set<Hex>,
): ReadyItem[] {
  // Build set of all accumulated packages from history
  const allAccumulatedPackages = new Set<Hex>()
  for (const packageSet of accumulated.packages) {
    if (packageSet) {
      for (const hash of packageSet) {
        allAccumulatedPackages.add(hash)
      }
    }
  }

  // Include packages accumulated in previous recursive calls
  if (accumulatedSoFar) {
    for (const hash of accumulatedSoFar) {
      allAccumulatedPackages.add(hash)
    }
  }

  // Find items with empty dependencies (g in Gray Paper)
  // Gray Paper: Self-referential items (depending on themselves) will never have empty dependencies
  const itemsWithEmptyDeps = items.filter(
    (item) => item.dependencies.size === 0,
  )

  if (itemsWithEmptyDeps.length === 0) {
    return []
  }

  // Extract package hashes from items with empty deps (P(g) in Gray Paper)
  const packageHashes = extractPackageHashes(itemsWithEmptyDeps)

  // Union with all accumulated packages for E function
  // E should remove dependencies that are in accumulatedcup ∪ P(g)
  const accumulatedcup = new Set<Hex>([
    ...allAccumulatedPackages,
    ...packageHashes,
  ])

  // Apply queue editing E(𝐫, accumulatedcup ∪ P(g)) to get remaining items
  const remainingItems = applyQueueEditingFunctionE(items, accumulatedcup)

  // Recursively process remaining items: Q(E(𝐫, accumulatedcup ∪ P(g)))
  // Pass accumulatedcup to include all packages found so far
  const recursivelyAccumulatable = getAccumulatableItemsQ(
    remainingItems,
    accumulated,
    accumulatedcup,
  )

  // Return g concat Q(E(𝐫, accumulatedcup ∪ P(g)))
  return [...itemsWithEmptyDeps, ...recursivelyAccumulatable]
}
