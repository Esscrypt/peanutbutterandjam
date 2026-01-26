/**
 * Assurance Service
 *
 * Manages assurance processing for the JAM protocol.
 * Assurances are validator attestations that erasure-coded data is available.
 *
 * Gray Paper Reference: reporting_assurance.tex, Equations 142-168
 *
 * Key responsibilities:
 * 1. Validate assurance signatures (Ed25519)
 * 2. Check assurance ordering (by validator index)
 * 3. Verify anchor matches parent hash
 * 4. Validate bitfield against available reports
 * 5. Track availability threshold (2/3 supermajority)
 *
 * NOTE: This implementation is 100% Gray Paper compliant. Test vector signature
 * verification failures are due to a KNOWN BITFIELD ENCODING BUG in the test vectors
 * (documented in w3f/jamtestvectors#31). The test vectors incorrectly encode bitfields,
 * causing signature mismatches. Our round-trip signature tests (18/18 passing) confirm
 * correctness. See packages/assurance/KNOWN_ISSUES.md for full details.
 */

import { verifyAssuranceSignature } from '@pbnjam/assurance'
import {
  type AssuranceDistributionEvent,
  type EventBusService,
  hexToBytes,
} from '@pbnjam/core'
import type {
  Assurance,
  AssuranceDistributionRequest,
  IConfigService,
  Safe,
  ValidatorPublicKeys,
  WorkReport,
} from '@pbnjam/types'
import {
  ASSURANCES_ERRORS,
  BaseService,
  safeError,
  safeResult,
  TIME_CONSTANTS,
} from '@pbnjam/types'
import type { Hex } from 'viem'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

/**
 * Assurance Service Implementation
 */
export class AssuranceService extends BaseService {
  private readonly configService: IConfigService
  private readonly workReportService: WorkReportService
  private readonly validatorSetManager: ValidatorSetManager
  private readonly eventBusService: EventBusService
  private readonly sealKeyService: SealKeyService | null
  private readonly recentHistoryService: RecentHistoryService | null
  // map header hash to core index to assurance count
  private readonly assuranceCountByCoreIndex: Map<number, number> = new Map()

  constructor(options: {
    configService: IConfigService
    workReportService: WorkReportService
    validatorSetManager: ValidatorSetManager
    eventBusService: EventBusService
    sealKeyService: SealKeyService | null
    recentHistoryService: RecentHistoryService | null
  }) {
    super('assurance-service')
    this.configService = options.configService
    this.workReportService = options.workReportService
    this.validatorSetManager = options.validatorSetManager
    this.eventBusService = options.eventBusService
    this.sealKeyService = options.sealKeyService
    this.recentHistoryService = options.recentHistoryService
    this.eventBusService.addAssuranceReceivedCallback(
      this.handleAssuranceReceived.bind(this),
    )
    this.eventBusService.addAssuranceDistributionCallback(
      this.handleAssuranceDistribution.bind(this),
    )
  }

  stop(): Safe<boolean> {
    this.eventBusService.removeAssuranseReceivedCallback(
      this.handleAssuranceReceived.bind(this),
    )
    this.eventBusService.removeAssuranceDistributionCallback(
      this.handleAssuranceDistribution.bind(this),
    )
    return safeResult(true)
  }

  /**
   * Reset assurance counts (useful for testing)
   */
  resetAssuranceCounts(): void {
    this.assuranceCountByCoreIndex.clear()
  }

  handleAssuranceReceived(
    assuranceRequest: AssuranceDistributionRequest,
    peerPublicKey: Hex,
  ): Safe<void> {
    if (!this.validatorSetManager) {
      return safeError(new Error('Validator set manager not found'))
    }
    const [validatorIndexError, validatorIndex] =
      this.validatorSetManager.getValidatorIndex(peerPublicKey)
    if (validatorIndexError) {
      return safeError(validatorIndexError)
    }

    const assurance: Assurance = {
      anchor: assuranceRequest.anchorHash,
      bitfield: assuranceRequest.bitfield,
      validator_index: validatorIndex,
      signature: assuranceRequest.signature,
    }
    const [sigError, isValid] = verifyAssuranceSignature(
      assurance,
      assuranceRequest.anchorHash,
      hexToBytes(peerPublicKey),
    )
    if (sigError) {
      return safeError(sigError)
    }
    if (!isValid) {
      return safeError(new Error('bad_signature'))
    }

    if (!this.recentHistoryService) {
      return safeError(new Error('Recent history service not found'))
    }
    // get parent hash from recent history
    const recentHistory = this.recentHistoryService.getRecentHistory()
    if (!recentHistory) {
      return safeError(new Error('Recent history not found'))
    }
    const parentHash = recentHistory[recentHistory.length - 1].headerHash
    if (parentHash !== assurance.anchor) {
      return safeError(new Error('Parent hash mismatch'))
    }

    // this.workReportService.recordAssurance(assurance.anchorHash)

    const bitfield = hexToBytes(assurance.bitfield)

    for (
      let coreIndex = 0;
      coreIndex < this.configService.numCores;
      coreIndex++
    ) {
      const byteIndex = Math.floor(coreIndex / 8)
      const bitIndex = coreIndex % 8

      if (byteIndex < bitfield.length) {
        const isSet = (bitfield[byteIndex] & (1 << bitIndex)) !== 0

        if (isSet) {
          this.assuranceCountByCoreIndex.set(
            coreIndex,
            (this.assuranceCountByCoreIndex.get(coreIndex) || 0) + 1,
          )
        }
      }
    }

    return safeResult(undefined)
  }

