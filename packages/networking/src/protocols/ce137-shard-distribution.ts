/**
 * CE 137: Shard Distribution Protocol
 *
 * Implements the shard distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting EC shards from guarantors.
 */

import {
  bytesToHex,
  type EventBusService,
  type Hex,
  hexToBytes,
  logger,
} from '@pbnjam/core'
import type {
  Safe,
  SafePromise,
  ShardDistributionRequest,
  ShardDistributionResponse,
} from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Shard distribution protocol handler
 */
export class ShardDistributionProtocol extends NetworkingProtocol<
  ShardDistributionRequest,
  ShardDistributionResponse
> {
  private readonly eventBus: EventBusService
  // Track event IDs for request/response linking
  private readonly requestEventIds: Map<string, bigint> = new Map()

  constructor(eventBus: EventBusService) {
    super()
    this.eventBus = eventBus

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
   * Process shard distribution request and generate response
   */
  async processRequest(
    request: ShardDistributionRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    logger.info('[CE137] Processing shard distribution request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      erasureRoot: request.erasureRoot,
      shardIndex: request.shardIndex.toString(),
    })

    // Emit JIP-3 receiving shard request event
    const eventId = await this.eventBus.emitReceivingShardRequest(
      hexToBytes(peerPublicKey),
    )

    // Store event ID for linking with response
    const requestKey = this.getRequestKey(
      peerPublicKey,
      request.erasureRoot,
      request.shardIndex,
    )
    this.requestEventIds.set(requestKey, eventId)

    // Emit JIP-3 shard request received event
    await this.eventBus.emitShardRequestReceived(
      eventId,
      hexToBytes(request.erasureRoot),
      request.shardIndex,
    )

    // Legacy event for backwards compatibility
    this.eventBus.emitShardDistributionRequest(request, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Process shard distribution response and generate request
   */
  async processResponse(
    response: ShardDistributionResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Note: We need the erasureRoot and shardIndex from the original request to look up the event ID
    // Since we don't have that in the response, we'll use the first available event ID for this peer
    // In a full implementation, the response would include request identifiers
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

    // Emit JIP-3 shards transferred event
    await this.eventBus.emitShardsTransferred(eventId)

    // Legacy event for backwards compatibility
    this.eventBus.emitShardDistributionResponse(response, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Serialize shard distribution request message
   */
  serializeRequest(request: ShardDistributionRequest): Safe<Uint8Array> {
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
   * Deserialize shard distribution request message
   */
  deserializeRequest(data: Uint8Array): Safe<ShardDistributionRequest> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read erasure root (32 bytes)
    const erasureRoot = data.slice(offset, offset + 32)
    offset += 32

    // Read shard index (4 bytes, little-endian)
    const shardIndex = view.getUint32(offset, true)

    return safeResult({
      erasureRoot: bytesToHex(erasureRoot),
      shardIndex: BigInt(shardIndex),
    })
  }

  /**
   * Serialize shard distribution response message
   */
  serializeResponse(response: ShardDistributionResponse): Safe<Uint8Array> {
    // Calculate total size
    let totalSize = 4 + 4 + 4 // bundle shard length + number of segment shards + justification length

    // Size for bundle shard
    totalSize += response.bundleShard.length

    // Size for segment shards
    for (const segmentShard of response.segmentShards) {
      totalSize += 4 + segmentShard.length // segment shard length + segment shard data
    }

    // Size for justification
    totalSize += response.justification.length

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write bundle shard length (4 bytes, little-endian)
    view.setUint32(offset, response.bundleShard.length, true)
    offset += 4

    // Write bundle shard data
    new Uint8Array(buffer).set(hexToBytes(response.bundleShard), offset)
    offset += response.bundleShard.length

    // Write number of segment shards (4 bytes, little-endian)
    view.setUint32(offset, response.segmentShards.length, true)
    offset += 4

    // Write segment shards
    for (const segmentShard of response.segmentShards) {
      // Write segment shard length (4 bytes, little-endian)
      view.setUint32(offset, segmentShard.length, true)
      offset += 4

      // Write segment shard data
      new Uint8Array(buffer).set(segmentShard, offset)
      offset += segmentShard.length
    }

    // Write justification length (4 bytes, little-endian)
    view.setUint32(offset, response.justification.length, true)
    offset += 4

    // Write justification data
    new Uint8Array(buffer).set(response.justification, offset)

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize shard distribution response message
   */
  deserializeResponse(data: Uint8Array): Safe<ShardDistributionResponse> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read bundle shard length (4 bytes, little-endian)
    const bundleShardLength = view.getUint32(offset, true)
    offset += 4

    // Read bundle shard data
    const bundleShard = data.slice(offset, offset + bundleShardLength)
    offset += bundleShardLength

    // Read number of segment shards (4 bytes, little-endian)
    const numSegmentShards = view.getUint32(offset, true)
    offset += 4

    // Read segment shards
    const segmentShards: Uint8Array[] = []
    for (let i = 0; i < numSegmentShards; i++) {
      // Read segment shard length (4 bytes, little-endian)
      const segmentShardLength = view.getUint32(offset, true)
      offset += 4

      // Read segment shard data
      const segmentShard = data.slice(offset, offset + segmentShardLength)
      offset += segmentShardLength

      segmentShards.push(segmentShard)
    }

    // Read justification length (4 bytes, little-endian)
    const justificationLength = view.getUint32(offset, true)
    offset += 4

    // Read justification data
    const justification = data.slice(offset, offset + justificationLength)

    return safeResult({
      bundleShard: bytesToHex(bundleShard),
      segmentShards,
      justification,
    })
  }
}
