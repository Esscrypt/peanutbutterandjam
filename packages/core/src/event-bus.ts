/**
 * Generalized Event Bus Service
 *
 * Type-safe centralized event system with minimal code repetition
 */

import type {
  AccumulateCost,
  AssuranceDistributionRequest,
  AuditAnnouncement,
  AuditShardRequest,
  AuditShardResponse,
  Block,
  BlockAnnouncementHandshake,
  BlockBody,
  BlockHeader,
  BlockOutline,
  BlockRequest,
  EpochMark,
  GuaranteeDiscardReason,
  GuaranteedWorkReport,
  GuaranteeOutline,
  IsAuthorizedCost,
  Judgment,
  Preimage,
  PreimageAnnouncement,
  PreimageRequest,
  RefineCost,
  Safe,
  SafePromise,
  SegmentShardRequest,
  SegmentShardResponse,
  ShardDistributionRequest,
  ShardDistributionResponse,
  StateRequest,
  StateResponse,
  TicketDistributionEvent,
  TicketDistributionRequest,
  TicketDistributionResponse,
  ValidatorKeyTuple,
  WorkPackageOutline,
  WorkPackageSharing,
  WorkPackageSharingResponse,
  WorkPackageSubmissionRequest,
  WorkReport,
  WorkReportOutline,
  WorkReportRequest,
  WorkReportResponse,
} from '@pbnjam/types'
import { BaseService, safeResult } from '@pbnjam/types'
import type { Hex } from 'viem'
import { logger } from './logger'

// Event types
export interface ConectivityChangeEvent {
  slot: bigint
}

export interface SlotChangeEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
  previousSlot: bigint
  isEpochTransition: boolean
}

export interface EpochTransitionEvent {
  slot: bigint
  epochMark: EpochMark | null
}

export interface RevertEpochTransitionEvent {
  slot: bigint
  epochMark: EpochMark | null
}

export interface ValidatorSetChangeEvent {
  timestamp: number
  epoch: bigint
  validators: ValidatorKeyTuple[]
}

export interface BlockProcessedEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  authorIndex: number
  header: BlockHeader
  body: BlockBody
}

export interface WorkReportProcessedEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  availableReports: WorkReport[]
  incomingReports: WorkReport[]
}

export interface WorkReportJudgmentEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  workReportHash: Hex
  judgment: 'good' | 'bad' | 'wonky'
  validatorHash: Hex
  reason?: string
}

export interface StatusEvent {
  totalPeerCount: bigint
  validatorPeerCount: bigint
  blockAnnouncementStreamPeerCount: bigint
  guaranteesByCore: Uint8Array
  shardCount: bigint
  shardTotalSizeBytes: bigint
  readyPreimageCount: bigint
  readyPreimageTotalSizeBytes: bigint
}

export interface AssuranceDistributionEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
}

export interface AuditTrancheEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
  trancheNumber: number
  wallclock: number
}

// Define the complete event map
export interface EventMap {
  slotChange: [SlotChangeEvent]
  epochTransition: [EpochTransitionEvent]
  revertEpochTransition: [RevertEpochTransitionEvent]
  validatorSetChange: [ValidatorSetChangeEvent]
  conectivityChange: [ConectivityChangeEvent]
  assuranceReceived: [AssuranceDistributionRequest, Hex]

  // Connection events
  connectionRefused: [string]
  connectingIn: [string]
  connectedIn: [bigint, Uint8Array]
  connectInFailed: [bigint, string]
  connectingOut: [Uint8Array, string]
  connectedOut: [bigint]
  connectOutFailed: [bigint, string]
  disconnected: [Uint8Array, string, ('local' | 'remote')?]
  peerMisbehaved: [Uint8Array, string]

  // Authoring events
  authoring: [bigint, Hex]
  authoringFailed: [bigint, string]
  authored: [Block]

  // Import events
  importing: [bigint, Hex]
  blockVerificationFailed: [bigint, string]
  blockVerified: [bigint]
  blockExecutionFailed: [bigint, string]
  blockExecuted: [bigint, Array<{ serviceId: bigint; cost: AccumulateCost }>]
  bestBlockChanged: [BlockHeader]
  finalizedBlockChanged: [BlockHeader]
  syncStatusChanged: [boolean]
  status: [StatusEvent]

  // Ticket events
  generatingTickets: [bigint]
  ticketGenerationFailed: [bigint, string]
  ticketsGenerated: [bigint, Uint8Array[]]
  ticketTransferFailed: [Uint8Array, 'local' | 'remote', boolean, string]
  ticketTransferred: [
    Uint8Array,
    'local' | 'remote',
    boolean,
    bigint,
    0n | 1n,
    Uint8Array,
  ]

  // Work package events
  workPackageSubmissionReceived: [WorkPackageSubmissionRequest, Hex]
  workPackageBeingShared: [Uint8Array]
  workPackageFailed: [bigint, string]
  duplicateWorkPackage: [bigint, bigint, Uint8Array]
  workPackageReceived: [bigint, bigint, WorkPackageOutline]
  authorized: [bigint, IsAuthorizedCost]
  extrinsicDataReceived: [bigint]
  importsReceived: [bigint]
  sharingWorkPackage: [bigint, Uint8Array]
  workPackageSharingFailed: [bigint, Uint8Array, string]
  bundleSent: [bigint, Uint8Array]
  refined: [bigint, RefineCost[]]
  workReportBuilt: [bigint, WorkReportOutline]
  workReportSignatureSent: [bigint]
  workReportSignatureReceived: [bigint, Uint8Array]

  // Guarantee events
  guaranteeBuilt: [bigint, GuaranteeOutline]
  sendingGuarantee: [bigint, Uint8Array]
  guaranteeSendFailed: [bigint, string]
  guaranteeSent: [bigint]
  guaranteesDistributed: [bigint]
  receivingGuarantee: [Uint8Array]
  guaranteeReceiveFailed: [bigint, string]
  guaranteeReceived: [bigint, GuaranteeOutline]
  guaranteeDiscarded: [GuaranteeOutline, GuaranteeDiscardReason]

  // Audit events
  workReportAvailable: [WorkReport, bigint, Hex]
  negativeJudgmentReceived: [Judgment, Hex, bigint]
  auditAnnouncementReceived: [AuditAnnouncement, Hex]
  judgmentPublished: [Judgment, Hex, bigint]

  // Statistics events
  blockProcessed: [BlockProcessedEvent]
  workReportProcessed: [WorkReportProcessedEvent]
  workReportJudgment: [WorkReportJudgmentEvent]

  // Work package sharing events
  workPackageSharing: [WorkPackageSharing, Hex]
  workPackageSharingResponse: [WorkPackageSharingResponse, Hex]

  // Preimage announcement events
  preimageAnnouncementReceived: [PreimageAnnouncement, Hex]
  preimageRequested: [PreimageRequest, Hex]
  preimageReceived: [Preimage, Hex]

  // Audit shard request events
  auditShardRequest: [AuditShardRequest, Hex]
  auditShardResponse: [AuditShardResponse, Hex]

  // Segment shard request events
  segmentShardRequest: [SegmentShardRequest, Hex]
  segmentShardResponse: [SegmentShardResponse, Hex]

  // Shard distribution request events
  shardDistributionRequest: [ShardDistributionRequest, Hex]
  shardDistributionResponse: [ShardDistributionResponse, Hex]

  // Work report request events
  workReportRequest: [WorkReportRequest, Hex]
  workReportResponse: [WorkReportResponse, Hex]

  // Work report distribution request events
  workReportDistributionRequest: [GuaranteedWorkReport, Hex]

  // Blocks received events
  blocksReceived: [Block[], Hex]
  blocksRequested: [BlockRequest, Hex]

  // Block distribution events (JIP-3: 60-68)
  blockAnnouncementStreamOpened: [Uint8Array, 'local' | 'remote']
  blockAnnouncementStreamClosed: [Uint8Array, 'local' | 'remote', string]
  blockAnnounced: [Uint8Array, 'local' | 'remote', bigint, Uint8Array]
  blockAnnouncementWithHeader: [Uint8Array, BlockHeader]
  blockAnnouncementHandshake: [Uint8Array, BlockAnnouncementHandshake]
  sendingBlockRequest: [
    Uint8Array,
    Uint8Array,
    'ascending_exclusive' | 'descending_inclusive',
    bigint,
  ]
  receivingBlockRequest: [Uint8Array]
  blockRequestFailed: [bigint, string]
  blockRequestSent: [bigint]
  blockRequestReceived: [
    bigint,
    Uint8Array,
    'ascending_exclusive' | 'descending_inclusive',
    bigint,
  ]
  blockTransferred: [bigint, bigint, BlockOutline, boolean]

  // State request events
  stateRequested: [StateRequest, Hex]
  stateResponse: [StateResponse, Hex]

  // Ticket distribution events
  ticketDistributionRequest: [TicketDistributionRequest, Hex]
  ticketDistributionResponse: [TicketDistributionResponse, Hex]

  firstPhaseTicketDistribution: [TicketDistributionEvent]
  secondPhaseTicketDistribution: [TicketDistributionEvent]

  // Assurance distribution events
  assuranceDistribution: [AssuranceDistributionEvent]

  // Availability distribution events (JIP-3: 120-131)
  sendingShardRequest: [Uint8Array, Uint8Array, bigint] // peerId, erasureRoot, shardIndex
  receivingShardRequest: [Uint8Array] // peerId
  shardRequestFailed: [bigint, string] // eventId, reason
  shardRequestSent: [bigint] // eventId
  shardRequestReceived: [bigint, Uint8Array, bigint] // eventId, erasureRoot, shardIndex
  shardsTransferred: [bigint] // eventId
  distributingAssurance: [Uint8Array, Uint8Array] // headerHash, availabilityBitfield
  assuranceSendFailed: [bigint, Uint8Array, string] // eventId, peerId, reason
  assuranceSent: [bigint, Uint8Array] // eventId, peerId
  assuranceDistributed: [bigint] // eventId
  assuranceReceiveFailed: [Uint8Array, string] // peerId, reason
  // assuranceReceived already exists

