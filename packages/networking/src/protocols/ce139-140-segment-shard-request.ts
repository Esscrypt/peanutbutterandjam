/**
 * CE 139-140: Segment Shard Request Protocol
 *
 * Implements the segment shard request protocol for JAMNP-S
 * CE 139: Without justification
 * CE 140: With justification
 */

import type {
  Bytes,
  SegmentShardRequest,
  SegmentShardResponse,
  StreamInfo,
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Segment shard request protocol handler
 */
export class SegmentShardRequestProtocol {
  private segmentShards: Map<string, Bytes[]> = new Map()
  private justifications: Map<string, Bytes> = new Map()
  private dbIntegration: NetworkingDatabaseIntegration | null = null

  constructor(dbIntegration?: NetworkingDatabaseIntegration) {
    this.dbIntegration = dbIntegration || null
  }

  /**
   * Set database integration for persistent storage
   */
  setDatabaseIntegration(dbIntegration: NetworkingDatabaseIntegration): void {
    this.dbIntegration = dbIntegration
  }

  /**
   * Load state from database
   */
  async loadState(): Promise<void> {
    if (!this.dbIntegration) return

    try {
      // Load segment shards from database (service ID 9 for segment shards)
      console.log(
        'Segment shard request state loading - protocol not yet fully implemented',
      )
    } catch (error) {
      console.error(
        'Failed to load segment shard request state from database:',
        error,
      )
    }
  }

  /**
   * Store segment shards in local store and persist to database
   */
  async storeSegmentShards(
    erasureRoot: Bytes,
    shardIndex: number,
    segmentShards: Bytes[],
  ): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_segments`
    this.segmentShards.set(key, segmentShards)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        // Store each segment shard individually
        for (let i = 0; i < segmentShards.length; i++) {
          const segmentKey = `${key}_${i}`
          await this.dbIntegration.setServiceStorage(
            9, // Service ID 9 for segment shards
            Buffer.from(segmentKey),
            segmentShards[i],
          )
        }

        // Store metadata with segment count
        const metadata = {
          count: segmentShards.length,
          timestamp: Date.now(),
        }

        await this.dbIntegration.setServiceStorage(
          9,
          Buffer.from(`${key}_meta`),
          Buffer.from(JSON.stringify(metadata), 'utf8'),
        )
      } catch (error) {
        console.error('Failed to persist segment shards to database:', error)
      }
    }
  }

  /**
   * Store justification in local store and persist to database
   */
  async storeJustification(
    erasureRoot: Bytes,
    shardIndex: number,
    justification: Bytes,
  ): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_justification`
    this.justifications.set(key, justification)

    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          9, // Service ID 9 for segment shards
          Buffer.from(key),
          justification,
        )
      } catch (error) {
        console.error('Failed to persist justification to database:', error)
      }
    }
  }

  /**
   * Get segment shards from local store
   */
  getSegmentShards(
    erasureRoot: Bytes,
    shardIndex: number,
  ): Bytes[] | undefined {
    const key = `${erasureRoot.toString()}_${shardIndex}_segments`
    return this.segmentShards.get(key)
  }

  /**
   * Get justification from local store
   */
  getJustification(erasureRoot: Bytes, shardIndex: number): Bytes | undefined {
    const key = `${erasureRoot.toString()}_${shardIndex}_justification`
    return this.justifications.get(key)
  }

  /**
   * Get segment shards from database if not in local store
   */
  async getSegmentShardsFromDatabase(
    erasureRoot: Bytes,
    shardIndex: number,
  ): Promise<Bytes[] | null> {
    if (this.getSegmentShards(erasureRoot, shardIndex)) {
      return this.getSegmentShards(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_segments`

      // Get metadata to know how many segments
      const metadataData = await this.dbIntegration.getServiceStorage(
        9,
        Buffer.from(`${key}_meta`),
      )

      if (!metadataData) return null

      const metadata = JSON.parse(metadataData.toString())
      const segmentShards: Bytes[] = []

      // Get each segment shard
      for (let i = 0; i < metadata.count; i++) {
        const segmentKey = `${key}_${i}`
        const segmentShard = await this.dbIntegration.getServiceStorage(
          9,
          Buffer.from(segmentKey),
        )

        if (segmentShard) {
          segmentShards.push(segmentShard)
        }
      }

      if (segmentShards.length > 0) {
        // Cache in local store
        this.segmentShards.set(key, segmentShards)
        return segmentShards
      }

      return null
    } catch (error) {
      console.error('Failed to get segment shards from database:', error)
      return null
    }
  }

  /**
   * Get justification from database if not in local store
   */
  async getJustificationFromDatabase(
    erasureRoot: Bytes,
    shardIndex: number,
  ): Promise<Bytes | null> {
    if (this.getJustification(erasureRoot, shardIndex)) {
      return this.getJustification(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_justification`
      const justification = await this.dbIntegration.getServiceStorage(
        9,
        Buffer.from(key),
      )

      if (justification) {
        // Cache in local store
        this.justifications.set(key, justification)
        return justification
      }

      return null
    } catch (error) {
      console.error('Failed to get justification from database:', error)
      return null
    }
  }

  /**
   * Process segment shard request and generate response
   */
  async processSegmentShardRequest(
    request: SegmentShardRequest,
  ): Promise<SegmentShardResponse | null> {
    try {
      // Process all requests in the array
      const allSegmentShards: Bytes[] = []
      const allJustifications: Bytes[] = []

      for (const req of request.requests) {
        // Get segment shards from local store or database
        const segmentShards = await this.getSegmentShardsFromDatabase(
          req.erasureRoot,
          req.shardIndex,
        )

        if (!segmentShards) {
          console.log(
            `Segment shards not found for erasure root: ${req.erasureRoot.toString().substring(0, 16)}..., shard index: ${req.shardIndex}`,
          )
          return null
        }

        // Get justification if available
        const justification = await this.getJustificationFromDatabase(
          req.erasureRoot,
          req.shardIndex,
        )
        if (justification) {
          allJustifications.push(justification)
        }

        // Add segment shards for the requested indices
        for (const segmentIndex of req.segmentIndices) {
          if (segmentIndex < segmentShards.length) {
            allSegmentShards.push(segmentShards[segmentIndex])
          }
        }

        console.log(
          `Found segment shards for erasure root: ${req.erasureRoot.toString().substring(0, 16)}..., shard index: ${req.shardIndex}`,
        )
      }

      return {
        segmentShards: allSegmentShards,
        justifications:
          allJustifications.length > 0 ? allJustifications : undefined,
      }
    } catch (error) {
      console.error('Failed to process segment shard request:', error)
      return null
    }
  }

  /**
   * Create segment shard request message
   */
  createSegmentShardRequest(
    requests: Array<{
      erasureRoot: Bytes
      shardIndex: number
      segmentIndices: number[]
    }>,
  ): SegmentShardRequest {
    return {
      requests,
    }
  }

  /**
   * Serialize segment shard request message
   */
  serializeSegmentShardRequest(request: SegmentShardRequest): Bytes {
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
      new Uint8Array(buffer).set(req.erasureRoot, offset)
      offset += 32

      // Write shard index (4 bytes, little-endian)
      view.setUint32(offset, req.shardIndex, true)
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

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize segment shard request message
   */
  deserializeSegmentShardRequest(data: Bytes): SegmentShardRequest {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of requests (4 bytes, little-endian)
    const numRequests = view.getUint32(offset, true)
    offset += 4

    const requests: Array<{
      erasureRoot: Bytes
      shardIndex: number
      segmentIndices: number[]
    }> = []

    // Read each request
    for (let i = 0; i < numRequests; i++) {
      // Read erasure root (32 bytes)
      const erasureRoot = data.slice(offset, offset + 32)
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
        shardIndex,
        segmentIndices,
      })
    }

    return {
      requests,
    }
  }

  /**
   * Serialize segment shard response message
   */
  serializeSegmentShardResponse(response: SegmentShardResponse): Bytes {
    // Calculate total size
    let totalSize = 4 + 4 // number of segment shards + number of justifications

    // Size for segment shards
    for (const segmentShard of response.segmentShards) {
      totalSize += 4 + segmentShard.length // segment shard length + segment shard data
    }

    // Size for justifications
    if (response.justifications) {
      for (const justification of response.justifications) {
        totalSize += 4 + justification.length // justification length + justification data
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
      // Write segment shard length (4 bytes, little-endian)
      view.setUint32(offset, segmentShard.length, true)
      offset += 4

      // Write segment shard data
      new Uint8Array(buffer).set(segmentShard, offset)
      offset += segmentShard.length
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
        // Write justification length (4 bytes, little-endian)
        view.setUint32(offset, justification.length, true)
        offset += 4

        // Write justification data
        new Uint8Array(buffer).set(justification, offset)
        offset += justification.length
      }
    }

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize segment shard response message
   */
  deserializeSegmentShardResponse(data: Bytes): SegmentShardResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read number of segment shards (4 bytes, little-endian)
    const numSegmentShards = view.getUint32(offset, true)
    offset += 4

    // Read segment shards
    const segmentShards: Bytes[] = []
    for (let i = 0; i < numSegmentShards; i++) {
      // Read segment shard length (4 bytes, little-endian)
      const segmentShardLength = view.getUint32(offset, true)
      offset += 4

      // Read segment shard data
      const segmentShard = data.slice(offset, offset + segmentShardLength)
      offset += segmentShardLength

      segmentShards.push(segmentShard)
    }

    // Read number of justifications (4 bytes, little-endian)
    const numJustifications = view.getUint32(offset, true)
    offset += 4

    // Read justifications
    const justifications: Bytes[] = []
    for (let i = 0; i < numJustifications; i++) {
      // Read justification length (4 bytes, little-endian)
      const justificationLength = view.getUint32(offset, true)
      offset += 4

      // Read justification data
      const justification = data.slice(offset, offset + justificationLength)
      offset += justificationLength

      justifications.push(justification)
    }

    return {
      segmentShards,
      justifications: justifications.length > 0 ? justifications : undefined,
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(
    _stream: StreamInfo,
    data: Bytes,
  ): Promise<SegmentShardResponse | null> {
    try {
      const request = this.deserializeSegmentShardRequest(data)
      return await this.processSegmentShardRequest(request)
    } catch (error) {
      console.error(
        'Failed to handle segment shard request stream data:',
        error,
      )
      return null
    }
  }
}
