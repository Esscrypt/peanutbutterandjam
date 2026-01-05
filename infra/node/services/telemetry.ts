// /**
//  * JIP-3 Telemetry Event Emitter
//  *
//  * Provides convenient methods for emitting all JIP-3 telemetry events
//  * with proper type safety and validation.
//  */

// import {
//   type EventBusService,
//   type Hex,
//   hexToBytes,
//   type Safe,
//   type SafePromise,
//   safeError,
//   safeResult,
// } from '@pbnjam/core'
// import type { TelemetryClient } from '@pbnjam/telemetry'
// import type {
//   AccumulateCost,
//   BlockOutline,
//   GuaranteeDiscardReason,
//   GuaranteeOutline,
//   IsAuthorizedCost,
//   RefineCost,
//   TelemetryEvent,
//   WorkPackageOutline,
//   WorkReportOutline,
// } from '@pbnjam/types'
// import { BaseService } from '@pbnjam/types'
// export class TelemetryEventEmitterService extends BaseService {
//   private eventIdCounter = 0n
//   private readonly client: TelemetryClient
//   private readonly eventBusService: EventBusService
//   constructor(options: {
//     client: TelemetryClient
//     eventBusService: EventBusService
//   }) {
//     super('telemetry-event-emitter')
//     this.client = options.client
//     this.eventBusService = options.eventBusService
//   }
//   override start(): Safe<boolean> {
//     this.eventBusService.addConnectionRefusedCallback(
//       this.emitConnectionRefused,
//     )
//     this.eventBusService.addConnectingInCallback(this.emitConnectingIn)
//     this.eventBusService.addConnectedInCallback(this.emitConnectedIn)
//     this.eventBusService.addConnectInFailedCallback(this.emitConnectInFailed)
//     this.eventBusService.addConnectingOutCallback(this.emitConnectingOut)
//     this.eventBusService.addConnectedOutCallback(this.emitConnectedOut)
//     this.eventBusService.addConnectOutFailedCallback(this.emitConnectOutFailed)
//     this.eventBusService.addDisconnectedCallback(this.emitDisconnected)
//     this.eventBusService.addPeerMisbehavedCallback(this.emitPeerMisbehaved)
//     this.eventBusService.addAuthoringCallback(this.emitAuthoring)
//     this.eventBusService.addAuthoringFailedCallback(this.emitAuthoringFailed)
//     // this.eventBusService.addAuthoredCallback(this.emitAuthored)
//     // this.eventBusService.addImportingCallback(this.emitImporting)
//     this.eventBusService.addBlockVerificationFailedCallback(
//       this.emitBlockVerificationFailed,
//     )
//     this.eventBusService.addBlockVerifiedCallback(this.emitBlockVerified)
//     this.eventBusService.addBlockExecutionFailedCallback(
//       this.emitBlockExecutionFailed,
//     )
//     this.eventBusService.addBlockExecutedCallback(this.emitBlockExecuted)
//     // this.eventBusService.addBestBlockChangedCallback(this.emitBestBlockChanged)
//     // this.eventBusService.addFinalizedBlockChangedCallback(
//     //   this.emitFinalizedBlockChanged,
//     // )
//     this.eventBusService.addSyncStatusChangedCallback(
//       this.emitSyncStatusChanged,
//     )
//     this.eventBusService.addStatusCallback(this.emitStatus)
//     this.eventBusService.addGeneratingTicketsCallback(
//       this.emitGeneratingTickets,
//     )
//     this.eventBusService.addTicketGenerationFailedCallback(
//       this.emitTicketGenerationFailed,
//     )
//     this.eventBusService.addTicketsGeneratedCallback(this.emitTicketsGenerated)
//     this.eventBusService.addTicketTransferFailedCallback(
//       this.emitTicketTransferFailed,
//     )
//     this.eventBusService.addTicketTransferredCallback(
//       this.emitTicketTransferred,
//     )
//     this.eventBusService.addWorkPackageSubmissionCallback(
//       this.emitWorkPackageSubmission,
//     )
//     this.eventBusService.addWorkPackageBeingSharedCallback(
//       this.emitWorkPackageBeingShared,
//     )
//     this.eventBusService.addWorkPackageFailedCallback(
//       this.emitWorkPackageFailed,
//     )
//     this.eventBusService.addDuplicateWorkPackageCallback(
//       this.emitDuplicateWorkPackage,
//     )
//     this.eventBusService.addWorkPackageReceivedCallback(
//       this.emitWorkPackageReceived,
//     )
//     this.eventBusService.addAuthorizedCallback(this.emitAuthorized)
//     this.eventBusService.addExtrinsicDataReceivedCallback(
//       this.emitExtrinsicDataReceived,
//     )
//     this.eventBusService.addImportsReceivedCallback(this.emitImportsReceived)
//     this.eventBusService.addSharingWorkPackageCallback(
//       this.emitSharingWorkPackage,
//     )
//     this.eventBusService.addWorkPackageSharingFailedCallback(
//       this.emitWorkPackageSharingFailed,
//     )
//     this.eventBusService.addBundleSentCallback(this.emitBundleSent)
//     this.eventBusService.addRefinedCallback(this.emitRefined)
//     this.eventBusService.addWorkReportBuiltCallback(this.emitWorkReportBuilt)
//     this.eventBusService.addWorkReportSignatureSentCallback(
//       this.emitWorkReportSignatureSent,
//     )
//     this.eventBusService.addWorkReportSignatureReceivedCallback(
//       this.emitWorkReportSignatureReceived,
//     )
//     this.eventBusService.addGuaranteeBuiltCallback(this.emitGuaranteeBuilt)
//     this.eventBusService.addSendingGuaranteeCallback(this.emitSendingGuarantee)
//     this.eventBusService.addGuaranteeSendFailedCallback(
//       this.emitGuaranteeSendFailed,
//     )
//     this.eventBusService.addGuaranteeSentCallback(this.emitGuaranteeSent)
//     this.eventBusService.addGuaranteesDistributedCallback(
//       this.emitGuaranteesDistributed,
//     )
//     this.eventBusService.addReceivingGuaranteeCallback(
//       this.emitReceivingGuarantee,
//     )
//     this.eventBusService.addGuaranteeReceiveFailedCallback(
//       this.emitGuaranteeReceiveFailed,
//     )
//     this.eventBusService.addGuaranteeReceivedCallback(
//       this.emitGuaranteeReceived,
//     )
//     this.eventBusService.addGuaranteeDiscardedCallback(
//       this.emitGuaranteeDiscarded,
//     )
//     return safeResult(true)
//   }
//   override stop(): Safe<boolean> {
//     this.eventBusService.removeConnectionRefusedCallback(
//       this.emitConnectionRefused,
//     )
//     this.eventBusService.removeConnectingInCallback(this.emitConnectingIn)
//     this.eventBusService.removeConnectedInCallback(this.emitConnectedIn)
//     this.eventBusService.removeConnectInFailedCallback(this.emitConnectInFailed)
//     this.eventBusService.removeConnectingOutCallback(this.emitConnectingOut)
//     this.eventBusService.removeConnectedOutCallback(this.emitConnectedOut)
//     this.eventBusService.removeConnectOutFailedCallback(
//       this.emitConnectOutFailed,
//     )
//     this.eventBusService.removeDisconnectedCallback(this.emitDisconnected)
//     this.eventBusService.removePeerMisbehavedCallback(this.emitPeerMisbehaved)
//     this.eventBusService.removeAuthoringCallback(this.emitAuthoring)
//     this.eventBusService.removeAuthoringFailedCallback(this.emitAuthoringFailed)
//     // this.eventBusService.removeAuthoredCallback(this.emitAuthored)
//     // this.eventBusService.removeImportingCallback(this.emitImporting)
//     this.eventBusService.removeBlockVerificationFailedCallback(
//       this.emitBlockVerificationFailed,
//     )
//     this.eventBusService.removeBlockVerifiedCallback(this.emitBlockVerified)
//     this.eventBusService.removeBlockExecutionFailedCallback(
//       this.emitBlockExecutionFailed,
//     )
//     this.eventBusService.removeBlockExecutedCallback(this.emitBlockExecuted)
//     // this.eventBusService.removeBestBlockChangedCallback(
//     //   this.emitBestBlockChanged,
//     // )
//     // this.eventBusService.removeFinalizedBlockChangedCallback(
//     //   this.emitFinalizedBlockChanged,
//     // )
//     this.eventBusService.removeSyncStatusChangedCallback(
//       this.emitSyncStatusChanged,
//     )
//     this.eventBusService.removeStatusCallback(this.emitStatus)
//     this.eventBusService.removeGeneratingTicketsCallback(
//       this.emitGeneratingTickets,
//     )
//     this.eventBusService.removeTicketGenerationFailedCallback(
//       this.emitTicketGenerationFailed,
//     )
//     this.eventBusService.removeTicketsGeneratedCallback(
//       this.emitTicketsGenerated,
//     )
//     this.eventBusService.removeTicketTransferFailedCallback(
//       this.emitTicketTransferFailed,
//     )
//     this.eventBusService.removeTicketTransferredCallback(
//       this.emitTicketTransferred,
//     )
//     this.eventBusService.removeWorkPackageSubmissionReceivedCallback(
//       this.emitWorkPackageSubmission,
//     )
//     this.eventBusService.removeWorkPackageBeingSharedCallback(
//       this.emitWorkPackageBeingShared,
//     )
//     this.eventBusService.removeWorkPackageFailedCallback(
//       this.emitWorkPackageFailed,
//     )
//     this.eventBusService.removeDuplicateWorkPackageCallback(
//       this.emitDuplicateWorkPackage,
//     )
//     this.eventBusService.removeWorkPackageReceivedCallback(
//       this.emitWorkPackageReceived,
//     )
//     this.eventBusService.removeAuthorizedCallback(this.emitAuthorized)
//     this.eventBusService.removeExtrinsicDataReceivedCallback(
//       this.emitExtrinsicDataReceived,
//     )
//     this.eventBusService.removeImportsReceivedCallback(this.emitImportsReceived)
//     this.eventBusService.removeSharingWorkPackageCallback(
//       this.emitSharingWorkPackage,
//     )
//     this.eventBusService.removeWorkPackageSharingFailedCallback(
//       this.emitWorkPackageSharingFailed,
//     )
//     this.eventBusService.removeBundleSentCallback(this.emitBundleSent)
//     this.eventBusService.removeRefinedCallback(this.emitRefined)
//     this.eventBusService.removeWorkReportBuiltCallback(this.emitWorkReportBuilt)
//     this.eventBusService.removeWorkReportSignatureSentCallback(
//       this.emitWorkReportSignatureSent,
//     )
//     return safeResult(true)
//   }

