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
  banderout,
  verifyEntropyVRFSignature,
  verifyEpochRoot,
} from '@pbnj/bandersnatch-vrf'
import { calculateBlockHashFromHeader } from '@pbnj/codec'
import {
  bytesToHex,
  type EventBusService,
  hexToBytes,
  logger,
  zeroHash
} from '@pbnj/core'
import {
  isSafroleTicket,
  verifyFallbackSealSignature,
  verifyTicketBasedSealSignature,
} from '@pbnj/safrole'
import type { Block, BlockHeader, ValidatorPublicKeys } from '@pbnj/types'
import {
  BaseService,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/types'
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

    // Handle epoch transition BEFORE signature verification and state transitions
    // Gray Paper order: epoch transition updates state (entropy, validator sets) BEFORE state transition function
    // Gray Paper Eq. 179-181: (entropy'_1, entropy'_2, entropy'_3) = (entropy_0, entropy_1, entropy_2) when e' > e
    // Gray Paper Eq. 115-118: Validator sets rotate on epoch transition (activeSet' = pendingSet)
    // The VRF and seal signatures use the validator's key from the active set AFTER epoch transition
    // State transition function (guarantees, assurances, etc.) uses updated state after epoch transition
    const isEpochTransition = this.clockService.isEpochTransition(
      block.header.timeslot,
    )

    if (isEpochTransition) {
      if (!block.header.epochMark) {
        return safeError(new Error('Epoch mark is not present'))
      }
      logger.info('Epoch transition detected, emitting epoch transition event')

      // Emit epoch transition event - this will execute all subscribed callbacks
      // (entropy rotation, validator set rotation, seal key sequence update, etc.)
      // The event bus waits for all callbacks to complete before continuing
      // Gray Paper Eq. 179-181: entropy3 rotates on epoch transition
      // Gray Paper Eq. 115-118: validator sets rotate on epoch transition
      const epochTransitionEvent = {
        slot: block.header.timeslot,
        epochMark: block.header.epochMark,
      }

      await this.eventBusService.emitEpochTransition(epochTransitionEvent)

      // Update clock service's current epoch and slot
      // this.clockService.setLatestReportedBlockTimeslot(block.header.timeslot)
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

    // Update previous block's state root to parent_state_root BEFORE processing guarantees
    // Gray Paper eq 23-25: Update previous entry's state_root to parent_state_root (H_priorstateroot)
    // This must happen before guarantee validation because guarantees may reference the parent block
    // as an anchor, and the parent block's state root must be correct for validation to pass
    if (this.recentHistoryService.getRecentHistory().length > 0) {
      const previousEntry =
        this.recentHistoryService.getRecentHistory()[
          this.recentHistoryService.getRecentHistory().length - 1
        ]
      previousEntry.stateRoot = block.header.priorStateRoot
    }

    // Gray Paper: Process assurances FIRST, then guarantees
    // From the perspective of a block's state-transition, the assurances are best processed first
    // since each core may only have a single work-report pending its package becoming available at a time.
    // This removes work reports that became available (super-majority) or timed out, freeing cores
    // for new guarantees to be processed.
    // Gray Paper accumulation.tex: Returns the "newly available work-reports" (ρ̂) that should be
    // passed to accumulation
    const [assuranceValidationError, availableWorkReports] = this.assuranceService.applyAssurances(
      block.body.assurances,
      Number(block.header.timeslot),
      block.header.parent,
      this.configService,
    )
    if (assuranceValidationError) {
      return safeError(assuranceValidationError)
    }
    if (!availableWorkReports) {
      return safeError(new Error('Assurance validation failed'))
    }

    // Process guarantees AFTER assurances
    // This allows new work reports to be added to cores that were freed by assurances
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

    // Process winnersMark from block header if present
    // Gray Paper Eq. 262-266: H_winnersmark = Z(ticketaccumulator) when e' = e ∧ m < Cepochtailstart ≤ m' ∧ |ticketaccumulator| = Cepochlen
    // winnersMark appears at the first block after contest period ends (phase >= contestDuration)
    // This contains the Z-sequenced tickets that will become seal tickets on the next epoch transition
    if (block.header.winnersMark) {
      logger.info('[BlockImporter] Processing winnersMark from block header', {
        slot: block.header.timeslot.toString(),
        winnersMarkLength: block.header.winnersMark.length,
      })
      // Store winnersMark in SealKeyService - it will be used to set seal keys on next epoch transition
      // Gray Paper Eq. 202-207: sealtickets' = Z(ticketaccumulator) when e' = e + 1 ∧ m ≥ Cepochtailstart ∧ |ticketaccumulator| = Cepochlen
      this.sealKeyService.setWinnersMark(block.header.winnersMark)
    }

    // process tickets from block body
    // Gray Paper Eq. 289-292: xt_tickets ∈ sequence{⟨xt_entryindex, xt_proof⟩}
    // Gray Paper Eq. 321-324: Tickets in block body should be added to ticket accumulator
    // Note: Extrinsic tickets include proof, but accumulator only stores (st_id, st_entryindex)  // Check if this is an epoch transition
    const isNewEpoch = this.clockService.isEpochTransition(
      block.header.timeslot,
    )

    const [ticketError] = await this.ticketService.applyTickets(
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
    // Gray Paper pvm_invocations.tex Eq. 185: accumulation uses entropyaccumulator' (updated value)
    // MUST await to ensure entropy is updated before accumulation uses it
    // Emit bestBlockChanged event to trigger entropy update (EntropyService listens to this)
    await this.eventBusService.emitBestBlockChanged(block.header)

    // Update thetime (C(11)) to the block's timeslot
    // Gray Paper merklization.tex C(11): thetime is the most recent block's timeslot index
    // This MUST happen for EVERY block, even empty ones, as thetime is part of the state
    this.clockService.setLatestReportedBlockTimeslot(block.header.timeslot)

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

    // Process accumulations for this block
    // Gray Paper accumulation.tex: Process newly available work-reports (ρ̂)
    // These are work reports that just became available (reached super-majority assurances)
    // in the current block, returned from applyAssurances above
    // The accumulation service will partition them into:
    // - ρ̂! (no dependencies) → accumulated immediately
    // - ρ̂Q (with dependencies) → added to ready queue at current slot
    
    logger.info('[BlockImporter] Processing accumulations', {
      slot: block.header.timeslot.toString(),
      guaranteesCount: block.body.guarantees.length,
      availableWorkReportsCount: availableWorkReports.length,
      availablePackageHashes: availableWorkReports.map(wr => wr.package_spec.hash.slice(0, 40)),
    })
    
    const accumulationResult = await this.accumulationService.applyTransition(
      block.header.timeslot,
      availableWorkReports, // Newly available work reports (ρ̂) from assurances
    )
    if (!accumulationResult.ok) {
      return safeError(accumulationResult.err)
    }

    // Update accout belt before adding to recent history
    // Gray Paper: accoutBelt' = mmrappend(accoutBelt, merklizewb(s, keccak), keccak)
    // where s is the encoded accumulation outputs from this block
    // Note: merklizewb([]) returns zero hash, so we always update even with empty outputs
// TODO: add last accumulation outputs to the accout belt
    const lastAccumulationOutputs =
      this.accumulationService.getLastAccumulationOutputs()

    const [beltError] = this.recentHistoryService.updateAccoutBelt(
      lastAccumulationOutputs,
    )
    if (beltError) {
      logger.warn('Failed to update accout belt', { error: beltError })
    }

    // Add block to recent history at the end, after all state updates are complete
    // Gray Paper: recent (β) is part of the state and must be updated for every block
    const [headerHashForHistoryError, headerHashForHistory] =
      calculateBlockHashFromHeader(block.header, this.configService)
    if (headerHashForHistoryError) {
      return safeError(headerHashForHistoryError)
    }

    // Add entry with temporary state root (will be updated after we calculate final state root)
    // Note: Previous entry's state_root was already updated above before processing guarantees
    // Gray Paper eq 41: New entry's state_root should be 0x0 initially
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
      block.header.priorStateRoot, // Still pass for consistency, but update already happened above
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
    const currentPhase = header.timeslot % BigInt(configService.epochDuration)
    if (header.winnersMark) {
      if (currentPhase < configService.contestDuration) {
        return safeError(
          new Error(`winners mark is present at phase < contest duration: ${currentPhase} <= ${configService.contestDuration}`),
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

      // Verify epoch root matches the validators in the epoch mark
      // Convert ValidatorKeyPair[] to ValidatorPublicKeys[] for verification
      // Note: verifyEpochRoot only uses bandersnatch keys, so we can use zero-filled bls/metadata
      const pendingSet: ValidatorPublicKeys[] = header.epochMark.validators.map(
        (validator) => ({
          bandersnatch: validator.bandersnatch,
          ed25519: validator.ed25519,
          bls: zeroHash, // Not used in epoch root verification
          metadata: zeroHash, // Not used in epoch root verification
        }),
      )

      const nextEpochRoot = this.validatorSetManagerService.getEpochRoot()

        const [verifyError, isValid] = verifyEpochRoot(nextEpochRoot, pendingSet)
        if (verifyError) {
          return safeError(
            new Error(
              `Epoch root verification failed: ${verifyError.message}`,
            ),
          )
        }
        if (!isValid) {
          return safeError(
            new Error(
              'Epoch root does not match the validators in the epoch mark',
            ),
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
    validatorSetManagerService: ValidatorSetManager,
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
      logger.info('Validating ticket-based seal signature', {
        slot: header.timeslot.toString(),
        authorIndex: header.authorIndex.toString(),
        expectedSealKey: publicKeys.bandersnatch,
        retrievedSealKey: sealKey ? sealKey.id : 'null',
        activeValidatorsSize: activeValidators.size,
      })
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

      // Validate that seal key matches the validator's Bandersnatch key
      // This ensures the seal key sequence was calculated correctly for this epoch
      const sealKeyHex = bytesToHex(sealKey as Uint8Array)
      if (sealKeyHex !== publicKeys.bandersnatch) {
        return safeError(
          new Error(
            `Seal key mismatch: expected ${publicKeys.bandersnatch}, got ${sealKeyHex}. ` +
              `This may indicate the seal key sequence was not updated correctly on epoch transition.`,
          ),
        )
      }

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
    validatorSetManagerService: ValidatorSetManager,
  ): Safe<boolean> {
    // Get validator's Bandersnatch public key from active set
    const activeValidators = validatorSetManagerService.getActiveValidators()

    const validatorKeys = activeValidators.get(Number(header.authorIndex))
    if (!validatorKeys) {
      logger.error('Validator not found in active set', {
        authorIndex: Number(header.authorIndex),
        activeSetSize: activeValidators.size,
        activeIndices: Array.from(activeValidators.keys()),
      })
      return safeError(
        new Error(
          `Validator at index ${header.authorIndex} not found in active set (size: ${activeValidators.size})`,
        ),
      )
    }
    const authorPublicKey = hexToBytes(validatorKeys.bandersnatch)

    // Extract VRF output from seal signature using banderout function
    // Gray Paper: banderout{H_sealsig} - first 32 bytes of VRF output hash
    const [extractError, sealOutput] = banderout(hexToBytes(header.sealSig))
    if (extractError) {
      logger.error('Failed to extract seal output using banderout', {
        error: extractError.message,
        sealSigLength: header.sealSig.length,
        sealSigHex: header.sealSig.substring(0, 20) + '...',
      })
      return safeError(extractError)
    }

    // Verify VRF signature using existing entropy VRF verification function
    // Gray Paper Eq. 158: H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
    const [verifyError, isValid] = verifyEntropyVRFSignature(
      authorPublicKey,
      hexToBytes(header.vrfSig),
      sealOutput,
    )
    if (verifyError) {
      logger.error('VRF signature verification error', {
        error: verifyError.message,
        authorIndex: Number(header.authorIndex),
        timeslot: Number(header.timeslot),
        publicKeyHex: validatorKeys.bandersnatch.substring(0, 20) + '...',
        vrfSigHex: header.vrfSig.substring(0, 20) + '...',
        sealOutputHex: bytesToHex(sealOutput).substring(0, 20) + '...',
      })
      return safeError(verifyError)
    }

    if (!isValid) {
      logger.error('VRF signature is invalid', {
        authorIndex: Number(header.authorIndex),
        timeslot: Number(header.timeslot),
        publicKeyHex: validatorKeys.bandersnatch.substring(0, 20) + '...',
        vrfSigHex: header.vrfSig.substring(0, 20) + '...',
        sealOutputHex: bytesToHex(sealOutput).substring(0, 20) + '...',
        sealSigHex: header.sealSig.substring(0, 20) + '...',
      })
    }

    return safeResult(isValid)
  }
}