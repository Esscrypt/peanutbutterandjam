/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import {
  generateVRFSignature,
  getTicketsForExtrinsic,
} from '@pbnj/block-authoring'
import type { Safe, SafePromise } from '@pbnj/core'
import {
  bytesToHex,
  type EventBusService,
  logger,
  type SlotChangeEvent,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  generateFallbackSealSignature,
  generateTicketBasedSealSignature,
  isSafroleTicket,
} from '@pbnj/safrole'
import type {
  Block,
  BlockHeader,
  Extrinsic,
  UnsignedBlockHeader,
} from '@pbnj/types'
import { BaseService } from '@pbnj/types'
// import type { WorkPackageProcessor } from './work-package-processor'
import type { BlockHeaderService } from './block-header-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { EntropyService } from './entropy'
// import type { ExtrinsicValidatorService } from './extrinsic-validator'
import type { HeaderConstructor } from './header-constructor'
import type { KeyPairService } from './keypair-service'
import type { SealKeyService } from './seal-key'
import type { TicketHolderService } from './ticket-holder-service'
import type { ValidatorSetManager } from './validator-set'

/**
 * Block Authoring Service Implementation
 */
export class BlockAuthoringService extends BaseService {
  private readonly headerConstructor: HeaderConstructor
  // private workPackageProcessor: WorkPackageProcessor
  // private extrinsicValidator: ExtrinsicValidatorService
  private readonly blockHeaderService: BlockHeaderService
  private readonly eventBusService: EventBusService
  private readonly entropyService: EntropyService
  private readonly keyPairService: KeyPairService
  private readonly sealKeyService: SealKeyService
  private readonly clockService: ClockService
  private readonly configService: ConfigService
  private readonly ticketHolderService: TicketHolderService
  private readonly validatorSetManagerService: ValidatorSetManager

  constructor(options: {
    eventBusService: EventBusService
    headerConstructor: HeaderConstructor
    // workPackageProcessor: WorkPackageProcessor
    blockHeaderService: BlockHeaderService
    entropyService: EntropyService
    keyPairService: KeyPairService
    sealKeyService: SealKeyService
    clockService: ClockService
    configService: ConfigService
    ticketHolderService: TicketHolderService
    validatorSetManagerService: ValidatorSetManager
  }) {
    super('block-authoring-service')
    this.headerConstructor = options.headerConstructor
    this.blockHeaderService = options.blockHeaderService
    // this.workPackageProcessor = options.workPackageProcessor
    this.eventBusService = options.eventBusService
    this.entropyService = options.entropyService
    this.keyPairService = options.keyPairService
    this.sealKeyService = options.sealKeyService
    this.clockService = options.clockService
    this.configService = options.configService
    this.ticketHolderService = options.ticketHolderService
    this.validatorSetManagerService = options.validatorSetManagerService

    // Register slot change handler to check if current validator is elected to author blocks
    this.eventBusService.onSlotChange(this.handleSlotChange)
  }

