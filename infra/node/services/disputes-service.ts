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
  hexToBytes,
  logger,
  type Safe,
  safeResult,
  verifySignature,
  type WorkReportJudgmentEvent,
} from '@pbnj/core'
import {
  BaseService as BaseServiceClass,
  type Disputes,
  type IValidatorSetManager,
  type Verdict,
} from '@pbnj/types'
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
export class DisputesService extends BaseServiceClass {
  private readonly eventBusService: EventBusService

  // Four sets as specified in Gray Paper
  private readonly goodSet = new Set<Hex>()
  private readonly badSet = new Set<Hex>()
  private readonly wonkySet = new Set<Hex>()
  private readonly offenders = new Set<Hex>()

  private readonly validatorSetManagerService: ValidatorSetManager

  constructor(
    eventBusService: EventBusService,
    validatorSetManagerService: ValidatorSetManager,
  ) {
    super('disputes-service')
    this.eventBusService = eventBusService
    this.validatorSetManagerService = validatorSetManagerService
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

    // Parse block for dispute extrinsics and update sets
    // This would extract dispute data from the block and update the appropriate sets
    event.body.disputes.forEach((dispute) => {
      dispute.verdicts.forEach((verdict) => {
        const validSignatures = this.verifyVerdictSignatures(
          verdict,
          this.validatorSetManagerService,
        )
        if (validSignatures < Math.floor(verdict.votes.length / 2) + 1) {
          this.wonkySet.add(verdict.target)
        } else {
          // for each vote, if the vote is true, add to the good set
          verdict.votes.forEach((vote) => {
            if (vote.vote) {
              this.goodSet.add(verdict.target)
            } else {
              this.badSet.add(verdict.target)
              // this.addOffender(vote.index)
            }
          })
        }
      })
    })

    // add offenders to the offenders set
    event.header.offendersMark.forEach((offender) => {
      this.offenders.add(offender)
    })

    return safeResult(undefined)
  }

  private verifyVerdictSignatures(
    verdict: Verdict,
    validatorSetManagerService: IValidatorSetManager,
  ): number {
    let validSignatures = 0
    verdict.votes.forEach((vote) => {
      const [publicKeyError, publicKeys] =
        validatorSetManagerService.getValidatorAtIndex(Number(vote.index))
      if (publicKeyError) {
        logger.error('Failed to get validator at index', {
          error: publicKeyError,
        })
        return
      }
      const publicKey = publicKeys.ed25519
      // TODO: check against GP what the message for verdict should be
      const isValid = verifySignature(
        hexToBytes(publicKey),
        vote.vote === true ? Uint8Array.from([0x01]) : Uint8Array.from([0x00]),
        hexToBytes(vote.signature),
      )
      if (isValid) {
        validSignatures++
      }
    })
    return validSignatures
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

    logger.debug('Disputes state updated', {
      goodSetSize: this.goodSet.size,
      badSetSize: this.badSet.size,
      wonkySetSize: this.wonkySet.size,
      offendersSize: this.offenders.size,
    })
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
