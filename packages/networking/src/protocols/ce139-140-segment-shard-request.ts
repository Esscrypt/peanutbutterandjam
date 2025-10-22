/**
 * CE 139-140: Segment Shard Request Protocol
 *
 * Implements the segment shard request protocol for JAMNP-S
 * CE 139: Without justification
 * CE 140: With justification
 */

import type { EventBusService, Hex, Safe, SafePromise } from '@pbnj/core'
import { bytesToHex, hexToBytes, safeResult } from '@pbnj/core'
import type { SegmentShardRequest, SegmentShardResponse } from '@pbnj/types'
import { NetworkingProtocol } from './protocol'

/**
 * Segment shard request protocol handler
 */
export class SegmentShardRequestProtocol extends NetworkingProtocol<
  SegmentShardRequest,
  SegmentShardResponse
> {
  private readonly eventBus: EventBusService

  constructor(eventBus: EventBusService) {
    super()
    this.eventBus = eventBus

    this.initializeEventHandlers()
  }

  /**
   * Process segment shard request and generate response
   */
  async processRequest(
    request: SegmentShardRequest,
    peerPublicKey: Hex,
  ): SafePromise<void> {
    this.eventBus.emitSegmentShardRequest(request, peerPublicKey)
    return safeResult(undefined)
  }

  async processResponse(
    response: SegmentShardResponse,
    peerPublicKey: Hex,
  ): SafePromise<void> {
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
