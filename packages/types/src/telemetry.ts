/**
 * JIP-3 Telemetry Types
 *
 * Specification for JAM node telemetry allowing integration into JAM Tart
 * (Testing, Analytics and Research Telemetry).
 *
 * Reference: JIP-3 specification
 */

/**
 * Common types used across telemetry messages
 */

export interface BlockOutline {
  sizeInBytes: bigint
  headerHash: Uint8Array
  ticketCount: bigint
  preimageCount: bigint
  preimagesSizeInBytes: bigint
  guaranteeCount: bigint
  assuranceCount: bigint
  disputeVerdictCount: bigint
}

export interface ExecCost {
  gasUsed: bigint
  elapsedWallClockTimeNanos: bigint
}

export interface IsAuthorizedCost {
  total: ExecCost
  codeLoadAndCompileTimeNanos: bigint
  hostCalls: ExecCost
}

export interface RefineCost {
  total: ExecCost
  codeLoadAndCompileTimeNanos: bigint
  historicalLookupCalls: ExecCost
  machineExpungeCalls: ExecCost
  peekPokePagesCalls: ExecCost
  invokeCalls: ExecCost
  otherHostCalls: ExecCost
}

export interface AccumulateCost {
  accumulateCallCount: bigint
  transfersProcessedCount: bigint
  itemsAccumulatedCount: bigint
  total: ExecCost
  codeLoadAndCompileTimeNanos: bigint
  readWriteCalls: ExecCost
  lookupCalls: ExecCost
  querySolicitForgetProvideCalls: ExecCost
  infoNewUpgradeEjectCalls: ExecCost
  transferCalls: ExecCost
  totalGasChargedForTransferProcessing: bigint
  otherHostCalls: ExecCost
}

export interface ImportSpec {
  rootIdentifier: Uint8Array
  exportIndex: bigint // plus 2^15 if Root Identifier is a Work-Package Hash
}

export interface WorkItemOutline {
  serviceId: bigint
  payloadSize: bigint
  refineGasLimit: bigint
  accumulateGasLimit: bigint
  sumOfExtrinsicLengths: bigint
  importSpecs: ImportSpec[]
  exportedSegmentCount: bigint
}

export interface WorkPackageOutline {
  sizeInBytes: bigint // excluding extrinsic data
  workPackageHash: Uint8Array
  anchor: Uint8Array
  lookupAnchorSlot: bigint
  prerequisites: Uint8Array[]
  workItems: WorkItemOutline[]
}

export interface WorkReportOutline {
  workReportHash: Uint8Array
  bundleSizeInBytes: bigint
  erasureRoot: Uint8Array
  segmentsRoot: Uint8Array
}

export interface GuaranteeOutline {
  workReportHash: Uint8Array
  slot: bigint
  guarantors: bigint[]
}

export enum GuaranteeDiscardReason {
  WorkPackageReportedOnChain = 0,
  ReplacedByBetterGuarantee = 1,
  CannotBeReportedOnChain = 2,
  TooManyGuarantees = 3,
  Other = 4,
}

export enum AnnouncedPreimageForgetReason {
  ProvidedOnChain = 0,
  NotRequestedOnChain = 1,
  FailedToAcquirePreimage = 2,
  TooManyAnnouncedPreimages = 3,
  BadLength = 4,
  Other = 5,
}

export enum PreimageDiscardReason {
  ProvidedOnChain = 0,
  NotRequestedOnChain = 1,
  TooManyPreimages = 2,
  Other = 3,
}

/**
 * Node information message (first message sent)
 * JIP-3 specification for initial telemetry handshake
 */
export interface NodeInfo {
  protocolVersion: bigint // 0 for current version
  jamParameters: Uint8Array // Encoded JAM parameters (as returned by fetch host call)
  genesisHeaderHash: Uint8Array // Genesis header hash (32 bytes)
  peerId: Uint8Array // Ed25519 public key (32 bytes)
  peerAddress: { host: string; port: number } // IPv6 address + port
  nodeFlags: bigint // Bitmask (Bit 0: PVM recompiler if 1, interpreter if 0)
  implementationName: string // Max 32 UTF-8 bytes
  implementationVersion: string // Max 32 UTF-8 bytes
  grayPaperVersion: string // Max 16 UTF-8 bytes (e.g., "0.7.1")
  additionalInfo: string // Max 512 UTF-8 bytes
}