  /**
   * Create a new block according to Gray Paper specifications
   *
   * Gray Paper Block Authoring Process:
   * 1. Validate extrinsics and process work packages
   * 2. Construct unsigned block header
   * 3. Generate seal signature (H_sealsig)
   * 4. Generate VRF signature (H_vrfsig) using seal output
   * 5. Complete block header with both signatures
   * 6. Update state and emit block
   */
  async createBlock(slot: bigint): SafePromise<Block> {
    const startTime = Date.now()

    try {
      // logger.info('Starting Gray Paper compliant block creation', {
      //   parentBlock: context.parentHeader.timeslot,
      //   extrinsicsCount: context.extrinsics.length,
      //   workPackagesCount: context.workPackages.length,
      // })

      // Step 1: Validate extrinsics
      // const [validationResultError, validationResult] =
      //   await this.validateExtrinsics(context.extrinsics)
      // if (validationResultError) {
      //   return safeError(validationResultError)
      // }

      // Step 2: Process work packages
      // const [workPackagesError, _workPackages] = await this.processWorkPackages(
      //   context.workPackages,
      // )
      // if (workPackagesError) {
      //   return safeError(workPackagesError)
      // }

      const [parentHeaderError, parentHeader] =
        await this.blockHeaderService.getBlockHeaderByTimeslot(slot - 1n)
      if (parentHeaderError) {
        return safeError(parentHeaderError)
      }
      if (!parentHeader) {
        return safeError(new Error('Parent header not found'))
      }

      // Step 3: Construct unsigned block header (without signatures)
      const [headerError, unsignedHeader] = this.constructUnsignedHeader(
        parentHeader,
        [],
      )
      if (headerError) {
        return safeError(headerError)
      }

      // Step 4: Generate seal signature (H_sealsig) first
      const [sealSigError, sealSignature] = await this.generateSealSignature(
        unsignedHeader,
        slot,
      )
      if (sealSigError) {
        return safeError(sealSigError)
      }

      // Step 5: Generate VRF signature (H_vrfsig) using seal output
      const [vrfSigError, vrfSignature] = await generateVRFSignature(
        sealSignature,
        this.keyPairService,
      )
      if (vrfSigError) {
        return safeError(vrfSigError)
      }

      // Step 6: Complete block header with both signatures
      const completeHeader: BlockHeader = {
        ...unsignedHeader,
        vrfSig: bytesToHex(vrfSignature),
        sealSig: bytesToHex(sealSignature),
      }

      const [ticketError, ticketsToInclude] = await getTicketsForExtrinsic(
        this.clockService,
        this.configService,
        this.ticketHolderService,
      )
      if (ticketError) {
        logger.warn('Failed to get tickets for extrinsic', {
          error: ticketError,
        })
      }

      // Step 7: Create complete block
      const block: Block = {
        header: completeHeader,
        body: {
          tickets: ticketsToInclude ?? [],
          preimages: [],
          guarantees: [],
          assurances: [],
          disputes: [],
        },
      }

      logger.info('Block created successfully', {
        slot: completeHeader.timeslot,
        authorIndex: completeHeader.authorIndex,
        vrfSig: completeHeader.vrfSig,
        sealSig: completeHeader.sealSig,
        duration: Date.now() - startTime,
      })

      return safeResult(block)
    } catch (error) {
      logger.error('Block creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return safeError(
        new Error(
          `Block creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      )
    }
  }

  /**
   * Construct unsigned block header (without signatures)
   * This creates the header structure before adding H_sealsig and H_vrfsig
   */
  constructUnsignedHeader(
    parent: BlockHeader,
    extrinsics: Extrinsic[],
  ): Safe<UnsignedBlockHeader> {
    // Use header constructor but without signatures
    const [error, header] = this.headerConstructor.construct(
      parent,
      extrinsics,
      this.configService,
    )
    if (error) {
      return safeError(error)
    }

    // Return header without signatures (they'll be added later)
    const unsignedHeader: UnsignedBlockHeader = {
      ...header,
      vrfSig:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
    }

    return safeResult(unsignedHeader)
  }

  /**
   * Generate seal signature for block header
   *
   * Implements Gray Paper safrole.tex equations 144-156:
   *
   * Two modes based on sealtickets type:
   * 1. Ticket-based sealing (Eq. 148): sealtickets' ∈ sequence{SafroleTicket}
   *    - Uses Ring VRF with ticket context: Xticket ∥ entropy'_3 ∥ i_st_entryindex
   *    - Validates: i_st_id = banderout{H_sealsig}
   *    - Sets: isticketed = 1
   *
   * 2. Fallback sealing (Eq. 154): sealtickets' ∈ sequence{bskey}
   *    - Uses direct VRF with fallback context: Xfallback ∥ entropy'_3
   *    - Sets: isticketed = 0
   *
   * Gray Paper Eq. 144: i = cyclic{sealtickets'[H_timeslot]}
   * Gray Paper Eq. 147-148: Ticket-based sealing
   * Gray Paper Eq. 152-154: Fallback sealing
   */
  async generateSealSignature(
    unsignedHeader: UnsignedBlockHeader,
    slot: bigint,
  ): SafePromise<Uint8Array> {
    try {
      // Get author's Bandersnatch key
      const authorPrivateKey =
        this.keyPairService.getLocalKeyPair().bandersnatchKeyPair.privateKey

      // Get entropy_3 for seal generation (Gray Paper line 166)
      const entropy3 = this.entropyService.getEntropy3()

      // Gray Paper Eq. 144: i = cyclic{sealtickets'[H_timeslot]}
      // Get the seal key for this specific slot from the seal key sequence
      const [sealKeyError, sealKey] =
        this.sealKeyService.getSealKeyForSlot(slot)
      if (sealKeyError) {
        return safeError(sealKeyError)
      }

      // Determine sealing mode based on seal key type
      if (isSafroleTicket(sealKey)) {
        // Gray Paper Eq. 147-148: Ticket-based sealing
        // sealtickets' ∈ sequence{SafroleTicket} ⟹ ticket-based sealing
        return generateTicketBasedSealSignature(
          authorPrivateKey,
          entropy3,
          unsignedHeader,
          sealKey,
          slot,
          this.configService,
        )
      } else {
        // Gray Paper Eq. 152-154: Fallback sealing
        // sealtickets' ∈ sequence{bskey} ⟹ fallback sealing
        const [sealError, sealResult] = generateFallbackSealSignature(
          authorPrivateKey,
          entropy3,
          unsignedHeader,
          this.configService,
        )
        if (sealError) {
          return safeError(sealError)
        }
        return safeResult(sealResult.signature)
      }
    } catch (error) {
      logger.error('Failed to generate seal signature', { error, slot })
      return safeError(error as Error)
    }
  }

  /**
   * Handle slot change events to check if current validator is elected to author blocks
   *
   * Gray Paper Logic:
   * - Get seal key for current slot from seal key sequence
   * - Compare with current validator's Bandersnatch public key
   * - If match: Current validator is elected to author block for this slot
   * - If no match: Current validator is not elected for this slot
   *
   * @param event - Slot change event containing slot, epoch, and phase information
   */
  private readonly handleSlotChange = async (
    event: SlotChangeEvent,
  ): SafePromise<void> => {
    try {
      // Get current validator's Bandersnatch public key
      const localKeyPair = this.keyPairService.getLocalKeyPair()
      const currentValidatorBandersnatchKey =
        localKeyPair.bandersnatchKeyPair.publicKey

      // Check if current validator is elected to author this block
      const isElected =
        this.validatorSetManagerService.isValidatorElectedForSlot(
          bytesToHex(currentValidatorBandersnatchKey),
          BigInt(event.slot),
        )

      if (!isElected) {
        return safeResult(undefined)
      }

      const [blockError, block] = await this.createBlock(event.slot)
      if (blockError) {
        logger.error('Failed to create block', { error: blockError })
        return safeError(blockError)
      }

      // Step 9: Emit block authored event
      this.eventBusService.emitAuthored(block)

      return safeResult(undefined)
    } catch (error) {
      logger.error('Error handling slot change event', {
        slot: event.slot.toString(),
        error: error instanceof Error ? error.message : String(error),
      })
      return safeError(error as Error)
    }
  }
}
