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

import { banderout, verifyEntropyVRFSignature } from '@pbnj/bandersnatch-vrf'
import {
  bytesToHex,
  type EventBusService,
  hexToBytes,
  logger,
} from '@pbnj/core'
import {
  isSafroleTicket,
  verifyFallbackSealSignature,
  verifyTicketBasedSealSignature,
} from '@pbnj/safrole'
import { calculateBlockHashFromHeader } from '@pbnj/serialization'
import type { BlockStore } from '@pbnj/state'
import type {
  Block,
  BlockHeader,
  IEntropyService,
  IValidatorSetManager,
} from '@pbnj/types'
import {
  BaseService,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'
import { zeroHash } from '../../../packages/core/src/utils/crypto'
import type { AssuranceService } from './assurance-service'
import type { AuthPoolService } from './auth-pool-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { GuarantorService } from './guarantor-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'
import type { StateService } from './state-service'
import type { StatisticsService } from './statistics-service'
import type { TicketService } from './ticket-service'

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
  private readonly validatorSetManagerService: IValidatorSetManager
  private readonly entropyService: IEntropyService
  private readonly sealKeyService: SealKeyService
  private readonly assuranceService: AssuranceService
  private readonly guarantorService: GuarantorService
  private readonly ticketService: TicketService
  private readonly recentHistoryService: RecentHistoryService
  private readonly stateService: StateService
  private readonly statisticsService: StatisticsService
  private readonly authPoolService: AuthPoolService
  constructor(options: {
    eventBusService: EventBusService
    clockService: ClockService
    recentHistoryService: RecentHistoryService
    stateService: StateService
    serviceAccountService: ServiceAccountService
    configService: ConfigService
    disputesService: DisputesService
    validatorSetManagerService: IValidatorSetManager
    entropyService: IEntropyService
    sealKeyService: SealKeyService
    blockStore: BlockStore | null
    assuranceService: AssuranceService
    guarantorService: GuarantorService
    ticketService: TicketService
    statisticsService: StatisticsService
    authPoolService: AuthPoolService
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
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Import a block and validate its timeslot
   *
   * @param block The block to import
   * @returns Result of the import operation
   */
  async importBlock(block: Block): SafePromise<void> {
    logger.debug('Block import started', {
      slot: block.header.timeslot.toString(),
      authorIndex: block.header.authorIndex.toString(),
      parent: block.header.parent,
      hasTickets: block.body.tickets.length > 0,
      hasGuarantees: block.body.guarantees.length > 0,
      hasPreimages: block.body.preimages.length > 0,
      hasAssurances: block.body.assurances.length > 0,
      hasDisputes: block.body.disputes.length > 0,
    })

    // Log pre-state components for debugging
    const [preStateTrieError, preStateTrie] =
      this.stateService.generateStateTrie()
    if (!preStateTrieError && preStateTrie) {
      logger.debug('Pre-state components', {
        entropyAccumulator: this.entropyService.getEntropyAccumulator().length,
        thetime: this.clockService.getCurrentSlot().toString(),
        ticketAccumulatorLength:
          this.ticketService.getTicketAccumulator().length,
        recentHistoryLength:
          this.recentHistoryService.getRecentHistory().length,
        stateRoot: this.stateService.getStateRoot()[1] || 'error',
        stateTrieKeys: Object.keys(preStateTrie).length,
      })
    }

    // Validate priorStateRoot matches pre-state root
    // Gray Paper: H_priorstateroot ≡ merklizestate{thestate} (prior state)
    //
    // Note: When state is set from test vectors, the computed state root may differ
    // because generateStateTrie() re-encodes all state components, which can produce
    // different values than the original test vector values if decode/encode isn't
    // perfectly round-trip, or if default/empty values are added for missing components.
    //
    // The block header's priorStateRoot is the authoritative value that was used
    // when the block was created, so we validate against it.
    const [preStateRootError, preStateRoot] = this.stateService.getStateRoot()
    if (preStateRootError) {
      return safeError(
        new Error(`Failed to get pre-state root: ${preStateRootError.message}`),
      )
    }
    if (block.header.priorStateRoot !== preStateRoot) {
      // Debug: Compare state trie to understand the mismatch
      const [trieError, stateTrie] = this.stateService.generateStateTrie()
      if (!trieError && stateTrie) {
        logger.debug('State root mismatch - debugging state trie', {
          computedStateRoot: preStateRoot,
          expectedStateRoot: block.header.priorStateRoot,
          stateTrieKeys: Object.keys(stateTrie).length,
          stateTrieKeysList: Object.keys(stateTrie).slice(0, 10), // First 10 keys for debugging
        })

        // Log potential causes
        logger.debug(
          'Possible causes: decode/encode round-trip issues, missing state components, or default values added',
        )
      }
      return safeError(
        new Error(
          `Prior state root mismatch: computed ${preStateRoot}, expected ${block.header.priorStateRoot}. ` +
            `This may indicate decode/encode round-trip issues or state components not being set correctly from test vectors.`,
        ),
      )
    }

    // validate the block header
    const [blockHeaderValidationError] = await this.validateBlockHeader(
      block.header,
      this.clockService,
      this.configService,
    )
    if (blockHeaderValidationError) {
      return safeError(blockHeaderValidationError)
    }

    // read relevant GP sections first
    const [guaranteeValidationError, reporters] =
      this.guarantorService.applyGuarantees(
        block.body.guarantees,
        block.header.timeslot,
      )
    if (guaranteeValidationError) {
      return safeError(guaranteeValidationError)
    }
    if (!reporters) {
      return safeError(new Error('Guarantee validation failed'))
    }

    // validate the assurances
    const [assuranceValidationError] = this.assuranceService.applyAssurances(
      block.body.assurances,
      Number(block.header.timeslot),
      block.header.parent,
      this.configService,
    )
    if (assuranceValidationError) {
      return safeError(assuranceValidationError)
    }

    // process tickets from block body
    // Gray Paper Eq. 289-292: xt_tickets ∈ sequence{⟨xt_entryindex, xt_proof⟩}
    // Gray Paper Eq. 321-324: Tickets in block body should be added to ticket accumulator
    // Note: Extrinsic tickets include proof, but accumulator only stores (st_id, st_entryindex)  // Check if this is an epoch transition
    const isNewEpoch = this.clockService.isEpochTransition(
      block.header.timeslot,
    )

    const [ticketError] = this.ticketService.applyTickets(
      block.body.tickets,
      isNewEpoch,
    )
    if (ticketError) {
      return safeError(ticketError)
    }

    // apply the service account transition
    const [serviceAccountValidationError] =
      this.serviceAccountService.applyPreimages(
        block.body.preimages,
        block.header.timeslot,
      )
    if (serviceAccountValidationError) {
      return safeError(serviceAccountValidationError)
    }
    //apply disputes
    const [disputeValidationError] = this.disputesService.applyDisputes(
      block.body.disputes,
      block.header.timeslot,
    )
    if (disputeValidationError) {
      return safeError(disputeValidationError)
    }

    // Update entropy accumulator with VRF signature from block header
    // Gray Paper Eq. 174: entropyaccumulator' = blake(entropyaccumulator || banderout(H_vrfsig))
    // This MUST happen for EVERY block, even empty ones, as entropy is part of the state
    // Emit bestBlockChanged event to trigger entropy update (EntropyService listens to this)
    this.eventBusService.emitBestBlockChanged(block.header)

    // Update thetime (C(11)) to the block's timeslot
    // Gray Paper merklization.tex C(11): thetime is the most recent block's timeslot index
    // This MUST happen for EVERY block, even empty ones, as thetime is part of the state
    this.clockService.setLatestReportedBlockTimeslot(block.header.timeslot)

    // Update statistics (activity) for this block
    // Gray Paper Eq. 46: Increment block count for author, update validator/core/service stats
    // This MUST happen for EVERY block, even empty ones, as activity is part of the state
    // Note: We call applyBlockDeltas directly instead of emitting BlockProcessedEvent
    this.statisticsService.applyBlockDeltas(
      block.body,
      block.header.timeslot,
      Number(block.header.authorIndex),
    )

    // Update authpool for this block
    // Gray Paper Eq. 26-27: authpool'[c] ≡ tail(F(c)) + [authqueue'[c][H_timeslot]]^C_authpoolsize
    // This MUST happen for EVERY block, even empty ones, as authpool is part of the state
    const [authPoolError] = this.authPoolService.applyBlockTransition(
      block.header.timeslot,
      block.body.guarantees,
    )
    if (authPoolError) {
      return safeError(authPoolError)
    }

    // Update recent history BEFORE calculating state root
    // Gray Paper: recent (β) is part of the state and must be updated for every block
    // This MUST happen BEFORE state root calculation as recent history is part of the state
    const [stateRootForHistoryError, stateRootForHistory] =
      this.stateService.getStateRoot()
    if (stateRootForHistoryError) {
      return safeError(stateRootForHistoryError)
    }

    const [headerHashForHistoryError, headerHashForHistory] =
      calculateBlockHashFromHeader(block.header, this.configService)
    if (headerHashForHistoryError) {
      return safeError(headerHashForHistoryError)
    }

    // Add block to recent history (this updates C(3) = recent)
    this.recentHistoryService.addBlockWithSuperPeak(
      {
        headerHash: headerHashForHistory,
        stateRoot: stateRootForHistory,
        reportedPackageHashes: new Map(
          block.body.guarantees.map((guarantee) => [
            guarantee.report.package_spec.hash,
            guarantee.report.package_spec.exports_root,
          ]),
        ),
      },
      block.header.parent,
    )

    // Now calculate final state root after all updates
    const [stateRootError, stateRoot] = this.stateService.getStateRoot()
    if (stateRootError) {
      return safeError(stateRootError)
    }

    // Log post-state components for debugging
    const [postStateTrieError, postStateTrie] =
      this.stateService.generateStateTrie()
    if (!postStateTrieError && postStateTrie) {
      const globalState = {
        entropy: this.entropyService.getEntropy(),
        thetime: this.clockService.getLatestReportedBlockTimeslot(),
        ticketAccumulator: this.ticketService.getTicketAccumulator(),
        recentHistory: this.recentHistoryService.getRecentHistory(),
        authpool: this.stateService.getStateComponent(1),
        authqueue: this.stateService.getStateComponent(2),
        reports: this.stateService.getStateComponent(10),
        ready: this.stateService.getStateComponent(14),
        accumulated: this.stateService.getStateComponent(15),
        lastAccumulationOutput: this.stateService.getStateComponent(16),
        activity: this.stateService.getStateComponent(13),
        disputes: this.stateService.getStateComponent(5),
        privileges: this.stateService.getStateComponent(12),
        safrole: this.stateService.getStateComponent(4),
        stagingset: this.stateService.getStateComponent(7),
        activeset: this.stateService.getStateComponent(8),
        previousset: this.stateService.getStateComponent(9),
      }

      // Type guard for accumulated
      const accumulated =
        globalState.accumulated &&
        typeof globalState.accumulated === 'object' &&
        'packages' in globalState.accumulated
          ? (globalState.accumulated as { packages: unknown[] })
          : null

      logger.debug('Post-state components (after updates)', {
        entropyAccumulator: bytesToHex(
          this.entropyService.getEntropyAccumulator(),
        ),
        thetime: globalState.thetime.toString(),
        ticketAccumulatorLength: globalState.ticketAccumulator.length,
        recentHistoryLength: globalState.recentHistory.length,
        authpoolCores: Array.isArray(globalState.authpool)
          ? globalState.authpool.length
          : 0,
        authqueueCores: Array.isArray(globalState.authqueue)
          ? globalState.authqueue.length
          : 0,
        reportsCount: Array.isArray(globalState.reports)
          ? globalState.reports.length
          : 0,
        readyCount: Array.isArray(globalState.ready)
          ? globalState.ready.length
          : 0,
        accumulatedSlots: accumulated ? accumulated.packages.length : 0,
        lastAccumulationOutputSize:
          globalState.lastAccumulationOutput instanceof Map
            ? globalState.lastAccumulationOutput.size
            : 0,
        stateTrieKeys: Object.keys(postStateTrie).length,
        stateRoot: stateRoot || 'not calculated yet',
      })
    }

    //TODO: process accumulations for this slot

    // const currentEpoch = this.clockService.getCurrentEpoch()

    // const event: BlockProcessedEvent = {
    //   timestamp: Date.now(),
    //   slot: block.header.timeslot,
    //   epoch: currentEpoch,
    //   authorIndex: Number(block.header.authorIndex),
    //   header: block.header,
    //   body: block.body,
    // }
    // // Block is valid, emit BlockProcessedEvent
    // this.eventBusService.emitBlockProcessed(event)

    return safeResult(undefined)
  }

  // TODO: add VRF signature validation, seal signature validation, and block header validations according to GP
  async validateBlockHeader(
    header: BlockHeader,
    clockService: ClockService,
    configService: ConfigService,
  ): SafePromise<void> {
    const wallClockSlot = clockService.getSlotFromWallClock()

    // according to the gray paper, the block header timeslot should be in the past
    if (header.timeslot > wallClockSlot) {
      return safeError(new Error('Block slot is in the future'))
    }

    // Validate parent block hash
    if (header.parent !== zeroHash) {
      const recentHistory = this.recentHistoryService.getRecentHistory()
      const recentBlock = this.recentHistoryService.getRecentHistoryForBlock(
        header.parent,
      )

      if (!recentBlock) {
        // If recent history is empty, check if parent matches genesis hash
        if (recentHistory.length === 0) {
          // Get genesis hash from state service (via genesis manager)
          const genesisManager = this.stateService.getGenesisManager()
          if (genesisManager) {
            const [genesisHashError, genesisHash] =
              genesisManager.getGenesisHeaderHash()
            if (genesisHashError || !genesisHash) {
              return safeError(
                new Error(
                  'Parent block not found and cannot verify against genesis hash',
                ),
              )
            }

            if (header.parent !== genesisHash) {
              return safeError(
                new Error(
                  `Parent block hash (${header.parent}) does not match genesis hash (${genesisHash})`,
                ),
              )
            }

            // Parent matches genesis, which is valid for the first block after genesis
            logger.debug('Parent block matches genesis hash', {
              parent: header.parent,
              genesisHash,
            })
          } else {
            return safeError(
              new Error(
                'Parent block not found and genesis manager not available',
              ),
            )
          }
        } else {
          return safeError(new Error('Parent block not found'))
        }
      }
    }

    // validate that winners mark is present only at phase > contest duration and has correct number of tickets
    const currentPhase = clockService.getCurrentPhase()
    if (header.winnersMark) {
      if (currentPhase <= configService.contestDuration) {
        return safeError(
          new Error('winners mark is present at phase <= contest duration'),
        )
      }

      // winners mark should contain exactly as amny tickets as number of slots in an epoch
      if (header.winnersMark.length !== configService.epochDuration) {
        return safeError(
          new Error('winners mark contains incorrect number of tickets'),
        )
      }
    }

    // validate that epoch mark is present only at first slot of an epoch
    if (header.epochMark) {
      if (currentPhase !== BigInt(0)) {
        return safeError(new Error('epoch mark is present at non-first slot'))
      }
      // if the validators are not as many as in config, return an error
      if (header.epochMark.validators.length !== configService.numValidators) {
        return safeError(
          new Error('epoch mark contains incorrect number of validators'),
        )
      }
    }

    // verify state against prior state root

    //validate the vrf signature
    const [vrfValidationError, isValid] = this.validateVRFSignature(
      header,
      this.validatorSetManagerService,
    )
    if (vrfValidationError) {
      return safeError(vrfValidationError)
    }
    if (!isValid) {
      return safeError(new Error('VRF signature is invalid'))
    }

    //validate the seal signature
    const [sealValidationError] = this.validateSealSignature(
      header,
      this.sealKeyService,
      this.validatorSetManagerService,
    )
    if (sealValidationError) {
      return safeError(sealValidationError)
    }

    return safeResult(undefined)
  }

  /**
   * Validate seal signature according to Gray Paper specifications
   *
   * Gray Paper safrole.tex equations 147-148 (ticket-based) and 154 (fallback):
   *
   * Ticket-based sealing (eq. 147-148):
   * - i_st_id = banderout{H_sealsig}
   * - H_sealsig ∈ bssignature{H_authorbskey}{Xticket ∥ entropy'_3 ∥ i_st_entryindex}{encodeunsignedheader{H}}
   *
   * Fallback sealing (eq. 154):
   * - H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
   *
   * @param header Block header containing seal signature
   * @param clockService Clock service for epoch information
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateSealSignature(
    header: BlockHeader,
    sealKeyService: SealKeyService,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<void> {
    const [sealKeyError, sealKey] = sealKeyService.getSealKeyForSlot(
      header.timeslot,
    )
    if (sealKeyError) {
      return safeError(sealKeyError)
    }

    // Get validator's Bandersnatch public key from active set
    // According to Gray Paper equation 154, we use the validator from the active set
    const activeValidators = validatorSetManagerService.getActiveValidators()
    const validatorKeys = activeValidators.get(Number(header.authorIndex))
    if (!validatorKeys) {
      return safeError(
        new Error(
          `Validator at index ${header.authorIndex} not found in active set`,
        ),
      )
    }
    const publicKeys = validatorKeys

    // Create unsigned header (header without seal signature)
    const unsignedHeader = {
      parent: header.parent,
      priorStateRoot: header.priorStateRoot,
      extrinsicHash: header.extrinsicHash,
      timeslot: header.timeslot,
      epochMark: header.epochMark,
      winnersMark: header.winnersMark,
      offendersMark: header.offendersMark,
      authorIndex: header.authorIndex,
      vrfSig: header.vrfSig,
    }

    // Get entropy_3 for seal signature validation
    const entropy3 = this.entropyService.getEntropy3()

    // Determine sealing mode and validate accordingly
    const isTicketBased = sealKey && isSafroleTicket(sealKey)

    if (isTicketBased) {
      // Ticket-based sealing validation (Gray Paper eq. 147-148)
      const [verificationError, isValid] = verifyTicketBasedSealSignature(
        hexToBytes(publicKeys.bandersnatch),
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        sealKey,
        this.configService,
      )
      if (verificationError) {
        return safeError(verificationError)
      }
      if (!isValid) {
        return safeError(new Error('Ticket-based seal signature is invalid'))
      }
    } else {
      // Fallback sealing validation (Gray Paper eq. 154)
      // H_sealsig ∈ bssignature{H_authorbskey}{Xfallback ∥ entropy'_3}{encodeunsignedheader{H}}
      // where H_authorbskey ≡ activeset'[H_authorindex]_vk_bs (Gray Paper eq. 60)
      // For fallback: i = H_authorbskey (Gray Paper eq. 152), so seal key equals H_authorbskey
      // But we use H_authorbskey from active set for verification
      const [verificationError, isValid] = verifyFallbackSealSignature(
        hexToBytes(publicKeys.bandersnatch), // H_authorbskey from activeset'[H_authorindex]_vk_bs
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        this.configService,
      )
      if (verificationError) {
        return safeError(verificationError)
      }
      if (!isValid) {
        return safeError(new Error('Fallback seal signature is invalid'))
      }
    }

    return safeResult(undefined)
  }

  /**
   * Validate VRF signature according to Gray Paper specifications
   *
   * Gray Paper safrole.tex equation 158:
   * H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
   * where Xentropy = "$jam_entropy"
   *
   * This verifies that:
   * 1. The VRF signature was generated by the block author
   * 2. The signature corresponds to the correct context (entropy + seal output)
   * 3. The VRF output provides deterministic, verifiable randomness
   *
   * @param header Block header containing VRF signature
   * @param sealKeyService Service to get seal key for this slot
   * @param validatorSetManagerService Validator set manager service
   * @returns Validation result
   */
  validateVRFSignature(
    header: BlockHeader,
    validatorSetManagerService: IValidatorSetManager,
  ): Safe<boolean> {
    // Get validator's Bandersnatch public key from active set
    const activeValidators = validatorSetManagerService.getActiveValidators()
    const validatorKeys = activeValidators.get(Number(header.authorIndex))
    if (!validatorKeys) {
      return safeError(
        new Error(
          `Validator at index ${header.authorIndex} not found in active set`,
        ),
      )
    }
    const authorPublicKey = hexToBytes(validatorKeys.bandersnatch)

    // Extract VRF output from seal signature using banderout function
    // Gray Paper: banderout{H_sealsig} - first 32 bytes of VRF output hash
    const [extractError, sealOutput] = banderout(hexToBytes(header.sealSig))
    if (extractError) {
      return safeError(extractError)
    }

    // Verify VRF signature using existing entropy VRF verification function
    // Gray Paper Eq. 158: H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
    return verifyEntropyVRFSignature(
      authorPublicKey,
      hexToBytes(header.vrfSig),
      sealOutput,
    )
  }
}