//   /**
//    * Get next event ID
//    */
//   private getNextEventId(): bigint {
//     this.eventIdCounter++
//     return this.eventIdCounter
//   }

//   /**
//    * Get current JAM timestamp
//    */
//   private getCurrentTimestamp(): bigint {
//     const jamEpochStart = 1609459200n * 1000000n // JAM Common Era start in microseconds
//     const currentMicros = BigInt(Date.now()) * 1000n
//     return currentMicros - jamEpochStart
//   }

//   /**
//    * Send event to client
//    */
//   private async sendEvent(event: TelemetryEvent): SafePromise<void> {
//     return await this.client.sendEvent(event)
//   }

//   // Meta Events

//   /**
//    * Emit dropped events message
//    */
//   async emitDropped(
//     droppedEventCount: bigint,
//     lastDroppedTimestamp?: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 0n,
//       timestamp: this.getCurrentTimestamp(),
//       lastDroppedTimestamp: lastDroppedTimestamp || this.getCurrentTimestamp(),
//       droppedEventCount,
//     })
//   }

//   // Status Events

//   /**
//    * Emit status event (sent periodically every ~2 seconds)
//    */
//   async emitStatus(status: {
//     totalPeerCount: bigint
//     validatorPeerCount: bigint
//     blockAnnouncementStreamPeerCount: bigint
//     guaranteesByCore: Uint8Array
//     shardCount: bigint
//     shardTotalSizeBytes: bigint
//     readyPreimageCount: bigint
//     readyPreimageTotalSizeBytes: bigint
//   }): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 10n,
//       timestamp: this.getCurrentTimestamp(),
//       ...status,
//     })
//   }