  // Bundle recovery events (JIP-3: 140-153)
  sendingBundleShardRequest: [bigint, Uint8Array, bigint] // eventId, peerId, shardIndex
  receivingBundleShardRequest: [Uint8Array] // peerId
  bundleShardRequestFailed: [bigint, string] // eventId, reason
  bundleShardRequestSent: [bigint] // eventId
  bundleShardRequestReceived: [bigint, Uint8Array, bigint] // eventId, erasureRoot, shardIndex
  bundleShardTransferred: [bigint] // eventId
  reconstructingBundle: [bigint, boolean] // eventId, isTrivial
  bundleReconstructed: [bigint] // eventId
  sendingBundleRequest: [bigint, Uint8Array] // eventId, peerId
  receivingBundleRequest: [Uint8Array] // peerId
  bundleRequestFailed: [bigint, string] // eventId, reason
  bundleRequestSent: [bigint] // eventId
  bundleRequestReceived: [bigint, Uint8Array] // eventId, erasureRoot
  bundleTransferred: [bigint] // eventId

  // Segment recovery events (JIP-3: 160-178)
  workPackageHashMapped: [bigint, Uint8Array, Uint8Array] // eventId, workPackageHash, segmentsRoot
  segmentsRootMapped: [bigint, Uint8Array, Uint8Array] // eventId, segmentsRoot, erasureRoot
  sendingSegmentShardRequest: [
    bigint,
    Uint8Array,
    boolean,
    Array<{ segmentId: bigint; shardIndex: bigint }>,
  ] // eventId, peerId, usingCE140, requests
  receivingSegmentShardRequest: [Uint8Array, boolean] // peerId, usingCE140
  segmentShardRequestFailed: [bigint, string] // eventId, reason
  segmentShardRequestSent: [bigint] // eventId
  segmentShardRequestReceived: [bigint, bigint] // eventId, shardCount
  segmentShardsTransferred: [bigint] // eventId
  reconstructingSegments: [bigint, bigint[], boolean] // eventId, segmentIds, isTrivial
  segmentReconstructionFailed: [bigint, string] // eventId, reason
  segmentsReconstructed: [bigint] // eventId
  segmentVerificationFailed: [bigint, bigint[], string] // eventId, segmentIndices, reason
  segmentsVerified: [bigint, bigint[]] // eventId, segmentIndices
  sendingSegmentRequest: [bigint, Uint8Array, bigint[]] // eventId, peerId, segmentIndices
  receivingSegmentRequest: [Uint8Array] // peerId
  segmentRequestFailed: [bigint, string] // eventId, reason
  segmentRequestSent: [bigint] // eventId
  segmentRequestReceived: [bigint, bigint] // eventId, segmentCount
  segmentsTransferred: [bigint] // eventId

  // Preimage distribution events (JIP-3: 190-199)
  preimageAnnouncementFailed: [Uint8Array, 'local' | 'remote', string] // peerId, connectionSide, reason
  preimageAnnounced: [
    Uint8Array,
    'local' | 'remote',
    bigint,
    Uint8Array,
    bigint,
  ] // peerId, connectionSide, serviceId, hash, length
  announcedPreimageForgotten: [bigint, Uint8Array, bigint, number] // serviceId, hash, length, reason
  sendingPreimageRequest: [Uint8Array, Uint8Array] // peerId, hash
  receivingPreimageRequest: [Uint8Array] // peerId
  preimageRequestFailed: [bigint, string] // eventId, reason
  preimageRequestSent: [bigint] // eventId
  preimageRequestReceived: [bigint, Uint8Array] // eventId, hash
  preimageTransferred: [bigint, bigint] // eventId, length
  preimageDiscarded: [Uint8Array, bigint, number] // hash, length, reason

  // Audit tranche events
  auditTranche: [AuditTrancheEvent]
}

// Helper type to get callback signature from event args
type EventCallback<T extends unknown[]> = (
  ...args: T
) => Safe<void> | SafePromise<void> | void | Promise<void>

// Type-safe event bus
export class EventBusService extends BaseService {
  private callbacks: {
    [K in keyof EventMap]?: EventCallback<EventMap[K]>[]
  } = {}

  constructor() {
    super('event-bus')
  }

  override stop(): Safe<boolean> {
    this.callbacks = {}
    return safeResult(true)
  }

  /**
   * Register a callback for an event
   */
  on<K extends keyof EventMap>(
    eventName: K,
    callback: EventCallback<EventMap[K]>,
  ): void {
    if (!this.callbacks[eventName]) {
      this.callbacks[eventName] = []
    }
    this.callbacks[eventName]!.push(callback)
  }

