/**
 * Block Importer Service
 *
 * Validates incoming blocks against current time slot and emits BlockProcessedEvent
 * for statistics tracking and other downstream processing.
 *
 * Key Responsibilities:
 * - Validate block header timeslot against current clock time
 * - Emit BlockProcessedEvent for valid blocks
 * - Handle block validation errors
 * - Provide block import status tracking
 */

import {
  validateBlockHeader,
  validatePreStateRoot,
} from '@pbnjam/block-importer'
import {
  calculateBlockHashFromHeader,
  calculateExtrinsicHash,
} from '@pbnjam/codec'
import { type EventBusService, type Hex, logger, zeroHash } from '@pbnjam/core'

import type { Block } from '@pbnjam/types'
import {
  BaseService,
  BLOCK_HEADER_ERRORS,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnjam/types'

import type { AccumulationService } from './accumulation-service'
import type { AssuranceService } from './assurance-service'
import type { AuthPoolService } from './auth-pool-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { EntropyService } from './entropy'
import type { GuarantorService } from './guarantor-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'
import type { StateService } from './state-service'
import type { StatisticsService } from './statistics-service'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'

/**
 * Block Importer Service
 *
 * Validates blocks against current time slot and emits BlockProcessedEvent
 * for downstream processing by statistics and other services.
 */
export class BlockImporterService extends BaseService {
  private readonly eventBusService: EventBusService
  private readonly clockService: ClockService
  private readonly serviceAccountService: ServiceAccountService
  private readonly configService: ConfigService
  private readonly disputesService: DisputesService
  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly entropyService: EntropyService
  private readonly sealKeyService: SealKeyService
  private readonly assuranceService: AssuranceService
  private readonly guarantorService: GuarantorService
  private readonly ticketService: TicketService
  private readonly recentHistoryService: RecentHistoryService
  private readonly stateService: StateService
  private readonly statisticsService: StatisticsService
  private readonly authPoolService: AuthPoolService
  private readonly accumulationService: AccumulationService
  private readonly workReportService: WorkReportService

  private previousStateRootForAnchorValidation: Hex | null = null
  private stateSnapshot: { key: Hex; value: Hex }[] | null = null
  constructor(options: {
    eventBusService: EventBusService
    clockService: ClockService
    recentHistoryService: RecentHistoryService
    stateService: StateService
    serviceAccountService: ServiceAccountService
    configService: ConfigService
    disputesService: DisputesService
    validatorSetManagerService: ValidatorSetManager
    entropyService: EntropyService
    sealKeyService: SealKeyService
    assuranceService: AssuranceService
    guarantorService: GuarantorService
    ticketService: TicketService
    statisticsService: StatisticsService
    authPoolService: AuthPoolService
    accumulationService: AccumulationService
    workReportService: WorkReportService
  }) {
    super('block-importer-service')
    this.eventBusService = options.eventBusService
    this.clockService = options.clockService
    this.recentHistoryService = options.recentHistoryService
    this.serviceAccountService = options.serviceAccountService
    this.configService = options.configService
    this.disputesService = options.disputesService
    this.validatorSetManagerService = options.validatorSetManagerService
    this.entropyService = options.entropyService
    this.sealKeyService = options.sealKeyService
    this.assuranceService = options.assuranceService
    this.guarantorService = options.guarantorService
    this.ticketService = options.ticketService
    this.stateService = options.stateService
    this.statisticsService = options.statisticsService
    this.authPoolService = options.authPoolService
    this.accumulationService = options.accumulationService
    this.workReportService = options.workReportService

    // Noop usage to satisfy linter (workReportService may be used in future)
    void this.workReportService
  }

  // ============================================================================
  // Public API
  // ============================================================================

  async importBlock(block: Block): SafePromise<boolean> {
    const isEpochTransition = this.clockService.isEpochTransition(
      block.header.timeslot,
    )
    let epochTransitionEmitted = false

    // Create state snapshot before processing block
    const [stateTrieError, stateTrie] = this.stateService.generateStateTrie()
    if (stateTrieError) {
      logger.error('[BlockImporter] Failed to create state snapshot', {
        error: stateTrieError,
      })
      return safeResult(false)
    }
    // Convert state trie to keyvals format for restoration
    this.stateSnapshot = Object.entries(stateTrie).map(([key, value]) => ({
      key: key as Hex,
      value: value as Hex,
    }))
    logger.debug('[BlockImporter] Created state snapshot', {
      snapshotSize: this.stateSnapshot.length,
      slot: block.header.timeslot.toString(),
    })

    try {
      validatePreStateRoot(block.header, this.stateService)
      // Emit epoch transition before processing if needed
      if (isEpochTransition && block.header.epochMark) {
        const epochTransitionEvent = {
          slot: block.header.timeslot,
          epochMark: block.header.epochMark,
        }
        await this.eventBusService.emitEpochTransition(epochTransitionEvent)
        epochTransitionEmitted = true
      }

      const [importError] = await this.importBlockInternal(block)
      if (importError) {
        logger.error(importError.message, {
          error: importError,
          stack: new Error().stack,
        })
        // Revert state to snapshot before returning error
        await this.revertStateSnapshot()
        // Revert epoch transition if it happened
        if (epochTransitionEmitted) {
          await this.eventBusService.emitRevertEpochTransition({
            slot: block.header.timeslot,
            epochMark: block.header.epochMark,
          })
        }
        if (
          this.previousStateRootForAnchorValidation !== null &&
          this.recentHistoryService.getRecentHistory().length > 0
        ) {
          const previousEntry =
            this.recentHistoryService.getRecentHistory()[
              this.recentHistoryService.getRecentHistory().length - 1
            ]
          previousEntry.stateRoot = this.previousStateRootForAnchorValidation
        }
        // Return error after reverting state so fuzzer can receive Error message
        return safeError(importError)
      }
      // Clear snapshot on success
      this.stateSnapshot = null
      return safeResult(true)
    } catch (error) {
      // Revert state to snapshot before returning error
      logger.error('[BlockImporter] Failed to import block', {
        error: error,
        stack: new Error().stack,
      })
      await this.revertStateSnapshot()
      // Revert epoch transition if it happened
      if (epochTransitionEmitted) {
        await this.eventBusService.emitRevertEpochTransition({
          slot: block.header.timeslot,
          epochMark: block.header.epochMark,
        })
      }
      if (
        this.previousStateRootForAnchorValidation !== null &&
        this.recentHistoryService.getRecentHistory().length > 0
      ) {
        const previousEntry =
          this.recentHistoryService.getRecentHistory()[
            this.recentHistoryService.getRecentHistory().length - 1
          ]
        previousEntry.stateRoot = this.previousStateRootForAnchorValidation
      }

      // Return error after reverting state so fuzzer can receive Error message
      return safeError(
        error instanceof Error ? error : new Error(String(error)),
      )
    }
  }

  /**
   * Import a block and validate its timeslot
   *
   * @param block The block to import
   * @returns Result of the import operation
   */
  async importBlockInternal(block: Block): SafePromise<void> {
    // validate the block header
    const [blockHeaderValidationError] = await validateBlockHeader(
      block.header,
      this.clockService,
      this.configService,
      this.stateService,
      this.recentHistoryService,
      this.validatorSetManagerService,
      this.sealKeyService,
      this.entropyService,
    )
    if (blockHeaderValidationError) {
      return safeError(blockHeaderValidationError)
    }

    // Validate extrinsic hash matches the block body
    const [extrinsicHashError, computedExtrinsicHash] = calculateExtrinsicHash(
      block.body,
      this.configService,
    )
    if (extrinsicHashError) {
      return safeError(extrinsicHashError)
    }
    if (computedExtrinsicHash !== block.header.extrinsicHash) {
      return safeError(new Error(BLOCK_HEADER_ERRORS.INVALID_EXTRINSIC_HASH))
    }

    // Temporarily update previous block's state root for anchor validation
    // Gray Paper eq 23-25: Update previous entry's state_root to parent_state_root (H_priorstateroot)
    // This is needed for validateGuarantees because anchor validation checks state_root
    if (this.recentHistoryService.getRecentHistory().length > 0) {
      const previousEntry =
        this.recentHistoryService.getRecentHistory()[
          this.recentHistoryService.getRecentHistory().length - 1
        ]
      this.previousStateRootForAnchorValidation = previousEntry.stateRoot
      previousEntry.stateRoot = block.header.priorStateRoot
    }

    // Process disputes (validate and apply)
    const [disputeError] = this.disputesService.processDisputes(
      block.body.disputes,
      block.header.timeslot,
    )
    if (disputeError) {
      return safeError(disputeError)
    }

    // Gray Paper: Process assurances FIRST, then guarantees
    // From the perspective of a block's state-transition, the assurances are best processed first
    // since each core may only have a single work-report pending its package becoming available at a time.
    // This removes work reports that became available (super-majority) or timed out, freeing cores
    // for new guarantees to be processed.
    // Gray Paper accumulation.tex: Returns the "newly available work-reports" (ρ̂) that should be
    // passed to accumulation
    const [assuranceError, availableWorkReports] =
      this.assuranceService.processAssurances(
        block.body.assurances,
        Number(block.header.timeslot),
        block.header.parent,
        this.configService,
      )
    if (assuranceError) {
      return safeError(assuranceError)
    }
    if (!availableWorkReports) {
      return safeError(new Error('Assurance processing failed'))
    }

    // Process guarantees AFTER assurances
    // This allows new work reports to be added to cores that were freed by assurances
    const [guaranteeValidationError, guaranteeResult] =
      this.guarantorService.applyGuarantees(
        block.body.guarantees,
        block.header.timeslot,
      )
    if (guaranteeValidationError) {
      return safeError(guaranteeValidationError)
    }
    if (!guaranteeResult) {
      return safeError(new Error('Guarantee validation failed'))
    }

    // If guarantee returned an error after assurances, treat as block invalid
    // (bad_code_hash for ejected services is caught by pre-validation above)
    if (guaranteeResult.error) {
      return safeError(
        new Error(`Guarantee validation failed: ${guaranteeResult.error}`),
      )
    }

    // Process winnersMark from block header if present (for non-epoch-transition blocks)
    // Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
    // winnersMark appears at the first block after contest period ends (phase >= contestDuration)
    // This contains the Z-sequenced tickets that will become seal tickets on the next epoch transition
    // Note: For epoch transition blocks, winnersMark is already processed above (before emitEpochTransition)
    if (block.header.winnersMark) {
      logger.info(
        '[BlockImporter] Processing winnersMark from block header (for next epoch)',
        {
          slot: block.header.timeslot.toString(),
          winnersMarkLength: block.header.winnersMark.length,
        },
      )
      // Store winnersMark in SealKeyService - it will be used to set seal keys on next epoch transition
      // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
      this.sealKeyService.setWinnersMark(block.header.winnersMark)
    }

    // Apply validated tickets to accumulator (already validated in Phase 1)
    // Gray Paper Eq. 289-292: xt_tickets ∈ sequence{⟨xt_entryindex, xt_proof⟩}
    // Gray Paper Eq. 321-324: Tickets in block body should be added to ticket accumulator
    // Note: Extrinsic tickets include proof, but accumulator only stores (st_id, st_entryindex)
    const [ticketApplyError] = this.ticketService.applyTickets(
      block.body.tickets,
      block.header.timeslot,
    )
    if (ticketApplyError) {
      return safeError(ticketApplyError)
    }

    // Update entropy accumulator with VRF signature from block header
    // Gray Paper Eq. 174: entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))
    // This MUST happen for EVERY block, even empty ones, as entropy is part of the state
    // Gray Paper pvm_invocations.tex Eq. 185: accumulation uses entropyaccumulator' (updated value)
    // MUST await to ensure entropy is updated before accumulation uses it
    // Emit bestBlockChanged event to trigger entropy update (EntropyService listens to this)
    await this.eventBusService.emitBestBlockChanged(block.header)

    // Update thetime (C(11)) to the block's timeslot
    // Gray Paper merklization.tex C(11): thetime is the most recent block's timeslot index
    // This MUST happen for EVERY block, even empty ones, as thetime is part of the state
    this.clockService.setLatestReportedBlockTimeslot(block.header.timeslot)

    // Reset per-block statistics (coreStats and serviceStats) at the START of block processing
    // Gray Paper: These stats are per-block, not cumulative across blocks
    // Must be called BEFORE accumulation so accumulation stats are fresh for this block
    this.statisticsService.resetPerBlockStats()

    const currentTimeslot = this.clockService.getLatestReportedBlockTimeslot()
    // Run accumulation for available work reports
    const accumulationResult = await this.accumulationService.applyTransition(
      // block.header.timeslot,
      currentTimeslot,
      availableWorkReports, // Newly available work reports (ρ̂) from assurances
    )
    if (!accumulationResult.ok) {
      return safeError(accumulationResult.err)
    }

    const lastAccumulationOutputs =
      this.accumulationService.getLastAccumulationOutputs()

    // Update accout belt before adding to recent history
    // Gray Paper: accoutBelt' = mmrappend(accoutBelt, merklizewb(s, keccak), keccak)
    const [beltError] = this.recentHistoryService.updateAccoutBelt(
      lastAccumulationOutputs,
    )
    if (beltError) {
      logger.warn('Failed to update accout belt', { error: beltError })
    }

    // Apply preimages to service accounts (MUST happen AFTER accumulation)
    // Gray Paper eq 62: accountspostpreimage ≺ (xt_preimages, accountspostxfer, thetime')
    // Preimages depend on accountspostxfer, which is produced by accumulation
    const [serviceAccountValidationError] =
      this.serviceAccountService.applyPreimages(
        block.body.preimages,
        block.header.timeslot,
      )
    if (serviceAccountValidationError) {
      return safeError(serviceAccountValidationError)
    }

    // Update authpool for this block (MUST happen AFTER accumulation)
    // Gray Paper eq 63: authpool' ≺ (theheader, xt_guarantees, authqueue', authpool)
    // Authpool depends on authqueue', which is produced by accumulation
    // Gray Paper Eq. 26-27: authpool'[c] ≡ tail(F(c)) + [authqueue'[c][H_timeslot]]^C_authpoolsize
    // This MUST happen for EVERY block, even empty ones, as authpool is part of the state
    const [authPoolError] = this.authPoolService.applyBlockTransition(
      block.header.timeslot,
      block.body.guarantees,
    )
    if (authPoolError) {
      return safeError(authPoolError)
    }

    // Add block to recent history at the end, after all state updates are complete
    const [headerHashForHistoryError, headerHashForHistory] =
      calculateBlockHashFromHeader(block.header, this.configService)
    if (headerHashForHistoryError) {
      return safeError(headerHashForHistoryError)
    }

    // Add entry with temporary state root (will be updated after we calculate final state root)
    this.recentHistoryService.addBlockWithSuperPeak(
      {
        headerHash: headerHashForHistory,
        stateRoot: zeroHash, // Temporary placeholder, will be updated below
        reportedPackageHashes: new Map(
          block.body.guarantees.map((guarantee) => [
            guarantee.report.package_spec.hash,
            guarantee.report.package_spec.exports_root,
          ]),
        ),
      },
      block.header.priorStateRoot,
    )

    // Update statistics (activity) for this block at the end, after accumulation is processed
    // Gray Paper Eq. 46: Increment block count for author, update validator/core/service stats
    // This MUST happen for EVERY block, even empty ones, as activity is part of the state
    // Note: Accumulation statistics are now updated directly by AccumulationService
    // via updateServiceAccumulationStats(), so we don't pass them here
    this.statisticsService.applyBlockDeltas(
      block.body,
      block.header.timeslot,
      Number(block.header.authorIndex),
      lastAccumulationOutputs,
    )

    return safeResult(undefined)
  }

  /**
   * Revert state to the snapshot taken before block import
   */
  private async revertStateSnapshot(): Promise<void> {
    if (!this.stateSnapshot) {
      logger.warn('[BlockImporter] No state snapshot to revert to')
      return
    }

    logger.info('[BlockImporter] Reverting state to snapshot', {
      snapshotSize: this.stateSnapshot.length,
    })

    const [revertError] = this.stateService.setState(this.stateSnapshot)
    if (revertError) {
      logger.error('[BlockImporter] Failed to revert state snapshot', {
        error: revertError,
      })
    } else {
      logger.debug('[BlockImporter] State reverted successfully')
    }

    // Clear snapshot after revert
    this.stateSnapshot = null
  }
}
