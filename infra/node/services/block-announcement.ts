// /**
//  * Block Authoring Service Implementation
//  *
//  * Implements block creation, validation, and submission according to JAM Protocol
//  * Reference: Gray Paper block authoring specifications
//  */

// import type { ConectivityChangeEvent } from '@pbnj/core'
// import {
//   type EventBusService,
//   type Hex,
//   logger,
// } from '@pbnj/core'
// import type { BlockAnnouncementProtocol } from '@pbnj/networking'
// import { calculateBlockHash } from '@pbnj/codec'
// import type {
//   Block,
//   BlockAnnouncement,
//   BlockAnnouncementHandshake,
//   SafePromise,
// } from '@pbnj/types'
// import { BaseService, safeError, safeResult } from '@pbnj/types'
// import type { ConfigService } from './config-service'
// import type { NetworkingService } from './networking-service'
// import type { ValidatorSetManager } from './validator-set'

// /**
//  * Block Announcement Service Implementation
//  */
// export class BlockAnnouncementService extends BaseService {
//   // Block announcement protocol integration
//   private blockAnnouncementProtocol: BlockAnnouncementProtocol
//   private isStarted = false

//   private validatorSetManager: ValidatorSetManager
//   private localValidatorIndex: bigint | null = null
//   private networkingService: NetworkingService
//   private configService: ConfigService
//   private eventBusService: EventBusService
//   constructor(options: {
//     blockAnnouncementProtocol: BlockAnnouncementProtocol
//     networkingService: NetworkingService
//     validatorSetManager: ValidatorSetManager
//     eventBusService: EventBusService
//     configService: ConfigService
//   }) {
//     super('block-announcement-service')
//     this.blockAnnouncementProtocol = options.blockAnnouncementProtocol
//     this.networkingService = options.networkingService
//     this.validatorSetManager = options.validatorSetManager
//     this.eventBusService = options.eventBusService
//     this.configService = options.configService
//     this.eventBusService.addConectivityChangeCallback(
//       this.handleConectivityChange.bind(this),
//     )
//   }

//   /**
//    * Start block announcement protocol
//    * JIP-5 compliant startup method
//    */
//   async handleConectivityChange(
//     _event: ConectivityChangeEvent,
//   ): SafePromise<void> {
//     // this.eventBusService.onEpochTransition(this.handleEpochTransition)
//     // Get neighboring validators from grid structure
//     const neighbors: { index: number; publicKey: Hex }[] =
//       this.validatorSetManager.getAllConnectedNeighbors(
//         Number(this.localValidatorIndex),
//       )

//     // Initialize UP0 streams to all neighbors
//     for (const neighbor of neighbors) {
//       await this.initializeStreamToValidator(neighbor)
//     }

//     return safeResult(undefined)
//   }

