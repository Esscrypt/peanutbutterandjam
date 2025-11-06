/**
 * Disputes Service
 *
 * Implements Gray Paper Section: Disputes (ψ)
 *
 * Gray Paper Reference: graypaper/text/reporting_assurance.tex
 *
 * This service manages dispute judgments on work-reports and validators.
 * It maintains four sets in memory for efficient dispute tracking.
 *
 * Key Components:
 * - goodSet: Work-reports judged correct
 * - badSet: Work-reports judged incorrect
 * - wonkySet: Work-reports with unknowable validity
 * - offenders: Validators who made incorrect judgments
 *
 * Storage Strategy:
 * - Primary: In-memory sets for fast lookups
 * - Secondary: Database persistence for node recovery
 */

import {
  type BlockProcessedEvent,
  type EventBusService,
  type Hex,
  logger,
  type WorkReportJudgmentEvent,
} from '@pbnj/core'
import {
  validateCulpritSignature,
  validateFaultSignature,
  validateVerdicts,
} from '@pbnj/disputes'
import {
  BaseService,
  type Dispute,
  type Disputes,
  type Safe,
  safeError,
  safeResult,
} from '@pbnj/types'
import type { ConfigService } from './config-service'
import type { ValidatorSetManager } from './validator-set'

// ============================================================================
// Disputes Service
// ============================================================================

/**
 * Disputes Service
 *
 * Manages dispute judgments according to Gray Paper specifications.
 * Uses in-memory sets for efficient dispute tracking with optional
 * database persistence.
 */
export class DisputesService extends BaseService {
  private readonly eventBusService: EventBusService

  // Four sets as specified in Gray Paper
  private readonly goodSet = new Set<Hex>()
  private readonly badSet = new Set<Hex>()
  private readonly wonkySet = new Set<Hex>()
  private readonly offenders = new Set<Hex>()

  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly configService: ConfigService

  constructor(options: {
    eventBusService: EventBusService
    validatorSetManagerService: ValidatorSetManager
    configService: ConfigService
  }) {
    super('disputes-service')
    this.eventBusService = options.eventBusService
    this.validatorSetManagerService = options.validatorSetManagerService
    this.configService = options.configService
  }

