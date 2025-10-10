/**
 * Audit Tranche Selection Service
 *
 * Implements the audit tranche selection logic from Gray Paper auditing.tex
 * Uses Fisher-Yates shuffle with Bandersnatch VRF output for verifiable random selection
 *
 * Gray Paper Reference: auditing.tex lines 64-68
 * p = fyshuffle([(c, local_reports[c]) for c in coreindex], banderout{local_seed_0})
 * local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
 */

import { jamShuffle, logger } from '@pbnj/core'
import type {
  AuditTrancheSelection,
  CoreWorkReport,
  NegativeJudgment,
  PreviousTrancheAnnouncement,
} from '@pbnj/types'
import type { Hex } from 'viem'

export const MAX_AUDIT_CORES = 10 // First 10 cores from shuffled sequence

/**
 * Select cores for audit tranche 0 using Fisher-Yates shuffle
 *
 * Gray Paper Implementation:
 * p = fyshuffle([(c, local_reports[c]) for c in coreindex], banderout{local_seed_0})
 * local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
 */
export function selectAuditTranche0(
  coreWorkReports: CoreWorkReport[],
  bandersnatchVrfOutput: Hex,
): AuditTrancheSelection {
  logger.debug('Selecting audit tranche 0', {
    coreCount: coreWorkReports.length,
    vrfOutput: `${bandersnatchVrfOutput.slice(0, 16)}...`,
  })

  // Create core-workreport pairs as per Gray Paper
  // [(c, local_reports[c]) for c in coreindex]
  const corePairs = coreWorkReports.map((core) => ({
    coreIndex: core.coreIndex,
    workReports: core.workReports,
  }))

  // Apply Fisher-Yates shuffle using Bandersnatch VRF output as entropy
  // fyshuffle(..., banderout{local_seed_0})
  const shuffledSequence = jamShuffle(corePairs, bandersnatchVrfOutput)

  // Select first 10 non-empty cores for auditing
  // local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
  const selectedCores: Array<{
    coreIndex: bigint
    workReports: Array<{
      workReportHash: Hex
      metadata?: Uint8Array
    }>
  }> = []

  for (const core of shuffledSequence) {
    // Only include cores with non-empty work reports
    if (core.workReports.length > 0) {
      selectedCores.push(core)

      // Stop after selecting 10 cores
      if (selectedCores.length >= MAX_AUDIT_CORES) {
        break
      }
    }
  }

  logger.debug('Audit tranche 0 selected', {
    selectedCoreCount: selectedCores.length,
    totalCores: coreWorkReports.length,
  })

  return {
    selectedCores,
    shuffledSequence,
    vrfOutput: bandersnatchVrfOutput,
    tranche: 0,
  }
}

/**
 * Select cores for subsequent audit tranches (n > 0)
 *
 * For tranches after 0, additional cores may be selected based on:
 * 1. Negative judgments received
 * 2. Insufficient judgments from previous tranche
 */
