/**
 * Event Bus Service
 *
 * Centralized event system for JAM node services
 * Manages event registration and emission
 */

import {
  type AccumulateCost,
  type AuditAnnouncement,
  BaseService,
  type Block,
  type BlockBody,
  type BlockHeader,
  type GuaranteeDiscardReason,
  type GuaranteeOutline,
  type IsAuthorizedCost,
  type Judgment,
  type RefineCost,
  type ValidatorKeyTuple,
  type WorkPackageOutline,
  type WorkReport,
  type WorkReportOutline,
} from '@pbnj/types'
import type { Hex } from 'viem'
import { logger } from './logger'
import { type Safe, type SafePromise, safeResult } from './safe'

// Event types
export interface ConectivityChangeEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
  previousEpoch: bigint
  newEpoch: bigint
  previousSlotPhase: bigint // Gray Paper: m - previous slot's phase within epoch
  validatorSetChanged: boolean
}

export interface TicketDistributionEvent {
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: 'first-step' | 'second-step'
  delaySlots: bigint
  totalValidators: number
  proxyValidatorIndex?: bigint
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
  timestamp: number
  slot: bigint
  epoch: bigint
  phase: bigint
  previousEpoch: bigint
  newEpoch: bigint
  previousSlotPhase: bigint // Gray Paper: m - previous slot's phase within epoch
  validatorSetChanged: boolean
}

export interface ValidatorSetChangeEvent {
  timestamp: number
  epoch: bigint
  validators: Map<number, ValidatorKeyTuple>
}

// Statistics events
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

// Callback types
export type ConectivityChangeCallback = (
  event: ConectivityChangeEvent,
) => Safe<void> | SafePromise<void>
export type TicketDistributionCallback = (
  event: TicketDistributionEvent,
) => Safe<void> | SafePromise<void>
export type SlotChangeCallback = (
  event: SlotChangeEvent,
) => Safe<void> | SafePromise<void>
export type EpochTransitionCallback = (
  event: EpochTransitionEvent,
) => Safe<void> | SafePromise<void>
export type ValidatorSetChangeCallback = (
  event: ValidatorSetChangeEvent,
) => Safe<void> | SafePromise<void>

// Statistics callback types
export type BlockProcessedCallback = (
  event: BlockProcessedEvent,
) => Safe<void> | SafePromise<void>

export type WorkReportProcessedCallback = (
  event: WorkReportProcessedEvent,
) => Safe<void> | SafePromise<void>

export type WorkReportJudgmentCallback = (
  event: WorkReportJudgmentEvent,
) => Safe<void> | SafePromise<void>

export type ConnectionRefusedCallback = (
  peerAddress: string,
) => Safe<void> | SafePromise<void>

export type ConnectingInCallback = (
  peerAddress: string,
) => Safe<void> | SafePromise<void>

export type ConnectedInCallback = (
  eventId: bigint,
  peerId: Uint8Array,
) => Safe<void> | SafePromise<void>

export type ConnectInFailedCallback = (
  eventId: bigint,
  reason: string,
) => Safe<void> | SafePromise<void>

export type ConnectingOutCallback = (
  peerId: Uint8Array,
  peerAddress: string,
) => Safe<void> | SafePromise<void>

export type ConnectedOutCallback = (
  eventId: bigint,
) => Safe<void> | SafePromise<void>

export type ConnectOutFailedCallback = (
  eventId: bigint,
  reason: string,
) => Safe<void> | SafePromise<void>

export type DisconnectedCallback = (
  peerId: Uint8Array,
  reason: string,
  terminator?: 'local' | 'remote',
) => void | Promise<void> | SafePromise<void>

export type PeerMisbehavedCallback = (
  peerId: Uint8Array,
  reason: string,
) => Safe<void> | SafePromise<void>

export type AuthoringCallback = (
  slot: bigint,
  parentHeaderHash: Hex,
) => void | Promise<void> | SafePromise<void>

export type AuthoringFailedCallback = (
  eventId: bigint,
  reason: string,
) => Safe<void> | SafePromise<void>
export type AuthoredCallback = (block: Block) => Safe<void> | SafePromise<void>

export type ImportingCallback = (
  slot: bigint,
  parentHeaderHash: Hex,
) => Safe<void> | SafePromise<void>

export type BlockVerificationFailedCallback = (
  eventId: bigint,
  reason: string,
) => Safe<void> | SafePromise<void>

export type BlockVerifiedCallback = (
  eventId: bigint,
) => Safe<void> | SafePromise<void>

export type BlockExecutionFailedCallback = (
  eventId: bigint,
  reason: string,
) => Safe<void> | SafePromise<void>

export type BlockExecutedCallback = (
  eventId: bigint,
  accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>,
) => Safe<void> | SafePromise<void>

export type BestBlockChangedCallback = (
  blockHeader: BlockHeader,
) => Safe<void> | SafePromise<void>

export type FinalizedBlockChangedCallback = (
  blockHeader: BlockHeader,
) => Safe<void> | SafePromise<void>

export type SyncStatusChangedCallback = (
  isSynced: boolean,
) => Safe<void> | SafePromise<void>

export type StatusCallback = (status: {
  totalPeerCount: bigint
  validatorPeerCount: bigint
  blockAnnouncementStreamPeerCount: bigint
  guaranteesByCore: Uint8Array
  shardCount: bigint
  shardTotalSizeBytes: bigint
  readyPreimageCount: bigint
  readyPreimageTotalSizeBytes: bigint
}) => void | Promise<void> | SafePromise<void>

export type GeneratingTicketsCallback = (
  epochIndex: bigint,
) => void | Promise<void> | SafePromise<void>