//   /**
//    * Announce a block to connected peers
//    *
//    * TODO: Implement comprehensive block announcement logic according to Gray Paper and JAMNP-S spec
//    * =============================================================================================
//    *
//    * REFERENCE:
//    * - Gray Paper: submodules/graypaper/text/header.tex (block validity)
//    * - Gray Paper: submodules/graypaper/text/best_chain.tex (finalization and ancestry)
//    * - JAMNP-S spec: submodules/jam-docs/docs/knowledge/advanced/simple-networking/spec.md (UP 0)
//    *
//    * 1. BLOCK VALIDITY CHECKS (Gray Paper Eq. 44-49):
//    *    - Block MUST be valid before announcement: H_timeslot ∈ timeslot
//    *    - Timeslot MUST be in the past: H_timeslot⋅C_slotseconds ≤ wallclock
//    *    - Timeslot MUST be greater than parent: getparent(H)_timeslot < H_timeslot
//    *    - Block MUST have valid seal signature H_sealsig from corresponding sealing key
//    *    - Extrinsic hash MUST be valid Merkle commitment to block's extrinsic data
//    *    - Required methods:
//    *      * this.validateBlockHeader(blockHeader)
//    *      * this.checkTimeslotValidity(timeslot, wallclock)
//    *      * this.validateSealSignature(sealSig, timeslot, sealingKey)
//    *
//    * 2. ANCESTRY AND FINALIZATION REQUIREMENTS (Gray Paper best_chain.tex):
//    *    - Block MUST be descendant of latest finalized block: ancestors(header) ∋ header^final
//    *    - Block MUST NOT be in a chain containing equivocations (two blocks at same timeslot)
//    *    - Skip announcement if block is NOT descendant of finalized block (JAMNP-S rule 2)
//    *    - Required methods:
//    *      * this.isDescendantOfFinalized(blockHash, finalizedBlockHash)
//    *      * this.hasEquivocations(blockHeader, finalizedHeader)
//    *      * this.getFinalizedBlock() → { hash, slot }
//    *
//    * 3. ANNOUNCEMENT CONDITIONS (JAMNP-S spec UP 0):
//    *    ANNOUNCE when:
//    *    - New valid block is produced by this node (authored)
//    *    - New valid block is received from another node (imported)
//    *
//    *    SKIP announcement if ANY of:
//    *    - A descendant of the block is announced instead (optimization)
//    *    - Block is NOT a descendant of latest finalized block (invalid chain)
//    *    - Block (or its descendant) has been announced by the other side of stream
//    *
//    *    Required state tracking:
//    *    - Map<streamId, Set<blockHash>> announcedToStream - track what we've announced to each peer
//    *    - Map<streamId, Set<blockHash>> receivedFromStream - track what peer announced to us
//    *
//    * 4. TARGET SELECTION (JAMNP-S spec):
//    *    Send announcements ONLY to:
//    *    - Grid neighbors if both nodes are validators
//    *    - ALL connected peers if either node is not a validator
//    *    - Validators in previous, current, AND next epochs during transitions
//    *    - Required methods:
//    *      * this.gridStructure.getNeighbors(validatorIndex)
//    *      * this.validatorSetManager.isValidator(nodeId)
//    *      * this.getActiveUP0Streams() → Set<streamId>
//    *
//    * 5. MESSAGE FORMAT (JAMNP-S spec):
//    *    Announcement = Header ++ Final
//    *    Where:
//    *    - Header = Complete block header (as in Gray Paper)
//    *    - Final = FinalBlockHash (32 bytes) ++ FinalBlockSlot (4 bytes LE)
//    *    - MUST include latest finalized block info in EVERY announcement
//    *    - Required methods:
//    *      * this.serializeBlockHeader(blockHeader) → Uint8Array
//    *      * this.serializeFinalizedInfo(hash, slot) → Uint8Array
//    *
//    * 6. TIMING AND ORDERING:
//    *    - Announce IMMEDIATELY when valid block is produced/received
//    *    - Do NOT wait for batch processing or delays
//    *    - Maintain announcement order (parents before children when possible)
//    *    - Handle concurrent announcements gracefully
//    *    - Required methods:
//    *      * this.enforceAnnouncementOrder(blockHeader, parentHeader)
//    *      * this.getDependentBlocks(blockHash) → Set<blockHash>
//    *
//    * 7. ERROR HANDLING AND RECOVERY:
//    *    - Continue announcing to other streams if one fails
//    *    - Log failed announcements for debugging
//    *    - Retry failed announcements with exponential backoff
//    *    - Reset stream if persistent failures occur
//    *    - Required methods:
//    *      * this.retryFailedAnnouncement(streamId, announcement)
//    *      * this.resetStream(streamId, reason)
//    *
//    * 8. EPOCH TRANSITIONS (JAMNP-S spec):
//    *    - Adjust UP 0 streams when validator set changes
//    *    - Wait for first block of epoch to be finalized before changes
//    *    - Wait max(⌊E/30⌋, 1) slots after epoch start before applying
//    *    - Synchronize changes across all validators
//    *    - Required methods:
//    *      * this.onEpochTransition(newEpoch, validatorSet)
//    *      * this.scheduleStreamAdjustments(epoch, validatorSet)
//    *
//    * 9. DEDUPLICATION AND OPTIMIZATION:
//    *    - Track what blocks have been announced to each peer
//    *    - Skip redundant announcements of same block
//    *    - Prefer announcing descendants over ancestors when possible
//    *    - Batch announcements when multiple blocks are ready
//    *    - Required state:
//    *      * Map<streamId, blockHash> lastAnnouncedBlock
//    *      * Set<blockHash> pendingAnnouncements
//    *
//    * 10. COMPLIANCE VERIFICATION:
//    *     - Verify announcement format matches JAMNP-S exactly
//    *     - Validate stream kind is 0 (UP 0) for block announcements
//    *     - Ensure bidirectional announcement exchange per spec
//    *     - Monitor for protocol violations from peers
//    *     - Required methods:
//    *       * this.validateAnnouncementFormat(announcement)
//    *       * this.verifyStreamCompliance(streamId, direction)
//    *
//    * CRITICAL: This is core networking logic - must follow JAMNP-S specification
//    * exactly for network compatibility and proper block propagation.
//    */
//   async announceBlock(block: Block): Promise<void> {
//     // compute block hash
//     const [finalBlockHashError, finalBlockHash] = calculateBlockHash(
//       block,
//       this.configService,
//     )
//     if (finalBlockHashError) {
//       logger.error('Failed to calculate block hash:', finalBlockHashError)
//       return
//     }