//   /**
//    * Emit best block changed event
//    */
//   async emitBestBlockChanged(
//     newBestSlot: bigint,
//     newBestHeaderHash: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 11n,
//       timestamp: this.getCurrentTimestamp(),
//       newBestSlot,
//       newBestHeaderHash,
//     })
//   }

//   /**
//    * Emit finalized block changed event
//    */
//   async emitFinalizedBlockChanged(
//     newFinalizedSlot: bigint,
//     newFinalizedHeaderHash: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 12n,
//       timestamp: this.getCurrentTimestamp(),
//       newFinalizedSlot,
//       newFinalizedHeaderHash,
//     })
//   }

//   /**
//    * Emit sync status changed event
//    */
//   async emitSyncStatusChanged(isSynced: boolean): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 13n,
//       timestamp: this.getCurrentTimestamp(),
//       isSynced,
//     })
//   }

//   // Networking Events

//   /**
//    * Emit connection refused event
//    */
//   async emitConnectionRefused(peerAddress: string): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 20n,
//       timestamp: this.getCurrentTimestamp(),
//       peerAddress: { address: new TextEncoder().encode(peerAddress), port: 0n },
//     })
//   }

//   /**
//    * Emit connecting in event (returns event ID for linking)
//    */
//   async emitConnectingIn(peerAddress: string): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 21n,
//       timestamp: this.getCurrentTimestamp(),
//       peerAddress: { address: new TextEncoder().encode(peerAddress), port: 0n },
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit connect in failed event
//    */
//   async emitConnectInFailed(
//     connectingInEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 22n,
//       timestamp: this.getCurrentTimestamp(),
//       connectingInEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit connected in event
//    */
//   async emitConnectedIn(
//     connectingInEventId: bigint,
//     peerId: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 23n,
//       timestamp: this.getCurrentTimestamp(),
//       connectingInEventId,
//       peerId,
//     })
//   }