/**
 * Node flags
 */
export enum NodeFlags {
  PVM_RECOMPILER = 1 << 0, // 1 means recompiler, 0 means interpreter
}

/**
 * Base event structure
 */
export interface BaseEvent {
  timestamp: bigint
  eventType: bigint // Discriminator
}

/**
 * Meta events
 */
export interface DroppedEvent extends BaseEvent {
  eventType: 0n
  lastDroppedTimestamp: bigint
  droppedEventCount: bigint
}

/**
 * Status events
 */
export interface StatusEvent extends BaseEvent {
  eventType: 10n
  totalPeerCount: bigint
  validatorPeerCount: bigint
  blockAnnouncementStreamPeerCount: bigint
  guaranteesByCore: Uint8Array // Number of guarantees per core
  shardCount: bigint
  shardTotalSizeBytes: bigint
  readyPreimageCount: bigint
  readyPreimageTotalSizeBytes: bigint
}

export interface BestBlockChangedEvent extends BaseEvent {
  eventType: 11n
  newBestSlot: bigint
  newBestHeaderHash: Uint8Array
}

export interface FinalizedBlockChangedEvent extends BaseEvent {
  eventType: 12n
  newFinalizedSlot: bigint
  newFinalizedHeaderHash: Uint8Array
}

export interface SyncStatusChangedEvent extends BaseEvent {
  eventType: 13n
  isSynced: boolean
}

/**
 * Networking events (20-27)
 */
export interface ConnectionRefusedEvent extends BaseEvent {
  eventType: 20n
  peerAddress:
    | { address: Uint8Array; port: bigint }
    | { host: string; port: bigint }
}

export interface ConnectingInEvent extends BaseEvent {
  eventType: 21n
  peerAddress:
    | { address: Uint8Array; port: bigint }
    | { host: string; port: bigint }
}

export interface ConnectInFailedEvent extends BaseEvent {
  eventType: 22n
  connectingInEventId: bigint
  reason: string
}

export interface ConnectedInEvent extends BaseEvent {
  eventType: 23n
  connectingInEventId: bigint
  peerId: Uint8Array
}

export interface ConnectingOutEvent extends BaseEvent {
  eventType: 24n
  peerId: Uint8Array
  peerAddress:
    | { address: Uint8Array; port: bigint }
    | { host: string; port: bigint }
}

export interface ConnectOutFailedEvent extends BaseEvent {
  eventType: 25n
  connectingOutEventId: bigint
  reason: string
}

export interface ConnectedOutEvent extends BaseEvent {
  eventType: 26n
  connectingOutEventId: bigint
}

export interface DisconnectedEvent extends BaseEvent {
  eventType: 27n
  peerId: Uint8Array
  terminator?: 'local' | 'remote'
  reason: string
}

export interface PeerMisbehavedEvent extends BaseEvent {
  eventType: 28n
  peerId: Uint8Array
  reason: string
}

/**
 * Block authoring/importing events (40-47)
 */
export interface AuthoringEvent extends BaseEvent {
  eventType: 40n
  slot: bigint
  parentHeaderHash: Uint8Array
}

export interface AuthoringFailedEvent extends BaseEvent {
  eventType: 41n
  authoringEventId: bigint
  reason: string
}

export interface AuthoredEvent extends BaseEvent {
  eventType: 42n
  authoringEventId: bigint
  blockOutline: BlockOutline
}

export interface ImportingEvent extends BaseEvent {
  eventType: 43n
  slot: bigint
  blockOutline: BlockOutline
}

export interface BlockVerificationFailedEvent extends BaseEvent {
  eventType: 44n
  importingEventId: bigint
  reason: string
}

export interface BlockVerifiedEvent extends BaseEvent {
  eventType: 45n
  importingEventId: bigint
}

export interface BlockExecutionFailedEvent extends BaseEvent {
  eventType: 46n
  authoringOrImportingEventId: bigint
  reason: string
}

export interface BlockExecutedEvent extends BaseEvent {
  eventType: 47n
  authoringOrImportingEventId: bigint
  accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>
}

/**
 * Block distribution events (60-68)
 */
export interface BlockAnnouncementStreamOpenedEvent extends BaseEvent {
  eventType: 60n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
}

export interface BlockAnnouncementStreamClosedEvent extends BaseEvent {
  eventType: 61n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  reason: string
}