//     // Create block announcement message
//     const announcement: BlockAnnouncement = {
//       header: block.header,
//       finalBlockHash: finalBlockHash,
//       finalBlockSlot: block.header.timeslot,
//     }

//     // Serialize announcement
//     const [error, announcementData] =
//       this.blockAnnouncementProtocol.serializeBlockAnnouncement(announcement)
//     if (error) {
//       logger.error('Failed to serialize block announcement:', error)
//       return
//     }

//     const neighbors = this.validatorSetManager.getAllConnectedNeighbors(
//       Number(block.header.authorIndex),
//     )

//     // Send to all active streams
//     let successCount = 0
//     for (const neighbor of neighbors) {
//       try {
//         await this.sendAnnouncementToValidator(
//           BigInt(neighbor.index),
//           announcementData,
//         )
//         successCount++
//       } catch (error) {
//         logger.error(
//           `Failed to send announcement to validator ${neighbor.index}:`,
//           error,
//         )
//       }
//     }

//     logger.info(
//       `Block announcement sent successfully to ${successCount}/${neighbors.length} neighbors`,
//     )
//   }

//   /**
//    * Send announcement data to a specific stream
//    */
//   private async sendAnnouncementToValidator(
//     validatorIndex: bigint,
//     data: Uint8Array,
//   ): SafePromise<void> {
//     if (!this.networkingService) {
//       logger.error(
//         `Stream manager not available for announcement to validator ${validatorIndex}`,
//       )
//       return safeError(new Error('Stream manager not available'))
//     }

//     // Send announcement via QUIC stream with proper JAMNP-S framing
//     const [error] = await this.networkingService.sendMessage(
//       validatorIndex,
//       0,
//       data,
//     )
//     if (error) {
//       logger.error(
//         `Failed to send block announcement to validator ${validatorIndex}:`,
//         error,
//       )
//       return safeError(error)
//     }

//     logger.info(
//       `✅ Block announcement sent to validator ${validatorIndex} (${data.length} bytes)`,
//     )

//     return safeResult(undefined)
//   }

//   /**
//    * Initialize UP0 stream to a specific validator
//    */
//   private async initializeStreamToValidator(validator: {
//     index: number
//     publicKey: Hex
//   }): Promise<void> {
//     if (this.networkingService.isConnectedToPeer(validator.publicKey)) {
//       return
//     }

//     const [endpointError, endpoint] =
//       this.validatorSetManager.getConnectionEndpointFromMetadata(
//         validator.index,
//       )
//     if (endpointError) {
//       logger.error(
//         'Failed to get connection endpoint from metadata:',
//         endpointError,
//       )
//       return
//     }

//     // Get or create connection to validator
//     await this.networkingService.connectToPeer(endpoint)

//     // Send handshake
//     await this.sendHandshake(BigInt(validator.index))
//   }

//   /**
//    * Send UP0 handshake to establish block announcement stream
//    */
//   private async sendHandshake(validatorIndex: bigint): Promise<void> {
//     if (!this.localValidatorIndex === null) {
//       throw new Error('Missing required components for handshake')
//     }

//     const handshake: BlockAnnouncementHandshake = {
//       finalBlockHash: new Uint8Array(32), // Placeholder for finalized block hash
//       finalBlockSlot: 0n, // Placeholder for finalized block slot
//       leaves: [], // Placeholder for known leaves
//     }

//     try {
//       // Serialize handshake message
//       const handshakeData =
//         this.blockAnnouncementProtocol.serializeHandshake(handshake)

//       // Send via QUIC stream with proper JAMNP-S framing
//       await this.networkingService.sendMessage(
//         validatorIndex,
//         0,
//         handshakeData.data,
//       )

//       logger.info(`✅ UP0 handshake sent to validator ${validatorIndex}`)
//     } catch (error) {
//       logger.error(
//         `❌ Failed to send UP0 handshake to validator ${validatorIndex}:`,
//         error,
//       )
//       throw error
//     }
//   }
// }