export function selectAuditTrancheN(
  coreWorkReports: CoreWorkReport[],
  bandersnatchVrfOutput: Hex,
  tranche: number,
  previousTrancheAnnouncements: PreviousTrancheAnnouncement[],
  negativeJudgments: NegativeJudgment[],
): AuditTrancheSelection {
  logger.debug('Selecting audit tranche N', {
    tranche,
    coreCount: coreWorkReports.length,
    previousAnnouncements: previousTrancheAnnouncements.length,
    negativeJudgments: negativeJudgments.length,
  })

  // For tranche N > 0, we need to consider:
  // 1. Cores with negative judgments (always audit)
  // 2. Cores with insufficient judgments from previous tranche
  // 3. Additional random selection if needed

  const coresToAudit = new Set<bigint>()

  // Always audit cores with negative judgments
  for (const judgment of negativeJudgments) {
    coresToAudit.add(judgment.coreIndex)
  }

  // Find cores with insufficient judgments from previous tranche
  const coresWithInsufficientJudgments = findCoresWithInsufficientJudgments(
    previousTrancheAnnouncements,
    negativeJudgments,
  )

  for (const coreIndex of coresWithInsufficientJudgments) {
    coresToAudit.add(coreIndex)
  }

  // If we still need more cores, use random selection
  if (coresToAudit.size < MAX_AUDIT_CORES) {
    const remainingCores = coreWorkReports.filter(
      (core) =>
        !coresToAudit.has(core.coreIndex) && core.workReports.length > 0,
    )

    if (remainingCores.length > 0) {
      // Shuffle remaining cores and select additional ones
      const shuffledRemaining = jamShuffle(
        remainingCores,
        bandersnatchVrfOutput,
      )
      const additionalNeeded = MAX_AUDIT_CORES - coresToAudit.size

      for (
        let i = 0;
        i < Math.min(additionalNeeded, shuffledRemaining.length);
        i++
      ) {
        coresToAudit.add(shuffledRemaining[i].coreIndex)
      }
    }
  }

  // Create final selection
  const selectedCores = coreWorkReports
    .filter((core) => coresToAudit.has(core.coreIndex))
    .map((core) => ({
      coreIndex: core.coreIndex,
      workReports: core.workReports,
    }))

  // Create shuffled sequence for verification (all cores)
  const corePairs = coreWorkReports.map((core) => ({
    coreIndex: core.coreIndex,
    workReports: core.workReports,
  }))
  const shuffledSequence = jamShuffle(corePairs, bandersnatchVrfOutput)

  logger.debug('Audit tranche N selected', {
    tranche,
    selectedCoreCount: selectedCores.length,
    totalCores: coreWorkReports.length,
  })

  return {
    selectedCores,
    shuffledSequence,
    vrfOutput: bandersnatchVrfOutput,
    tranche,
  }
}

/**
 * Find cores with insufficient judgments from previous tranche
 *
 * A core has insufficient judgments if:
 * - It was announced in previous tranche
 * - No corresponding judgment was received
 */
export function findCoresWithInsufficientJudgments(
  previousAnnouncements: PreviousTrancheAnnouncement[],
  negativeJudgments: NegativeJudgment[],
): bigint[] {
  const coresWithInsufficientJudgments = new Set<bigint>()

  // Create set of work reports that received judgments
  const judgedWorkReports = new Set(
    negativeJudgments.map((j) => j.workReportHash),
  )

  // Check each previous announcement for cores without judgments
  for (const announcement of previousAnnouncements) {
    for (const workReport of announcement.announcement.workReports) {
      if (!judgedWorkReports.has(workReport.workReportHash)) {
        coresWithInsufficientJudgments.add(workReport.coreIndex)
      }
    }
  }

  return Array.from(coresWithInsufficientJudgments)
}

/**
 * Verify audit tranche selection
 *
 * Validates that the selection was done correctly using the provided VRF output
 */
export function verifyAuditTrancheSelection(
  selection: AuditTrancheSelection,
  coreWorkReports: CoreWorkReport[],
): boolean {
  try {
    // Recreate the shuffled sequence
    const corePairs = coreWorkReports.map((core) => ({
      coreIndex: core.coreIndex,
      workReports: core.workReports,
    }))
    const expectedShuffled = jamShuffle(corePairs, selection.vrfOutput)

    // Verify the shuffled sequence matches
    if (expectedShuffled.length !== selection.shuffledSequence.length) {
      return false
    }

    for (let i = 0; i < expectedShuffled.length; i++) {
      if (
        expectedShuffled[i].coreIndex !==
        selection.shuffledSequence[i].coreIndex
      ) {
        return false
      }
    }

    // Verify selected cores are from the first 10 non-empty cores
    const nonEmptyCores = expectedShuffled.filter(
      (core) => core.workReports.length > 0,
    )
    const expectedSelectedCores = nonEmptyCores.slice(0, MAX_AUDIT_CORES)

    if (selection.selectedCores.length !== expectedSelectedCores.length) {
      return false
    }

    for (let i = 0; i < selection.selectedCores.length; i++) {
      if (
        selection.selectedCores[i].coreIndex !==
        expectedSelectedCores[i].coreIndex
      ) {
        return false
      }
    }

    return true
  } catch (error) {
    logger.error('Failed to verify audit tranche selection', { error })
    return false
  }
}