export interface BlockAnnouncedEvent extends BaseEvent {
  eventType: 62n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  slot: bigint
  headerHash: Uint8Array
}

export interface SendingBlockRequestEvent extends BaseEvent {
  eventType: 63n
  peerId: Uint8Array
  headerHash: Uint8Array
  direction: 'ascending_exclusive' | 'descending_inclusive'
  maxBlocks: bigint
}

export interface ReceivingBlockRequestEvent extends BaseEvent {
  eventType: 64n
  peerId: Uint8Array
}

export interface BlockRequestFailedEvent extends BaseEvent {
  eventType: 65n
  blockRequestEventId: bigint
  reason: string
}

export interface BlockRequestSentEvent extends BaseEvent {
  eventType: 66n
  sendingBlockRequestEventId: bigint
}

export interface BlockRequestReceivedEvent extends BaseEvent {
  eventType: 67n
  receivingBlockRequestEventId: bigint
  headerHash: Uint8Array
  direction: 'ascending_exclusive' | 'descending_inclusive'
  maxBlocks: bigint
}

export interface BlockTransferredEvent extends BaseEvent {
  eventType: 68n
  blockRequestEventId: bigint
  slot: bigint
  blockOutline: BlockOutline
  isLastBlock: boolean
}

/**
 * Safrole ticket events (80-84)
 */
export interface GeneratingTicketsEvent extends BaseEvent {
  eventType: 80n
  epochIndex: bigint
}

export interface TicketGenerationFailedEvent extends BaseEvent {
  eventType: 81n
  generatingTicketsEventId: bigint
  reason: string
}

export interface TicketsGeneratedEvent extends BaseEvent {
  eventType: 82n
  generatingTicketsEventId: bigint
  ticketVrfOutputs: Uint8Array[] // Array of 32-byte VRF outputs
}

export interface TicketTransferFailedEvent extends BaseEvent {
  eventType: 83n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  wasCe132Used: boolean
  reason: string
}

export interface TicketTransferredEvent extends BaseEvent {
  eventType: 84n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  wasCe132Used: boolean
  epochIndex: bigint
  attemptNumber: 0n | 1n
  vrfOutput: Uint8Array // 32 bytes
}

/**
 * Guaranteeing events (90-113)
 */
export interface WorkPackageSubmissionEvent extends BaseEvent {
  eventType: 90n
  peerId: Uint8Array // Builder
}

export interface WorkPackageBeingSharedEvent extends BaseEvent {
  eventType: 91n
  peerId: Uint8Array // Primary guarantor
}

export interface WorkPackageFailedEvent extends BaseEvent {
  eventType: 92n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  reason: string
}

export interface DuplicateWorkPackageEvent extends BaseEvent {
  eventType: 93n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  coreIndex: bigint
  workPackageHash: Uint8Array
}

export interface WorkPackageReceivedEvent extends BaseEvent {
  eventType: 94n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  coreIndex: bigint
  workPackageOutline: WorkPackageOutline
}

export interface AuthorizedEvent extends BaseEvent {
  eventType: 95n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  isAuthorizedCost: IsAuthorizedCost
}

export interface ExtrinsicDataReceivedEvent extends BaseEvent {
  eventType: 96n
  workPackageEventId: bigint // ID of work-package submission or being shared event
}

export interface ImportsReceivedEvent extends BaseEvent {
  eventType: 97n
  workPackageEventId: bigint // ID of work-package submission or being shared event
}

export interface SharingWorkPackageEvent extends BaseEvent {
  eventType: 98n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Secondary guarantor
}

export interface WorkPackageSharingFailedEvent extends BaseEvent {
  eventType: 99n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Secondary guarantor
  reason: string
}

export interface BundleSentEvent extends BaseEvent {
  eventType: 100n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Secondary guarantor
}

export interface RefinedEvent extends BaseEvent {
  eventType: 101n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  refineCosts: RefineCost[] // Cost of refine call for each work item
}

export interface WorkReportBuiltEvent extends BaseEvent {
  eventType: 102n
  workPackageEventId: bigint // ID of work-package submission or being shared event
  workReportOutline: WorkReportOutline
}

export interface WorkReportSignatureSentEvent extends BaseEvent {
  eventType: 103n
  workPackageBeingSharedEventId: bigint // ID of work-package being shared event
}

