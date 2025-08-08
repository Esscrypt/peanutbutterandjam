/**
 * CE 137: Shard Distribution Protocol
 *
 * Implements the shard distribution protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting EC shards from guarantors.
 */

import type { 
  Bytes, 
  ShardDistributionRequest,
  ShardDistributionResponse,
  StreamInfo
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Shard distribution protocol handler
 */
export class ShardDistributionProtocol {
  private bundleShards: Map<string, Bytes> = new Map()
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
      // Load shards from database (service ID 7 for shards)
      console.log('Shard distribution state loading - protocol not yet fully implemented')
    } catch (error) {
      console.error('Failed to load shard distribution state from database:', error)
    }
  }

  /**
   * Store bundle shard in local store and persist to database
   */
  async storeBundleShard(erasureRoot: Bytes, shardIndex: number, bundleShard: Bytes): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_bundle`
    this.bundleShards.set(key, bundleShard)
    
    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          7, // Service ID 7 for shards
          Buffer.from(key),
          bundleShard
        )
      } catch (error) {
        console.error('Failed to persist bundle shard to database:', error)
      }
    }
  }

  /**
   * Store segment shards in local store and persist to database
   */
  async storeSegmentShards(erasureRoot: Bytes, shardIndex: number, segmentShards: Bytes[]): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_segments`
    this.segmentShards.set(key, segmentShards)
    
    // Persist to database if available
    if (this.dbIntegration) {
      try {
        // Store each segment shard individually
        for (let i = 0; i < segmentShards.length; i++) {
          const segmentKey = `${key}_${i}`
          await this.dbIntegration.setServiceStorage(
            7,
            Buffer.from(segmentKey),
            segmentShards[i]
          )
        }
        
        // Store metadata with segment count
        const metadata = {
          count: segmentShards.length,
          timestamp: Date.now()
        }
        
        await this.dbIntegration.setServiceStorage(
          7,
          Buffer.from(`${key}_meta`),
          Buffer.from(JSON.stringify(metadata), 'utf8')
        )
      } catch (error) {
        console.error('Failed to persist segment shards to database:', error)
      }
    }
  }

  /**
   * Store justification in local store and persist to database
   */
  async storeJustification(erasureRoot: Bytes, shardIndex: number, justification: Bytes): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_justification`
    this.justifications.set(key, justification)
    
    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          7, // Service ID 7 for shards
          Buffer.from(key),
          justification
        )
      } catch (error) {
        console.error('Failed to persist justification to database:', error)
      }
    }
  }

  /**
   * Get bundle shard from local store
   */
  getBundleShard(erasureRoot: Bytes, shardIndex: number): Bytes | undefined {
    const key = `${erasureRoot.toString()}_${shardIndex}_bundle`
    return this.bundleShards.get(key)
  }

  /**
   * Get segment shards from local store
   */
  getSegmentShards(erasureRoot: Bytes, shardIndex: number): Bytes[] | undefined {
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
   * Get bundle shard from database if not in local store
   */
  async getBundleShardFromDatabase(erasureRoot: Bytes, shardIndex: number): Promise<Bytes | null> {
    if (this.getBundleShard(erasureRoot, shardIndex)) {
      return this.getBundleShard(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_bundle`
      const bundleShard = await this.dbIntegration.getServiceStorage(
        7,
        Buffer.from(key)
      )
      
      if (bundleShard) {
        // Cache in local store
        this.bundleShards.set(key, bundleShard)
        return bundleShard
      }
      
      return null
    } catch (error) {
      console.error('Failed to get bundle shard from database:', error)
      return null
    }
  }

  /**
   * Get segment shards from database if not in local store
   */
  async getSegmentShardsFromDatabase(erasureRoot: Bytes, shardIndex: number): Promise<Bytes[] | null> {
    if (this.getSegmentShards(erasureRoot, shardIndex)) {
      return this.getSegmentShards(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_segments`
      
      // Get metadata to know how many segments
      const metadataData = await this.dbIntegration.getServiceStorage(
        7,
        Buffer.from(`${key}_meta`)
      )
      
      if (!metadataData) return null
      
      const metadata = JSON.parse(metadataData.toString())
      const segmentShards: Bytes[] = []
      
      // Get each segment shard
      for (let i = 0; i < metadata.count; i++) {
        const segmentKey = `${key}_${i}`
        const segmentShard = await this.dbIntegration.getServiceStorage(
          7,
          Buffer.from(segmentKey)
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
  async getJustificationFromDatabase(erasureRoot: Bytes, shardIndex: number): Promise<Bytes | null> {
    if (this.getJustification(erasureRoot, shardIndex)) {
      return this.getJustification(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_justification`
      const justification = await this.dbIntegration.getServiceStorage(
        7,
        Buffer.from(key)
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
   * Process shard distribution request and generate response
   */
  async processShardDistributionRequest(request: ShardDistributionRequest): Promise<ShardDistributionResponse | null> {
    try {
      // Get bundle shard
      const bundleShard = await this.getBundleShardFromDatabase(request.erasureRoot, request.shardIndex)
      if (!bundleShard) {
        console.log(`Bundle shard not found for erasure root: ${request.erasureRoot.toString().substring(0, 16)}..., shard index: ${request.shardIndex}`)
        return null
      }

      // Get segment shards
      const segmentShards = await this.getSegmentShardsFromDatabase(request.erasureRoot, request.shardIndex)
      if (!segmentShards) {
        console.log(`Segment shards not found for erasure root: ${request.erasureRoot.toString().substring(0, 16)}..., shard index: ${request.shardIndex}`)
        return null
      }

      // Get justification
      const justification = await this.getJustificationFromDatabase(request.erasureRoot, request.shardIndex)

      console.log(`Found shards for erasure root: ${request.erasureRoot.toString().substring(0, 16)}..., shard index: ${request.shardIndex}`)

      return {
        bundleShard,
        segmentShards,
        justification: justification || Buffer.alloc(0) // Empty buffer if no justification
      }
    } catch (error) {
      console.error('Failed to process shard distribution request:', error)
      return null
    }
  }

  /**
   * Create shard distribution request message
   */
  createShardDistributionRequest(erasureRoot: Bytes, shardIndex: number): ShardDistributionRequest {
    return {
      erasureRoot,
      shardIndex
    }
  }

  /**
   * Serialize shard distribution request message
   */
  serializeShardDistributionRequest(request: ShardDistributionRequest): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(32 + 4) // erasureRoot + shardIndex
    const view = new DataView(buffer)
    let offset = 0

    // Write erasure root (32 bytes)
    new Uint8Array(buffer).set(request.erasureRoot, offset)
    offset += 32

    // Write shard index (4 bytes, little-endian)
    view.setUint32(offset, request.shardIndex, true)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize shard distribution request message
   */
  deserializeShardDistributionRequest(data: Bytes): ShardDistributionRequest {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read erasure root (32 bytes)
    const erasureRoot = data.slice(offset, offset + 32)
    offset += 32

    // Read shard index (4 bytes, little-endian)
    const shardIndex = view.getUint32(offset, true)

    return {
      erasureRoot,
      shardIndex
    }
  }

  /**
   * Serialize shard distribution response message
   */
  serializeShardDistributionResponse(response: ShardDistributionResponse): Bytes {
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
    new Uint8Array(buffer).set(response.bundleShard, offset)
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

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize shard distribution response message
   */
  deserializeShardDistributionResponse(data: Bytes): ShardDistributionResponse {
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

    // Read justification length (4 bytes, little-endian)
    const justificationLength = view.getUint32(offset, true)
    offset += 4

    // Read justification data
    const justification = data.slice(offset, offset + justificationLength)

    return {
      bundleShard,
      segmentShards,
      justification
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(stream: StreamInfo, data: Bytes): Promise<ShardDistributionResponse | null> {
    try {
      const request = this.deserializeShardDistributionRequest(data)
      return await this.processShardDistributionRequest(request)
    } catch (error) {
      console.error('Failed to handle shard distribution stream data:', error)
      return null
    }
  }
} 