//   /**
//    * Emit connecting out event (returns event ID for linking)
//    */
//   async emitConnectingOut(
//     peerId: Uint8Array,
//     peerAddress: string,
//   ): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 24n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       peerAddress: { address: new TextEncoder().encode(peerAddress), port: 0n },
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit connect out failed event
//    */
//   async emitConnectOutFailed(
//     connectingOutEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 25n,
//       timestamp: this.getCurrentTimestamp(),
//       connectingOutEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit connected out event
//    */
//   async emitConnectedOut(connectingOutEventId: bigint): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 26n,
//       timestamp: this.getCurrentTimestamp(),
//       connectingOutEventId,
//     })
//   }

//   /**
//    * Emit disconnected event
//    */
//   async emitDisconnected(
//     peerId: Uint8Array,
//     reason: string,
//     terminator?: 'local' | 'remote',
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 27n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       terminator,
//       reason,
//     })
//   }

//   /**
//    * Emit peer misbehaved event
//    */
//   async emitPeerMisbehaved(
//     peerId: Uint8Array,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 28n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       reason,
//     })
//   }

//   // Block Authoring/Importing Events

//   /**
//    * Emit authoring event (returns event ID for linking)
//    */
//   async emitAuthoring(slot: bigint, parentHeaderHash: Hex): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 40n,
//       timestamp: this.getCurrentTimestamp(),
//       slot,
//       parentHeaderHash: hexToBytes(parentHeaderHash),
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit authoring failed event
//    */
//   async emitAuthoringFailed(
//     authoringEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 41n,
//       timestamp: this.getCurrentTimestamp(),
//       authoringEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit authored event
//    */
//   async emitAuthored(
//     authoringEventId: bigint,
//     blockOutline: BlockOutline,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 42n,
//       timestamp: this.getCurrentTimestamp(),
//       authoringEventId,
//       blockOutline,
//     })
//   }

//   /**
//    * Emit importing event (returns event ID for linking)
//    */
//   async emitImporting(
//     slot: bigint,
//     blockOutline: BlockOutline,
//   ): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 43n,
//       timestamp: this.getCurrentTimestamp(),
//       slot,
//       blockOutline,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit block verification failed event
//    */
//   async emitBlockVerificationFailed(
//     importingEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 44n,
//       timestamp: this.getCurrentTimestamp(),
//       importingEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit block verified event
//    */
//   async emitBlockVerified(importingEventId: bigint): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 45n,
//       timestamp: this.getCurrentTimestamp(),
//       importingEventId,
//     })
//   }

//   /**
//    * Emit block execution failed event
//    */
//   async emitBlockExecutionFailed(
//     authoringOrImportingEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 46n,
//       timestamp: this.getCurrentTimestamp(),
//       authoringOrImportingEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit block executed event
//    */
//   async emitBlockExecuted(
//     authoringOrImportingEventId: bigint,
//     accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 47n,
//       timestamp: this.getCurrentTimestamp(),
//       authoringOrImportingEventId,
//       accumulatedServices,
//     })
//   }