export interface WorkReportSignatureReceivedEvent extends BaseEvent {
  eventType: 104n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Secondary guarantor
}

export interface GuaranteeBuiltEvent extends BaseEvent {
  eventType: 105n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  guaranteeOutline: GuaranteeOutline
}

export interface SendingGuaranteeEvent extends BaseEvent {
  eventType: 106n
  guaranteeBuiltEventId: bigint // ID of guarantee built event
  peerId: Uint8Array // Recipient
}

export interface GuaranteeSendFailedEvent extends BaseEvent {
  eventType: 107n
  sendingGuaranteeEventId: bigint // ID of sending guarantee event
  reason: string
}

export interface GuaranteeSentEvent extends BaseEvent {
  eventType: 108n
  sendingGuaranteeEventId: bigint // ID of sending guarantee event
}

export interface GuaranteesDistributedEvent extends BaseEvent {
  eventType: 109n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
}

export interface ReceivingGuaranteeEvent extends BaseEvent {
  eventType: 110n
  peerId: Uint8Array // Sender
}

export interface GuaranteeReceiveFailedEvent extends BaseEvent {
  eventType: 111n
  receivingGuaranteeEventId: bigint // ID of receiving guarantee event
  reason: string
}

export interface GuaranteeReceivedEvent extends BaseEvent {
  eventType: 112n
  receivingGuaranteeEventId: bigint // ID of receiving guarantee event
  guaranteeOutline: GuaranteeOutline
}

export interface GuaranteeDiscardedEvent extends BaseEvent {
  eventType: 113n
  guaranteeOutline: GuaranteeOutline
  discardReason: GuaranteeDiscardReason
}

/**
 * Availability distribution events (120-131)
 */
export interface SendingShardRequestEvent extends BaseEvent {
  eventType: 120n
  peerId: Uint8Array // Guarantor
  erasureRoot: Uint8Array
  shardIndex: bigint
}

export interface ReceivingShardRequestEvent extends BaseEvent {
  eventType: 121n
  peerId: Uint8Array // Assurer
}

export interface ShardRequestFailedEvent extends BaseEvent {
  eventType: 122n
  shardRequestEventId: bigint // ID of sending or receiving shard request event
  reason: string
}

export interface ShardRequestSentEvent extends BaseEvent {
  eventType: 123n
  sendingShardRequestEventId: bigint // ID of sending shard request event
}

export interface ShardRequestReceivedEvent extends BaseEvent {
  eventType: 124n
  receivingShardRequestEventId: bigint // ID of receiving shard request event
  erasureRoot: Uint8Array
  shardIndex: bigint
}

export interface ShardsTransferredEvent extends BaseEvent {
  eventType: 125n
  shardRequestEventId: bigint // ID of sending or receiving shard request event
}

export interface DistributingAssuranceEvent extends BaseEvent {
  eventType: 126n
  assuranceAnchor: Uint8Array // Header hash
  availabilityBitfield: Uint8Array // One bit per core
}

export interface AssuranceSendFailedEvent extends BaseEvent {
  eventType: 127n
  distributingAssuranceEventId: bigint // ID of distributing assurance event
  peerId: Uint8Array // Recipient
  reason: string
}

export interface AssuranceSentEvent extends BaseEvent {
  eventType: 128n
  distributingAssuranceEventId: bigint // ID of distributing assurance event
  peerId: Uint8Array // Recipient
}

export interface AssuranceDistributedEvent extends BaseEvent {
  eventType: 129n
  distributingAssuranceEventId: bigint // ID of distributing assurance event
}

export interface AssuranceReceiveFailedEvent extends BaseEvent {
  eventType: 130n
  peerId: Uint8Array // Sender
  reason: string
}

export interface AssuranceReceivedEvent extends BaseEvent {
  eventType: 131n
  peerId: Uint8Array // Sender
  assuranceAnchor: Uint8Array // Header hash
}

/**
 * Bundle recovery events (140-147)
 */
export interface SendingBundleShardRequestEvent extends BaseEvent {
  eventType: 140n
  auditingEventId: bigint // TODO: reference auditing event
  peerId: Uint8Array // Assurer
  shardIndex: bigint
}

export interface ReceivingBundleShardRequestEvent extends BaseEvent {
  eventType: 141n
  peerId: Uint8Array // Auditor
}

