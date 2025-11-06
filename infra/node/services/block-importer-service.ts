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
  type BlockProcessedEvent,
  type EventBusService,
  hexToBytes,
} from '@pbnj/core'
import {
  isSafroleTicket,
  verifyFallbackSealSignature,
  verifyTicketBasedSealSignature,
} from '@pbnj/safrole'
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
import type { AssuranceService } from './assurance-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { GuarantorService } from './guarantor-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'

// ============================================================================
// Block Importer Service
// ============================================================================

export interface BlockImportResult {
  success: boolean
  error?: string
  timeslotValid: boolean
  currentSlot: bigint
  blockSlot: bigint
}

/**
 * Block Importer Service
 *
 * Validates blocks against current time slot and emits BlockProcessedEvent
 * for downstream processing by statistics and other services.
 */
export class BlockImporterService extends BaseService {
  private readonly eventBusService: EventBusService
  private readonly clockService: ClockService
  // private readonly recentHistoryService: RecentHistoryService
  private readonly serviceAccountService: ServiceAccountService
  private readonly configService: ConfigService
  private readonly disputesService: DisputesService
  private readonly validatorSetManagerService: IValidatorSetManager
  private readonly entropyService: IEntropyService
  private readonly sealKeyService: SealKeyService
  private readonly assuranceService: AssuranceService
  private readonly guarantorService: GuarantorService
  private readonly recentHistoryService: RecentHistoryService

  constructor(options: {
    eventBusService: EventBusService
    clockService: ClockService
    recentHistoryService: RecentHistoryService
    serviceAccountService: ServiceAccountService
    configService: ConfigService
    disputesService: DisputesService
    validatorSetManagerService: IValidatorSetManager
    entropyService: IEntropyService
    sealKeyService: SealKeyService
    blockStore: BlockStore | null
    assuranceService: AssuranceService
    guarantorService: GuarantorService
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

    const currentEpoch = this.clockService.getCurrentEpoch()

    const event: BlockProcessedEvent = {
      timestamp: Date.now(),
      slot: block.header.timeslot,
      epoch: currentEpoch,
      authorIndex: Number(block.header.authorIndex),
      header: block.header,
      body: block.body,
    }
    // Block is valid, emit BlockProcessedEvent
    this.eventBusService.emitBlockProcessed(event)

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

    // validate the parent hash exists in the block store
    const recentBlock = this.recentHistoryService.getRecentHistoryForBlock(
      header.parent,
    )
    if (!recentBlock) {
      return safeError(new Error('Parent block not found'))
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

    //validate the seal signature
    const [sealValidationError] = this.validateSealSignature(
      header,
      this.sealKeyService,
      this.validatorSetManagerService,
    )
    if (sealValidationError) {
      return safeError(sealValidationError)
    }

    //validate the vrf signature
    const [vrfValidationError] = this.validateVRFSignature(
      header,
      this.validatorSetManagerService,
    )
    if (vrfValidationError) {
      return safeError(vrfValidationError)
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

    // Get validator's Bandersnatch public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(Number(header.authorIndex))
    if (publicKeyError) {
      return safeError(publicKeyError)
    }

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
    if (sealKey && isSafroleTicket(sealKey)) {
      // Ticket-based sealing validation (Gray Paper eq. 147-148)
      const [isValid] = verifyTicketBasedSealSignature(
        hexToBytes(publicKeys.bandersnatch),
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        sealKey,
        this.configService,
      )
      if (!isValid) {
        return safeError(new Error('Ticket-based seal signature is invalid'))
      }
    } else {
      // Fallback sealing validation (Gray Paper eq. 154)
      const [isValid] = verifyFallbackSealSignature(
        hexToBytes(publicKeys.bandersnatch),
        hexToBytes(header.sealSig),
        entropy3,
        unsignedHeader,
        this.configService,
      )
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
  ): Safe<void> {
    // Get validator's Bandersnatch public key
    const [publicKeyError, publicKeys] =
      validatorSetManagerService.getValidatorAtIndex(Number(header.authorIndex))
    if (publicKeyError) {
      return safeError(publicKeyError)
    }

    // Extract VRF output from seal signature using banderout function
    // Gray Paper: banderout{H_sealsig} - first 32 bytes of VRF output hash
    const [extractError, sealOutput] = banderout(hexToBytes(header.sealSig))
    if (extractError) {
      return safeError(extractError)
    }

    // Verify VRF signature using existing entropy VRF verification function
    // Gray Paper Eq. 158: H_vrfsig ∈ bssignature{H_authorbskey}{Xentropy ∥ banderout{H_sealsig}}{[]}
    const [isValid] = verifyEntropyVRFSignature(
      hexToBytes(publicKeys.bandersnatch),
      hexToBytes(header.vrfSig),
      sealOutput,
    )

    if (!isValid) {
      return safeError(new Error('VRF signature is invalid'))
    }

    return safeResult(undefined)
  }
}