//   // Block Distribution Events

//   /**
//    * Emit block announcement stream opened event
//    */
//   async emitBlockAnnouncementStreamOpened(
//     peerId: Uint8Array,
//     connectionSide: 'local' | 'remote',
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 60n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       connectionSide,
//     })
//   }

//   /**
//    * Emit block announcement stream closed event
//    */
//   async emitBlockAnnouncementStreamClosed(
//     peerId: Uint8Array,
//     connectionSide: 'local' | 'remote',
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 61n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       connectionSide,
//       reason,
//     })
//   }

//   /**
//    * Emit block announced event
//    */
//   async emitBlockAnnounced(
//     peerId: Uint8Array,
//     connectionSide: 'local' | 'remote',
//     slot: bigint,
//     headerHash: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 62n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       connectionSide,
//       slot,
//       headerHash,
//     })
//   }

//   /**
//    * Emit sending block request event (returns event ID for linking)
//    */
//   async emitSendingBlockRequest(
//     peerId: Uint8Array,
//     headerHash: Uint8Array,
//     direction: 'ascending_exclusive' | 'descending_inclusive',
//     maxBlocks: bigint,
//   ): SafePromise<bigint> {
//     const eventId = this.getNextEventId()
//     const [error] = await this.sendEvent({
//       eventType: 63n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       headerHash,
//       direction,
//       maxBlocks,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(eventId)
//   }

//   /**
//    * Emit receiving block request event (returns event ID for linking)
//    */
//   async emitReceivingBlockRequest(peerId: Uint8Array): SafePromise<bigint> {
//     const eventId = this.getNextEventId()
//     const [error] = await this.sendEvent({
//       eventType: 64n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(eventId)
//   }

//   /**
//    * Emit block request failed event
//    */
//   async emitBlockRequestFailed(
//     blockRequestEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 65n,
//       timestamp: this.getCurrentTimestamp(),
//       blockRequestEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit block request sent event
//    */
//   async emitBlockRequestSent(
//     sendingBlockRequestEventId: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 66n,
//       timestamp: this.getCurrentTimestamp(),
//       sendingBlockRequestEventId,
//     })
//   }

//   /**
//    * Emit block request received event
//    */
//   async emitBlockRequestReceived(
//     receivingBlockRequestEventId: bigint,
//     headerHash: Uint8Array,
//     direction: 'ascending_exclusive' | 'descending_inclusive',
//     maxBlocks: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 67n,
//       timestamp: this.getCurrentTimestamp(),
//       receivingBlockRequestEventId,
//       headerHash,
//       direction,
//       maxBlocks,
//     })
//   }

//   /**
//    * Emit block transferred event
//    */
//   async emitBlockTransferred(
//     blockRequestEventId: bigint,
//     slot: bigint,
//     blockOutline: BlockOutline,
//     isLastBlock: boolean,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 68n,
//       timestamp: this.getCurrentTimestamp(),
//       blockRequestEventId,
//       slot,
//       blockOutline,
//       isLastBlock,
//     })
//   }

//   // Safrole Ticket Events

//   /**
//    * Emit generating tickets event (returns event ID for linking)
//    */
//   async emitGeneratingTickets(epochIndex: bigint): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 80n,
//       timestamp: this.getCurrentTimestamp(),
//       epochIndex,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit ticket generation failed event
//    */
//   async emitTicketGenerationFailed(
//     generatingTicketsEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 81n,
//       timestamp: this.getCurrentTimestamp(),
//       generatingTicketsEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit tickets generated event
//    */
//   async emitTicketsGenerated(
//     generatingTicketsEventId: bigint,
//     ticketVrfOutputs: Uint8Array[],
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 82n,
//       timestamp: this.getCurrentTimestamp(),
//       generatingTicketsEventId,
//       ticketVrfOutputs,
//     })
//   }

//   /**
//    * Emit ticket transfer failed event
//    */
//   async emitTicketTransferFailed(
//     peerId: Uint8Array,
//     connectionSide: 'local' | 'remote',
//     wasCe132Used: boolean,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 83n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       connectionSide,
//       wasCe132Used,
//       reason,
//     })
//   }

