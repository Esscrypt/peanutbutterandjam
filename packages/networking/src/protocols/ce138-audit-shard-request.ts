/**
 * CE 138: Audit Shard Request Protocol
 *
 * Implements the audit shard request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting bundle shards from assurers.
 */

import {
  bytesToHex,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type {
  AuditShardRequest,
  AuditShardResponse,
  Safe,
  SafePromise,
} from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Audit shard request protocol handler
 */
export class AuditShardRequestProtocol extends NetworkingProtocol<
  AuditShardRequest,
  AuditShardResponse
> {
  private readonly eventBusService: EventBusService
  // Track event IDs for request/response linking
  private readonly requestEventIds: Map<string, bigint> = new Map()

  constructor(eventBus: EventBusService) {
    super()
    this.eventBusService = eventBus

    this.initializeEventHandlers()
  }

  /**
   * Generate a unique key for tracking request event IDs
   */
  private getRequestKey(
    peerPublicKey: Hex,
    erasureRoot: Hex,
    shardIndex: bigint,
  ): string {
    return `${peerPublicKey}:${erasureRoot}:${shardIndex.toString()}`
  }

  /**
   * Process audit shard request and generate response
   */
  async processRequest(
    request: AuditShardRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE138] Processing audit shard request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      erasureRoot: request.erasureRoot,
      shardIndex: request.shardIndex.toString(),
    })

    // Emit JIP-3 receiving bundle shard request event (JIP-3: 141)
    const eventId = await this.eventBusService.emitReceivingBundleShardRequest(
      hexToBytes(peerPublicKey),
    )

    // Store event ID for linking with response
    const requestKey = this.getRequestKey(
      peerPublicKey,
      request.erasureRoot,
      request.shardIndex,
    )
    this.requestEventIds.set(requestKey, eventId)

    // Emit JIP-3 bundle shard request received event (JIP-3: 144)
    await this.eventBusService.emitBundleShardRequestReceived(
      eventId,
      hexToBytes(request.erasureRoot),
      request.shardIndex,
    )

    // Legacy event for backwards compatibility
    this.eventBusService.emitAuditShardRequest(request, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Serialize audit shard request message
   */
  serializeRequest(request: AuditShardRequest): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32 + 4) // erasureRoot + shardIndex
    const view = new DataView(buffer)
    let offset = 0

    // Write erasure root (32 bytes)
    new Uint8Array(buffer).set(hexToBytes(request.erasureRoot), offset)
    offset += 32

    // Write shard index (4 bytes, little-endian)
    view.setUint32(offset, Number(request.shardIndex), true)

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize audit shard request message
   */
  deserializeRequest(data: Uint8Array): Safe<AuditShardRequest> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read erasure root (32 bytes)
    const erasureRoot = bytesToHex(data.slice(offset, offset + 32))
    offset += 32

    // Read shard index (4 bytes, little-endian)
    const shardIndex = view.getUint32(offset, true)

    return safeResult({
      erasureRoot,
      shardIndex: BigInt(shardIndex),
    })
  }

  /**
   * Serialize audit shard response message
   */
  serializeResponse(response: AuditShardResponse): Safe<Uint8Array> {
    // Serialize according to JAMNP-S specification
    const bundleShardBytes = hexToBytes(response.bundleShard)
    const justificationBytes = response.justification

    const buffer = new ArrayBuffer(
      4 + 4 + bundleShardBytes.length + justificationBytes.length,
    )
    const view = new DataView(buffer)
    let offset = 0

    // Write bundle shard length (4 bytes, little-endian)
    view.setUint32(offset, bundleShardBytes.length, true)
    offset += 4

    // Write bundle shard data
    new Uint8Array(buffer).set(bundleShardBytes, offset)
    offset += bundleShardBytes.length

    // Write justification length (4 bytes, little-endian)
    view.setUint32(offset, justificationBytes.length, true)
    offset += 4

    // Write justification data
    new Uint8Array(buffer).set(justificationBytes, offset)

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize audit shard response message
   */
  deserializeResponse(data: Uint8Array): Safe<AuditShardResponse> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read bundle shard length (4 bytes, little-endian)
    const bundleShardLength = view.getUint32(offset, true)
    offset += 4

    // Read bundle shard data
    const bundleShard = bytesToHex(
      data.slice(offset, offset + bundleShardLength),
    )
    offset += bundleShardLength

    // Read justification length (4 bytes, little-endian)
    const justificationLength = view.getUint32(offset, true)
    offset += 4

    // Read justification data
    const justification = bytesToHex(
      data.slice(offset, offset + justificationLength),
    )

    return safeResult({
      bundleShard,
      justification: hexToBytes(justification),
    })
  }

  async processResponse(
    response: AuditShardResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Look up event ID from the original request
    // Since we don't have erasureRoot and shardIndex in the response, use the first available event ID for this peer
    let eventId: bigint | undefined
    for (const [key, id] of this.requestEventIds.entries()) {
      if (key.startsWith(`${peerPublicKey}:`)) {
        eventId = id
        this.requestEventIds.delete(key)
        break
      }
    }

    // If no event ID found, generate a new one (fallback)
    if (eventId === undefined) {
      eventId = BigInt(Date.now())
    }

    // Emit JIP-3 bundle shard transferred event (JIP-3: 145)
    await this.eventBusService.emitBundleShardTransferred(eventId)

    // Legacy event for backwards compatibility
    this.eventBusService.emitAuditShardResponse(response, peerPublicKey)
    return safeResult(undefined)
  }
}