export type TicketGenerationFailedCallback = (
  eventId: bigint,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type TicketsGeneratedCallback = (
  eventId: bigint,
  ticketVrfOutputs: Uint8Array[],
) => void | Promise<void> | SafePromise<void>

export type TicketTransferFailedCallback = (
  peerId: Uint8Array,
  connectionSide: 'local' | 'remote',
  wasCe132Used: boolean,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type TicketTransferredCallback = (
  peerId: Uint8Array,
  connectionSide: 'local' | 'remote',
  wasCe132Used: boolean,
  epochIndex: bigint,
  attemptNumber: 0n | 1n,
  vrfOutput: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type WorkPackageSubmissionCallback = (
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type WorkPackageBeingSharedCallback = (
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type WorkPackageFailedCallback = (
  workPackageEventId: bigint,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type DuplicateWorkPackageCallback = (
  workPackageEventId: bigint,
  coreIndex: bigint,
  workPackageHash: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type WorkPackageReceivedCallback = (
  workPackageEventId: bigint,
  coreIndex: bigint,
  workPackageOutline: WorkPackageOutline,
) => void | Promise<void> | SafePromise<void>

export type AuthorizedCallback = (
  workPackageEventId: bigint,
  isAuthorizedCost: IsAuthorizedCost,
) => void | Promise<void> | SafePromise<void>

export type ExtrinsicDataReceivedCallback = (
  workPackageEventId: bigint,
) => void | Promise<void> | SafePromise<void>

export type ImportsReceivedCallback = (
  workPackageEventId: bigint,
) => void | Promise<void> | SafePromise<void>

export type SharingWorkPackageCallback = (
  workPackageSubmissionEventId: bigint,
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type WorkPackageSharingFailedCallback = (
  workPackageSubmissionEventId: bigint,
  peerId: Uint8Array,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type BundleSentCallback = (
  workPackageSubmissionEventId: bigint,
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type RefinedCallback = (
  workPackageEventId: bigint,
  refineCosts: RefineCost[],
) => void | Promise<void> | SafePromise<void>

export type WorkReportBuiltCallback = (
  workPackageEventId: bigint,
  workReportOutline: WorkReportOutline,
) => void | Promise<void> | SafePromise<void>

export type WorkReportSignatureSentCallback = (
  workPackageBeingSharedEventId: bigint,
) => void | Promise<void> | SafePromise<void>

export type WorkReportSignatureReceivedCallback = (
  workPackageSubmissionEventId: bigint,
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeBuiltCallback = (
  workPackageSubmissionEventId: bigint,
  guaranteeOutline: GuaranteeOutline,
) => void | Promise<void> | SafePromise<void>

export type SendingGuaranteeCallback = (
  guaranteeBuiltEventId: bigint,
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeSendFailedCallback = (
  sendingGuaranteeEventId: bigint,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeSentCallback = (
  sendingGuaranteeEventId: bigint,
) => void | Promise<void> | SafePromise<void>

export type GuaranteesDistributedCallback = (
  workPackageSubmissionEventId: bigint,
) => void | Promise<void> | SafePromise<void>

export type ReceivingGuaranteeCallback = (
  peerId: Uint8Array,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeReceiveFailedCallback = (
  receivingGuaranteeEventId: bigint,
  reason: string,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeReceivedCallback = (
  receivingGuaranteeEventId: bigint,
  guaranteeOutline: GuaranteeOutline,
) => void | Promise<void> | SafePromise<void>

export type GuaranteeDiscardedCallback = (
  guaranteeOutline: GuaranteeOutline,
  discardReason: GuaranteeDiscardReason,
) => void | Promise<void> | SafePromise<void>

// Audit-related callback types
export type WorkReportAvailableCallback = (
  workReport: WorkReport,
  coreIndex: bigint,
  blockHeaderHash: Hex,
) => Safe<void> | SafePromise<void>

export type NegativeJudgmentReceivedCallback = (
  judgment: Judgment,
  workReportHash: Hex,
  validatorIndex: bigint,
) => Safe<void> | SafePromise<void>

export type AuditAnnouncementReceivedCallback = (
  announcement: AuditAnnouncement,
  validatorIndex: bigint,
) => Safe<void> | SafePromise<void>

export type JudgmentPublishedCallback = (
  judgment: Judgment,
  workReportHash: Hex,
  validatorIndex: bigint,
) => Safe<void> | SafePromise<void>

export class EventBusService extends BaseService {
  private slotChangeCallbacks: SlotChangeCallback[] = []
  private epochTransitionCallbacks: EpochTransitionCallback[] = []
  private validatorSetChangeCallbacks: ValidatorSetChangeCallback[] = []
  private connectionRefusedCallbacks: ConnectionRefusedCallback[] = []
  private connectingInCallbacks: ConnectingInCallback[] = []
  private connectedInCallbacks: ConnectedInCallback[] = []
  private connectInFailedCallbacks: ConnectInFailedCallback[] = []
  private connectingOutCallbacks: ConnectingOutCallback[] = []
  private connectedOutCallbacks: ConnectedOutCallback[] = []
  private connectOutFailedCallbacks: ConnectOutFailedCallback[] = []
  private disconnectedCallbacks: DisconnectedCallback[] = []
  private peerMisbehavedCallbacks: PeerMisbehavedCallback[] = []
  private authoringCallbacks: AuthoringCallback[] = []
  private authoringFailedCallbacks: AuthoringFailedCallback[] = []
  private authoredCallbacks: AuthoredCallback[] = []
  private importingCallbacks: ImportingCallback[] = []
  private blockVerificationFailedCallbacks: BlockVerificationFailedCallback[] =
    []
  private blockVerifiedCallbacks: BlockVerifiedCallback[] = []
  private blockExecutionFailedCallbacks: BlockExecutionFailedCallback[] = []
  private blockExecutedCallbacks: BlockExecutedCallback[] = []
  private bestBlockChangedCallbacks: BestBlockChangedCallback[] = []
  private finalizedBlockChangedCallbacks: FinalizedBlockChangedCallback[] = []
  private syncStatusChangedCallbacks: SyncStatusChangedCallback[] = []
  private statusCallbacks: StatusCallback[] = []
  private generatingTicketsCallbacks: GeneratingTicketsCallback[] = []
  private ticketGenerationFailedCallbacks: TicketGenerationFailedCallback[] = []
  private ticketsGeneratedCallbacks: TicketsGeneratedCallback[] = []
  private ticketTransferFailedCallbacks: TicketTransferFailedCallback[] = []
  private ticketTransferredCallbacks: TicketTransferredCallback[] = []
  private workPackageSubmissionCallbacks: WorkPackageSubmissionCallback[] = []
  private workPackageBeingSharedCallbacks: WorkPackageBeingSharedCallback[] = []
  private workPackageFailedCallbacks: WorkPackageFailedCallback[] = []
  private duplicateWorkPackageCallbacks: DuplicateWorkPackageCallback[] = []
  private workPackageReceivedCallbacks: WorkPackageReceivedCallback[] = []
  private authorizedCallbacks: AuthorizedCallback[] = []
  private extrinsicDataReceivedCallbacks: ExtrinsicDataReceivedCallback[] = []
  private importsReceivedCallbacks: ImportsReceivedCallback[] = []
  private sharingWorkPackageCallbacks: SharingWorkPackageCallback[] = []
  private workPackageSharingFailedCallbacks: WorkPackageSharingFailedCallback[] =
    []
  private bundleSentCallbacks: BundleSentCallback[] = []
  private refinedCallbacks: RefinedCallback[] = []
  private workReportBuiltCallbacks: WorkReportBuiltCallback[] = []
  private workReportSignatureSentCallbacks: WorkReportSignatureSentCallback[] =
    []
  private workReportSignatureReceivedCallbacks: WorkReportSignatureReceivedCallback[] =
    []
  private guaranteeBuiltCallbacks: GuaranteeBuiltCallback[] = []
  private sendingGuaranteeCallbacks: SendingGuaranteeCallback[] = []
  private guaranteeSendFailedCallbacks: GuaranteeSendFailedCallback[] = []
  private guaranteeSentCallbacks: GuaranteeSentCallback[] = []
  private guaranteesDistributedCallbacks: GuaranteesDistributedCallback[] = []
  private receivingGuaranteeCallbacks: ReceivingGuaranteeCallback[] = []
  private guaranteeReceiveFailedCallbacks: GuaranteeReceiveFailedCallback[] = []
  private guaranteeReceivedCallbacks: GuaranteeReceivedCallback[] = []
  private guaranteeDiscardedCallbacks: GuaranteeDiscardedCallback[] = []
  private conectivityChangeCallbacks: ConectivityChangeCallback[] = []
  private readonly ticketDistributionCallbacks: TicketDistributionCallback[] =
    []

  // Audit-related callback arrays
  private workReportAvailableCallbacks: WorkReportAvailableCallback[] = []
  private negativeJudgmentReceivedCallbacks: NegativeJudgmentReceivedCallback[] =
    []
  private auditAnnouncementReceivedCallbacks: AuditAnnouncementReceivedCallback[] =
    []
  private judgmentPublishedCallbacks: JudgmentPublishedCallback[] = []

  // Statistics callback arrays
  private blockProcessedCallbacks: BlockProcessedCallback[] = []
  private workReportProcessedCallbacks: WorkReportProcessedCallback[] = []
  private workReportJudgmentCallbacks: WorkReportJudgmentCallback[] = []

  constructor() {
    super('event-bus')
  }

  override stop(): Safe<boolean> {
    this.slotChangeCallbacks = []
    this.epochTransitionCallbacks = []
    this.validatorSetChangeCallbacks = []
    this.connectionRefusedCallbacks = []
    this.connectingInCallbacks = []
    this.connectedInCallbacks = []
    this.connectInFailedCallbacks = []
    this.connectingOutCallbacks = []
    this.connectedOutCallbacks = []
    this.connectOutFailedCallbacks = []
    this.disconnectedCallbacks = []
    this.peerMisbehavedCallbacks = []
    this.authoringCallbacks = []
    this.authoringFailedCallbacks = []
    this.authoredCallbacks = []
    this.importingCallbacks = []
    this.blockVerificationFailedCallbacks = []
    this.blockVerifiedCallbacks = []
    this.blockExecutionFailedCallbacks = []
    this.blockExecutedCallbacks = []
    this.bestBlockChangedCallbacks = []
    this.finalizedBlockChangedCallbacks = []
    this.syncStatusChangedCallbacks = []
    this.statusCallbacks = []
    this.generatingTicketsCallbacks = []
    this.ticketGenerationFailedCallbacks = []
    this.ticketsGeneratedCallbacks = []
    this.ticketTransferFailedCallbacks = []
    this.ticketTransferredCallbacks = []
    this.workPackageSubmissionCallbacks = []
    this.workPackageBeingSharedCallbacks = []
    this.workPackageFailedCallbacks = []
    this.duplicateWorkPackageCallbacks = []
    this.workPackageReceivedCallbacks = []
    this.authorizedCallbacks = []
    this.extrinsicDataReceivedCallbacks = []
    this.importsReceivedCallbacks = []
    this.sharingWorkPackageCallbacks = []
    this.workPackageSharingFailedCallbacks = []
    this.bundleSentCallbacks = []
    this.refinedCallbacks = []
    this.workReportBuiltCallbacks = []
    this.workReportSignatureSentCallbacks = []
    this.workReportSignatureReceivedCallbacks = []
    this.guaranteeBuiltCallbacks = []
    this.sendingGuaranteeCallbacks = []
    this.guaranteeSendFailedCallbacks = []
    this.guaranteeSentCallbacks = []
    this.guaranteesDistributedCallbacks = []
    this.receivingGuaranteeCallbacks = []
    this.guaranteeReceiveFailedCallbacks = []
    this.guaranteeReceivedCallbacks = []
    this.guaranteeDiscardedCallbacks = []
    this.conectivityChangeCallbacks = []
    this.blockProcessedCallbacks = []
    this.workReportProcessedCallbacks = []
    this.ticketDistributionCallbacks.length = 0

    // Clear audit-related callbacks
    this.workReportAvailableCallbacks = []
    this.negativeJudgmentReceivedCallbacks = []
    this.auditAnnouncementReceivedCallbacks = []
    this.judgmentPublishedCallbacks = []
    this.workReportJudgmentCallbacks = []

    return safeResult(true)
  }

  /**
   * Register a slot change callback
   */
  onSlotChange(callback: SlotChangeCallback): void {
    this.slotChangeCallbacks.push(callback)
  }

  /**
   * Register an epoch transition callback
   */
  onEpochTransition(callback: EpochTransitionCallback): void {
    this.epochTransitionCallbacks.push(callback)
  }

  /**
   * Register a validator set change callback
   */
  onValidatorSetChange(callback: ValidatorSetChangeCallback): void {
    this.validatorSetChangeCallbacks.push(callback)
  }

  /**
   * Register a conectivity change callback
   */
  onConectivityChange(callback: ConectivityChangeCallback): void {
    this.conectivityChangeCallbacks.push(callback)
  }

  onTicketDistribution(callback: TicketDistributionCallback): void {
    this.ticketDistributionCallbacks.push(callback)
  }

  onAuthoring(callback: AuthoringCallback): void {
    this.authoringCallbacks.push(callback)
  }

  onAuthoringFailed(callback: AuthoringFailedCallback): void {
    this.authoringFailedCallbacks.push(callback)
  }

  onAuthored(callback: AuthoredCallback): void {
    this.authoredCallbacks.push(callback)
  }

  onImporting(callback: ImportingCallback): void {
    this.importingCallbacks.push(callback)
  }

  onBlockVerificationFailed(callback: BlockVerificationFailedCallback): void {
    this.blockVerificationFailedCallbacks.push(callback)
  }

  onBlockVerified(callback: BlockVerifiedCallback): void {
    this.blockVerifiedCallbacks.push(callback)
  }

  onBlockExecutionFailed(callback: BlockExecutionFailedCallback): void {
    this.blockExecutionFailedCallbacks.push(callback)
  }

  onBlockExecuted(callback: BlockExecutedCallback): void {
    this.blockExecutedCallbacks.push(callback)
  }

  onBestBlockChanged(callback: BestBlockChangedCallback): void {
    this.bestBlockChangedCallbacks.push(callback)
  }

  onFinalizedBlockChanged(callback: FinalizedBlockChangedCallback): void {
    this.finalizedBlockChangedCallbacks.push(callback)
  }

  onSyncStatusChanged(callback: SyncStatusChangedCallback): void {
    this.syncStatusChangedCallbacks.push(callback)
  }

  onStatus(callback: StatusCallback): void {
    this.statusCallbacks.push(callback)
  }

  onGeneratingTickets(callback: GeneratingTicketsCallback): void {
    this.generatingTicketsCallbacks.push(callback)
  }

  onTicketGenerationFailed(callback: TicketGenerationFailedCallback): void {
    this.ticketGenerationFailedCallbacks.push(callback)
  }

  onTicketsGenerated(callback: TicketsGeneratedCallback): void {
    this.ticketsGeneratedCallbacks.push(callback)
  }

  onBlockProcessed(callback: BlockProcessedCallback): void {
    this.blockProcessedCallbacks.push(callback)
  }

  onWorkReportProcessed(callback: WorkReportProcessedCallback): void {
    this.workReportProcessedCallbacks.push(callback)
  }

  // Add callback methods (aliases for compatibility with telemetry service)
  addConnectionRefusedCallback(callback: ConnectionRefusedCallback): void {
    this.connectionRefusedCallbacks.push(callback)
  }

  addConnectingInCallback(callback: ConnectingInCallback): void {
    this.connectingInCallbacks.push(callback)
  }

  addConnectedInCallback(callback: ConnectedInCallback): void {
    this.connectedInCallbacks.push(callback)
  }

  addConnectInFailedCallback(callback: ConnectInFailedCallback): void {
    this.connectInFailedCallbacks.push(callback)
  }

  addConnectingOutCallback(callback: ConnectingOutCallback): void {
    this.connectingOutCallbacks.push(callback)
  }

  addConnectedOutCallback(callback: ConnectedOutCallback): void {
    this.connectedOutCallbacks.push(callback)
  }

  addConnectOutFailedCallback(callback: ConnectOutFailedCallback): void {
    this.connectOutFailedCallbacks.push(callback)
  }

  addDisconnectedCallback(callback: DisconnectedCallback): void {
    this.disconnectedCallbacks.push(callback)
  }

  addPeerMisbehavedCallback(callback: PeerMisbehavedCallback): void {
    this.peerMisbehavedCallbacks.push(callback)
  }

  addAuthoringCallback(callback: AuthoringCallback): void {
    this.authoringCallbacks.push(callback)
  }

  addAuthoringFailedCallback(callback: AuthoringFailedCallback): void {
    this.authoringFailedCallbacks.push(callback)
  }

  addAuthoredCallback(callback: AuthoredCallback): void {
    this.authoredCallbacks.push(callback)
  }

  addImportingCallback(callback: ImportingCallback): void {
    this.importingCallbacks.push(callback)
  }

  addBlockVerificationFailedCallback(
    callback: BlockVerificationFailedCallback,
  ): void {
    this.blockVerificationFailedCallbacks.push(callback)
  }

  addBlockVerifiedCallback(callback: BlockVerifiedCallback): void {
    this.blockVerifiedCallbacks.push(callback)
  }

  addBlockExecutionFailedCallback(
    callback: BlockExecutionFailedCallback,
  ): void {
    this.blockExecutionFailedCallbacks.push(callback)
  }

  addBlockExecutedCallback(callback: BlockExecutedCallback): void {
    this.blockExecutedCallbacks.push(callback)
  }

  addBestBlockChangedCallback(callback: BestBlockChangedCallback): void {
    this.bestBlockChangedCallbacks.push(callback)
  }

  addFinalizedBlockChangedCallback(
    callback: FinalizedBlockChangedCallback,
  ): void {
    this.finalizedBlockChangedCallbacks.push(callback)
  }

  addSyncStatusChangedCallback(callback: SyncStatusChangedCallback): void {
    this.syncStatusChangedCallbacks.push(callback)
  }

  addStatusCallback(callback: StatusCallback): void {
    this.statusCallbacks.push(callback)
  }

  addGeneratingTicketsCallback(callback: GeneratingTicketsCallback): void {
    this.generatingTicketsCallbacks.push(callback)
  }

  addTicketGenerationFailedCallback(
    callback: TicketGenerationFailedCallback,
  ): void {
    this.ticketGenerationFailedCallbacks.push(callback)
  }

  addTicketsGeneratedCallback(callback: TicketsGeneratedCallback): void {
    this.ticketsGeneratedCallbacks.push(callback)
  }

  addTicketTransferFailedCallback(
    callback: TicketTransferFailedCallback,
  ): void {
    this.ticketTransferFailedCallbacks.push(callback)
  }

  addTicketTransferredCallback(callback: TicketTransferredCallback): void {
    this.ticketTransferredCallbacks.push(callback)
  }

  addWorkPackageSubmissionCallback(
    callback: WorkPackageSubmissionCallback,
  ): void {
    this.workPackageSubmissionCallbacks.push(callback)
  }

  addWorkPackageBeingSharedCallback(
    callback: WorkPackageBeingSharedCallback,
  ): void {
    this.workPackageBeingSharedCallbacks.push(callback)
  }

  addWorkPackageFailedCallback(callback: WorkPackageFailedCallback): void {
    this.workPackageFailedCallbacks.push(callback)
  }

  addDuplicateWorkPackageCallback(
    callback: DuplicateWorkPackageCallback,
  ): void {
    this.duplicateWorkPackageCallbacks.push(callback)
  }

  addWorkPackageReceivedCallback(callback: WorkPackageReceivedCallback): void {
    this.workPackageReceivedCallbacks.push(callback)
  }

  addAuthorizedCallback(callback: AuthorizedCallback): void {
    this.authorizedCallbacks.push(callback)
  }

  addExtrinsicDataReceivedCallback(
    callback: ExtrinsicDataReceivedCallback,
  ): void {
    this.extrinsicDataReceivedCallbacks.push(callback)
  }

  addImportsReceivedCallback(callback: ImportsReceivedCallback): void {
    this.importsReceivedCallbacks.push(callback)
  }

  addSharingWorkPackageCallback(callback: SharingWorkPackageCallback): void {
    this.sharingWorkPackageCallbacks.push(callback)
  }

  addWorkPackageSharingFailedCallback(
    callback: WorkPackageSharingFailedCallback,
  ): void {
    this.workPackageSharingFailedCallbacks.push(callback)
  }

  addBundleSentCallback(callback: BundleSentCallback): void {
    this.bundleSentCallbacks.push(callback)
  }

  addRefinedCallback(callback: RefinedCallback): void {
    this.refinedCallbacks.push(callback)
  }

  addWorkReportBuiltCallback(callback: WorkReportBuiltCallback): void {
    this.workReportBuiltCallbacks.push(callback)
  }

  addWorkReportSignatureSentCallback(
    callback: WorkReportSignatureSentCallback,
  ): void {
    this.workReportSignatureSentCallbacks.push(callback)
  }

  addWorkReportSignatureReceivedCallback(
    callback: WorkReportSignatureReceivedCallback,
  ): void {
    this.workReportSignatureReceivedCallbacks.push(callback)
  }

  addGuaranteeBuiltCallback(callback: GuaranteeBuiltCallback): void {
    this.guaranteeBuiltCallbacks.push(callback)
  }

  addSendingGuaranteeCallback(callback: SendingGuaranteeCallback): void {
    this.sendingGuaranteeCallbacks.push(callback)
  }

  addGuaranteeSendFailedCallback(callback: GuaranteeSendFailedCallback): void {
    this.guaranteeSendFailedCallbacks.push(callback)
  }

  addGuaranteeSentCallback(callback: GuaranteeSentCallback): void {
    this.guaranteeSentCallbacks.push(callback)
  }

  addGuaranteesDistributedCallback(
    callback: GuaranteesDistributedCallback,
  ): void {
    this.guaranteesDistributedCallbacks.push(callback)
  }

  addReceivingGuaranteeCallback(callback: ReceivingGuaranteeCallback): void {
    this.receivingGuaranteeCallbacks.push(callback)
  }

  addGuaranteeReceiveFailedCallback(
    callback: GuaranteeReceiveFailedCallback,
  ): void {
    this.guaranteeReceiveFailedCallbacks.push(callback)
  }

  addGuaranteeReceivedCallback(callback: GuaranteeReceivedCallback): void {
    this.guaranteeReceivedCallbacks.push(callback)
  }

  addGuaranteeDiscardedCallback(callback: GuaranteeDiscardedCallback): void {
    this.guaranteeDiscardedCallbacks.push(callback)
  }

  // Audit-related callback registration methods
  addWorkReportAvailableCallback(callback: WorkReportAvailableCallback): void {
    this.workReportAvailableCallbacks.push(callback)
  }

  addNegativeJudgmentReceivedCallback(
    callback: NegativeJudgmentReceivedCallback,
  ): void {
    this.negativeJudgmentReceivedCallbacks.push(callback)
  }

  addAuditAnnouncementReceivedCallback(
    callback: AuditAnnouncementReceivedCallback,
  ): void {
    this.auditAnnouncementReceivedCallbacks.push(callback)
  }

  addJudgmentPublishedCallback(callback: JudgmentPublishedCallback): void {
    this.judgmentPublishedCallbacks.push(callback)
  }

  // Statistics callback registration methods
  addBlockProcessedCallback(callback: BlockProcessedCallback): void {
    this.blockProcessedCallbacks.push(callback)
  }

  addWorkReportProcessedCallback(callback: WorkReportProcessedCallback): void {
    this.workReportProcessedCallbacks.push(callback)
  }

  addWorkReportJudgmentCallback(callback: WorkReportJudgmentCallback): void {
    this.workReportJudgmentCallbacks.push(callback)
  }

  /**
   * Remove a slot change callback
   */
  removeSlotChangeCallback(callback: SlotChangeCallback): void {
    const index = this.slotChangeCallbacks.indexOf(callback)
    if (index > -1) {
      this.slotChangeCallbacks.splice(index, 1)
    }
  }

  /**
   * Remove an epoch transition callback
   */
  removeEpochTransitionCallback(callback: EpochTransitionCallback): void {
    const index = this.epochTransitionCallbacks.indexOf(callback)
    if (index > -1) {
      this.epochTransitionCallbacks.splice(index, 1)
    }
  }

  /**
   * Remove a validator set change callback
   */
  removeValidatorSetChangeCallback(callback: ValidatorSetChangeCallback): void {
    const index = this.validatorSetChangeCallbacks.indexOf(callback)
    if (index > -1) {
      this.validatorSetChangeCallbacks.splice(index, 1)
    }
  }

  removeAuthoringCallback(callback: AuthoringCallback): void {
    const index = this.authoringCallbacks.indexOf(callback)
    if (index > -1) {
      this.authoringCallbacks.splice(index, 1)
    }
  }

  removeAuthoringFailedCallback(callback: AuthoringFailedCallback): void {
    const index = this.authoringFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.authoringFailedCallbacks.splice(index, 1)
    }
  }

  removeAuthoredCallback(callback: AuthoredCallback): void {
    const index = this.authoredCallbacks.indexOf(callback)
    if (index > -1) {
      this.authoredCallbacks.splice(index, 1)
    }
  }

  removeImportingCallback(callback: ImportingCallback): void {
    const index = this.importingCallbacks.indexOf(callback)
    if (index > -1) {
      this.importingCallbacks.splice(index, 1)
    }
  }

  removeBlockVerificationFailedCallback(
    callback: BlockVerificationFailedCallback,
  ): void {
    const index = this.blockVerificationFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.blockVerificationFailedCallbacks.splice(index, 1)
    }
  }

  removeBlockVerifiedCallback(callback: BlockVerifiedCallback): void {
    const index = this.blockVerifiedCallbacks.indexOf(callback)
    if (index > -1) {
      this.blockVerifiedCallbacks.splice(index, 1)
    }
  }

  removeBlockExecutionFailedCallback(
    callback: BlockExecutionFailedCallback,
  ): void {
    const index = this.blockExecutionFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.blockExecutionFailedCallbacks.splice(index, 1)
    }
  }

  removeBlockExecutedCallback(callback: BlockExecutedCallback): void {
    const index = this.blockExecutedCallbacks.indexOf(callback)
    if (index > -1) {
      this.blockExecutedCallbacks.splice(index, 1)
    }
  }

  removeBestBlockChangedCallback(callback: BestBlockChangedCallback): void {
    const index = this.bestBlockChangedCallbacks.indexOf(callback)
    if (index > -1) {
      this.bestBlockChangedCallbacks.splice(index, 1)
    }
  }

  removeFinalizedBlockChangedCallback(
    callback: FinalizedBlockChangedCallback,
  ): void {
    const index = this.finalizedBlockChangedCallbacks.indexOf(callback)
    if (index > -1) {
      this.finalizedBlockChangedCallbacks.splice(index, 1)
    }
  }

  removeSyncStatusChangedCallback(callback: SyncStatusChangedCallback): void {
    const index = this.syncStatusChangedCallbacks.indexOf(callback)
    if (index > -1) {
      this.syncStatusChangedCallbacks.splice(index, 1)
    }
  }

  removeStatusCallback(callback: StatusCallback): void {
    const index = this.statusCallbacks.indexOf(callback)
    if (index > -1) {
      this.statusCallbacks.splice(index, 1)
    }
  }

  removeGeneratingTicketsCallback(callback: GeneratingTicketsCallback): void {
    const index = this.generatingTicketsCallbacks.indexOf(callback)
    if (index > -1) {
      this.generatingTicketsCallbacks.splice(index, 1)
    }
  }

  removeTicketGenerationFailedCallback(
    callback: TicketGenerationFailedCallback,
  ): void {
    const index = this.ticketGenerationFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.ticketGenerationFailedCallbacks.splice(index, 1)
    }
  }

  removeTicketsGeneratedCallback(callback: TicketsGeneratedCallback): void {
    const index = this.ticketsGeneratedCallbacks.indexOf(callback)
    if (index > -1) {
      this.ticketsGeneratedCallbacks.splice(index, 1)
    }
  }

  removeConnectionRefusedCallback(callback: ConnectionRefusedCallback): void {
    const index = this.connectionRefusedCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectionRefusedCallbacks.splice(index, 1)
    }
  }

  removeConnectingInCallback(callback: ConnectingInCallback): void {
    const index = this.connectingInCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectingInCallbacks.splice(index, 1)
    }
  }

  removeConnectedInCallback(callback: ConnectedInCallback): void {
    const index = this.connectedInCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectedInCallbacks.splice(index, 1)
    }
  }

  removeConnectInFailedCallback(callback: ConnectInFailedCallback): void {
    const index = this.connectInFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectInFailedCallbacks.splice(index, 1)
    }
  }

  removeConnectingOutCallback(callback: ConnectingOutCallback): void {
    const index = this.connectingOutCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectingOutCallbacks.splice(index, 1)
    }
  }

  removeConnectedOutCallback(callback: ConnectedOutCallback): void {
    const index = this.connectedOutCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectedOutCallbacks.splice(index, 1)
    }
  }

  removeConnectOutFailedCallback(callback: ConnectOutFailedCallback): void {
    const index = this.connectOutFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.connectOutFailedCallbacks.splice(index, 1)
    }
  }

  removeDisconnectedCallback(callback: DisconnectedCallback): void {
    const index = this.disconnectedCallbacks.indexOf(callback)
    if (index > -1) {
      this.disconnectedCallbacks.splice(index, 1)
    }
  }

  removePeerMisbehavedCallback(callback: PeerMisbehavedCallback): void {
    const index = this.peerMisbehavedCallbacks.indexOf(callback)
    if (index > -1) {
      this.peerMisbehavedCallbacks.splice(index, 1)
    }
  }

  removeTicketTransferFailedCallback(
    callback: TicketTransferFailedCallback,
  ): void {
    const index = this.ticketTransferFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.ticketTransferFailedCallbacks.splice(index, 1)
    }
  }

  removeTicketTransferredCallback(callback: TicketTransferredCallback): void {
    const index = this.ticketTransferredCallbacks.indexOf(callback)
    if (index > -1) {
      this.ticketTransferredCallbacks.splice(index, 1)
    }
  }

  removeWorkPackageSubmissionCallback(
    callback: WorkPackageSubmissionCallback,
  ): void {
    const index = this.workPackageSubmissionCallbacks.indexOf(callback)
    if (index > -1) {
      this.workPackageSubmissionCallbacks.splice(index, 1)
    }
  }

  removeWorkPackageBeingSharedCallback(
    callback: WorkPackageBeingSharedCallback,
  ): void {
    const index = this.workPackageBeingSharedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workPackageBeingSharedCallbacks.splice(index, 1)
    }
  }

  removeWorkPackageFailedCallback(callback: WorkPackageFailedCallback): void {
    const index = this.workPackageFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workPackageFailedCallbacks.splice(index, 1)
    }
  }

  removeDuplicateWorkPackageCallback(
    callback: DuplicateWorkPackageCallback,
  ): void {
    const index = this.duplicateWorkPackageCallbacks.indexOf(callback)
    if (index > -1) {
      this.duplicateWorkPackageCallbacks.splice(index, 1)
    }
  }

  removeWorkPackageReceivedCallback(
    callback: WorkPackageReceivedCallback,
  ): void {
    const index = this.workPackageReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workPackageReceivedCallbacks.splice(index, 1)
    }
  }

  removeAuthorizedCallback(callback: AuthorizedCallback): void {
    const index = this.authorizedCallbacks.indexOf(callback)
    if (index > -1) {
      this.authorizedCallbacks.splice(index, 1)
    }
  }

  removeExtrinsicDataReceivedCallback(
    callback: ExtrinsicDataReceivedCallback,
  ): void {
    const index = this.extrinsicDataReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.extrinsicDataReceivedCallbacks.splice(index, 1)
    }
  }

  removeImportsReceivedCallback(callback: ImportsReceivedCallback): void {
    const index = this.importsReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.importsReceivedCallbacks.splice(index, 1)
    }
  }

  removeSharingWorkPackageCallback(callback: SharingWorkPackageCallback): void {
    const index = this.sharingWorkPackageCallbacks.indexOf(callback)
    if (index > -1) {
      this.sharingWorkPackageCallbacks.splice(index, 1)
    }
  }

  removeWorkPackageSharingFailedCallback(
    callback: WorkPackageSharingFailedCallback,
  ): void {
    const index = this.workPackageSharingFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workPackageSharingFailedCallbacks.splice(index, 1)
    }
  }

  removeBundleSentCallback(callback: BundleSentCallback): void {
    const index = this.bundleSentCallbacks.indexOf(callback)
    if (index > -1) {
      this.bundleSentCallbacks.splice(index, 1)
    }
  }

  removeRefinedCallback(callback: RefinedCallback): void {
    const index = this.refinedCallbacks.indexOf(callback)
    if (index > -1) {
      this.refinedCallbacks.splice(index, 1)
    }
  }

  removeWorkReportBuiltCallback(callback: WorkReportBuiltCallback): void {
    const index = this.workReportBuiltCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportBuiltCallbacks.splice(index, 1)
    }
  }

  removeWorkReportSignatureSentCallback(
    callback: WorkReportSignatureSentCallback,
  ): void {
    const index = this.workReportSignatureSentCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportSignatureSentCallbacks.splice(index, 1)
    }
  }

  removeWorkReportSignatureReceivedCallback(
    callback: WorkReportSignatureReceivedCallback,
  ): void {
    const index = this.workReportSignatureReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportSignatureReceivedCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeBuiltCallback(callback: GuaranteeBuiltCallback): void {
    const index = this.guaranteeBuiltCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeBuiltCallbacks.splice(index, 1)
    }
  }

  removeSendingGuaranteeCallback(callback: SendingGuaranteeCallback): void {
    const index = this.sendingGuaranteeCallbacks.indexOf(callback)
    if (index > -1) {
      this.sendingGuaranteeCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeSendFailedCallback(
    callback: GuaranteeSendFailedCallback,
  ): void {
    const index = this.guaranteeSendFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeSendFailedCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeSentCallback(callback: GuaranteeSentCallback): void {
    const index = this.guaranteeSentCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeSentCallbacks.splice(index, 1)
    }
  }

  removeGuaranteesDistributedCallback(
    callback: GuaranteesDistributedCallback,
  ): void {
    const index = this.guaranteesDistributedCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteesDistributedCallbacks.splice(index, 1)
    }
  }

  removeReceivingGuaranteeCallback(callback: ReceivingGuaranteeCallback): void {
    const index = this.receivingGuaranteeCallbacks.indexOf(callback)
    if (index > -1) {
      this.receivingGuaranteeCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeReceiveFailedCallback(
    callback: GuaranteeReceiveFailedCallback,
  ): void {
    const index = this.guaranteeReceiveFailedCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeReceiveFailedCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeReceivedCallback(callback: GuaranteeReceivedCallback): void {
    const index = this.guaranteeReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeReceivedCallbacks.splice(index, 1)
    }
  }

  removeGuaranteeDiscardedCallback(callback: GuaranteeDiscardedCallback): void {
    const index = this.guaranteeDiscardedCallbacks.indexOf(callback)
    if (index > -1) {
      this.guaranteeDiscardedCallbacks.splice(index, 1)
    }
  }

  // Audit-related callback removal methods
  removeWorkReportAvailableCallback(
    callback: WorkReportAvailableCallback,
  ): void {
    const index = this.workReportAvailableCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportAvailableCallbacks.splice(index, 1)
    }
  }

  removeNegativeJudgmentReceivedCallback(
    callback: NegativeJudgmentReceivedCallback,
  ): void {
    const index = this.negativeJudgmentReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.negativeJudgmentReceivedCallbacks.splice(index, 1)
    }
  }

  removeAuditAnnouncementReceivedCallback(
    callback: AuditAnnouncementReceivedCallback,
  ): void {
    const index = this.auditAnnouncementReceivedCallbacks.indexOf(callback)
    if (index > -1) {
      this.auditAnnouncementReceivedCallbacks.splice(index, 1)
    }
  }

  removeJudgmentPublishedCallback(callback: JudgmentPublishedCallback): void {
    const index = this.judgmentPublishedCallbacks.indexOf(callback)
    if (index > -1) {
      this.judgmentPublishedCallbacks.splice(index, 1)
    }
  }

  removeConectivityChangeCallback(callback: ConectivityChangeCallback): void {
    const index = this.conectivityChangeCallbacks.indexOf(callback)
    if (index > -1) {
      this.conectivityChangeCallbacks.splice(index, 1)
    }
  }

  removeTicketDistributionCallback(callback: TicketDistributionCallback): void {
    const index = this.ticketDistributionCallbacks.indexOf(callback)
    if (index > -1) {
      this.ticketDistributionCallbacks.splice(index, 1)
    }
  }

  removeBlockProcessedCallback(callback: BlockProcessedCallback): void {
    const index = this.blockProcessedCallbacks.indexOf(callback)
    if (index > -1) {
      this.blockProcessedCallbacks.splice(index, 1)
    }
  }

  removeWorkReportProcessedCallback(
    callback: WorkReportProcessedCallback,
  ): void {
    const index = this.workReportProcessedCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportProcessedCallbacks.splice(index, 1)
    }
  }

  removeWorkReportJudgmentCallback(callback: WorkReportJudgmentCallback): void {
    const index = this.workReportJudgmentCallbacks.indexOf(callback)
    if (index > -1) {
      this.workReportJudgmentCallbacks.splice(index, 1)
    }
  }

  /**
   * Emit slot change event
   */
  async emitSlotChange(event: SlotChangeEvent): Promise<void> {
    for (const callback of this.slotChangeCallbacks) {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error in slot change callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: event.slot.toString(),
        })
      }
    }
  }

  /**
   * Emit epoch transition event
   */
  async emitEpochTransition(event: EpochTransitionEvent): Promise<void> {
    for (const callback of this.epochTransitionCallbacks) {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error in epoch transition callback', {
          error: error instanceof Error ? error.message : String(error),
          previousEpoch: event.previousEpoch.toString(),
          newEpoch: event.newEpoch.toString(),
        })
      }
    }
  }

  /**
   * Emit validator set change event
   */
  async emitValidatorSetChange(event: ValidatorSetChangeEvent): Promise<void> {
    for (const callback of this.validatorSetChangeCallbacks) {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error in validator set change callback', {
          error: error instanceof Error ? error.message : String(error),
          epoch: event.epoch.toString(),
        })
      }
    }
  }

  public async emitConnectionRefused(peerAddress: string): Promise<void> {
    for (const callback of this.connectionRefusedCallbacks) {
      try {
        await callback(peerAddress)
      } catch (error) {
        logger.error('Error in connection refused callback', {
          error: error instanceof Error ? error.message : String(error),
          peerAddress,
        })
      }
    }
  }

  public async emitConnectingIn(peerAddress: string): Promise<void> {
    for (const callback of this.connectingInCallbacks) {
      try {
        await callback(peerAddress)
      } catch (error) {
        logger.error('Error in connecting in callback', {
          error: error instanceof Error ? error.message : String(error),
          peerAddress,
        })
      }
    }
  }

  public async emitConnectedIn(
    eventId: bigint,
    peerId: Uint8Array,
  ): Promise<void> {
    for (const callback of this.connectedInCallbacks) {
      try {
        await callback(eventId, peerId)
      } catch (error) {
        logger.error('Error in connected in callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          peerId,
        })
      }
    }
  }

  public async emitConnectInFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.connectInFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in connect in failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitConnectingOut(
    peerId: Uint8Array,
    peerAddress: string,
  ): Promise<void> {
    for (const callback of this.connectingOutCallbacks) {
      try {
        await callback(peerId, peerAddress)
      } catch (error) {
        logger.error('Error in connecting out callback', {
          error: error instanceof Error ? error.message : String(error),
          peerId,
          peerAddress,
        })
      }
    }
  }

  public async emitConnectedOut(eventId: bigint): Promise<void> {
    for (const callback of this.connectedOutCallbacks) {
      try {
        await callback(eventId)
      } catch (error) {
        logger.error('Error in connected out callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
        })
      }
    }
  }

  public async emitConnectOutFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.connectOutFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in connect out failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitDisconnected(
    peerId: Uint8Array,
    reason: string,
    terminator?: 'local' | 'remote',
  ): Promise<void> {
    for (const callback of this.disconnectedCallbacks) {
      try {
        await callback(peerId, reason, terminator)
      } catch (error) {
        logger.error('Error in disconnected callback', {
          error: error instanceof Error ? error.message : String(error),
          peerId,
          reason,
          terminator,
        })
      }
    }
  }

  public async emitPeerMisbehaved(
    peerId: Uint8Array,
    reason: string,
  ): Promise<void> {
    for (const callback of this.peerMisbehavedCallbacks) {
      try {
        await callback(peerId, reason)
      } catch (error) {
        logger.error('Error in peer misbehaved callback', {
          error: error instanceof Error ? error.message : String(error),
          peerId,
          reason,
        })
      }
    }
  }

  public async emitAuthoring(
    slot: bigint,
    parentHeaderHash: Hex,
  ): Promise<void> {
    for (const callback of this.authoringCallbacks) {
      try {
        await callback(slot, parentHeaderHash)
      } catch (error) {
        logger.error('Error in authoring callback', {
          error: error instanceof Error ? error.message : String(error),
          slot,
          parentHeaderHash,
        })
      }
    }
  }

  public async emitAuthoringFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.authoringFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in authoring failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitAuthored(block: Block): Promise<void> {
    const errors: Error[] = []
    for (const callback of this.authoredCallbacks) {
      const result = await callback(block)
      if (result && result.length > 0 && result[0]) {
        errors.push(result[0])
      }
    }
    if (errors.length > 0) {
      logger.error('Error in authored callback', {
        errors,
        block,
      })
    }
  }

  public async emitImporting(slot: bigint, block: Block): Promise<void> {
    const errors: Error[] = []
    for (const callback of this.importingCallbacks) {
      const [error, _result] = await callback(slot, block.header.parent)
      if (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) {
      logger.error('Error in importing callback', {
        errors,
        slot,
        block,
      })
    }
  }

  public async emitBlockVerificationFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.blockVerificationFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in block verification failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitBlockVerified(eventId: bigint): Promise<void> {
    for (const callback of this.blockVerifiedCallbacks) {
      try {
        await callback(eventId)
      } catch (error) {
        logger.error('Error in block verified callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
        })
      }
    }
  }

  public async emitBlockExecutionFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.blockExecutionFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in block execution failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitBlockExecuted(
    eventId: bigint,
    accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>,
  ): Promise<void> {
    for (const callback of this.blockExecutedCallbacks) {
      try {
        await callback(eventId, accumulatedServices)
      } catch (error) {
        logger.error('Error in block executed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          accumulatedServices,
        })
      }
    }
  }

  public async emitBestBlockChanged(blockHeader: BlockHeader): Promise<void> {
    for (const callback of this.bestBlockChangedCallbacks) {
      try {
        await callback(blockHeader)
      } catch (error) {
        logger.error('Error in best block changed callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: blockHeader.timeslot,
          headerHash: blockHeader.parent, // Using parent as identifier
        })
      }
    }
  }

  public async emitFinalizedBlockChanged(
    blockHeader: BlockHeader,
  ): Promise<void> {
    for (const callback of this.finalizedBlockChangedCallbacks) {
      try {
        await callback(blockHeader)
      } catch (error) {
        logger.error('Error in finalized block changed callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: blockHeader.timeslot,
          headerHash: blockHeader.parent, // Using parent as identifier
        })
      }
    }
  }

  public async emitSyncStatusChanged(isSynced: boolean): Promise<void> {
    for (const callback of this.syncStatusChangedCallbacks) {
      try {
        await callback(isSynced)
      } catch (error) {
        logger.error('Error in sync status changed callback', {
          error: error instanceof Error ? error.message : String(error),
          isSynced,
        })
      }
    }
  }

  public async emitStatus(status: {
    totalPeerCount: bigint
    validatorPeerCount: bigint
    blockAnnouncementStreamPeerCount: bigint
    guaranteesByCore: Uint8Array
    shardCount: bigint
    shardTotalSizeBytes: bigint
    readyPreimageCount: bigint
    readyPreimageTotalSizeBytes: bigint
  }): Promise<void> {
    for (const callback of this.statusCallbacks) {
      try {
        await callback(status)
      } catch (error) {
        logger.error('Error in status callback', {
          error: error instanceof Error ? error.message : String(error),
          status,
        })
      }
    }
  }

  public async emitGeneratingTickets(epochIndex: bigint): Promise<void> {
    for (const callback of this.generatingTicketsCallbacks) {
      try {
        await callback(epochIndex)
      } catch (error) {
        logger.error('Error in generating tickets callback', {
          error: error instanceof Error ? error.message : String(error),
          epochIndex,
        })
      }
    }
  }

  public async emitTicketGenerationFailed(
    eventId: bigint,
    reason: string,
  ): Promise<void> {
    for (const callback of this.ticketGenerationFailedCallbacks) {
      try {
        await callback(eventId, reason)
      } catch (error) {
        logger.error('Error in ticket generation failed callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          reason,
        })
      }
    }
  }

  public async emitTicketsGenerated(
    eventId: bigint,
    ticketVrfOutputs: Uint8Array[],
  ): Promise<void> {
    for (const callback of this.ticketsGeneratedCallbacks) {
      try {
        await callback(eventId, ticketVrfOutputs)
      } catch (error) {
        logger.error('Error in tickets generated callback', {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          ticketVrfOutputs,
        })
      }
    }
  }

  public async emitConectivityChange(
    event: ConectivityChangeEvent,
  ): Promise<void> {
    for (const callback of this.conectivityChangeCallbacks) {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error in conectivity change callback', {
          error: error instanceof Error ? error.message : String(error),
          event,
        })
      }
    }
  }

  public async emitTicketDistribution(
    event: TicketDistributionEvent,
  ): Promise<void> {
    for (const callback of this.ticketDistributionCallbacks) {
      try {
        await callback(event)
      } catch (error) {
        logger.error('Error in ticket distribution callback', {
          error: error instanceof Error ? error.message : String(error),
          event,
        })
      }
    }
  }

  // Audit-related event emission methods
  public async emitWorkReportAvailable(
    workReport: WorkReport,
    coreIndex: bigint,
    blockHeaderHash: Hex,
  ): Promise<void> {
    for (const callback of this.workReportAvailableCallbacks) {
      try {
        const result = await callback(workReport, coreIndex, blockHeaderHash)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in work report available callback', {
            error: result[0],
            coreIndex: coreIndex.toString(),
            blockHeaderHash,
          })
        }
      } catch (error) {
        logger.error('Error in work report available callback', {
          error: error instanceof Error ? error.message : String(error),
          coreIndex: coreIndex.toString(),
          blockHeaderHash,
        })
      }
    }
  }

  public async emitNegativeJudgmentReceived(
    judgment: Judgment,
    workReportHash: Hex,
    validatorIndex: bigint,
  ): Promise<void> {
    for (const callback of this.negativeJudgmentReceivedCallbacks) {
      try {
        const result = await callback(judgment, workReportHash, validatorIndex)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in negative judgment received callback', {
            error: result[0],
            workReportHash,
            validatorIndex: validatorIndex.toString(),
          })
        }
      } catch (error) {
        logger.error('Error in negative judgment received callback', {
          error: error instanceof Error ? error.message : String(error),
          workReportHash,
          validatorIndex: validatorIndex.toString(),
        })
      }
    }
  }

  public async emitAuditAnnouncementReceived(
    announcement: AuditAnnouncement,
    validatorIndex: bigint,
  ): Promise<void> {
    for (const callback of this.auditAnnouncementReceivedCallbacks) {
      try {
        const result = await callback(announcement, validatorIndex)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in audit announcement received callback', {
            error: result[0],
            headerHash: announcement.headerHash,
            tranche: announcement.tranche.toString(),
            validatorIndex: validatorIndex.toString(),
          })
        }
      } catch (error) {
        logger.error('Error in audit announcement received callback', {
          error: error instanceof Error ? error.message : String(error),
          headerHash: announcement.headerHash,
          tranche: announcement.tranche.toString(),
          validatorIndex: validatorIndex.toString(),
        })
      }
    }
  }

  public async emitJudgmentPublished(
    judgment: Judgment,
    workReportHash: Hex,
    validatorIndex: bigint,
  ): Promise<void> {
    for (const callback of this.judgmentPublishedCallbacks) {
      try {
        const result = await callback(judgment, workReportHash, validatorIndex)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in judgment published callback', {
            error: result[0],
            workReportHash,
            validatorIndex: validatorIndex.toString(),
          })
        }
      } catch (error) {
        logger.error('Error in judgment published callback', {
          error: error instanceof Error ? error.message : String(error),
          workReportHash,
          validatorIndex: validatorIndex.toString(),
        })
      }
    }
  }

  // Statistics event emission methods
  public async emitBlockProcessed(event: BlockProcessedEvent): Promise<void> {
    for (const callback of this.blockProcessedCallbacks) {
      try {
        const result = await callback(event)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in block processed callback', {
            error: result[0],
            slot: event.slot.toString(),
            authorIndex: event.authorIndex,
          })
        }
      } catch (error) {
        logger.error('Error in block processed callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: event.slot.toString(),
          authorIndex: event.authorIndex,
        })
      }
    }
  }

  public async emitWorkReportProcessed(
    event: WorkReportProcessedEvent,
  ): Promise<void> {
    for (const callback of this.workReportProcessedCallbacks) {
      try {
        const result = await callback(event)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in work report processed callback', {
            error: result[0],
            slot: event.slot.toString(),
            availableCount: event.availableReports.length,
            incomingCount: event.incomingReports.length,
          })
        }
      } catch (error) {
        logger.error('Error in work report processed callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: event.slot.toString(),
          availableCount: event.availableReports.length,
          incomingCount: event.incomingReports.length,
        })
      }
    }
  }

  public async emitWorkReportJudgment(
    event: WorkReportJudgmentEvent,
  ): Promise<void> {
    for (const callback of this.workReportJudgmentCallbacks) {
      try {
        const result = await callback(event)
        if (result && result.length > 0 && result[0]) {
          logger.error('Error in work report judgment callback', {
            error: result[0],
            slot: event.slot.toString(),
            workReportHash: event.workReportHash,
            judgment: event.judgment,
            validatorHash: event.validatorHash,
          })
        }
      } catch (error) {
        logger.error('Error in work report judgment callback', {
          error: error instanceof Error ? error.message : String(error),
          slot: event.slot.toString(),
          workReportHash: event.workReportHash,
          judgment: event.judgment,
          validatorHash: event.validatorHash,
        })
      }
    }
  }
}