//   /**
//    * Emit ticket transferred event
//    */
//   async emitTicketTransferred(
//     peerId: Uint8Array,
//     connectionSide: 'local' | 'remote',
//     wasCe132Used: boolean,
//     epochIndex: bigint,
//     attemptNumber: 0n | 1n,
//     vrfOutput: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 84n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//       connectionSide,
//       wasCe132Used,
//       epochIndex,
//       attemptNumber,
//       vrfOutput,
//     })
//   }

//   // Guaranteeing Events (90-113)

//   /**
//    * Emit work-package submission event (returns event ID for linking)
//    */
//   async emitWorkPackageSubmission(peerId: Uint8Array): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 90n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit work-package being shared event (returns event ID for linking)
//    */
//   async emitWorkPackageBeingShared(peerId: Uint8Array): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 91n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit work-package failed event
//    */
//   async emitWorkPackageFailed(
//     workPackageEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 92n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit duplicate work-package event
//    */
//   async emitDuplicateWorkPackage(
//     workPackageEventId: bigint,
//     coreIndex: bigint,
//     workPackageHash: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 93n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       coreIndex,
//       workPackageHash,
//     })
//   }

//   /**
//    * Emit work-package received event
//    */
//   async emitWorkPackageReceived(
//     workPackageEventId: bigint,
//     coreIndex: bigint,
//     workPackageOutline: WorkPackageOutline,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 94n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       coreIndex,
//       workPackageOutline,
//     })
//   }

//   /**
//    * Emit authorized event
//    */
//   async emitAuthorized(
//     workPackageEventId: bigint,
//     isAuthorizedCost: IsAuthorizedCost,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 95n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       isAuthorizedCost,
//     })
//   }

//   /**
//    * Emit extrinsic data received event
//    */
//   async emitExtrinsicDataReceived(
//     workPackageEventId: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 96n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//     })
//   }

//   /**
//    * Emit imports received event
//    */
//   async emitImportsReceived(workPackageEventId: bigint): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 97n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//     })
//   }

//   /**
//    * Emit sharing work-package event (returns event ID for linking)
//    */
//   async emitSharingWorkPackage(
//     workPackageSubmissionEventId: bigint,
//     peerId: Uint8Array,
//   ): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 98n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit work-package sharing failed event
//    */
//   async emitWorkPackageSharingFailed(
//     workPackageSubmissionEventId: bigint,
//     peerId: Uint8Array,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 99n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//       peerId,
//       reason,
//     })
//   }

//   /**
//    * Emit bundle sent event
//    */
//   async emitBundleSent(
//     workPackageSubmissionEventId: bigint,
//     peerId: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 100n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//       peerId,
//     })
//   }

//   /**
//    * Emit refined event
//    */
//   async emitRefined(
//     workPackageEventId: bigint,
//     refineCosts: RefineCost[],
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 101n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       refineCosts,
//     })
//   }

//   /**
//    * Emit work-report built event
//    */
//   async emitWorkReportBuilt(
//     workPackageEventId: bigint,
//     workReportOutline: WorkReportOutline,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 102n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageEventId,
//       workReportOutline,
//     })
//   }

//   /**
//    * Emit work-report signature sent event
//    */
//   async emitWorkReportSignatureSent(
//     workPackageBeingSharedEventId: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 103n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageBeingSharedEventId,
//     })
//   }

//   /**
//    * Emit work-report signature received event
//    */
//   async emitWorkReportSignatureReceived(
//     workPackageSubmissionEventId: bigint,
//     peerId: Uint8Array,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 104n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//       peerId,
//     })
//   }

//   /**
//    * Emit guarantee built event (returns event ID for linking)
//    */
//   async emitGuaranteeBuilt(
//     workPackageSubmissionEventId: bigint,
//     guaranteeOutline: GuaranteeOutline,
//   ): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 105n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//       guaranteeOutline,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit sending guarantee event (returns event ID for linking)
//    */
//   async emitSendingGuarantee(
//     guaranteeBuiltEventId: bigint,
//     peerId: Uint8Array,
//   ): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 106n,
//       timestamp: this.getCurrentTimestamp(),
//       guaranteeBuiltEventId,
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit guarantee send failed event
//    */
//   async emitGuaranteeSendFailed(
//     sendingGuaranteeEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 107n,
//       timestamp: this.getCurrentTimestamp(),
//       sendingGuaranteeEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit guarantee sent event
//    */
//   async emitGuaranteeSent(sendingGuaranteeEventId: bigint): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 108n,
//       timestamp: this.getCurrentTimestamp(),
//       sendingGuaranteeEventId,
//     })
//   }