export interface BundleShardRequestFailedEvent extends BaseEvent {
  eventType: 142n
  bundleShardRequestEventId: bigint // ID of sending or receiving bundle shard request event
  reason: string
}

export interface BundleShardRequestSentEvent extends BaseEvent {
  eventType: 143n
  sendingBundleShardRequestEventId: bigint // ID of sending bundle shard request event
}

export interface BundleShardRequestReceivedEvent extends BaseEvent {
  eventType: 144n
  receivingBundleShardRequestEventId: bigint // ID of receiving bundle shard request event
  erasureRoot: Uint8Array
  shardIndex: bigint
}

export interface BundleShardTransferredEvent extends BaseEvent {
  eventType: 145n
  bundleShardRequestEventId: bigint // ID of sending or receiving bundle shard request event
}

export interface ReconstructingBundleEvent extends BaseEvent {
  eventType: 146n
  auditingEventId: bigint // TODO: reference auditing event
  isTrivialReconstruction: boolean // Using only original-data shards
}

export interface BundleReconstructedEvent extends BaseEvent {
  eventType: 147n
  auditingEventId: bigint // TODO: reference auditing event
}

/**
 * Segment recovery events (160-172)
 */
export interface WorkPackageHashMappedEvent extends BaseEvent {
  eventType: 160n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  workPackageHash: Uint8Array
  segmentsRoot: Uint8Array
}

export interface SegmentsRootMappedEvent extends BaseEvent {
  eventType: 161n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  segmentsRoot: Uint8Array
  erasureRoot: Uint8Array
}

export interface SendingSegmentShardRequestEvent extends BaseEvent {
  eventType: 162n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Assurer
  wasCe140Used: boolean // Using CE 140 instead of CE 139
  segmentShards: Array<{ importSegmentId: bigint; shardIndex: bigint }>
}

export interface ReceivingSegmentShardRequestEvent extends BaseEvent {
  eventType: 163n
  peerId: Uint8Array // Sender
  wasCe140Used: boolean // Using CE 140 instead of CE 139
}

export interface SegmentShardRequestFailedEvent extends BaseEvent {
  eventType: 164n
  segmentShardRequestEventId: bigint // ID of sending or receiving segment shard request event
  reason: string
}

export interface SegmentShardRequestSentEvent extends BaseEvent {
  eventType: 165n
  sendingSegmentShardRequestEventId: bigint // ID of sending segment shard request event
}

export interface SegmentShardRequestReceivedEvent extends BaseEvent {
  eventType: 166n
  receivingSegmentShardRequestEventId: bigint // ID of receiving segment shard request event
  segmentShardCount: bigint // Number of segment shards requested
}

export interface SegmentShardsTransferredEvent extends BaseEvent {
  eventType: 167n
  segmentShardRequestEventId: bigint // ID of sending or receiving segment shard request event
}

export interface ReconstructingSegmentsEvent extends BaseEvent {
  eventType: 168n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  segmentIds: bigint[] // Import segment IDs being reconstructed
  isTrivialReconstruction: boolean // Using only original-data shards
}

export interface SegmentReconstructionFailedEvent extends BaseEvent {
  eventType: 169n
  reconstructingSegmentsEventId: bigint // ID of reconstructing segments event
  reason: string
}

export interface SegmentsReconstructedEvent extends BaseEvent {
  eventType: 170n
  reconstructingSegmentsEventId: bigint // ID of reconstructing segments event
}

export interface SegmentVerificationFailedEvent extends BaseEvent {
  eventType: 171n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  failedSegmentIndices: bigint[] // Indices of failed segments in import list
  reason: string
}

export interface SegmentsVerifiedEvent extends BaseEvent {
  eventType: 172n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  verifiedSegmentIndices: bigint[] // Indices of verified segments in import list
}

export interface SendingSegmentRequestEvent extends BaseEvent {
  eventType: 173n
  workPackageSubmissionEventId: bigint // ID of work-package submission event
  peerId: Uint8Array // Previous guarantor
  requestedSegmentIndices: bigint[] // Indices of requested segments in import list
}

export interface ReceivingSegmentRequestEvent extends BaseEvent {
  eventType: 174n
  peerId: Uint8Array // Guarantor
}

export interface SegmentRequestFailedEvent extends BaseEvent {
  eventType: 175n
  segmentRequestEventId: bigint // ID of sending or receiving segment request event
  reason: string
}