  override start(): Safe<boolean> {
    // Register event handlers
    this.eventBusService.addBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )
    this.eventBusService.addWorkReportJudgmentCallback(
      this.handleWorkReportJudgment.bind(this),
    )
    return safeResult(true)
  }

  override stop(): Safe<boolean> {
    // Remove event handlers
    this.eventBusService.removeBlockProcessedCallback(
      this.handleBlockProcessed.bind(this),
    )
    this.eventBusService.removeWorkReportJudgmentCallback(
      this.handleWorkReportJudgment.bind(this),
    )

    return safeResult(true)
  }

  // ============================================================================
  // Dispute Processing
  // ============================================================================

  /**
   * Process disputes according to Gray Paper specifications
   *
   * Gray Paper Reference: graypaper/text/judgments.tex
   *
   * Processes disputes extrinsic (XT_disputes) which comprises:
   * - Verdicts: Collections of judgments on work-report validity
   * - Culprits: Validators who guaranteed invalid work-reports
   * - Faults: Validators with contradictory judgments
   *
   * @param disputes - Array of dispute extrinsics to process
   * @param currentTimeslot - Current timeslot (tau) for age validation
   * @returns Safe result containing offenders_mark (Ed25519 keys of offenders)
   */
  public applyDisputes(
    disputes: Dispute[],
    currentTimeslot: bigint,
  ): Safe<Hex[]> {
    if (!this.configService) {
      return safeError(
        new Error('ConfigService is required for processing disputes'),
      )
    }

    const offendersMark: Hex[] = []

    // Process each dispute
    for (const dispute of disputes) {
      // Validate verdicts are sorted and unique by target (Gray Paper line 73)
      // \xtverdicts = \sqorderuniqby{\xv¬reporthash}{...}
      for (let i = 0; i < dispute.verdicts.length; i++) {
        if (i > 0) {
          const prevTarget = dispute.verdicts[i - 1].target
          const currentTarget = dispute.verdicts[i].target
          // Check if out of order or duplicate
          if (currentTarget <= prevTarget) {
            return safeError(new Error('verdicts_not_sorted_unique'))
          }
        }
      }

      // Process verdicts
      for (const verdict of dispute.verdicts) {
        // Validate judgments are sorted and unique by index (Gray Paper line 81)
        // \xv¬judgments = \sqorderuniqby{\xvj¬judgeindex}{...}
        for (let i = 0; i < verdict.votes.length; i++) {
          if (i > 0) {
            const prevIndex = verdict.votes[i - 1].index
            const currentIndex = verdict.votes[i].index
            // Check if out of order or duplicate
            if (currentIndex <= prevIndex) {
              return safeError(new Error('judgements_not_sorted_unique'))
            }
          }
        }

        // Check if already judged - return error according to Gray Paper
        if (
          this.goodSet.has(verdict.target) ||
          this.badSet.has(verdict.target) ||
          this.wonkySet.has(verdict.target)
        ) {
          return safeError(new Error('already_judged'))
        }

        // Validate verdict signatures
        const [validationError] = validateVerdicts(
          [verdict],
          this.validatorSetManagerService,
          this.configService,
          currentTimeslot,
        )
        if (validationError) {
          return safeError(validationError)
        }

        // Determine verdict based on votes
        // Gray Paper line 92: verdict approval must be exactly one of:
        // {0, floor(1/3*Cvalcount), floor(2/3*Cvalcount) + 1}
        const positiveVotes = verdict.votes.filter((v) => v.vote).length

        // Gray Paper: Validate that the approval value (sum of positive votes) is valid
        const requiredWonky = Math.floor(this.configService.numValidators / 3)
        const requiredGood =
          Math.floor((2 * this.configService.numValidators) / 3) + 1
        const allowedApprovalValues = [0, requiredWonky, requiredGood]

        // The approval value is the sum of positive votes
        if (!allowedApprovalValues.includes(positiveVotes)) {
          return safeError(new Error('bad_vote_split'))
        }

        // Determine which set to add the verdict target to
        if (positiveVotes === requiredGood) {
          // Good verdict: floor(2/3*Cvalcount) + 1 positive votes
          this.goodSet.add(verdict.target)
        } else if (positiveVotes === 0) {
          // Bad verdict: 0 positive votes
          this.badSet.add(verdict.target)
        } else if (positiveVotes === requiredWonky) {
          // Wonky verdict: floor(1/3*Cvalcount) positive votes
          this.wonkySet.add(verdict.target)
        } else {
          // This should never happen due to the validation above, but handle it anyway
          return safeError(new Error('bad_vote_split'))
        }
      }

      // Gray Paper line 105-111: Validate constraints on verdict composition
      // For good verdicts (2/3+1 positive votes): must have at least one fault
      // For bad verdicts (0 positive votes): must have at least 2 culprits
      for (const verdict of dispute.verdicts) {
        const positiveVotes = verdict.votes.filter((v) => v.vote).length
        const totalVotes = verdict.votes.length
        const requiredPositiveVotes =
          Math.floor((2 * this.configService.numValidators) / 3) + 1

        // Gray Paper line 107-108: good verdict (2/3+1 positive votes) → must have at least one fault
        // A verdict is "good" if positiveVotes >= requiredPositiveVotes (floor(2/3*Cvalcount) + 1)
        if (positiveVotes >= requiredPositiveVotes && totalVotes > 0) {
          const faultsForTarget = dispute.faults.filter(
            (f) => f.target === verdict.target,
          )
          if (faultsForTarget.length < 1) {
            return safeError(new Error('not_enough_faults'))
          }
        }

        // Gray Paper line 109-110: bad verdict (0 positive votes) → must have at least 2 culprits
        if (positiveVotes === 0 && totalVotes > 0) {
          const culpritsForTarget = dispute.culprits.filter(
            (c) => c.target === verdict.target,
          )
          if (culpritsForTarget.length < 2) {
            return safeError(new Error('not_enough_culprits'))
          }
        }
      }

      // Validate culprits are sorted and unique by key (Gray Paper line 74)
      // \xtculprits = \sqorderuniqby{\xc¬offenderindex}{...}
      for (let i = 0; i < dispute.culprits.length; i++) {
        if (i > 0) {
          const prevKey = dispute.culprits[i - 1].key
          const currentKey = dispute.culprits[i].key
          // Check if out of order or duplicate
          if (currentKey <= prevKey) {
            return safeError(new Error('culprits_not_sorted_unique'))
          }
        }
      }

      // Process culprits - validators who guaranteed invalid work-reports
      // Gray Paper equation (58-61): culprits must have valid signatures and target in badSet
      // Gray Paper: "may not report keys which are already in the punish-set"
      for (const culprit of dispute.culprits) {
        // Step 1: Check if key is already in offenders (must check FIRST before any other validation)
        // This includes keys from pre_state.offenders AND keys added by previous culprits in this batch
        if (this.offenders.has(culprit.key)) {
          return safeError(new Error('offender_already_reported'))
        }

        // Step 2: Validate culprit signature according to Gray Paper
        const [sigError] = validateCulpritSignature(
          culprit,
          this.validatorSetManagerService,
        )
        if (sigError) {
          // Return the error (could be bad_guarantor_key or bad_signature)
          return safeError(sigError)
        }

        // Step 3: Verify the culprit's target is in badSet (Gray Paper requirement)
        // Gray Paper: reprothash ∈ badset'
        if (!this.badSet.has(culprit.target)) {
          return safeError(new Error('culprits_verdict_not_bad'))
        }

        // Step 4: Add culprit's Ed25519 key to offenders
        this.offenders.add(culprit.key)
        offendersMark.push(culprit.key)
      }

      // Validate faults are sorted and unique by key (Gray Paper line 75)
      // \xtfaults = \sqorderuniqby{\xf¬offenderindex}{...}
      for (let i = 0; i < dispute.faults.length; i++) {
        if (i > 0) {
          const prevKey = dispute.faults[i - 1].key
          const currentKey = dispute.faults[i].key
          // Check if out of order or duplicate
          if (currentKey <= prevKey) {
            return safeError(new Error('faults_not_sorted_unique'))
          }
        }
      }

      // Process faults - validators with contradictory judgments
      // Gray Paper equation (63-66): faults must have valid signatures and contradict verdicts
      for (const fault of dispute.faults) {
        // Step 1: Check if key is already in offenders (must check FIRST before any other validation)
        // This includes keys from pre_state.offenders AND keys added by previous faults/culprits in this batch
        // Gray Paper: Similar to culprits, faults cannot report keys already in the punish-set
        if (this.offenders.has(fault.key)) {
          return safeError(new Error('offender_already_reported'))
        }

        // Step 2: Validate fault signature according to Gray Paper
        const [sigError] = validateFaultSignature(
          fault,
          this.validatorSetManagerService,
        )
        if (sigError) {
          return safeError(sigError)
        }

        // Step 3: Check verdict relationship according to Gray Paper
        // Gray Paper: reprothash ∈ badset' ⇔ reprothash ∉ goodset' ⇔ validity
        // This means: if fault.vote (validity) = true, then target must be in badset
        //            if fault.vote (validity) = false, then target must be in goodset
        const isGood = this.goodSet.has(fault.target)
        const isBad = this.badSet.has(fault.target)

        // Gray Paper condition: fault.vote must match the verdict state
        // fault.vote = true → target should be in badset (not goodset)
        // fault.vote = false → target should be in goodset (not badset)
        const verdictMatchesFaultVote =
          (fault.vote && isBad && !isGood) || // fault.vote=true → badset
          (!fault.vote && isGood && !isBad) // fault.vote=false → goodset

        if (!verdictMatchesFaultVote) {
          // Fault vote does not match verdict state
          return safeError(new Error(`fault_verdict_wrong`))
        }

        // Step 4: If verdict matches fault vote, the validator who signed this fault vote
        // is in contradiction with the verdict, so they are an offender
        // (The fault proves the validator voted fault.vote, but the verdict went the opposite way)
        // Actually wait - if fault.vote=true and verdict is bad, that means validator voted
        // "good" (fault.vote=true means jam_valid), but verdict is "bad" → contradiction → offender
        // If fault.vote=false and verdict is good, that means validator voted "bad" (fault.vote=false
        // means jam_invalid), but verdict is "good" → contradiction → offender
        // Both cases represent contradictions, so add to offenders
        if (!this.offenders.has(fault.key)) {
          this.offenders.add(fault.key)
          offendersMark.push(fault.key)
        }
      }
    }

    return safeResult(offendersMark)
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Handle block processing event
   * Updates dispute sets based on block content
   */
  private async handleBlockProcessed(
    event: BlockProcessedEvent,
  ): Promise<Safe<void>> {
    logger.debug('Processing block for disputes', {
      goodSetSize: this.goodSet.size,
      badSetSize: this.badSet.size,
      wonkySetSize: this.wonkySet.size,
      offendersSize: this.offenders.size,
    })

    // Process disputes from block
    const [processError, offendersMark] = this.applyDisputes(
      event.body.disputes,
      event.header.timeslot,
    )
    if (processError) {
      logger.error('Failed to process disputes', { error: processError })
      return safeError(processError)
    }

    // Update header's offendersMark with computed offenders
    // Note: This should ideally be set by the caller, but we populate it here for convenience
    if (offendersMark) {
      offendersMark.forEach((offender) => {
        event.header.offendersMark.push(offender)
      })
    }

    // Add all offenders from header to offenders set (in case they were set externally)
    event.header.offendersMark.forEach((offender) => {
      this.offenders.add(offender)
    })

    return safeResult(undefined)
  }

  /**
   * Handle work report judgment event
   * Updates dispute sets based on judgment
   */
  private async handleWorkReportJudgment(
    event: WorkReportJudgmentEvent,
  ): Promise<Safe<void>> {
    logger.debug('Processing work report judgment', {
      workReportHash: event.workReportHash,
      judgment: event.judgment,
      validatorHash: event.validatorHash,
      reason: event.reason,
    })

    // Update the appropriate dispute set based on judgment
    switch (event.judgment) {
      case 'good':
        this.goodSet.add(event.workReportHash)
        break
      case 'bad':
        this.badSet.add(event.workReportHash)
        // If judgment is bad, the validator might be an offender
        // TODO: Implement logic to determine if validator should be added to offenders
        break
      case 'wonky':
        this.wonkySet.add(event.workReportHash)
        break
      default:
        logger.warn('Unknown judgment type', { judgment: event.judgment })
    }

    return safeResult(undefined)
  }

  /**
   * Check if work-report is in good set
   */
  public isInGoodSet(workReportHash: Hex): boolean {
    return this.goodSet.has(workReportHash)
  }

  /**
   * Check if work-report is in bad set
   */
  public isInBadSet(workReportHash: Hex): boolean {
    return this.badSet.has(workReportHash)
  }

  /**
   * Check if work-report is in wonky set
   */
  public isInWonkySet(workReportHash: Hex): boolean {
    return this.wonkySet.has(workReportHash)
  }

  /**
   * Check if validator is an offender
   */
  public isOffender(validatorHash: Hex): boolean {
    return this.offenders.has(validatorHash)
  }

  /**
   * Get all disputes as Gray Paper Disputes interface
   */
  public getDisputes(): {
    goodSet: Hex[]
    badSet: Hex[]
    wonkySet: Hex[]
    offenders: Hex[]
  } {
    return {
      goodSet: Array.from(this.goodSet),
      badSet: Array.from(this.badSet),
      wonkySet: Array.from(this.wonkySet),
      offenders: Array.from(this.offenders),
    }
  }

  /**
   * Get disputes state as Disputes interface
   *
   * Gray Paper: disputes ≡ (goodset, badset, wonkyset, offenders)
   */
  public getDisputesState(): Disputes {
    return {
      goodSet: this.goodSet,
      badSet: this.badSet,
      wonkySet: this.wonkySet,
      offenders: this.offenders,
    }
  }

  /**
   * Set disputes state from Disputes interface
   *
   * Gray Paper: disputes ≡ (goodset, badset, wonkyset, offenders)
   */
  public setDisputesState(disputes: Disputes): void {
    this.goodSet.clear()
    this.badSet.clear()
    this.wonkySet.clear()
    this.offenders.clear()

    // Copy all elements from the provided disputes
    disputes.goodSet.forEach((hash) => this.goodSet.add(hash))
    disputes.badSet.forEach((hash) => this.badSet.add(hash))
    disputes.wonkySet.forEach((hash) => this.wonkySet.add(hash))
    disputes.offenders.forEach((hash) => this.offenders.add(hash))
  }

  /**
   * Clear all dispute sets (for testing)
   */
  public clearDisputes(): void {
    this.goodSet.clear()
    this.badSet.clear()
    this.wonkySet.clear()
    this.offenders.clear()
    logger.info('All dispute sets cleared')
  }

  /**
   * Remove work-report from all sets
   */
  public removeWorkReport(workReportHash: Hex): void {
    this.goodSet.delete(workReportHash)
    this.badSet.delete(workReportHash)
    this.wonkySet.delete(workReportHash)
    logger.debug('Removed work-report from all sets', { workReportHash })
  }
}