//   /**
//    * Emit guarantees distributed event
//    */
//   async emitGuaranteesDistributed(
//     workPackageSubmissionEventId: bigint,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 109n,
//       timestamp: this.getCurrentTimestamp(),
//       workPackageSubmissionEventId,
//     })
//   }

//   /**
//    * Emit receiving guarantee event (returns event ID for linking)
//    */
//   async emitReceivingGuarantee(peerId: Uint8Array): SafePromise<void> {
//     const [error] = await this.sendEvent({
//       eventType: 110n,
//       timestamp: this.getCurrentTimestamp(),
//       peerId,
//     })
//     if (error) {
//       return safeError(error)
//     }
//     return safeResult(undefined)
//   }

//   /**
//    * Emit guarantee receive failed event
//    */
//   async emitGuaranteeReceiveFailed(
//     receivingGuaranteeEventId: bigint,
//     reason: string,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 111n,
//       timestamp: this.getCurrentTimestamp(),
//       receivingGuaranteeEventId,
//       reason,
//     })
//   }

//   /**
//    * Emit guarantee received event
//    */
//   async emitGuaranteeReceived(
//     receivingGuaranteeEventId: bigint,
//     guaranteeOutline: GuaranteeOutline,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 112n,
//       timestamp: this.getCurrentTimestamp(),
//       receivingGuaranteeEventId,
//       guaranteeOutline,
//     })
//   }

//   /**
//    * Emit guarantee discarded event
//    */
//   async emitGuaranteeDiscarded(
//     guaranteeOutline: GuaranteeOutline,
//     discardReason: GuaranteeDiscardReason,
//   ): SafePromise<void> {
//     return await this.sendEvent({
//       eventType: 113n,
//       timestamp: this.getCurrentTimestamp(),
//       guaranteeOutline,
//       discardReason,
//     })
//   }

//   // Additional helper methods for commonly used patterns

//   /**
//    * Helper: Create node info for initial connection
//    */
//   createNodeInfo(
//     nodeId: string,
//     address: string,
//     version = '0.0.1',
//   ): {
//     protocolVersion: number
//     peerId: Uint8Array
//     peerAddress: string
//     nodeFlags: number
//     implementationName: string
//     implementationVersion: string
//     additionalInfo: string
//   } {
//     // Convert nodeId to 32-byte peer ID (this would normally be the Ed25519 public key)
//     const peerId = new Uint8Array(32)
//     const nodeIdBytes = new TextEncoder().encode(nodeId)
//     peerId.set(nodeIdBytes.slice(0, Math.min(32, nodeIdBytes.length)))

//     return {
//       protocolVersion: 0,
//       peerId,
//       peerAddress: address,
//       nodeFlags: 0, // Example flag
//       implementationName: 'PeanutButterAndJam',
//       implementationVersion: version,
//       additionalInfo: `JAM node implementation in TypeScript`,
//     }
//   }

//   /**
//    * Helper: Create IPv6 address from IPv4
//    */
//   static ipv4ToIpv6(ipv4: string, port: number): string {
//     const ipv4Parts = ipv4.split('.').map(Number)
//     if (
//       ipv4Parts.length !== 4 ||
//       ipv4Parts.some((part) => part < 0 || part > 255)
//     ) {
//       throw new Error('Invalid IPv4 address')
//     }

//     // Create IPv6-mapped IPv4 address (::ffff:x.x.x.x)
//     const ipv6 = new Uint8Array(16)
//     ipv6[10] = 0xff
//     ipv6[11] = 0xff
//     ipv6.set(ipv4Parts, 12)

//     return `${ipv6.toString()}:${port}`
//   }

//   /**
//    * Helper: Create block outline from basic parameters
//    */
//   static createBlockOutline(
//     sizeInBytes: bigint,
//     headerHash: Uint8Array,
//     ticketCount = 0n,
//     preimageCount = 0n,
//     guaranteeCount = 0n,
//     assuranceCount = 0n,
//   ): BlockOutline {
//     return {
//       sizeInBytes,
//       headerHash,
//       ticketCount,
//       preimageCount,
//       preimagesSizeInBytes: 0n,
//       guaranteeCount,
//       assuranceCount,
//       disputeVerdictCount: 0n,
//     }
//   }
// }
