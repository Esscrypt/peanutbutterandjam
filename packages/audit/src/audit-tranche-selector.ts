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

import { calculateWorkReportHash } from '@pbnjam/codec'
import { bytesToHex, type Hex, jamShuffle, logger } from '@pbnjam/core'
import type {
  AuditTrancheSelection,
  IConfigService,
  IWorkReportService,
  WorkReport,
} from '@pbnjam/types'
import {
  generateTranche0AuditSignature,
  generateTrancheNAuditSignature,
} from './audit-signature'

export const MAX_AUDIT_CORES = 10 // First 10 cores from shuffled sequence

/**
 * Create core-workreport pairs for all cores
 *
 * Gray Paper: [(c, local_reports[c]) for c in coreindex]
 * Queries work report for each core from WorkReportService
 *
 * @param workReportService - Service to query work reports
 * @param numCores - Total number of cores
 * @returns Array of (coreIndex, workReport) pairs, where workReport can be null
 */
function createCoreWorkReportPairs(
  workReportService: IWorkReportService,
  numCores: number,
): Array<{ coreIndex: bigint; workReport: WorkReport | null }> {
  return Array.from({ length: numCores }, (_, i) => {
    const coreIndex = BigInt(i)
    return {
      coreIndex,
      workReport: workReportService.getWorkReportForCore(coreIndex),
    }
  })
}

/**
 * Convert a core-workreport pair to the hash format used in audit selections
 *
 * @param pair - Core-workreport pair
 * @returns Core with work report hash, or null if work report is missing or hash calculation fails
 */
function pairToCoreWithHash(pair: {
  coreIndex: bigint
  workReport: WorkReport | null
}): {
  coreIndex: bigint
  workReports: Array<{ workReportHash: Hex }>
} | null {
  if (pair.workReport === null) {
    return null
  }

  const [hashError, workReportHash] = calculateWorkReportHash(pair.workReport)
  if (hashError) {
    logger.warn('Failed to calculate work report hash', {
      error: hashError.message,
      coreIndex: pair.coreIndex.toString(),
    })
    return null
  }

  return {
    coreIndex: pair.coreIndex,
    workReports: [{ workReportHash: workReportHash! }],
  }
}

/**
 * Compute bandersnatch VRF output for audit tranche selection
 *
 * Generates the tranche 0 audit signature and extracts the banderout result
 * as a hex string. This VRF output is used for Fisher-Yates shuffle entropy
 * in both tranche 0 and tranche N selections.
 *
 * Gray Paper: banderout{local_seed_0} from s_0 ∈ bssignature{...}{Xaudit ∥ banderout{H_vrfsig}}{∅}
 *
 * @param validatorSecretKey - Validator's Bandersnatch secret key
 * @param blockHeaderVrfOutput - Block header VRF output (32 bytes)
 * @returns Hex string representation of the VRF output, or undefined on error
 */
function computeBandersnatchVrfOutput(
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
): Hex | undefined {
  const [signatureError, signatureResult] = generateTranche0AuditSignature(
    validatorSecretKey,
    blockHeaderVrfOutput,
  )

  if (signatureError || !signatureResult) {
    logger.error(
      'Failed to generate tranche 0 audit signature for VRF output',
      {
        error: signatureError?.message || 'Signature result is undefined',
      },
    )
    return undefined
  }

  return bytesToHex(signatureResult.banderoutResult)
}

/**
 * Select cores for audit tranche 0 using Fisher-Yates shuffle
 *
 * Gray Paper Implementation:
 * p = fyshuffle([(c, local_reports[c]) for c in coreindex], banderout{local_seed_0})
 * local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
 *
 * According to Gray Paper auditing.tex lines 38-49 and 54-68:
 * - local_reports is a sequence of length Ccorecount mapping core index to work report or None
 * - local_reports[c] = reports[c].workreport if reports[c].workreport ∈ justbecameavailable, else None
 * - local_seed_0 ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig}}{∅}
 * - banderout{local_seed_0} is used as entropy for Fisher-Yates shuffle
 */
