/**
 * CE 139-140: Segment Shard Request Protocol
 *
 * Implements the segment shard request protocol for JAMNP-S
 * CE 139: Without justification
 * CE 140: With justification
 */

import type { EventBusService, Hex } from '@pbnjam/core'
import { bytesToHex, hexToBytes, logger } from '@pbnjam/core'
import type {
  Safe,
  SafePromise,
  SegmentShardRequest,
  SegmentShardResponse,
} from '@pbnjam/types'
import { safeResult } from '@pbnjam/types'
import { NetworkingProtocol } from './protocol'

/**
 * Segment shard request protocol handler
 */
export class SegmentShardRequestProtocol extends NetworkingProtocol<
  SegmentShardRequest,
  SegmentShardResponse
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
  private getRequestKey(peerPublicKey: Hex, requestIndex: number): string {
    return `${peerPublicKey}:${requestIndex}`
  }

  /**
   * Process segment shard request and generate response
   */
  async processRequest(
    request: SegmentShardRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    const totalSegmentIndices = request.requests.reduce(
      (sum, req) => sum + req.segmentIndices.length,
      0,
    )

    logger.info('[CE139-140] Processing segment shard request', {
      peerPublicKey: `${peerPublicKey.slice(0, 20)}...`,
      requestsCount: request.requests.length,
      totalSegmentIndices,
    })

    // Emit JIP-3 receiving segment shard request event (JIP-3: 163)
    // Determine if CE 140 is used - we'll check this when processing the response
    // For now, set to false (will be corrected when response is processed)
    const eventId = await this.eventBus.emitReceivingSegmentShardRequest(
      hexToBytes(peerPublicKey),
      false, // Will be determined from response justifications
    )

    // Store event ID for linking with response (use first request as key)
    if (request.requests.length > 0) {
      const requestKey = this.getRequestKey(peerPublicKey, 0)
      this.requestEventIds.set(requestKey, eventId)
    }

    // Calculate total number of segment shards requested
    const shardCount = request.requests.reduce(
      (sum, req) => sum + BigInt(req.segmentIndices.length),
      0n,
    )

    // Emit JIP-3 segment shard request received event (JIP-3: 166)
    await this.eventBus.emitSegmentShardRequestReceived(eventId, shardCount)

    // Legacy event for backwards compatibility
    this.eventBus.emitSegmentShardRequest(request, peerPublicKey)
    return safeResult(undefined)
  }

  async processResponse(
    response: SegmentShardResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    // Note: CE 140 can be determined from presence of justifications in response
    // CE 140 includes justifications, CE 139 does not
    // However, the receivingSegmentShardRequest event was already emitted in processRequest
    // with usingCE140=false. In a full implementation, we'd either:
    // 1. Know the protocol kind (139 vs 140) at request time, or
    // 2. Emit a correction event when we determine CE 140 was used

    // Look up event ID from the original request
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

    // Emit JIP-3 segment shards transferred event (JIP-3: 167)
    await this.eventBus.emitSegmentShardsTransferred(eventId)

    // Legacy event for backwards compatibility
    this.eventBus.emitSegmentShardResponse(response, peerPublicKey)
    return safeResult(undefined)
  }

  /**
   * Serialize segment shard request message
   */
  serializeRequest(request: SegmentShardRequest): Safe<Uint8Array> {
    // Calculate total size
    let totalSize = 4 // number of requests

    for (const req of request.requests) {
      totalSize += 32 + 4 + 4 // erasureRoot + shardIndex + number of segment indices
      totalSize += req.segmentIndices.length * 4 // segment indices
    }

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write number of requests (4 bytes, little-endian)
    view.setUint32(offset, request.requests.length, true)
    offset += 4

    // Write each request
    for (const req of request.requests) {
      // Write erasure root (32 bytes)
      new Uint8Array(buffer).set(hexToBytes(req.erasureRoot), offset)
      offset += 32

      // Write shard index (4 bytes, little-endian)
      view.setUint32(offset, Number(req.shardIndex), true)
      offset += 4

      // Write number of segment indices (4 bytes, little-endian)
      view.setUint32(offset, req.segmentIndices.length, true)
      offset += 4

      // Write segment indices
      for (const segmentIndex of req.segmentIndices) {
        view.setUint32(offset, segmentIndex, true)
        offset += 4
      }
    }

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize segment shard request message
   */
  deserializeRequest(data: Uint8Array): Safe<SegmentShardRequest> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of requests (4 bytes, little-endian)
    const numRequests = view.getUint32(offset, true)
    offset += 4

    const requests: Array<{
      erasureRoot: Hex
      shardIndex: bigint
      segmentIndices: number[]
    }> = []

    // Read each request
    for (let i = 0; i < numRequests; i++) {
      // Read erasure root (32 bytes)
      const erasureRoot = bytesToHex(data.slice(offset, offset + 32))
      offset += 32

      // Read shard index (4 bytes, little-endian)
      const shardIndex = view.getUint32(offset, true)
      offset += 4

      // Read number of segment indices (4 bytes, little-endian)
      const numSegmentIndices = view.getUint32(offset, true)
      offset += 4

      // Read segment indices
      const segmentIndices: number[] = []
      for (let j = 0; j < numSegmentIndices; j++) {
        const segmentIndex = view.getUint32(offset, true)
        offset += 4
        segmentIndices.push(segmentIndex)
      }

      requests.push({
        erasureRoot,
        shardIndex: BigInt(shardIndex),
        segmentIndices,
      })
    }

    return safeResult({
      requests,
    })
  }

  /**
   * Serialize segment shard response message
   */
  serializeResponse(response: SegmentShardResponse): Safe<Uint8Array> {
    // Calculate total size
    let totalSize = 4 + 4 // number of segment shards + number of justifications

    // Size for segment shards
    for (const segmentShard of response.segmentShards) {
      const shardBytes = hexToBytes(segmentShard)
      totalSize += 4 + shardBytes.length // segment shard length + segment shard data
    }

    // Size for justifications
    if (response.justifications) {
      for (const justification of response.justifications) {
        const justBytes = justification
        totalSize += 4 + justBytes.length // justification length + justification data
      }
    }

    const buffer = new ArrayBuffer(totalSize)
    const view = new DataView(buffer)
    let offset = 0

    // Write number of segment shards (4 bytes, little-endian)
    view.setUint32(offset, response.segmentShards.length, true)
    offset += 4

    // Write segment shards
    for (const segmentShard of response.segmentShards) {
      const shardBytes = hexToBytes(segmentShard)
      // Write segment shard length (4 bytes, little-endian)
      view.setUint32(offset, shardBytes.length, true)
      offset += 4

      // Write segment shard data
      new Uint8Array(buffer).set(shardBytes, offset)
      offset += shardBytes.length
    }

    // Write number of justifications (4 bytes, little-endian)
    const numJustifications = response.justifications
      ? response.justifications.length
      : 0
    view.setUint32(offset, numJustifications, true)
    offset += 4

    // Write justifications
    if (response.justifications) {
      for (const justification of response.justifications) {
        const justBytes = justification
        // Write justification length (4 bytes, little-endian)
        view.setUint32(offset, justBytes.length, true)
        offset += 4

        // Write justification data
        new Uint8Array(buffer).set(justBytes, offset)
        offset += justBytes.length
      }
    }

    return safeResult(new Uint8Array(buffer))
  }

  /**
   * Deserialize segment shard response message
   */
  deserializeResponse(data: Uint8Array): Safe<SegmentShardResponse> {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of segment shards (4 bytes, little-endian)
    const numSegmentShards = view.getUint32(offset, true)
    offset += 4

    // Read segment shards
    const segmentShards: Hex[] = []
    for (let i = 0; i < numSegmentShards; i++) {
      // Read segment shard length (4 bytes, little-endian)
      const segmentShardLength = view.getUint32(offset, true)
      offset += 4

      // Read segment shard data
      const segmentShard = bytesToHex(
        data.slice(offset, offset + segmentShardLength),
      )
      offset += segmentShardLength

      segmentShards.push(segmentShard)
    }

    // Read number of justifications (4 bytes, little-endian)
    const numJustifications = view.getUint32(offset, true)
    offset += 4

    // Read justifications
    const justifications: Hex[] = []
    for (let i = 0; i < numJustifications; i++) {
      // Read justification length (4 bytes, little-endian)
      const justificationLength = view.getUint32(offset, true)
      offset += 4

      // Read justification data
      const justification = bytesToHex(
        data.slice(offset, offset + justificationLength),
      )
      offset += justificationLength

      justifications.push(justification)
    }

    return safeResult({
      segmentShards,
      justifications:
        justifications.length > 0
          ? justifications.map((j) => hexToBytes(j))
          : undefined,
    })
  }
}