  /**
   * Remove a callback for an event
   */
  off<K extends keyof EventMap>(
    eventName: K,
    callback: EventCallback<EventMap[K]>,
  ): void {
    const callbacks = this.callbacks[eventName]
    if (!callbacks) return

    const index = callbacks.indexOf(callback)
    if (index > -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * Emit an event with type-safe arguments
   */
  async emit<K extends keyof EventMap>(
    eventName: K,
    ...args: EventMap[K]
  ): Promise<void> {
    const callbacks = this.callbacks[eventName]
    if (!callbacks) return

    for (const callback of callbacks) {
      try {
        const result = await callback(...args)
        // Handle Safe/SafePromise results
        if (result && Array.isArray(result) && result.length > 0 && result[0]) {
          logger.error(`Error in ${String(eventName)} callback`, {
            error: result[0],
            args,
          })
        }
      } catch (error) {
        logger.error(`Error in ${String(eventName)} callback`, {
          error: error instanceof Error ? error.message : String(error),
          args,
        })
      }
    }
  }

  addBlocksReceivedCallback(
    callback: EventCallback<EventMap['blocksReceived']>,
  ): void {
    this.on('blocksReceived', callback)
  }

  addBlocksRequestedCallback(
    callback: EventCallback<EventMap['blocksRequested']>,
  ): void {
    this.on('blocksRequested', callback)
  }

  addSlotChangeCallback(callback: EventCallback<EventMap['slotChange']>): void {
    this.on('slotChange', callback)
  }

  addEpochTransitionCallback(
    callback: EventCallback<EventMap['epochTransition']>,
  ): void {
    this.on('epochTransition', callback)
  }

  addRevertEpochTransitionCallback(
    callback: EventCallback<EventMap['revertEpochTransition']>,
  ): void {
    this.on('revertEpochTransition', callback)
  }

  addConectivityChangeCallback(
    callback: EventCallback<EventMap['conectivityChange']>,
  ): void {
    this.on('conectivityChange', callback)
  }

  // Aliases for compatibility (addXxxCallback methods)
  addConnectionRefusedCallback(
    callback: EventCallback<EventMap['connectionRefused']>,
  ): void {
    this.on('connectionRefused', callback)
  }

  addConnectingInCallback(
    callback: EventCallback<EventMap['connectingIn']>,
  ): void {
    this.on('connectingIn', callback)
  }

  addConnectedInCallback(
    callback: EventCallback<EventMap['connectedIn']>,
  ): void {
    this.on('connectedIn', callback)
  }

  addConnectInFailedCallback(
    callback: EventCallback<EventMap['connectInFailed']>,
  ): void {
    this.on('connectInFailed', callback)
  }

  addConnectingOutCallback(
    callback: EventCallback<EventMap['connectingOut']>,
  ): void {
    this.on('connectingOut', callback)
  }

  addConnectedOutCallback(
    callback: EventCallback<EventMap['connectedOut']>,
  ): void {
    this.on('connectedOut', callback)
  }

  addConnectOutFailedCallback(
    callback: EventCallback<EventMap['connectOutFailed']>,
  ): void {
    this.on('connectOutFailed', callback)
  }

  addDisconnectedCallback(
    callback: EventCallback<EventMap['disconnected']>,
  ): void {
    this.on('disconnected', callback)
  }

  addPeerMisbehavedCallback(
    callback: EventCallback<EventMap['peerMisbehaved']>,
  ): void {
    this.on('peerMisbehaved', callback)
  }

  addAuthoringCallback(callback: EventCallback<EventMap['authoring']>): void {
    this.on('authoring', callback)
  }

  addAuthoringFailedCallback(
    callback: EventCallback<EventMap['authoringFailed']>,
  ): void {
    this.on('authoringFailed', callback)
  }

  addAuthoredCallback(callback: EventCallback<EventMap['authored']>): void {
    this.on('authored', callback)
  }

  addImportingCallback(callback: EventCallback<EventMap['importing']>): void {
    this.on('importing', callback)
  }

  addBlockVerificationFailedCallback(
    callback: EventCallback<EventMap['blockVerificationFailed']>,
  ): void {
    this.on('blockVerificationFailed', callback)
  }

  addBlockVerifiedCallback(
    callback: EventCallback<EventMap['blockVerified']>,
  ): void {
    this.on('blockVerified', callback)
  }

  addBlockExecutionFailedCallback(
    callback: EventCallback<EventMap['blockExecutionFailed']>,
  ): void {
    this.on('blockExecutionFailed', callback)
  }

  addBlockExecutedCallback(
    callback: EventCallback<EventMap['blockExecuted']>,
  ): void {
    this.on('blockExecuted', callback)
  }

  addBestBlockChangedCallback(
    callback: EventCallback<EventMap['bestBlockChanged']>,
  ): void {
    this.on('bestBlockChanged', callback)
  }

  addFinalizedBlockChangedCallback(
    callback: EventCallback<EventMap['finalizedBlockChanged']>,
  ): void {
    this.on('finalizedBlockChanged', callback)
  }

  addSyncStatusChangedCallback(
    callback: EventCallback<EventMap['syncStatusChanged']>,
  ): void {
    this.on('syncStatusChanged', callback)
  }

  addStatusCallback(callback: EventCallback<EventMap['status']>): void {
    this.on('status', callback)
  }

  // Block distribution event callbacks (JIP-3: 60-68)
  addBlockAnnouncementStreamOpenedCallback(
    callback: EventCallback<EventMap['blockAnnouncementStreamOpened']>,
  ): void {
    this.on('blockAnnouncementStreamOpened', callback)
  }

  addBlockAnnouncementStreamClosedCallback(
    callback: EventCallback<EventMap['blockAnnouncementStreamClosed']>,
  ): void {
    this.on('blockAnnouncementStreamClosed', callback)
  }

  addBlockAnnouncedCallback(
    callback: EventCallback<EventMap['blockAnnounced']>,
  ): void {
    this.on('blockAnnounced', callback)
  }

  addBlockAnnouncementWithHeaderCallback(
    callback: EventCallback<EventMap['blockAnnouncementWithHeader']>,
  ): void {
    this.on('blockAnnouncementWithHeader', callback)
  }

  addBlockAnnouncementHandshakeCallback(
    callback: EventCallback<EventMap['blockAnnouncementHandshake']>,
  ): void {
    this.on('blockAnnouncementHandshake', callback)
  }

  addSendingBlockRequestCallback(
    callback: EventCallback<EventMap['sendingBlockRequest']>,
  ): void {
    this.on('sendingBlockRequest', callback)
  }

  addReceivingBlockRequestCallback(
    callback: EventCallback<EventMap['receivingBlockRequest']>,
  ): void {
    this.on('receivingBlockRequest', callback)
  }

  addBlockRequestFailedCallback(
    callback: EventCallback<EventMap['blockRequestFailed']>,
  ): void {
    this.on('blockRequestFailed', callback)
  }

  addBlockRequestSentCallback(
    callback: EventCallback<EventMap['blockRequestSent']>,
  ): void {
    this.on('blockRequestSent', callback)
  }

  addBlockRequestReceivedCallback(
    callback: EventCallback<EventMap['blockRequestReceived']>,
  ): void {
    this.on('blockRequestReceived', callback)
  }

  addBlockTransferredCallback(
    callback: EventCallback<EventMap['blockTransferred']>,
  ): void {
    this.on('blockTransferred', callback)
  }

  // Availability distribution event callbacks (JIP-3: 120-131)
  addSendingShardRequestCallback(
    callback: EventCallback<EventMap['sendingShardRequest']>,
  ): void {
    this.on('sendingShardRequest', callback)
  }

  addReceivingShardRequestCallback(
    callback: EventCallback<EventMap['receivingShardRequest']>,
  ): void {
    this.on('receivingShardRequest', callback)
  }

  addShardRequestFailedCallback(
    callback: EventCallback<EventMap['shardRequestFailed']>,
  ): void {
    this.on('shardRequestFailed', callback)
  }

  addShardRequestSentCallback(
    callback: EventCallback<EventMap['shardRequestSent']>,
  ): void {
    this.on('shardRequestSent', callback)
  }

  addShardRequestReceivedCallback(
    callback: EventCallback<EventMap['shardRequestReceived']>,
  ): void {
    this.on('shardRequestReceived', callback)
  }

  addShardsTransferredCallback(
    callback: EventCallback<EventMap['shardsTransferred']>,
  ): void {
    this.on('shardsTransferred', callback)
  }

  addDistributingAssuranceCallback(
    callback: EventCallback<EventMap['distributingAssurance']>,
  ): void {
    this.on('distributingAssurance', callback)
  }

  addAssuranceSendFailedCallback(
    callback: EventCallback<EventMap['assuranceSendFailed']>,
  ): void {
    this.on('assuranceSendFailed', callback)
  }

  addAssuranceSentCallback(
    callback: EventCallback<EventMap['assuranceSent']>,
  ): void {
    this.on('assuranceSent', callback)
  }

  addAssuranceDistributedCallback(
    callback: EventCallback<EventMap['assuranceDistributed']>,
  ): void {
    this.on('assuranceDistributed', callback)
  }

  addAssuranceReceiveFailedCallback(
    callback: EventCallback<EventMap['assuranceReceiveFailed']>,
  ): void {
    this.on('assuranceReceiveFailed', callback)
  }

  // Bundle recovery event callbacks (JIP-3: 140-153)
  addSendingBundleShardRequestCallback(
    callback: EventCallback<EventMap['sendingBundleShardRequest']>,
  ): void {
    this.on('sendingBundleShardRequest', callback)
  }

  addReceivingBundleShardRequestCallback(
    callback: EventCallback<EventMap['receivingBundleShardRequest']>,
  ): void {
    this.on('receivingBundleShardRequest', callback)
  }

  addBundleShardRequestFailedCallback(
    callback: EventCallback<EventMap['bundleShardRequestFailed']>,
  ): void {
    this.on('bundleShardRequestFailed', callback)
  }

  addBundleShardRequestSentCallback(
    callback: EventCallback<EventMap['bundleShardRequestSent']>,
  ): void {
    this.on('bundleShardRequestSent', callback)
  }

  addBundleShardRequestReceivedCallback(
    callback: EventCallback<EventMap['bundleShardRequestReceived']>,
  ): void {
    this.on('bundleShardRequestReceived', callback)
  }

  addBundleShardTransferredCallback(
    callback: EventCallback<EventMap['bundleShardTransferred']>,
  ): void {
    this.on('bundleShardTransferred', callback)
  }

  addReconstructingBundleCallback(
    callback: EventCallback<EventMap['reconstructingBundle']>,
  ): void {
    this.on('reconstructingBundle', callback)
  }

  addBundleReconstructedCallback(
    callback: EventCallback<EventMap['bundleReconstructed']>,
  ): void {
    this.on('bundleReconstructed', callback)
  }

  addSendingBundleRequestCallback(
    callback: EventCallback<EventMap['sendingBundleRequest']>,
  ): void {
    this.on('sendingBundleRequest', callback)
  }

  addReceivingBundleRequestCallback(
    callback: EventCallback<EventMap['receivingBundleRequest']>,
  ): void {
    this.on('receivingBundleRequest', callback)
  }

  addBundleRequestFailedCallback(
    callback: EventCallback<EventMap['bundleRequestFailed']>,
  ): void {
    this.on('bundleRequestFailed', callback)
  }

  addBundleRequestSentCallback(
    callback: EventCallback<EventMap['bundleRequestSent']>,
  ): void {
    this.on('bundleRequestSent', callback)
  }

  addBundleRequestReceivedCallback(
    callback: EventCallback<EventMap['bundleRequestReceived']>,
  ): void {
    this.on('bundleRequestReceived', callback)
  }

  addBundleTransferredCallback(
    callback: EventCallback<EventMap['bundleTransferred']>,
  ): void {
    this.on('bundleTransferred', callback)
  }

  // Segment recovery event callbacks (JIP-3: 160-178)
  addWorkPackageHashMappedCallback(
    callback: EventCallback<EventMap['workPackageHashMapped']>,
  ): void {
    this.on('workPackageHashMapped', callback)
  }

  addSegmentsRootMappedCallback(
    callback: EventCallback<EventMap['segmentsRootMapped']>,
  ): void {
    this.on('segmentsRootMapped', callback)
  }

  addSendingSegmentShardRequestCallback(
    callback: EventCallback<EventMap['sendingSegmentShardRequest']>,
  ): void {
    this.on('sendingSegmentShardRequest', callback)
  }

  addReceivingSegmentShardRequestCallback(
    callback: EventCallback<EventMap['receivingSegmentShardRequest']>,
  ): void {
    this.on('receivingSegmentShardRequest', callback)
  }

  addSegmentShardRequestFailedCallback(
    callback: EventCallback<EventMap['segmentShardRequestFailed']>,
  ): void {
    this.on('segmentShardRequestFailed', callback)
  }

  addSegmentShardRequestSentCallback(
    callback: EventCallback<EventMap['segmentShardRequestSent']>,
  ): void {
    this.on('segmentShardRequestSent', callback)
  }

  addSegmentShardRequestReceivedCallback(
    callback: EventCallback<EventMap['segmentShardRequestReceived']>,
  ): void {
    this.on('segmentShardRequestReceived', callback)
  }

  addSegmentShardsTransferredCallback(
    callback: EventCallback<EventMap['segmentShardsTransferred']>,
  ): void {
    this.on('segmentShardsTransferred', callback)
  }

  addReconstructingSegmentsCallback(
    callback: EventCallback<EventMap['reconstructingSegments']>,
  ): void {
    this.on('reconstructingSegments', callback)
  }

  addSegmentReconstructionFailedCallback(
    callback: EventCallback<EventMap['segmentReconstructionFailed']>,
  ): void {
    this.on('segmentReconstructionFailed', callback)
  }

  addSegmentsReconstructedCallback(
    callback: EventCallback<EventMap['segmentsReconstructed']>,
  ): void {
    this.on('segmentsReconstructed', callback)
  }

  addSegmentVerificationFailedCallback(
    callback: EventCallback<EventMap['segmentVerificationFailed']>,
  ): void {
    this.on('segmentVerificationFailed', callback)
  }

  addSegmentsVerifiedCallback(
    callback: EventCallback<EventMap['segmentsVerified']>,
  ): void {
    this.on('segmentsVerified', callback)
  }

  addSendingSegmentRequestCallback(
    callback: EventCallback<EventMap['sendingSegmentRequest']>,
  ): void {
    this.on('sendingSegmentRequest', callback)
  }

  addReceivingSegmentRequestCallback(
    callback: EventCallback<EventMap['receivingSegmentRequest']>,
  ): void {
    this.on('receivingSegmentRequest', callback)
  }

  addSegmentRequestFailedCallback(
    callback: EventCallback<EventMap['segmentRequestFailed']>,
  ): void {
    this.on('segmentRequestFailed', callback)
  }

  addSegmentRequestSentCallback(
    callback: EventCallback<EventMap['segmentRequestSent']>,
  ): void {
    this.on('segmentRequestSent', callback)
  }

  addSegmentRequestReceivedCallback(
    callback: EventCallback<EventMap['segmentRequestReceived']>,
  ): void {
    this.on('segmentRequestReceived', callback)
  }

  addSegmentsTransferredCallback(
    callback: EventCallback<EventMap['segmentsTransferred']>,
  ): void {
    this.on('segmentsTransferred', callback)
  }

  // Preimage distribution event callbacks (JIP-3: 190-199)
  addPreimageAnnouncementFailedCallback(
    callback: EventCallback<EventMap['preimageAnnouncementFailed']>,
  ): void {
    this.on('preimageAnnouncementFailed', callback)
  }

  addPreimageAnnouncedCallback(
    callback: EventCallback<EventMap['preimageAnnounced']>,
  ): void {
    this.on('preimageAnnounced', callback)
  }

  addAnnouncedPreimageForgottenCallback(
    callback: EventCallback<EventMap['announcedPreimageForgotten']>,
  ): void {
    this.on('announcedPreimageForgotten', callback)
  }

  addSendingPreimageRequestCallback(
    callback: EventCallback<EventMap['sendingPreimageRequest']>,
  ): void {
    this.on('sendingPreimageRequest', callback)
  }

  addReceivingPreimageRequestCallback(
    callback: EventCallback<EventMap['receivingPreimageRequest']>,
  ): void {
    this.on('receivingPreimageRequest', callback)
  }

  addPreimageRequestFailedCallback(
    callback: EventCallback<EventMap['preimageRequestFailed']>,
  ): void {
    this.on('preimageRequestFailed', callback)
  }

  addPreimageRequestSentCallback(
    callback: EventCallback<EventMap['preimageRequestSent']>,
  ): void {
    this.on('preimageRequestSent', callback)
  }

  addPreimageRequestReceivedCallback(
    callback: EventCallback<EventMap['preimageRequestReceived']>,
  ): void {
    this.on('preimageRequestReceived', callback)
  }

  addPreimageTransferredCallback(
    callback: EventCallback<EventMap['preimageTransferred']>,
  ): void {
    this.on('preimageTransferred', callback)
  }

  addPreimageDiscardedCallback(
    callback: EventCallback<EventMap['preimageDiscarded']>,
  ): void {
    this.on('preimageDiscarded', callback)
  }

  addGeneratingTicketsCallback(
    callback: EventCallback<EventMap['generatingTickets']>,
  ): void {
    this.on('generatingTickets', callback)
  }

  addTicketGenerationFailedCallback(
    callback: EventCallback<EventMap['ticketGenerationFailed']>,
  ): void {
    this.on('ticketGenerationFailed', callback)
  }

  addTicketsGeneratedCallback(
    callback: EventCallback<EventMap['ticketsGenerated']>,
  ): void {
    this.on('ticketsGenerated', callback)
  }

  addTicketTransferFailedCallback(
    callback: EventCallback<EventMap['ticketTransferFailed']>,
  ): void {
    this.on('ticketTransferFailed', callback)
  }

  addTicketTransferredCallback(
    callback: EventCallback<EventMap['ticketTransferred']>,
  ): void {
    this.on('ticketTransferred', callback)
  }

  addWorkPackageBeingSharedCallback(
    callback: EventCallback<EventMap['workPackageBeingShared']>,
  ): void {
    this.on('workPackageBeingShared', callback)
  }

  addWorkPackageFailedCallback(
    callback: EventCallback<EventMap['workPackageFailed']>,
  ): void {
    this.on('workPackageFailed', callback)
  }

  addDuplicateWorkPackageCallback(
    callback: EventCallback<EventMap['duplicateWorkPackage']>,
  ): void {
    this.on('duplicateWorkPackage', callback)
  }

  addWorkPackageSubmissionReceivedCallback(
    callback: EventCallback<EventMap['workPackageSubmissionReceived']>,
  ): void {
    this.on('workPackageSubmissionReceived', callback)
  }

  addAuthorizedCallback(callback: EventCallback<EventMap['authorized']>): void {
    this.on('authorized', callback)
  }

  addExtrinsicDataReceivedCallback(
    callback: EventCallback<EventMap['extrinsicDataReceived']>,
  ): void {
    this.on('extrinsicDataReceived', callback)
  }

  addImportsReceivedCallback(
    callback: EventCallback<EventMap['importsReceived']>,
  ): void {
    this.on('importsReceived', callback)
  }

  addSharingWorkPackageCallback(
    callback: EventCallback<EventMap['sharingWorkPackage']>,
  ): void {
    this.on('sharingWorkPackage', callback)
  }

  addWorkPackageSharingFailedCallback(
    callback: EventCallback<EventMap['workPackageSharingFailed']>,
  ): void {
    this.on('workPackageSharingFailed', callback)
  }

  addBundleSentCallback(callback: EventCallback<EventMap['bundleSent']>): void {
    this.on('bundleSent', callback)
  }

  addRefinedCallback(callback: EventCallback<EventMap['refined']>): void {
    this.on('refined', callback)
  }

  addWorkReportBuiltCallback(
    callback: EventCallback<EventMap['workReportBuilt']>,
  ): void {
    this.on('workReportBuilt', callback)
  }

  addWorkReportSignatureSentCallback(
    callback: EventCallback<EventMap['workReportSignatureSent']>,
  ): void {
    this.on('workReportSignatureSent', callback)
  }

  addWorkReportSignatureReceivedCallback(
    callback: EventCallback<EventMap['workReportSignatureReceived']>,
  ): void {
    this.on('workReportSignatureReceived', callback)
  }

  addGuaranteeBuiltCallback(
    callback: EventCallback<EventMap['guaranteeBuilt']>,
  ): void {
    this.on('guaranteeBuilt', callback)
  }

  addSendingGuaranteeCallback(
    callback: EventCallback<EventMap['sendingGuarantee']>,
  ): void {
    this.on('sendingGuarantee', callback)
  }

  addGuaranteeSendFailedCallback(
    callback: EventCallback<EventMap['guaranteeSendFailed']>,
  ): void {
    this.on('guaranteeSendFailed', callback)
  }

  addGuaranteeSentCallback(
    callback: EventCallback<EventMap['guaranteeSent']>,
  ): void {
    this.on('guaranteeSent', callback)
  }

  addGuaranteesDistributedCallback(
    callback: EventCallback<EventMap['guaranteesDistributed']>,
  ): void {
    this.on('guaranteesDistributed', callback)
  }

  addReceivingGuaranteeCallback(
    callback: EventCallback<EventMap['receivingGuarantee']>,
  ): void {
    this.on('receivingGuarantee', callback)
  }

  addGuaranteeReceiveFailedCallback(
    callback: EventCallback<EventMap['guaranteeReceiveFailed']>,
  ): void {
    this.on('guaranteeReceiveFailed', callback)
  }

  addGuaranteeReceivedCallback(
    callback: EventCallback<EventMap['guaranteeReceived']>,
  ): void {
    this.on('guaranteeReceived', callback)
  }

  addGuaranteeDiscardedCallback(
    callback: EventCallback<EventMap['guaranteeDiscarded']>,
  ): void {
    this.on('guaranteeDiscarded', callback)
  }

  addWorkReportAvailableCallback(
    callback: EventCallback<EventMap['workReportAvailable']>,
  ): void {
    this.on('workReportAvailable', callback)
  }

  addNegativeJudgmentReceivedCallback(
    callback: EventCallback<EventMap['negativeJudgmentReceived']>,
  ): void {
    this.on('negativeJudgmentReceived', callback)
  }

  addAuditAnnouncementReceivedCallback(
    callback: EventCallback<EventMap['auditAnnouncementReceived']>,
  ): void {
    this.on('auditAnnouncementReceived', callback)
  }

  addJudgmentPublishedCallback(
    callback: EventCallback<EventMap['judgmentPublished']>,
  ): void {
    this.on('judgmentPublished', callback)
  }

  addBlockProcessedCallback(
    callback: EventCallback<EventMap['blockProcessed']>,
  ): void {
    this.on('blockProcessed', callback)
  }

  addWorkReportProcessedCallback(
    callback: EventCallback<EventMap['workReportProcessed']>,
  ): void {
    this.on('workReportProcessed', callback)
  }

  addWorkReportJudgmentCallback(
    callback: EventCallback<EventMap['workReportJudgment']>,
  ): void {
    this.on('workReportJudgment', callback)
  }

  addWorkPackageSharingCallback(
    callback: EventCallback<EventMap['workPackageSharing']>,
  ): void {
    this.on('workPackageSharing', callback)
  }

  addWorkPackageSharingResponseCallback(
    callback: EventCallback<EventMap['workPackageSharingResponse']>,
  ): void {
    this.on('workPackageSharingResponse', callback)
  }

  addPreimageAnnouncementCallback(
    callback: EventCallback<EventMap['preimageAnnouncementReceived']>,
  ): void {
    this.on('preimageAnnouncementReceived', callback)
  }

  addPreimageRequestedCallback(
    callback: EventCallback<EventMap['preimageRequested']>,
  ): void {
    this.on('preimageRequested', callback)
  }

  addPreimageReceivedCallback(
    callback: EventCallback<EventMap['preimageReceived']>,
  ): void {
    this.on('preimageReceived', callback)
  }

  addAssuranceReceivedCallback(
    callback: EventCallback<EventMap['assuranceReceived']>,
  ): void {
    this.on('assuranceReceived', callback)
  }

  addAuditShardRequestCallback(
    callback: EventCallback<EventMap['auditShardRequest']>,
  ): void {
    this.on('auditShardRequest', callback)
  }

  addAuditShardResponseCallback(
    callback: EventCallback<EventMap['auditShardResponse']>,
  ): void {
    this.on('auditShardResponse', callback)
  }

  addSegmentShardRequestCallback(
    callback: EventCallback<EventMap['segmentShardRequest']>,
  ): void {
    this.on('segmentShardRequest', callback)
  }

  addSegmentShardResponseCallback(
    callback: EventCallback<EventMap['segmentShardResponse']>,
  ): void {
    this.on('segmentShardResponse', callback)
  }

  addShardDistributionRequestCallback(
    callback: EventCallback<EventMap['shardDistributionRequest']>,
  ): void {
    this.on('shardDistributionRequest', callback)
  }

  addShardDistributionResponseCallback(
    callback: EventCallback<EventMap['shardDistributionResponse']>,
  ): void {
    this.on('shardDistributionResponse', callback)
  }

  addWorkReportRequestCallback(
    callback: EventCallback<EventMap['workReportRequest']>,
  ): void {
    this.on('workReportRequest', callback)
  }

  addWorkReportResponseCallback(
    callback: EventCallback<EventMap['workReportResponse']>,
  ): void {
    this.on('workReportResponse', callback)
  }

  addWorkReportDistributionRequestCallback(
    callback: EventCallback<EventMap['workReportDistributionRequest']>,
  ): void {
    this.on('workReportDistributionRequest', callback)
  }

  addStateRequestedCallback(
    callback: EventCallback<EventMap['stateRequested']>,
  ): void {
    this.on('stateRequested', callback)
  }

  addStateResponseCallback(
    callback: EventCallback<EventMap['stateResponse']>,
  ): void {
    this.on('stateResponse', callback)
  }

  addTicketDistributionRequestCallback(
    callback: EventCallback<EventMap['ticketDistributionRequest']>,
  ): void {
    this.on('ticketDistributionRequest', callback)
  }

  addTicketDistributionResponseCallback(
    callback: EventCallback<EventMap['ticketDistributionResponse']>,
  ): void {
    this.on('ticketDistributionResponse', callback)
  }

  addFirstPhaseTicketDistributionCallback(
    callback: EventCallback<EventMap['firstPhaseTicketDistribution']>,
  ): void {
    this.on('firstPhaseTicketDistribution', callback)
  }

  addSecondPhaseTicketDistributionCallback(
    callback: EventCallback<EventMap['secondPhaseTicketDistribution']>,
  ): void {
    this.on('secondPhaseTicketDistribution', callback)
  }

  addAssuranceDistributionCallback(
    callback: EventCallback<EventMap['assuranceDistribution']>,
  ): void {
    this.on('assuranceDistribution', callback)
  }

  addAuditTrancheCallback(
    callback: EventCallback<EventMap['auditTranche']>,
  ): void {
    this.on('auditTranche', callback)
  }

  // Remove methods (aliases)
  removeSlotChangeCallback(
    callback: EventCallback<EventMap['slotChange']>,
  ): void {
    this.off('slotChange', callback)
  }

  removeEpochTransitionCallback(
    callback: EventCallback<EventMap['epochTransition']>,
  ): void {
    this.off('epochTransition', callback)
  }

  removeValidatorSetChangeCallback(
    callback: EventCallback<EventMap['validatorSetChange']>,
  ): void {
    this.off('validatorSetChange', callback)
  }

  removeConectivityChangeCallback(
    callback: EventCallback<EventMap['conectivityChange']>,
  ): void {
    this.off('conectivityChange', callback)
  }

  removeFirstPhaseTicketDistributionCallback(
    callback: EventCallback<EventMap['firstPhaseTicketDistribution']>,
  ): void {
    this.off('firstPhaseTicketDistribution', callback)
  }

  removeSecondPhaseTicketDistributionCallback(
    callback: EventCallback<EventMap['secondPhaseTicketDistribution']>,
  ): void {
    this.off('secondPhaseTicketDistribution', callback)
  }

  removeAssuranceDistributionCallback(
    callback: EventCallback<EventMap['assuranceDistribution']>,
  ): void {
    this.off('assuranceDistribution', callback)
  }

  removeAuditTrancheCallback(
    callback: EventCallback<EventMap['auditTranche']>,
  ): void {
    this.off('auditTranche', callback)
  }

  removeAssuranseReceivedCallback(
    callback: EventCallback<EventMap['assuranceReceived']>,
  ): void {
    this.off('assuranceReceived', callback)
  }

  removeAuthoringCallback(
    callback: EventCallback<EventMap['authoring']>,
  ): void {
    this.off('authoring', callback)
  }

  removeAuthoringFailedCallback(
    callback: EventCallback<EventMap['authoringFailed']>,
  ): void {
    this.off('authoringFailed', callback)
  }

  removeAuthoredCallback(callback: EventCallback<EventMap['authored']>): void {
    this.off('authored', callback)
  }

  removeImportingCallback(
    callback: EventCallback<EventMap['importing']>,
  ): void {
    this.off('importing', callback)
  }

  removeBlockVerificationFailedCallback(
    callback: EventCallback<EventMap['blockVerificationFailed']>,
  ): void {
    this.off('blockVerificationFailed', callback)
  }

  removeBlockVerifiedCallback(
    callback: EventCallback<EventMap['blockVerified']>,
  ): void {
    this.off('blockVerified', callback)
  }

  removeBlockExecutionFailedCallback(
    callback: EventCallback<EventMap['blockExecutionFailed']>,
  ): void {
    this.off('blockExecutionFailed', callback)
  }

  removeBlockExecutedCallback(
    callback: EventCallback<EventMap['blockExecuted']>,
  ): void {
    this.off('blockExecuted', callback)
  }

  removeBestBlockChangedCallback(
    callback: EventCallback<EventMap['bestBlockChanged']>,
  ): void {
    this.off('bestBlockChanged', callback)
  }

  removeFinalizedBlockChangedCallback(
    callback: EventCallback<EventMap['finalizedBlockChanged']>,
  ): void {
    this.off('finalizedBlockChanged', callback)
  }

  removeSyncStatusChangedCallback(
    callback: EventCallback<EventMap['syncStatusChanged']>,
  ): void {
    this.off('syncStatusChanged', callback)
  }

  removeStatusCallback(callback: EventCallback<EventMap['status']>): void {
    this.off('status', callback)
  }

  removeGeneratingTicketsCallback(
    callback: EventCallback<EventMap['generatingTickets']>,
  ): void {
    this.off('generatingTickets', callback)
  }

  removeTicketGenerationFailedCallback(
    callback: EventCallback<EventMap['ticketGenerationFailed']>,
  ): void {
    this.off('ticketGenerationFailed', callback)
  }

  removeTicketsGeneratedCallback(
    callback: EventCallback<EventMap['ticketsGenerated']>,
  ): void {
    this.off('ticketsGenerated', callback)
  }

  removeConnectionRefusedCallback(
    callback: EventCallback<EventMap['connectionRefused']>,
  ): void {
    this.off('connectionRefused', callback)
  }

  removeConnectingInCallback(
    callback: EventCallback<EventMap['connectingIn']>,
  ): void {
    this.off('connectingIn', callback)
  }

  removeConnectedInCallback(
    callback: EventCallback<EventMap['connectedIn']>,
  ): void {
    this.off('connectedIn', callback)
  }

  removeConnectInFailedCallback(
    callback: EventCallback<EventMap['connectInFailed']>,
  ): void {
    this.off('connectInFailed', callback)
  }

  removeConnectingOutCallback(
    callback: EventCallback<EventMap['connectingOut']>,
  ): void {
    this.off('connectingOut', callback)
  }

  removeConnectedOutCallback(
    callback: EventCallback<EventMap['connectedOut']>,
  ): void {
    this.off('connectedOut', callback)
  }

  removeConnectOutFailedCallback(
    callback: EventCallback<EventMap['connectOutFailed']>,
  ): void {
    this.off('connectOutFailed', callback)
  }

  removeDisconnectedCallback(
    callback: EventCallback<EventMap['disconnected']>,
  ): void {
    this.off('disconnected', callback)
  }

  removePeerMisbehavedCallback(
    callback: EventCallback<EventMap['peerMisbehaved']>,
  ): void {
    this.off('peerMisbehaved', callback)
  }

  removeTicketTransferFailedCallback(
    callback: EventCallback<EventMap['ticketTransferFailed']>,
  ): void {
    this.off('ticketTransferFailed', callback)
  }

  removeTicketTransferredCallback(
    callback: EventCallback<EventMap['ticketTransferred']>,
  ): void {
    this.off('ticketTransferred', callback)
  }

  removeWorkPackageBeingSharedCallback(
    callback: EventCallback<EventMap['workPackageBeingShared']>,
  ): void {
    this.off('workPackageBeingShared', callback)
  }

  removeWorkPackageFailedCallback(
    callback: EventCallback<EventMap['workPackageFailed']>,
  ): void {
    this.off('workPackageFailed', callback)
  }

  removeDuplicateWorkPackageCallback(
    callback: EventCallback<EventMap['duplicateWorkPackage']>,
  ): void {
    this.off('duplicateWorkPackage', callback)
  }

  removeWorkPackageSubmissionReceivedCallback(
    callback: EventCallback<EventMap['workPackageSubmissionReceived']>,
  ): void {
    this.off('workPackageSubmissionReceived', callback)
  }

  removeAuthorizedCallback(
    callback: EventCallback<EventMap['authorized']>,
  ): void {
    this.off('authorized', callback)
  }

  removeExtrinsicDataReceivedCallback(
    callback: EventCallback<EventMap['extrinsicDataReceived']>,
  ): void {
    this.off('extrinsicDataReceived', callback)
  }

  removeImportsReceivedCallback(
    callback: EventCallback<EventMap['importsReceived']>,
  ): void {
    this.off('importsReceived', callback)
  }

  removeSharingWorkPackageCallback(
    callback: EventCallback<EventMap['sharingWorkPackage']>,
  ): void {
    this.off('sharingWorkPackage', callback)
  }

  removeWorkPackageSharingFailedCallback(
    callback: EventCallback<EventMap['workPackageSharingFailed']>,
  ): void {
    this.off('workPackageSharingFailed', callback)
  }

  removeBundleSentCallback(
    callback: EventCallback<EventMap['bundleSent']>,
  ): void {
    this.off('bundleSent', callback)
  }

  removeRefinedCallback(callback: EventCallback<EventMap['refined']>): void {
    this.off('refined', callback)
  }

  removeWorkReportBuiltCallback(
    callback: EventCallback<EventMap['workReportBuilt']>,
  ): void {
    this.off('workReportBuilt', callback)
  }

  removeWorkReportSignatureSentCallback(
    callback: EventCallback<EventMap['workReportSignatureSent']>,
  ): void {
    this.off('workReportSignatureSent', callback)
  }

  removeWorkReportSignatureReceivedCallback(
    callback: EventCallback<EventMap['workReportSignatureReceived']>,
  ): void {
    this.off('workReportSignatureReceived', callback)
  }

  removeGuaranteeBuiltCallback(
    callback: EventCallback<EventMap['guaranteeBuilt']>,
  ): void {
    this.off('guaranteeBuilt', callback)
  }

  removeSendingGuaranteeCallback(
    callback: EventCallback<EventMap['sendingGuarantee']>,
  ): void {
    this.off('sendingGuarantee', callback)
  }

  removeGuaranteeSendFailedCallback(
    callback: EventCallback<EventMap['guaranteeSendFailed']>,
  ): void {
    this.off('guaranteeSendFailed', callback)
  }

  removeGuaranteeSentCallback(
    callback: EventCallback<EventMap['guaranteeSent']>,
  ): void {
    this.off('guaranteeSent', callback)
  }

  removeGuaranteesDistributedCallback(
    callback: EventCallback<EventMap['guaranteesDistributed']>,
  ): void {
    this.off('guaranteesDistributed', callback)
  }

  removeReceivingGuaranteeCallback(
    callback: EventCallback<EventMap['receivingGuarantee']>,
  ): void {
    this.off('receivingGuarantee', callback)
  }

  removeGuaranteeReceiveFailedCallback(
    callback: EventCallback<EventMap['guaranteeReceiveFailed']>,
  ): void {
    this.off('guaranteeReceiveFailed', callback)
  }

  removeGuaranteeReceivedCallback(
    callback: EventCallback<EventMap['guaranteeReceived']>,
  ): void {
    this.off('guaranteeReceived', callback)
  }

  removeGuaranteeDiscardedCallback(
    callback: EventCallback<EventMap['guaranteeDiscarded']>,
  ): void {
    this.off('guaranteeDiscarded', callback)
  }

  removeWorkReportAvailableCallback(
    callback: EventCallback<EventMap['workReportAvailable']>,
  ): void {
    this.off('workReportAvailable', callback)
  }

  removeNegativeJudgmentReceivedCallback(
    callback: EventCallback<EventMap['negativeJudgmentReceived']>,
  ): void {
    this.off('negativeJudgmentReceived', callback)
  }

  removeAuditAnnouncementReceivedCallback(
    callback: EventCallback<EventMap['auditAnnouncementReceived']>,
  ): void {
    this.off('auditAnnouncementReceived', callback)
  }

  removeJudgmentPublishedCallback(
    callback: EventCallback<EventMap['judgmentPublished']>,
  ): void {
    this.off('judgmentPublished', callback)
  }

  removeBlockProcessedCallback(
    callback: EventCallback<EventMap['blockProcessed']>,
  ): void {
    this.off('blockProcessed', callback)
  }

  removeWorkReportProcessedCallback(
    callback: EventCallback<EventMap['workReportProcessed']>,
  ): void {
    this.off('workReportProcessed', callback)
  }

  removeWorkReportJudgmentCallback(
    callback: EventCallback<EventMap['workReportJudgment']>,
  ): void {
    this.off('workReportJudgment', callback)
  }

  removeWorkPackageSharingCallback(
    callback: EventCallback<EventMap['workPackageSharing']>,
  ): void {
    this.off('workPackageSharing', callback)
  }

  removeWorkPackageSharingResponseCallback(
    callback: EventCallback<EventMap['workPackageSharingResponse']>,
  ): void {
    this.off('workPackageSharingResponse', callback)
  }

  removePreimageAnnouncementCallback(
    callback: EventCallback<EventMap['preimageAnnouncementReceived']>,
  ): void {
    this.off('preimageAnnouncementReceived', callback)
  }

  removePreimageRequestedCallback(
    callback: EventCallback<EventMap['preimageRequested']>,
  ): void {
    this.off('preimageRequested', callback)
  }

  removePreimageReceivedCallback(
    callback: EventCallback<EventMap['preimageReceived']>,
  ): void {
    this.off('preimageReceived', callback)
  }

  removeAuditShardRequestCallback(
    callback: EventCallback<EventMap['auditShardRequest']>,
  ): void {
    this.off('auditShardRequest', callback)
  }

  removeAuditShardResponseCallback(
    callback: EventCallback<EventMap['auditShardResponse']>,
  ): void {
    this.off('auditShardResponse', callback)
  }

  removeSegmentShardRequestCallback(
    callback: EventCallback<EventMap['segmentShardRequest']>,
  ): void {
    this.off('segmentShardRequest', callback)
  }

  removeSegmentShardResponseCallback(
    callback: EventCallback<EventMap['segmentShardResponse']>,
  ): void {
    this.off('segmentShardResponse', callback)
  }

  removeShardDistributionRequestCallback(
    callback: EventCallback<EventMap['shardDistributionRequest']>,
  ): void {
    this.off('shardDistributionRequest', callback)
  }

  removeShardDistributionResponseCallback(
    callback: EventCallback<EventMap['shardDistributionResponse']>,
  ): void {
    this.off('shardDistributionResponse', callback)
  }

  removeWorkReportRequestCallback(
    callback: EventCallback<EventMap['workReportRequest']>,
  ): void {
    this.off('workReportRequest', callback)
  }

  removeWorkReportResponseCallback(
    callback: EventCallback<EventMap['workReportResponse']>,
  ): void {
    this.off('workReportResponse', callback)
  }

  removeWorkReportDistributionRequestCallback(
    callback: EventCallback<EventMap['workReportDistributionRequest']>,
  ): void {
    this.off('workReportDistributionRequest', callback)
  }

  removeBlocksReceivedCallback(
    callback: EventCallback<EventMap['blocksReceived']>,
  ): void {
    this.off('blocksReceived', callback)
  }

  removeBlocksRequestedCallback(
    callback: EventCallback<EventMap['blocksRequested']>,
  ): void {
    this.off('blocksRequested', callback)
  }

  removeStateRequestedCallback(
    callback: EventCallback<EventMap['stateRequested']>,
  ): void {
    this.off('stateRequested', callback)
  }

  removeStateResponseCallback(
    callback: EventCallback<EventMap['stateResponse']>,
  ): void {
    this.off('stateResponse', callback)
  }

  removeTicketDistributionRequestCallback(
    callback: EventCallback<EventMap['ticketDistributionRequest']>,
  ): void {
    this.off('ticketDistributionRequest', callback)
  }

  removeTicketDistributionResponseCallback(
    callback: EventCallback<EventMap['ticketDistributionResponse']>,
  ): void {
    this.off('ticketDistributionResponse', callback)
  }

  // Emit methods with better naming (aliases)
  async emitSlotChange(event: SlotChangeEvent): Promise<void> {
    await this.emit('slotChange', event)
  }

  async emitEpochTransition(event: EpochTransitionEvent): Promise<void> {
    await this.emit('epochTransition', event)
  }

  async emitRevertEpochTransition(
    event: RevertEpochTransitionEvent,
  ): Promise<void> {
    await this.emit('revertEpochTransition', event)
  }

  async emitValidatorSetChange(event: ValidatorSetChangeEvent): Promise<void> {
    await this.emit('validatorSetChange', event)
  }

  async emitConectivityChange(event: ConectivityChangeEvent): Promise<void> {
    await this.emit('conectivityChange', event)
  }

  async emitFirstPhaseTicketDistribution(
    event: TicketDistributionEvent,
  ): Promise<void> {
    await this.emit('firstPhaseTicketDistribution', event)
  }

  async emitSecondPhaseTicketDistribution(
    event: TicketDistributionEvent,
  ): Promise<void> {
    await this.emit('secondPhaseTicketDistribution', event)
  }

  async emitAssuranceReceived(
    assurance: AssuranceDistributionRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('assuranceReceived', assurance, peerPublicKey)
  }

  async emitConnectionRefused(peerAddress: string): Promise<void> {
    await this.emit('connectionRefused', peerAddress)
  }

  async emitConnectingIn(peerAddress: string): Promise<void> {
    await this.emit('connectingIn', peerAddress)
  }

  async emitConnectedIn(eventId: bigint, peerId: Uint8Array): Promise<void> {
    await this.emit('connectedIn', eventId, peerId)
  }

  async emitConnectInFailed(eventId: bigint, reason: string): Promise<void> {
    await this.emit('connectInFailed', eventId, reason)
  }

  async emitConnectingOut(
    peerId: Uint8Array,
    peerAddress: string,
  ): Promise<void> {
    await this.emit('connectingOut', peerId, peerAddress)
  }

  async emitConnectedOut(eventId: bigint): Promise<void> {
    await this.emit('connectedOut', eventId)
  }

  async emitConnectOutFailed(eventId: bigint, reason: string): Promise<void> {
    await this.emit('connectOutFailed', eventId, reason)
  }

  async emitDisconnected(
    peerId: Uint8Array,
    reason: string,
    terminator?: 'local' | 'remote',
  ): Promise<void> {
    await this.emit('disconnected', peerId, reason, terminator)
  }

  async emitPeerMisbehaved(peerId: Uint8Array, reason: string): Promise<void> {
    await this.emit('peerMisbehaved', peerId, reason)
  }

  async emitAuthoring(slot: bigint, parentHeaderHash: Hex): Promise<void> {
    await this.emit('authoring', slot, parentHeaderHash)
  }

  async emitAuthoringFailed(eventId: bigint, reason: string): Promise<void> {
    await this.emit('authoringFailed', eventId, reason)
  }

  async emitAuthored(block: Block): Promise<void> {
    await this.emit('authored', block)
  }

  async emitImporting(slot: bigint, block: Block): Promise<void> {
    await this.emit('importing', slot, block.header.parent)
  }

  async emitBlockVerificationFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('blockVerificationFailed', eventId, reason)
  }

  async emitBlockVerified(eventId: bigint): Promise<void> {
    await this.emit('blockVerified', eventId)
  }

  async emitBlockExecutionFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('blockExecutionFailed', eventId, reason)
  }