export function selectAuditTranche0(
  workReportService: IWorkReportService,
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  configService: IConfigService,
): AuditTrancheSelection {
  const numCores = configService.numCores

  // Generate local_seed_0 signature and extract banderout{local_seed_0}
  // Gray Paper Eq. 54-62: s_0 ∈ bssignature{activeset[v]_bs}{Xaudit ∥ banderout{H_vrfsig}}{∅}
  const banderoutLocalSeed0 = computeBandersnatchVrfOutput(
    validatorSecretKey,
    blockHeaderVrfOutput,
  )

  if (!banderoutLocalSeed0) {
    logger.error('Failed to compute bandersnatch VRF output for tranche 0')
    // Return empty selection on error
    return {
      selectedCores: [],
      shuffledSequence: [],
      vrfOutput: bytesToHex(blockHeaderVrfOutput),
      tranche: 0,
    }
  }

  // Create core-workreport pairs for ALL cores as per Gray Paper
  // [(c, local_reports[c]) for c in coreindex]
  const pairs = createCoreWorkReportPairs(workReportService, numCores)

  // Apply Fisher-Yates shuffle using banderout{local_seed_0} as entropy
  // Gray Paper Eq. 67: p = fyshuffle([(c, local_reports[c]) for c in coreindex], banderout{local_seed_0})
  const shuffledSequence = jamShuffle(pairs, banderoutLocalSeed0)

  // Select first 10 non-empty cores for auditing
  // local_tranche_0 = {wrc for wrc in p[0:10] if wr != None}
  const selectedCores = shuffledSequence
    .slice(0, MAX_AUDIT_CORES)
    .map(pairToCoreWithHash)
    .filter((core): core is NonNullable<typeof core> => core !== null)

  logger.debug('Audit tranche 0 selected', {
    selectedCoreCount: selectedCores.length,
    totalCores: numCores,
  })

  // Build shuffled sequence with work report hashes
  const shuffledSequenceWithHashes = shuffledSequence.map((pair) => {
    const coreWithHash = pairToCoreWithHash(pair)
    return (
      coreWithHash ?? {
        coreIndex: pair.coreIndex,
        workReports: [],
      }
    )
  })

  return {
    selectedCores,
    shuffledSequence: shuffledSequenceWithHashes,
    vrfOutput: banderoutLocalSeed0, // banderout{local_seed_0} used for shuffle
    tranche: 0,
  }
}

/**
 * Select cores for subsequent audit tranches (n > 0)
 *
 * Gray Paper Implementation:
 * local_tranche_n ≡ {wr for (Cvalcount/256*Cauditbiasfactor)*banderout{local_seed_n(wr)}_0 < m_n, wr ∈ local_reports, wr ≠ None}
 * where m_n = len{A_{n-1}(wr) \ J_top(wr)} (no-shows)
 *
 * According to Gray Paper auditing.tex lines 101-108:
 * - Queries work reports for ALL cores from WorkReportService (like tranche 0)
 * - For each work report, generates local_seed_n(wr) and extracts banderout{local_seed_n(wr)}
 * - Selection based on bias factor and no-show count
 */