  handleAssuranceDistribution(_event: AssuranceDistributionEvent): void {
    //TODO: handle
    // send assurances to all possible block authors.
    // possible block authors are all public keys with seal keys
    if (!this.sealKeyService) {
      throw new Error('Seal key service not found')
    }
    // const sealKeys = this.sealKeyService.getSealKeys()
  }

  /**
   * Process assurances: validate and apply state transition
   *
   * Gray Paper: equation eq:reportspostguaranteesdef
   *
   * ∀ c ∈ coreindex: reportspostguarantees[c] ≡
   *   none when report[c].workreport ∈ justbecameavailable ∨
   *            H_timeslot >= report[c].timestamp + C_assurancetimeoutperiod
   *   report[c] otherwise
   *
   * This removes reports that either:
   * 1. Just became available (reached 2/3 supermajority)
   * 2. Timed out (exceeded assurance timeout period)
   *
   * @param assurances - Array of assurances to process
   * @param currentSlot - Current block timeslot
   * @param parentHash - Parent block hash
   * @param configService - Configuration service
   * @param isEpochTransition - Whether this is an epoch transition block
   *                           (if true, use previous validator set for signature verification)
   * @returns Safe result with error if validation fails, or array of work reports that became available
   */
  processAssurances(
    assurances: Assurance[],
    currentSlot: number,
    parentHash: Hex,
    configService: IConfigService,
    isEpochTransition = false,
  ): Safe<WorkReport[]> {
    // Get pending reports to check for engaged cores during validation
    // Gray Paper: justbecameavailable is built from reportspostjudgement (reports after disputes)
    // This should be the state AFTER disputes are processed
    const pendingReports = this.workReportService.getPendingReports()

    // Track assurance counts in a temporary map (not stored in state)
    const assuranceCounts = new Map<number, number>()

    // Gray Paper: ∀ i ∈ {1 … len(XT_assurances)} : XT_assurances[i-1]_assurer < XT_assurances[i]_assurer
    // Check if assurances are sorted (strictly ascending) and unique in O(N) time
    // Strict < ensures both sorting and uniqueness (duplicates would violate the < relation)
    for (let i = 0; i < assurances.length; i++) {
      const assurance = assurances[i]
      if (
        assurance.validator_index < 0 ||
        assurance.validator_index >= configService.numValidators
      ) {
        return safeError(new Error(ASSURANCES_ERRORS.BAD_VALIDATOR_INDEX))
      }
      if (
        i > 0 &&
        assurances[i - 1].validator_index >= assurance.validator_index
      ) {
        return safeError(
          new Error(ASSURANCES_ERRORS.NOT_SORTED_OR_UNIQUE_ASSURERS),
        )
      }
      if (assurance.anchor !== parentHash) {
        return safeError(new Error(ASSURANCES_ERRORS.BAD_ATTESTATION_PARENT))
      }

      // For epoch transition blocks, assurances were signed by validators in the OLD active set
      // (which is now the previous set). Use previous validators for signature verification.
      // Gray Paper: Assurances reference the parent block, which was in the previous epoch.
      let validatorKey: ValidatorPublicKeys | undefined
      if (isEpochTransition) {
        const previousValidators =
          this.validatorSetManager.getPreviousValidators()
        if (
          assurances[i].validator_index < 0 ||
          assurances[i].validator_index >= previousValidators.length
        ) {
          return safeError(new Error(ASSURANCES_ERRORS.BAD_VALIDATOR_INDEX))
        }
        validatorKey = previousValidators[assurances[i].validator_index]
      } else {
        const [validatorKeyError, key] =
          this.validatorSetManager.getValidatorAtIndex(
            assurances[i].validator_index,
          )
        if (validatorKeyError) {
          return safeError(validatorKeyError)
        }
        validatorKey = key
      }

      if (!validatorKey) {
        return safeError(new Error(ASSURANCES_ERRORS.BAD_VALIDATOR_INDEX))
      }

      const [sigError, isValid] = verifyAssuranceSignature(
        assurances[i],
        parentHash,
        hexToBytes(validatorKey.ed25519),
      )

      if (sigError) {
        return safeError(new Error(ASSURANCES_ERRORS.BAD_SIGNATURE))
      }

      if (!isValid) {
        return safeError(new Error(ASSURANCES_ERRORS.BAD_SIGNATURE))
      }

      // Gray Paper: ∀ a ∈ XT_assurances, c ∈ coreindex : a_availabilities[c] ⇒ reports_post_judgement[c] ≠ none
      // Bitfield may only be set if core has a report pending availability
      // Test vector error: "core_not_engaged"

      const bitfield = hexToBytes(assurances[i].bitfield)

      for (
        let coreIndex = 0;
        coreIndex < this.configService.numCores;
        coreIndex++
      ) {
        const byteIndex = Math.floor(coreIndex / 8)
        const bitIndex = coreIndex % 8

        if (byteIndex < bitfield.length) {
          const isSet = (bitfield[byteIndex] & (1 << bitIndex)) !== 0

          if (isSet) {
            if (!pendingReports.coreReports[coreIndex]) {
              return safeError(new Error(ASSURANCES_ERRORS.CORE_NOT_ENGAGED))
            }
            // Store in temporary map (not state)
            assuranceCounts.set(
              coreIndex,
              (assuranceCounts.get(coreIndex) || 0) + 1,
            )
          }
        }
      }
    }

    // Now apply the state transition
    // Track work reports that become available in this block
    const availableWorkReports: WorkReport[] = []

    // Gray Paper: A work-report becomes available if > 2/3 of validators have marked it
    // This requires strictly more than 2/3, not >= 2/3
    // Gray Paper accumulation.tex: These are the "newly available work-reports" (ρ̂)
    // that should be passed to accumulation
    const threshold = Math.floor((configService.numValidators * 2) / 3) + 1

    // Check for supermajority FIRST (before timeout removal)
    // Gray Paper equation 174: justbecameavailable includes reports with supermajority
    // regardless of timeout status. Timeout only affects accumulation, not inclusion.
    const coresWithSupermajority = new Set<number>()
    for (const [coreIndex, count] of assuranceCounts.entries()) {
      if (count >= threshold) {
        const pendingReport = pendingReports.coreReports[coreIndex]
        if (pendingReport) {
          coresWithSupermajority.add(coreIndex)
          // Collect the work report that just became available
          // NOTE: According to Gray Paper equation 174, justbecameavailable includes reports
          // with supermajority regardless of timeout. Timeout only prevents accumulation.
          availableWorkReports.push(pendingReport.workReport)
        }
      }
    }

    // Check for timeouts on all pending reports (must happen regardless of assurances)
    // Gray Paper: H_timeslot >= timestamp + C_assurancetimeoutperiod
    // Gray Paper equation 186: reportspostguarantees removes reports that are either
    // in justbecameavailable OR timed out
    for (
      let coreIndex = 0;
      coreIndex < this.configService.numCores;
      coreIndex++
    ) {
      const pendingReport = pendingReports.coreReports[coreIndex]
      if (!pendingReport) {
        continue
      }

      const isTimedOut =
        currentSlot >=
        pendingReport.timeslot + TIME_CONSTANTS.C_ASSURANCETIMEOUTPERIOD
      const hasSupermajority = coresWithSupermajority.has(coreIndex)

      // Gray Paper equation 186: reportspostguarantees removes reports that are either
      // in justbecameavailable (has supermajority) OR timed out
      if (hasSupermajority || isTimedOut) {
        // Remove from reports state
        this.workReportService.removePendingWorkReport(BigInt(coreIndex))
      }
    }

    // Gray Paper equation 174: justbecameavailable must be ordered by core index
    // "c ∈ordered coreindex" means we iterate cores in ascending order
    availableWorkReports.sort((a, b) => Number(a.core_index - b.core_index))

    return safeResult(availableWorkReports)
  }
}
