/**
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */

import {
  constructBlockBody,
  constructHeader,
  handleBlockRequest,
} from '@pbnjam/block-authoring'
import { calculateBlockHashFromHeader } from '@pbnjam/codec'
import type { EventBusService } from '@pbnjam/core'
import {
  bytesToHex,
  getValidatorCredentialsWithFallback,
  type Hex,
  logger,
  type SlotChangeEvent,
} from '@pbnjam/core'
import type {
  BlockAnnouncementProtocol,
  BlockRequestProtocol,
} from '@pbnjam/networking'
import type {
  Block,
  BlockAnnouncement,
  BlockRequest,
  StreamKind,
} from '@pbnjam/types'
import {
  BaseService,
  type Safe,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { AssuranceService } from './assurance-service'
import type { ChainManagerService } from './chain-manager-service'
import type { ClockService } from './clock-service'
import type { ConfigService } from './config-service'
import type { DisputesService } from './disputes-service'
import type { EntropyService } from './entropy'
import type { NodeGenesisManager } from './genesis-manager'
import type { GuarantorService } from './guarantor-service'
import type { KeyPairService } from './keypair-service'
import type { NetworkingService } from './networking-service'
import type { RecentHistoryService } from './recent-history-service'
import type { SealKeyService } from './seal-key'
import type { ServiceAccountService } from './service-account-service'
import type { StateService } from './state-service'
import type { TicketService } from './ticket-service'
import type { ValidatorSetManager } from './validator-set'
import type { WorkReportService } from './work-report-service'
/** Block Authoring Service
 * Block Authoring Service Implementation
 *
 * Implements block creation, validation, and submission according to JAM Protocol
 * Reference: Gray Paper block authoring specifications
 */
export class BlockAuthoringService extends BaseService {
  private readonly eventBusService: EventBusService
  private readonly entropyService: EntropyService
  private readonly keyPairService: KeyPairService | null
  private readonly sealKeyService: SealKeyService
  private readonly clockService: ClockService
  private readonly configService: ConfigService
  private readonly validatorSetManagerService: ValidatorSetManager
  private readonly recentHistoryService: RecentHistoryService
  private readonly stateService: StateService
  private readonly networkingService: NetworkingService | null
  private readonly blockAnnouncementProtocol?: BlockAnnouncementProtocol | null
  private readonly blockRequestProtocol?: BlockRequestProtocol | null
  private readonly genesisManagerService: NodeGenesisManager | null
  private readonly chainManagerService: ChainManagerService | null
  private readonly ticketService: TicketService
  private readonly serviceAccountService: ServiceAccountService | null
  private readonly guarantorService: GuarantorService | null
  private readonly workReportService: WorkReportService | null
  private readonly assuranceService: AssuranceService | null
  private readonly disputesService: DisputesService | null

  constructor(options: {
    eventBusService: EventBusService
    // workPackageProcessor: WorkPackageProcessor
    entropyService: EntropyService
    keyPairService?: KeyPairService | null
    sealKeyService: SealKeyService
    clockService: ClockService
    configService: ConfigService
    validatorSetManagerService: ValidatorSetManager
    recentHistoryService: RecentHistoryService
    stateService: StateService
    ticketService: TicketService
    serviceAccountService?: ServiceAccountService | null
    guarantorService?: GuarantorService | null
    workReportService?: WorkReportService | null
    assuranceService?: AssuranceService | null
    disputesService?: DisputesService | null
    networkingService?: NetworkingService | null
    genesisManagerService?: NodeGenesisManager | null
    chainManagerService?: ChainManagerService | null
    blockRequestProtocol?: BlockRequestProtocol | null
    blockAnnouncementProtocol?: BlockAnnouncementProtocol | null
  }) {
    super('block-authoring-service')
    this.eventBusService = options.eventBusService
    this.entropyService = options.entropyService
    this.keyPairService = options.keyPairService ?? null
    this.sealKeyService = options.sealKeyService
    this.clockService = options.clockService
    this.configService = options.configService
    this.validatorSetManagerService = options.validatorSetManagerService
    this.recentHistoryService = options.recentHistoryService
    this.stateService = options.stateService
    this.ticketService = options.ticketService
    this.serviceAccountService = options.serviceAccountService ?? null
    this.guarantorService = options.guarantorService ?? null
    this.workReportService = options.workReportService ?? null
    this.assuranceService = options.assuranceService ?? null
    this.disputesService = options.disputesService ?? null
    this.networkingService = options.networkingService ?? null
    this.genesisManagerService = options.genesisManagerService ?? null
    this.chainManagerService = options.chainManagerService ?? null

    // Services stored for future use (see TODOs in constructBlockBody)
    void this.stateService
    void this.guarantorService
    void this.workReportService
    void this.assuranceService
    void this.disputesService

    // Initialize block announcement protocol for serializing announcements
    this.blockAnnouncementProtocol = options.blockAnnouncementProtocol ?? null

    // Initialize block request protocol (required for handling block requests)
    this.blockRequestProtocol = options.blockRequestProtocol ?? undefined
    // Register slot change handler to check if current validator is elected to author blocks
    this.eventBusService.addSlotChangeCallback(this.handleSlotChange.bind(this))

    // Handle block requests: when chain manager determines we need a block,
    // send the request via networking service
    this.eventBusService.addBlocksRequestedCallback(
      async (request: BlockRequest, peerPublicKey: Hex) => {
        // Skip if networking service is not available
        if (!this.networkingService || !this.blockRequestProtocol) {
          logger.debug(
            'Networking service or block request protocol not available, skipping block request',
          )
          return
        }

        await handleBlockRequest(
          request,
          peerPublicKey,
          this.blockRequestProtocol,
          this.networkingService,
        )
      },
    )
  }

  /**
   * Create a new block according to Gray Paper specifications
   *
   * Gray Paper Block Authoring Process:
   * 1. Get parent header from recent history (or genesis)
   * 2. Construct block body (tickets, preimages, guarantees, assurances, disputes)
   * 3. Calculate extrinsic hash from block body
   * 4. Construct unsigned block header with correct extrinsic hash
   * 5. Generate seal signature (H_sealsig)
   * 6. Generate VRF signature (H_vrfsig) using seal output
   * 7. Complete block header with both signatures
   * 8. Update state and emit block
   */
  async createBlock(slot: bigint): SafePromise<Block> {
    const startTime = Date.now()

    try {
      // Step 1: Construct block body
      // Collect tickets, preimages, guarantees, assurances, and disputes from services
      const [blockBodyError, blockBody] = constructBlockBody(
        slot,
        this.configService,
        this.serviceAccountService!,
        this.ticketService,
        this.guarantorService!,
        this.workReportService!,
        this.assuranceService!,
        this.disputesService!,
        this.recentHistoryService,
        this.clockService,
      )
      if (blockBodyError) {
        return safeError(blockBodyError)
      }
      if (!blockBody) {
        return safeError(
          new Error('Block body construction returned undefined'),
        )
      }

      // Step 2: Construct complete block header with signatures
      // constructHeader now generates both seal and VRF signatures internally
      const [headerError, completeHeader] = await constructHeader(
        slot,
        blockBody,
        this.configService,
        this.recentHistoryService,
        this.genesisManagerService ?? null,
        this.stateService,
        this.clockService,
        this.entropyService,
        this.validatorSetManagerService,
        this.ticketService,
        this.keyPairService,
        this.sealKeyService,
      )
      if (headerError) {
        return safeError(headerError)
      }
      if (!completeHeader) {
        return safeError(new Error('Header construction returned undefined'))
      }

      // Step 3: Create complete block
      const block: Block = {
        header: completeHeader,
        body: blockBody,
      }

      logger.info('Block created successfully', {
        slot: completeHeader.timeslot,
        authorIndex: completeHeader.authorIndex,
        parentHash: completeHeader.parent,
        extrinsicHash: completeHeader.extrinsicHash,
        vrfSig: `${completeHeader.vrfSig.substring(0, 20)}...`,
        sealSig: `${completeHeader.sealSig.substring(0, 20)}...`,
        duration: Date.now() - startTime,
      })

      // Step 4: Announce block to neighbors via networking service
      await this.announceBlock(block)

      return safeResult(block)
    } catch (error) {
      logger.error('Block creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      })

      return safeError(
        new Error(
          `Block creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ),
      )
    }
  }

  /**
   * Check if this node should author a block for the given slot
   *
   * Gray Paper Logic:
   * - Get seal key for the slot from seal key sequence
   * - Find the validator index that matches the seal key
   * - Compare with config.validatorIndex
   * - If match: This node should author the block
   * - If no match: This node should not author the block
   *
   * @param slot - Slot to check
   * @returns true if this node should author the block, false otherwise
   */
  private shouldAuthorBlock(slot: bigint): Safe<boolean> {
    // If validatorIndex is not set, we cannot determine if we should author
    if (this.configService.validatorIndex === undefined) {
      return safeResult(false)
    }

    // Get the seal key for this slot
    const [sealKeyError, sealKey] = this.sealKeyService.getSealKeyForSlot(slot)
    if (sealKeyError || !sealKey) {
      return safeError(
        sealKeyError ||
          new Error(
            'Failed to get seal key for slot to determine block author',
          ),
      )
    }

    // If seal key is a ticket, we need to check if our validator owns it
    if (typeof sealKey === 'object' && 'id' in sealKey) {
      // Ticket-based sealing - check if our validator owns the ticket
      const [credentialsError, validatorCredentials] =
        getValidatorCredentialsWithFallback(
          this.configService,
          this.keyPairService ?? undefined,
        )
      if (credentialsError || !validatorCredentials) {
        return safeError(
          credentialsError ||
            new Error('Failed to get validator credentials for ticket check'),
        )
      }
      const currentValidatorBandersnatchKey =
        validatorCredentials.bandersnatchKeyPair.publicKey

      // Check if current validator is elected to author this block
      const [electedError, isElected] =
        this.validatorSetManagerService.isValidatorElectedForSlot(
          bytesToHex(currentValidatorBandersnatchKey),
          slot,
        )
      if (electedError) {
        return safeError(electedError)
      }
      return safeResult(isElected)
    }

    // Fallback sealing - seal key is a Bandersnatch public key
    // Find the validator index that matches the seal key
    const sealKeyHex = bytesToHex(sealKey as Uint8Array)
    const activeValidators =
      this.validatorSetManagerService.getActiveValidators()
    for (let i = 0; i < activeValidators.length; i++) {
      if (activeValidators[i]?.bandersnatch === sealKeyHex) {
        // Check if this matches our validator index
        return safeResult(i === this.configService.validatorIndex)
      }
    }

    // Seal key not found in active validator set
    return safeResult(false)
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
      // Check if this node should author a block for this slot
      const [shouldAuthorError, shouldAuthor] = this.shouldAuthorBlock(
        BigInt(event.slot),
      )
      if (shouldAuthorError) {
        return safeError(shouldAuthorError)
      }
      if (!shouldAuthor) {
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

  /**
   * Announce block to connected neighbors via networking service
   *
   * Implements block announcement logic from block-announcement.ts:
   * - Calculate block hash
   * - Create BlockAnnouncement message
   * - Serialize announcement using BlockAnnouncementProtocol
   * - Get neighbors from validator set manager
   * - Send to each neighbor via networking service (UP0, kind 0)
   */
  private async announceBlock(block: Block): Promise<void> {
    // Skip announcement if networking service is not available
    if (!this.networkingService) {
      logger.debug(
        'Networking service not available, skipping block announcement',
      )
      return
    }

    // Skip announcement if block announcement protocol is not available
    if (!this.blockAnnouncementProtocol) {
      logger.debug(
        'Block announcement protocol not available, skipping block announcement',
      )
      return
    }

    try {
      // Calculate block hash (finalized block hash for announcement)
      const [blockHashError, blockHash] = calculateBlockHashFromHeader(
        block.header,
        this.configService,
      )
      if (blockHashError || !blockHash) {
        logger.error('Failed to calculate block hash for announcement', {
          error: blockHashError?.message,
        })
        return
      }

      // Get finalized block info from chain manager (stateless UP0 protocol)
      let finalBlockHash: string = blockHash
      let finalBlockSlot: bigint = block.header.timeslot

      if (this.chainManagerService) {
        const finalizedInfo = this.chainManagerService.getFinalizedBlockInfo()
        if (finalizedInfo) {
          finalBlockHash = finalizedInfo.hash
          finalBlockSlot = finalizedInfo.slot
        } else {
          // No finalized block yet, use genesis or current block
          if (this.genesisManagerService) {
            const [genesisHashError, genesisHash] =
              this.genesisManagerService.getGenesisHeaderHash()
            if (!genesisHashError && genesisHash) {
              finalBlockHash = genesisHash
              finalBlockSlot = 0n
            }
          }
        }
      } else {
        // Fallback to recent history if chain manager not available
        const recentHistory = this.recentHistoryService.getRecentHistory()
        if (recentHistory.length > 0) {
          const oldestEntry = recentHistory[0]
          finalBlockHash = oldestEntry.headerHash
          const currentSlot = this.clockService.getLatestReportedBlockTimeslot()
          finalBlockSlot = currentSlot - BigInt(recentHistory.length - 1)
        } else if (this.genesisManagerService) {
          const [genesisHashError, genesisHash] =
            this.genesisManagerService.getGenesisHeaderHash()
          if (!genesisHashError && genesisHash) {
            finalBlockHash = genesisHash
            finalBlockSlot = 0n
          }
        }
      }

      // Create block announcement message
      const announcement: BlockAnnouncement = {
        header: block.header,
        finalBlockHash: finalBlockHash as `0x${string}`,
        finalBlockSlot: finalBlockSlot,
      }

      // Serialize announcement using BlockAnnouncementProtocol
      const [serializeError, announcementData] =
        this.blockAnnouncementProtocol.serializeBlockAnnouncement(announcement)
      if (serializeError || !announcementData) {
        logger.error('Failed to serialize block announcement', {
          error: serializeError?.message,
        })
        return
      }

      // Get current validator index for finding neighbors
      const [credentialsError, validatorCredentials] =
        getValidatorCredentialsWithFallback(
          this.configService,
          this.keyPairService ?? undefined,
        )
      if (credentialsError || !validatorCredentials) {
        logger.error('Failed to get validator credentials for announcement', {
          error: credentialsError?.message,
        })
        return
      }

      // Get Ed25519 public key to find validator index
      const ed25519PublicKey = bytesToHex(
        validatorCredentials.ed25519KeyPair.publicKey,
      )
      const [validatorIndexError, validatorIndex] =
        this.validatorSetManagerService.getValidatorIndex(ed25519PublicKey)
      if (validatorIndexError) {
        logger.debug(
          'Local node is not a validator, skipping block announcement',
          {
            error: validatorIndexError.message,
          },
        )
        return
      }

      // Get neighbors from validator set manager
      const neighbors =
        this.validatorSetManagerService.getAllConnectedNeighbors(validatorIndex)

      if (neighbors.length === 0) {
        logger.debug('No neighbors found, skipping block announcement')
        return
      }

      // Send announcement to all neighbors via networking service (UP0, kind 0)
      for (const neighbor of neighbors) {
        try {
          const [sendError] = await this.networkingService.sendMessage(
            BigInt(neighbor.index),
            0 as StreamKind, // UP0 block announcement protocol
            announcementData,
          )
          if (sendError) {
            logger.warn('Failed to send block announcement to neighbor', {
              neighborIndex: neighbor.index,
              neighborPublicKey: `${neighbor.publicKey.substring(0, 20)}...`,
              error: sendError.message,
            })
          }
        } catch (error) {
          logger.error('Error sending block announcement to neighbor', {
            neighborIndex: neighbor.index,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }
    } catch (error) {
      logger.error('Failed to announce block', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      // Don't fail block creation if announcement fails
    }
  }
}