export function selectAuditTrancheN(
  workReportService: IWorkReportService,
  validatorSecretKey: Uint8Array,
  blockHeaderVrfOutput: Uint8Array,
  configService: IConfigService,
  tranche: number,
  previousTrancheAnnouncements: Array<{
    validatorIndex?: bigint
    announcement: {
      workReports: Array<{
        coreIndex: bigint
        workReportHash: Hex
      }>
      signature: Hex
    }
  }>,
  negativeJudgments: Array<{ coreIndex: bigint; workReportHash?: Hex }>,
): AuditTrancheSelection {
  const numCores = configService.numCores
  const numValidators = configService.numValidators
  const CAUDITBIASFACTOR = 2 // Gray Paper: Cauditbiasfactor = 2

  logger.debug('Selecting audit tranche N', {
    tranche,
    numCores,
    numValidators,
    previousAnnouncements: previousTrancheAnnouncements.length,
    negativeJudgments: negativeJudgments.length,
  })

  // Create core-workreport pairs for ALL cores as per Gray Paper (like tranche 0)
  // [(c, local_reports[c]) for c in coreindex]
  const pairs = createCoreWorkReportPairs(workReportService, numCores)

  // Build map of no-shows (m_n) for each work report
  // m_n = len{A_{n-1}(wr) \ J_top(wr)}
  // A_{n-1}(wr): validators who announced intent to audit this work report in previous tranche
  // J_top(wr): validators who provided positive judgments
  const noShowCountByWorkReport = new Map<Hex, number>()
  const workReportByHash = new Map<Hex, WorkReport>()

  // Build map of work reports by hash
  for (const pair of pairs) {
    if (pair.workReport !== null) {
      const [hashError, workReportHash] = calculateWorkReportHash(
        pair.workReport,
      )
      if (!hashError && workReportHash) {
        workReportByHash.set(workReportHash, pair.workReport)
      }
    }
  }

  // Calculate m_n for each work report
  for (const [workReportHash] of workReportByHash.entries()) {
    // Count validators who announced this work report in previous tranche
    const announcers = new Set<bigint>()
    for (const announcement of previousTrancheAnnouncements) {
      const announcedThisWorkReport =
        announcement.announcement.workReports.some(
          (wr) => wr.workReportHash === workReportHash,
        )
      if (
        announcedThisWorkReport &&
        announcement.validatorIndex !== undefined
      ) {
        announcers.add(announcement.validatorIndex)
      }
    }

    // Count positive judgments (for now, assume no judgments = 0 positive)
    // TODO: Get actual positive judgments from judgment service
    const positiveJudgments = 0

    // m_n = number of no-shows
    const m_n = announcers.size - positiveJudgments
    noShowCountByWorkReport.set(workReportHash, m_n)
  }

  // Always audit cores with negative judgments
  const coresToAudit = new Set<bigint>()
  for (const judgment of negativeJudgments) {
    coresToAudit.add(judgment.coreIndex)
  }

  // Apply Gray Paper Eq. 106 selection logic for each work report
  // local_tranche_n ≡ {wr for (Cvalcount/256*Cauditbiasfactor)*banderout{local_seed_n(wr)}_0 < m_n, wr ∈ local_reports, wr ≠ None}
  const biasThreshold = numValidators / (256 * CAUDITBIASFACTOR)

  for (const pair of pairs) {
    if (pair.workReport === null) {
      continue
    }

    // Skip if already selected (negative judgment)
    if (coresToAudit.has(pair.coreIndex)) {
      continue
    }

    // Generate local_seed_n(wr) for this work report
    // Gray Paper Eq. 105: s_n(w) ∈ bssignature{...}{Xaudit ∥ banderout{H_vrfsig} ∥ blake{w} ∥ n}{∅}
    const [signatureError, signatureResult] = generateTrancheNAuditSignature(
      validatorSecretKey,
      blockHeaderVrfOutput,
      pair.workReport,
      BigInt(tranche),
    )

    if (signatureError || !signatureResult) {
      logger.warn(
        'Failed to generate tranche N audit signature for work report',
        {
          error: signatureError?.message || 'Signature result is undefined',
          coreIndex: pair.coreIndex.toString(),
          tranche,
        },
      )
      continue
    }

    // Extract banderout{local_seed_n(wr)}_0 (first byte)
    const banderoutLocalSeedN = signatureResult.banderoutResult
    const banderoutFirstByte = banderoutLocalSeedN[0]

    // Get m_n for this work report
    const [hashError, workReportHash] = calculateWorkReportHash(pair.workReport)
    if (hashError || !workReportHash) {
      continue
    }

    const m_n = noShowCountByWorkReport.get(workReportHash) || 0

    // Apply selection condition: (Cvalcount/256*Cauditbiasfactor)*banderout{local_seed_n(wr)}_0 < m_n
    const leftSide = (biasThreshold * banderoutFirstByte) / 256

    if (leftSide < m_n) {
      coresToAudit.add(pair.coreIndex)
    }
  }

  // Create final selection with work report hashes
  const selectedCores: Array<{
    coreIndex: bigint
    workReports: Array<{ workReportHash: Hex }>
  }> = []

  for (const coreIndex of coresToAudit) {
    const pair = pairs.find((p) => p.coreIndex === coreIndex)
    if (pair && pair.workReport !== null) {
      const [hashError, workReportHash] = calculateWorkReportHash(
        pair.workReport,
      )
      if (hashError) {
        logger.warn('Failed to calculate work report hash', {
          error: hashError.message,
          coreIndex: coreIndex.toString(),
        })
        continue
      }
      selectedCores.push({
        coreIndex,
        workReports: [{ workReportHash: workReportHash! }],
      })
    }
  }

  // Build shuffled sequence with work report hashes (all cores, like tranche 0)
  const shuffledSequenceWithHashes = pairs.map((pair) => {
    if (pair.workReport === null) {
      return {
        coreIndex: pair.coreIndex,
        workReports: [],
      }
    }
    const [hashError, workReportHash] = calculateWorkReportHash(pair.workReport)
    if (hashError) {
      logger.warn(
        'Failed to calculate work report hash for shuffled sequence',
        {
          error: hashError.message,
          coreIndex: pair.coreIndex.toString(),
        },
      )
      return {
        coreIndex: pair.coreIndex,
        workReports: [],
      }
    }
    return {
      coreIndex: pair.coreIndex,
      workReports: [{ workReportHash: workReportHash! }],
    }
  })

  // Use tranche 0 VRF output for the shuffled sequence (consistent with tranche 0)
  // This ensures the same shuffle entropy is used across tranches
  const bandersnatchVrfOutput = computeBandersnatchVrfOutput(
    validatorSecretKey,
    blockHeaderVrfOutput,
  )

  if (!bandersnatchVrfOutput) {
    logger.error('Failed to compute bandersnatch VRF output for tranche N')
    // Fallback to blockHeaderVrfOutput on error
    const fallbackVrfOutput = bytesToHex(blockHeaderVrfOutput)
    const shuffledSequence = jamShuffle(
      shuffledSequenceWithHashes,
      fallbackVrfOutput,
    )
    return {
      selectedCores,
      shuffledSequence,
      vrfOutput: fallbackVrfOutput,
      tranche,
    }
  }

  const shuffledSequence = jamShuffle(
    shuffledSequenceWithHashes,
    bandersnatchVrfOutput,
  )

  logger.debug('Audit tranche N selected', {
    tranche,
    selectedCoreCount: selectedCores.length,
    totalCores: numCores,
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
  previousAnnouncements: Array<{
    validatorIndex?: bigint
    announcement: {
      workReports: Array<{
        coreIndex: bigint
        workReportHash: Hex
      }>
      signature: Hex
    }
  }>,
  negativeJudgments: Array<{ coreIndex: bigint; workReportHash?: Hex }>,
): bigint[] {
  const coresWithInsufficientJudgments = new Set<bigint>()

  // Create set of work reports that received judgments
  const judgedWorkReports = new Set(
    negativeJudgments
      .map((j) => j.workReportHash)
      .filter((h): h is Hex => h !== undefined),
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
  workReports: WorkReport[],
): boolean {
  try {
    // Group work reports by core index
    const coreWorkReportsMap = new Map<bigint, WorkReport[]>()
    for (const workReport of workReports) {
      const coreIndex = workReport.core_index
      if (!coreWorkReportsMap.has(coreIndex)) {
        coreWorkReportsMap.set(coreIndex, [])
      }
      coreWorkReportsMap.get(coreIndex)!.push(workReport)
    }

    // Recreate the shuffled sequence
    const corePairs = Array.from(coreWorkReportsMap.entries()).map(
      ([coreIndex, coreWorkReports]) => {
        const workReportHashes: Array<{ workReportHash: Hex }> = []
        for (const workReport of coreWorkReports) {
          const [hashError, workReportHash] =
            calculateWorkReportHash(workReport)
          if (!hashError && workReportHash) {
            workReportHashes.push({ workReportHash })
          }
        }
        return {
          coreIndex,
          workReports: workReportHashes,
        }
      },
    )
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