  async emitBlockExecuted(
    eventId: bigint,
    accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>,
  ): Promise<void> {
    await this.emit('blockExecuted', eventId, accumulatedServices)
  }

  async emitBestBlockChanged(blockHeader: BlockHeader): Promise<void> {
    await this.emit('bestBlockChanged', blockHeader)
  }

  async emitFinalizedBlockChanged(blockHeader: BlockHeader): Promise<void> {
    await this.emit('finalizedBlockChanged', blockHeader)
  }

  async emitSyncStatusChanged(isSynced: boolean): Promise<void> {
    await this.emit('syncStatusChanged', isSynced)
  }

  async emitStatus(status: StatusEvent): Promise<void> {
    await this.emit('status', status)
  }

  async emitGeneratingTickets(epochIndex: bigint): Promise<void> {
    await this.emit('generatingTickets', epochIndex)
  }

  async emitTicketGenerationFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('ticketGenerationFailed', eventId, reason)
  }

  async emitTicketsGenerated(
    eventId: bigint,
    ticketVrfOutputs: Uint8Array[],
  ): Promise<void> {
    await this.emit('ticketsGenerated', eventId, ticketVrfOutputs)
  }

  async emitPreimageAnnouncementReceived(
    announcement: PreimageAnnouncement,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('preimageAnnouncementReceived', announcement, peerPublicKey)
  }

  async emitWorkReportAvailable(
    workReport: WorkReport,
    coreIndex: bigint,
    blockHeaderHash: Hex,
  ): Promise<void> {
    await this.emit(
      'workReportAvailable',
      workReport,
      coreIndex,
      blockHeaderHash,
    )
  }

  async emitNegativeJudgmentReceived(
    judgment: Judgment,
    workReportHash: Hex,
    validatorIndex: bigint,
  ): Promise<void> {
    await this.emit(
      'negativeJudgmentReceived',
      judgment,
      workReportHash,
      validatorIndex,
    )
  }

  async emitAuditAnnouncementReceived(
    announcement: AuditAnnouncement,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('auditAnnouncementReceived', announcement, peerPublicKey)
  }

  async emitJudgmentPublished(
    judgment: Judgment,
    workReportHash: Hex,
    validatorIndex: bigint,
  ): Promise<void> {
    await this.emit(
      'judgmentPublished',
      judgment,
      workReportHash,
      validatorIndex,
    )
  }

  async emitBlockProcessed(event: BlockProcessedEvent): Promise<void> {
    await this.emit('blockProcessed', event)
  }

  async emitWorkReportProcessed(
    event: WorkReportProcessedEvent,
  ): Promise<void> {
    await this.emit('workReportProcessed', event)
  }

  async emitWorkReportJudgment(event: WorkReportJudgmentEvent): Promise<void> {
    await this.emit('workReportJudgment', event)
  }

  async emitWorkPackageReceived(
    data: WorkPackageSubmissionRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workPackageSubmissionReceived', data, peerPublicKey)
  }

  async emitWorkPackageSharing(
    sharing: WorkPackageSharing,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workPackageSharing', sharing, peerPublicKey)
  }

  async emitWorkPackageSharingResponse(
    response: WorkPackageSharingResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workPackageSharingResponse', response, peerPublicKey)
  }

  async emitPreimageRequested(
    request: PreimageRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('preimageRequested', request, peerPublicKey)
  }

  async emitPreimageReceived(
    preimage: Preimage,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('preimageReceived', preimage, peerPublicKey)
  }

  async emitAuditShardRequest(
    request: AuditShardRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('auditShardRequest', request, peerPublicKey)
  }

  async emitAuditShardResponse(
    response: AuditShardResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('auditShardResponse', response, peerPublicKey)
  }

  async emitSegmentShardRequest(
    request: SegmentShardRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('segmentShardRequest', request, peerPublicKey)
  }

  async emitSegmentShardResponse(
    response: SegmentShardResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('segmentShardResponse', response, peerPublicKey)
  }

  async emitShardDistributionRequest(
    request: ShardDistributionRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('shardDistributionRequest', request, peerPublicKey)
  }

  async emitShardDistributionResponse(
    response: ShardDistributionResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('shardDistributionResponse', response, peerPublicKey)
  }

  async emitWorkReportRequest(
    request: WorkReportRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workReportRequest', request, peerPublicKey)
  }

  async emitWorkReportResponse(
    response: WorkReportResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workReportResponse', response, peerPublicKey)
  }

  async emitWorkReportDistributionRequest(
    request: GuaranteedWorkReport,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('workReportDistributionRequest', request, peerPublicKey)
  }

  async emitTicketDistributionRequest(
    request: TicketDistributionRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('ticketDistributionRequest', request, peerPublicKey)
  }

  async emitTicketDistributionResponse(
    response: TicketDistributionResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('ticketDistributionResponse', response, peerPublicKey)
  }

  async emitBlocksReceived(blocks: Block[], peerPublicKey: Hex): Promise<void> {
    await this.emit('blocksReceived', blocks, peerPublicKey)
  }

  async emitBlocksRequested(
    request: BlockRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('blocksRequested', request, peerPublicKey)
  }

  async emitStateRequested(
    request: StateRequest,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('stateRequested', request, peerPublicKey)
  }

  async emitStateResponse(
    response: StateResponse,
    peerPublicKey: Hex,
  ): Promise<void> {
    await this.emit('stateResponse', response, peerPublicKey)
  }

  async emitAssuranceDistribution(
    event: AssuranceDistributionEvent,
  ): Promise<void> {
    await this.emit('assuranceDistribution', event)
  }

  async emitAuditTranche(event: AuditTrancheEvent): Promise<void> {
    await this.emit('auditTranche', event)
  }

  // Block distribution events (JIP-3: 60-68)
  async emitBlockAnnouncementStreamOpened(
    peerId: Uint8Array,
    connectionSide: 'local' | 'remote',
  ): Promise<void> {
    await this.emit('blockAnnouncementStreamOpened', peerId, connectionSide)
  }

  async emitBlockAnnouncementStreamClosed(
    peerId: Uint8Array,
    connectionSide: 'local' | 'remote',
    reason: string,
  ): Promise<void> {
    await this.emit(
      'blockAnnouncementStreamClosed',
      peerId,
      connectionSide,
      reason,
    )
  }

  async emitBlockAnnounced(
    peerId: Uint8Array,
    connectionSide: 'local' | 'remote',
    slot: bigint,
    headerHash: Uint8Array,
  ): Promise<void> {
    await this.emit('blockAnnounced', peerId, connectionSide, slot, headerHash)
  }

  async emitBlockAnnouncementWithHeader(
    peerId: Uint8Array,
    header: BlockHeader,
  ): Promise<void> {
    await this.emit('blockAnnouncementWithHeader', peerId, header)
  }

  async emitBlockAnnouncementHandshake(
    peerId: Uint8Array,
    handshake: BlockAnnouncementHandshake,
  ): Promise<void> {
    await this.emit('blockAnnouncementHandshake', peerId, handshake)
  }

  async emitSendingBlockRequest(
    peerId: Uint8Array,
    headerHash: Uint8Array,
    direction: 'ascending_exclusive' | 'descending_inclusive',
    maxBlocks: bigint,
  ): Promise<bigint> {
    // Generate event ID for linking
    const eventId = BigInt(Date.now())
    await this.emit(
      'sendingBlockRequest',
      peerId,
      headerHash,
      direction,
      maxBlocks,
    )
    return eventId
  }

  async emitReceivingBlockRequest(peerId: Uint8Array): Promise<bigint> {
    // Generate event ID for linking
    const eventId = BigInt(Date.now())
    await this.emit('receivingBlockRequest', peerId)
    return eventId
  }

  async emitBlockRequestFailed(eventId: bigint, reason: string): Promise<void> {
    await this.emit('blockRequestFailed', eventId, reason)
  }

  async emitBlockRequestSent(eventId: bigint): Promise<void> {
    await this.emit('blockRequestSent', eventId)
  }

  async emitBlockRequestReceived(
    eventId: bigint,
    headerHash: Uint8Array,
    direction: 'ascending_exclusive' | 'descending_inclusive',
    maxBlocks: bigint,
  ): Promise<void> {
    await this.emit(
      'blockRequestReceived',
      eventId,
      headerHash,
      direction,
      maxBlocks,
    )
  }

  async emitBlockTransferred(
    eventId: bigint,
    slot: bigint,
    blockOutline: BlockOutline,
    isLastBlock: boolean,
  ): Promise<void> {
    await this.emit(
      'blockTransferred',
      eventId,
      slot,
      blockOutline,
      isLastBlock,
    )
  }

  // Availability distribution events (JIP-3: 120-131)
  async emitSendingShardRequest(
    peerId: Uint8Array,
    erasureRoot: Uint8Array,
    shardIndex: bigint,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('sendingShardRequest', peerId, erasureRoot, shardIndex)
    return eventId
  }

  async emitReceivingShardRequest(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingShardRequest', peerId)
    return eventId
  }

  async emitShardRequestFailed(eventId: bigint, reason: string): Promise<void> {
    await this.emit('shardRequestFailed', eventId, reason)
  }

  async emitShardRequestSent(eventId: bigint): Promise<void> {
    await this.emit('shardRequestSent', eventId)
  }

  async emitShardRequestReceived(
    eventId: bigint,
    erasureRoot: Uint8Array,
    shardIndex: bigint,
  ): Promise<void> {
    await this.emit('shardRequestReceived', eventId, erasureRoot, shardIndex)
  }

  async emitShardsTransferred(eventId: bigint): Promise<void> {
    await this.emit('shardsTransferred', eventId)
  }

  async emitDistributingAssurance(
    headerHash: Uint8Array,
    availabilityBitfield: Uint8Array,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('distributingAssurance', headerHash, availabilityBitfield)
    return eventId
  }

  async emitAssuranceSendFailed(
    eventId: bigint,
    peerId: Uint8Array,
    reason: string,
  ): Promise<void> {
    await this.emit('assuranceSendFailed', eventId, peerId, reason)
  }

  async emitAssuranceSent(eventId: bigint, peerId: Uint8Array): Promise<void> {
    await this.emit('assuranceSent', eventId, peerId)
  }

  async emitAssuranceDistributed(eventId: bigint): Promise<void> {
    await this.emit('assuranceDistributed', eventId)
  }

  async emitAssuranceReceiveFailed(
    peerId: Uint8Array,
    reason: string,
  ): Promise<void> {
    await this.emit('assuranceReceiveFailed', peerId, reason)
  }

  // Bundle recovery events (JIP-3: 140-153)
  async emitSendingBundleShardRequest(
    auditEventId: bigint,
    peerId: Uint8Array,
    shardIndex: bigint,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit(
      'sendingBundleShardRequest',
      auditEventId,
      peerId,
      shardIndex,
    )
    return eventId
  }

  async emitReceivingBundleShardRequest(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingBundleShardRequest', peerId)
    return eventId
  }

  async emitBundleShardRequestFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('bundleShardRequestFailed', eventId, reason)
  }

  async emitBundleShardRequestSent(eventId: bigint): Promise<void> {
    await this.emit('bundleShardRequestSent', eventId)
  }

  async emitBundleShardRequestReceived(
    eventId: bigint,
    erasureRoot: Uint8Array,
    shardIndex: bigint,
  ): Promise<void> {
    await this.emit(
      'bundleShardRequestReceived',
      eventId,
      erasureRoot,
      shardIndex,
    )
  }

  async emitBundleShardTransferred(eventId: bigint): Promise<void> {
    await this.emit('bundleShardTransferred', eventId)
  }

  async emitReconstructingBundle(
    auditEventId: bigint,
    isTrivial: boolean,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('reconstructingBundle', auditEventId, isTrivial)
    return eventId
  }

  async emitBundleReconstructed(eventId: bigint): Promise<void> {
    await this.emit('bundleReconstructed', eventId)
  }

  async emitSendingBundleRequest(
    auditEventId: bigint,
    peerId: Uint8Array,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('sendingBundleRequest', auditEventId, peerId)
    return eventId
  }

  async emitReceivingBundleRequest(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingBundleRequest', peerId)
    return eventId
  }

  async emitBundleRequestFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('bundleRequestFailed', eventId, reason)
  }

  async emitBundleRequestSent(eventId: bigint): Promise<void> {
    await this.emit('bundleRequestSent', eventId)
  }

  async emitBundleRequestReceived(
    eventId: bigint,
    erasureRoot: Uint8Array,
  ): Promise<void> {
    await this.emit('bundleRequestReceived', eventId, erasureRoot)
  }

  async emitBundleTransferred(eventId: bigint): Promise<void> {
    await this.emit('bundleTransferred', eventId)
  }

  // Segment recovery events (JIP-3: 160-178)
  async emitWorkPackageHashMapped(
    workPackageEventId: bigint,
    workPackageHash: Uint8Array,
    segmentsRoot: Uint8Array,
  ): Promise<void> {
    await this.emit(
      'workPackageHashMapped',
      workPackageEventId,
      workPackageHash,
      segmentsRoot,
    )
  }

  async emitSegmentsRootMapped(
    workPackageEventId: bigint,
    segmentsRoot: Uint8Array,
    erasureRoot: Uint8Array,
  ): Promise<void> {
    await this.emit(
      'segmentsRootMapped',
      workPackageEventId,
      segmentsRoot,
      erasureRoot,
    )
  }

  async emitSendingSegmentShardRequest(
    workPackageEventId: bigint,
    peerId: Uint8Array,
    usingCE140: boolean,
    requests: Array<{ segmentId: bigint; shardIndex: bigint }>,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit(
      'sendingSegmentShardRequest',
      workPackageEventId,
      peerId,
      usingCE140,
      requests,
    )
    return eventId
  }

  async emitReceivingSegmentShardRequest(
    peerId: Uint8Array,
    usingCE140: boolean,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingSegmentShardRequest', peerId, usingCE140)
    return eventId
  }

  async emitSegmentShardRequestFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('segmentShardRequestFailed', eventId, reason)
  }

  async emitSegmentShardRequestSent(eventId: bigint): Promise<void> {
    await this.emit('segmentShardRequestSent', eventId)
  }

  async emitSegmentShardRequestReceived(
    eventId: bigint,
    shardCount: bigint,
  ): Promise<void> {
    await this.emit('segmentShardRequestReceived', eventId, shardCount)
  }

  async emitSegmentShardsTransferred(eventId: bigint): Promise<void> {
    await this.emit('segmentShardsTransferred', eventId)
  }

  async emitReconstructingSegments(
    workPackageEventId: bigint,
    segmentIds: bigint[],
    isTrivial: boolean,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit(
      'reconstructingSegments',
      workPackageEventId,
      segmentIds,
      isTrivial,
    )
    return eventId
  }

  async emitSegmentReconstructionFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('segmentReconstructionFailed', eventId, reason)
  }

  async emitSegmentsReconstructed(eventId: bigint): Promise<void> {
    await this.emit('segmentsReconstructed', eventId)
  }

  async emitSegmentVerificationFailed(
    workPackageEventId: bigint,
    segmentIndices: bigint[],
    reason: string,
  ): Promise<void> {
    await this.emit(
      'segmentVerificationFailed',
      workPackageEventId,
      segmentIndices,
      reason,
    )
  }

  async emitSegmentsVerified(
    workPackageEventId: bigint,
    segmentIndices: bigint[],
  ): Promise<void> {
    await this.emit('segmentsVerified', workPackageEventId, segmentIndices)
  }

  async emitSendingSegmentRequest(
    workPackageEventId: bigint,
    peerId: Uint8Array,
    segmentIndices: bigint[],
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit(
      'sendingSegmentRequest',
      workPackageEventId,
      peerId,
      segmentIndices,
    )
    return eventId
  }

  async emitReceivingSegmentRequest(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingSegmentRequest', peerId)
    return eventId
  }

  async emitSegmentRequestFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('segmentRequestFailed', eventId, reason)
  }

  async emitSegmentRequestSent(eventId: bigint): Promise<void> {
    await this.emit('segmentRequestSent', eventId)
  }

  async emitSegmentRequestReceived(
    eventId: bigint,
    segmentCount: bigint,
  ): Promise<void> {
    await this.emit('segmentRequestReceived', eventId, segmentCount)
  }

  async emitSegmentsTransferred(eventId: bigint): Promise<void> {
    await this.emit('segmentsTransferred', eventId)
  }

  // Preimage distribution events (JIP-3: 190-199)
  async emitPreimageAnnouncementFailed(
    peerId: Uint8Array,
    connectionSide: 'local' | 'remote',
    reason: string,
  ): Promise<void> {
    await this.emit(
      'preimageAnnouncementFailed',
      peerId,
      connectionSide,
      reason,
    )
  }

  async emitPreimageAnnounced(
    peerId: Uint8Array,
    connectionSide: 'local' | 'remote',
    serviceId: bigint,
    hash: Uint8Array,
    length: bigint,
  ): Promise<void> {
    await this.emit(
      'preimageAnnounced',
      peerId,
      connectionSide,
      serviceId,
      hash,
      length,
    )
  }

  async emitAnnouncedPreimageForgotten(
    serviceId: bigint,
    hash: Uint8Array,
    length: bigint,
    reason: number, // AnnouncedPreimageForgetReason enum value
  ): Promise<void> {
    await this.emit(
      'announcedPreimageForgotten',
      serviceId,
      hash,
      length,
      reason,
    )
  }

  async emitSendingPreimageRequest(
    peerId: Uint8Array,
    hash: Uint8Array,
  ): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('sendingPreimageRequest', peerId, hash)
    return eventId
  }

  async emitReceivingPreimageRequest(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingPreimageRequest', peerId)
    return eventId
  }

  async emitPreimageRequestFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('preimageRequestFailed', eventId, reason)
  }

  async emitPreimageRequestSent(eventId: bigint): Promise<void> {
    await this.emit('preimageRequestSent', eventId)
  }

  async emitPreimageRequestReceived(
    eventId: bigint,
    hash: Uint8Array,
  ): Promise<void> {
    await this.emit('preimageRequestReceived', eventId, hash)
  }

  async emitPreimageTransferred(
    eventId: bigint,
    length: bigint,
  ): Promise<void> {
    await this.emit('preimageTransferred', eventId, length)
  }

  async emitPreimageDiscarded(
    hash: Uint8Array,
    length: bigint,
    reason: number, // PreimageDiscardReason enum value
  ): Promise<void> {
    await this.emit('preimageDiscarded', hash, length, reason)
  }

  // Guarantee events (JIP-3: 106-113) - missing emit methods
  async emitReceivingGuarantee(peerId: Uint8Array): Promise<bigint> {
    const eventId = BigInt(Date.now())
    await this.emit('receivingGuarantee', peerId)
    return eventId
  }

  async emitGuaranteeReceiveFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    await this.emit('guaranteeReceiveFailed', eventId, reason)
  }

  async emitGuaranteeReceived(
    eventId: bigint,
    guaranteeOutline: GuaranteeOutline,
  ): Promise<void> {
    await this.emit('guaranteeReceived', eventId, guaranteeOutline)
  }
}
