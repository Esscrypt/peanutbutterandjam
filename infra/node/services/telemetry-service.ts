/**
 * Telemetry Integration Helper
 *
 * Provides utilities for integrating telemetry event emission throughout the JAM node
 * according to JIP-3 specification.
 */

import { type SafePromise, safeError, safeResult } from '@pbnj/core'
import { type TelemetryClient, TelemetryEventEmitter } from '@pbnj/telemetry'
import type { AccumulateCost, BlockOutline } from '@pbnj/types'
import { BaseService } from '../interfaces/service'

export class TelemetryService extends BaseService {
  private telemetryClient: TelemetryClient
  private telemetryEmitter: TelemetryEventEmitter | null = null

  constructor(telemetryClient: TelemetryClient) {
    super('telemetry')
    this.telemetryClient = telemetryClient
  }

  async init(): SafePromise<boolean> {
    super.init()
    this.telemetryEmitter = new TelemetryEventEmitter(this.telemetryClient)
    return safeResult(true)
  }

  async start(): SafePromise<boolean> {
    super.start()
    const started = await this.telemetryClient.start()
    if (!started) {
      return safeError(new Error('Failed to start telemetry client'))
    }
    return safeResult(true)
  }

  async stop(): SafePromise<boolean> {
    super.stop()
    await this.telemetryClient.stop()
    return safeResult(true)
  }

  public async emitConnectionRefused(peerAddress: string): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectionRefused(peerAddress)
  }

  public async emitConnectingIn(peerAddress: string): SafePromise<bigint> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectingIn(peerAddress)
  }

  public async emitConnectedIn(
    eventId: bigint,
    peerId: Uint8Array,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectedIn(eventId, peerId)
  }

  public async emitConnectInFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectInFailed(eventId, reason)
  }

  public async emitConnectingOut(
    peerId: Uint8Array,
    peerAddress: string,
  ): SafePromise<bigint> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectingOut(peerId, peerAddress)
  }

  public async emitConnectedOut(eventId: bigint): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectedOut(eventId)
  }

  public async emitConnectOutFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitConnectOutFailed(eventId, reason)
  }

  public async emitDisconnected(
    peerId: Uint8Array,
    reason: string,
    terminator?: 'local' | 'remote',
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitDisconnected(
      peerId,
      reason,
      terminator,
    )
  }

  public async emitPeerMisbehaved(
    peerId: Uint8Array,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitPeerMisbehaved(peerId, reason)
  }

  public async emitAuthoring(
    slot: bigint,
    parentHeaderHash: Uint8Array,
  ): SafePromise<bigint> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return this.telemetryEmitter.emitAuthoring(slot, parentHeaderHash)
  }

  public async emitAuthoringFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitAuthoringFailed(eventId, reason)
  }

  public async emitAuthored(
    eventId: bigint,
    blockOutline: BlockOutline,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitAuthored(eventId, blockOutline)
  }

  public async emitImporting(
    slot: bigint,
    blockOutline: BlockOutline,
  ): SafePromise<bigint> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitImporting(slot, blockOutline)
  }

  public async emitBlockVerificationFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitBlockVerificationFailed(
      eventId,
      reason,
    )
  }

  public async emitBlockVerified(eventId: bigint): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitBlockVerified(eventId)
  }

  public async emitBlockExecutionFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitBlockExecutionFailed(eventId, reason)
  }

  public async emitBlockExecuted(
    eventId: bigint,
    accumulatedServices: Array<{ serviceId: bigint; cost: AccumulateCost }>,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitBlockExecuted(
      eventId,
      accumulatedServices,
    )
  }

  public async emitBestBlockChanged(
    slot: bigint,
    headerHash: Uint8Array,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitBestBlockChanged(slot, headerHash)
  }

  public async emitFinalizedBlockChanged(
    slot: bigint,
    headerHash: Uint8Array,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitFinalizedBlockChanged(
      slot,
      headerHash,
    )
  }

  public async emitSyncStatusChanged(isSynced: boolean): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitSyncStatusChanged(isSynced)
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
  }): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitStatus(status)
  }

  public async emitGeneratingTickets(epochIndex: bigint): SafePromise<bigint> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitGeneratingTickets(epochIndex)
  }

  public async emitTicketGenerationFailed(
    eventId: bigint,
    reason: string,
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitTicketGenerationFailed(
      eventId,
      reason,
    )
  }

  public async emitTicketsGenerated(
    eventId: bigint,
    ticketVrfOutputs: Uint8Array[],
  ): SafePromise<void> {
    if (!this.telemetryEmitter)
      return safeError(new Error('Telemetry emitter not initialized'))
    return await this.telemetryEmitter.emitTicketsGenerated(
      eventId,
      ticketVrfOutputs,
    )
  }
}