export interface SegmentRequestSentEvent extends BaseEvent {
  eventType: 176n
  sendingSegmentRequestEventId: bigint // ID of sending segment request event
}

export interface SegmentRequestReceivedEvent extends BaseEvent {
  eventType: 177n
  receivingSegmentRequestEventId: bigint // ID of receiving segment request event
  segmentCount: bigint // Number of segments requested
}

export interface SegmentsTransferredEvent extends BaseEvent {
  eventType: 178n
  segmentRequestEventId: bigint // ID of sending or receiving segment request event
}

/**
 * Bundle request events (148-153)
 */
export interface SendingBundleRequestEvent extends BaseEvent {
  eventType: 148n
  auditingEventId: bigint // TODO: reference auditing event
  peerId: Uint8Array // Guarantor
}

export interface ReceivingBundleRequestEvent extends BaseEvent {
  eventType: 149n
  peerId: Uint8Array // Auditor
}

export interface BundleRequestFailedEvent extends BaseEvent {
  eventType: 150n
  bundleRequestEventId: bigint // ID of sending or receiving bundle request event
  reason: string
}

export interface BundleRequestSentEvent extends BaseEvent {
  eventType: 151n
  sendingBundleRequestEventId: bigint // ID of sending bundle request event
}

export interface BundleRequestReceivedEvent extends BaseEvent {
  eventType: 152n
  receivingBundleRequestEventId: bigint // ID of receiving bundle request event
  erasureRoot: Uint8Array
}

export interface BundleTransferredEvent extends BaseEvent {
  eventType: 153n
  bundleRequestEventId: bigint // ID of sending or receiving bundle request event
}

/**
 * Preimage distribution events (190-199)
 */
export interface PreimageAnnouncementFailedEvent extends BaseEvent {
  eventType: 190n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  reason: string
}

export interface PreimageAnnouncedEvent extends BaseEvent {
  eventType: 191n
  peerId: Uint8Array
  connectionSide: 'local' | 'remote'
  requestingServiceId: bigint
  preimageHash: Uint8Array
  preimageLength: bigint
}

export interface AnnouncedPreimageForgottenEvent extends BaseEvent {
  eventType: 192n
  requestingServiceId: bigint
  preimageHash: Uint8Array
  preimageLength: bigint
  forgetReason: AnnouncedPreimageForgetReason
}

export interface SendingPreimageRequestEvent extends BaseEvent {
  eventType: 193n
  peerId: Uint8Array // Recipient
  preimageHash: Uint8Array
}

export interface ReceivingPreimageRequestEvent extends BaseEvent {
  eventType: 194n
  peerId: Uint8Array // Sender
}

export interface PreimageRequestFailedEvent extends BaseEvent {
  eventType: 195n
  preimageRequestEventId: bigint // ID of sending or receiving preimage request event
  reason: string
}

export interface PreimageRequestSentEvent extends BaseEvent {
  eventType: 196n
  sendingPreimageRequestEventId: bigint // ID of sending preimage request event
}

export interface PreimageRequestReceivedEvent extends BaseEvent {
  eventType: 197n
  receivingPreimageRequestEventId: bigint // ID of receiving preimage request event
  preimageHash: Uint8Array
}

export interface PreimageTransferredEvent extends BaseEvent {
  eventType: 198n
  preimageRequestEventId: bigint // ID of sending or receiving preimage request event
  preimageLength: bigint
}

export interface PreimageDiscardedEvent extends BaseEvent {
  eventType: 199n
  preimageHash: Uint8Array
  preimageLength: bigint
  discardReason: PreimageDiscardReason
}

/**
 * Union type for all telemetry events
 */
export type TelemetryEvent =
  | DroppedEvent
  | StatusEvent
  | BestBlockChangedEvent
  | FinalizedBlockChangedEvent
  | SyncStatusChangedEvent
  | ConnectionRefusedEvent
  | ConnectingInEvent
  | ConnectInFailedEvent
  | ConnectedInEvent
  | ConnectingOutEvent
  | ConnectOutFailedEvent
  | ConnectedOutEvent
  | DisconnectedEvent
  | PeerMisbehavedEvent
  | AuthoringEvent
  | AuthoringFailedEvent
  | AuthoredEvent
  | ImportingEvent
  | BlockVerificationFailedEvent
  | BlockVerifiedEvent
  | BlockExecutionFailedEvent
  | BlockExecutedEvent
  | BlockAnnouncementStreamOpenedEvent
  | BlockAnnouncementStreamClosedEvent
  | BlockAnnouncedEvent
  | SendingBlockRequestEvent
  | ReceivingBlockRequestEvent
  | BlockRequestFailedEvent
  | BlockRequestSentEvent
  | BlockRequestReceivedEvent
  | BlockTransferredEvent
  | GeneratingTicketsEvent
  | TicketGenerationFailedEvent
  | TicketsGeneratedEvent
  | TicketTransferFailedEvent
  | TicketTransferredEvent
  | WorkPackageSubmissionEvent
  | WorkPackageBeingSharedEvent
  | WorkPackageFailedEvent
  | DuplicateWorkPackageEvent
  | WorkPackageReceivedEvent
  | AuthorizedEvent
  | ExtrinsicDataReceivedEvent
  | ImportsReceivedEvent
  | SharingWorkPackageEvent
  | WorkPackageSharingFailedEvent
  | BundleSentEvent
  | RefinedEvent
  | WorkReportBuiltEvent
  | WorkReportSignatureSentEvent
  | WorkReportSignatureReceivedEvent
  | GuaranteeBuiltEvent
  | SendingGuaranteeEvent
  | GuaranteeSendFailedEvent
  | GuaranteeSentEvent
  | GuaranteesDistributedEvent
  | ReceivingGuaranteeEvent
  | GuaranteeReceiveFailedEvent
  | GuaranteeReceivedEvent
  | GuaranteeDiscardedEvent
  | SendingShardRequestEvent
  | ReceivingShardRequestEvent
  | ShardRequestFailedEvent
  | ShardRequestSentEvent
  | ShardRequestReceivedEvent
  | ShardsTransferredEvent
  | DistributingAssuranceEvent
  | AssuranceSendFailedEvent
  | AssuranceSentEvent
  | AssuranceDistributedEvent
  | AssuranceReceiveFailedEvent
  | AssuranceReceivedEvent
  | SendingBundleShardRequestEvent
  | ReceivingBundleShardRequestEvent
  | BundleShardRequestFailedEvent
  | BundleShardRequestSentEvent
  | BundleShardRequestReceivedEvent
  | BundleShardTransferredEvent
  | ReconstructingBundleEvent
  | BundleReconstructedEvent
  | WorkPackageHashMappedEvent
  | SegmentsRootMappedEvent
  | SendingSegmentShardRequestEvent
  | ReceivingSegmentShardRequestEvent
  | SegmentShardRequestFailedEvent
  | SegmentShardRequestSentEvent
  | SegmentShardRequestReceivedEvent
  | SegmentShardsTransferredEvent
  | ReconstructingSegmentsEvent
  | SegmentReconstructionFailedEvent
  | SegmentsReconstructedEvent
  | SegmentVerificationFailedEvent
  | SegmentsVerifiedEvent
  | SendingSegmentRequestEvent
  | ReceivingSegmentRequestEvent
  | SegmentRequestFailedEvent
  | SegmentRequestSentEvent
  | SegmentRequestReceivedEvent
  | SegmentsTransferredEvent
  | SendingBundleRequestEvent
  | ReceivingBundleRequestEvent
  | BundleRequestFailedEvent
  | BundleRequestSentEvent
  | BundleRequestReceivedEvent
  | BundleTransferredEvent
  | PreimageAnnouncementFailedEvent
  | PreimageAnnouncedEvent
  | AnnouncedPreimageForgottenEvent
  | SendingPreimageRequestEvent
  | ReceivingPreimageRequestEvent
  | PreimageRequestFailedEvent
  | PreimageRequestSentEvent
  | PreimageRequestReceivedEvent
  | PreimageTransferredEvent
  | PreimageDiscardedEvent

/**
 * Telemetry configuration
 */
export interface TelemetryConfig {
  /** Telemetry server endpoint (HOST:PORT) */
  endpoint?: string
  /** Whether telemetry is enabled */
  enabled: boolean
  /** Maximum buffer size for events before dropping */
  maxBufferSize?: bigint
  /** Connection retry settings */
  retrySettings?: {
    maxRetries: bigint
    retryDelayMs: bigint
    backoffMultiplier: bigint
  }
}
