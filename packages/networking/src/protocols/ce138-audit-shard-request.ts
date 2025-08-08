/**
 * CE 138: Audit Shard Request Protocol
 *
 * Implements the audit shard request protocol for JAMNP-S
 * This is a Common Ephemeral (CE) stream for requesting bundle shards from assurers.
 */

import type { 
  Bytes, 
  AuditShardRequest,
  AuditShardResponse,
  StreamInfo
} from '@pbnj/types'
import type { NetworkingDatabaseIntegration } from '../db-integration'

/**
 * Audit shard request protocol handler
 */
export class AuditShardRequestProtocol {
  private auditShards: Map<string, Bytes> = new Map()
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
      // Load audit shards from database (service ID 8 for audit shards)
      console.log('Audit shard request state loading - protocol not yet fully implemented')
    } catch (error) {
      console.error('Failed to load audit shard request state from database:', error)
    }
  }

  /**
   * Store audit shard in local store and persist to database
   */
  async storeAuditShard(erasureRoot: Bytes, shardIndex: number, auditShard: Bytes): Promise<void> {
    const key = `${erasureRoot.toString()}_${shardIndex}_audit`
    this.auditShards.set(key, auditShard)
    
    // Persist to database if available
    if (this.dbIntegration) {
      try {
        await this.dbIntegration.setServiceStorage(
          8, // Service ID 8 for audit shards
          Buffer.from(key),
          auditShard
        )
      } catch (error) {
        console.error('Failed to persist audit shard to database:', error)
      }
    }
  }

  /**
   * Get audit shard from local store
   */
  getAuditShard(erasureRoot: Bytes, shardIndex: number): Bytes | undefined {
    const key = `${erasureRoot.toString()}_${shardIndex}_audit`
    return this.auditShards.get(key)
  }

  /**
   * Get audit shard from database if not in local store
   */
  async getAuditShardFromDatabase(erasureRoot: Bytes, shardIndex: number): Promise<Bytes | null> {
    if (this.getAuditShard(erasureRoot, shardIndex)) {
      return this.getAuditShard(erasureRoot, shardIndex) || null
    }

    if (!this.dbIntegration) return null

    try {
      const key = `${erasureRoot.toString()}_${shardIndex}_audit`
      const auditShard = await this.dbIntegration.getServiceStorage(
        8,
        Buffer.from(key)
      )
      
      if (auditShard) {
        // Cache in local store
        this.auditShards.set(key, auditShard)
        return auditShard
      }
      
      return null
    } catch (error) {
      console.error('Failed to get audit shard from database:', error)
      return null
    }
  }

  /**
   * Process audit shard request and generate response
   */
  async processAuditShardRequest(request: AuditShardRequest): Promise<AuditShardResponse | null> {
    try {
      // Get audit shard from local store or database
      const auditShard = await this.getAuditShardFromDatabase(request.erasureRoot, request.shardIndex)
      
      if (!auditShard) {
        console.log(`Audit shard not found for erasure root: ${request.erasureRoot.toString().substring(0, 16)}..., shard index: ${request.shardIndex}`)
        return null
      }

      console.log(`Found audit shard for erasure root: ${request.erasureRoot.toString().substring(0, 16)}..., shard index: ${request.shardIndex}`)

      return {
        bundleShard: auditShard,
        justification: Buffer.alloc(0) // Empty buffer if no justification
      }
    } catch (error) {
      console.error('Failed to process audit shard request:', error)
      return null
    }
  }

  /**
   * Create audit shard request message
   */
  createAuditShardRequest(erasureRoot: Bytes, shardIndex: number): AuditShardRequest {
    return {
      erasureRoot,
      shardIndex
    }
  }

  /**
   * Serialize audit shard request message
   */
  serializeAuditShardRequest(request: AuditShardRequest): Bytes {
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
   * Deserialize audit shard request message
   */
  deserializeAuditShardRequest(data: Bytes): AuditShardRequest {
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
   * Serialize audit shard response message
   */
  serializeAuditShardResponse(response: AuditShardResponse): Bytes {
    // Serialize according to JAMNP-S specification
    const buffer = new ArrayBuffer(4 + 4 + response.bundleShard.length + response.justification.length)
    const view = new DataView(buffer)
    let offset = 0

    // Write bundle shard length (4 bytes, little-endian)
    view.setUint32(offset, response.bundleShard.length, true)
    offset += 4

    // Write bundle shard data
    new Uint8Array(buffer).set(response.bundleShard, offset)
    offset += response.bundleShard.length

    // Write justification length (4 bytes, little-endian)
    view.setUint32(offset, response.justification.length, true)
    offset += 4

    // Write justification data
    new Uint8Array(buffer).set(response.justification, offset)

    return new Uint8Array(buffer)
  }

  /**
   * Deserialize audit shard response message
   */
  deserializeAuditShardResponse(data: Bytes): AuditShardResponse {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    let offset = 0

    // Read bundle shard length (4 bytes, little-endian)
    const bundleShardLength = view.getUint32(offset, true)
    offset += 4

    // Read bundle shard data
    const bundleShard = data.slice(offset, offset + bundleShardLength)
    offset += bundleShardLength

    // Read justification length (4 bytes, little-endian)
    const justificationLength = view.getUint32(offset, true)
    offset += 4

    // Read justification data
    const justification = data.slice(offset, offset + justificationLength)

    return {
      bundleShard,
      justification
    }
  }

  /**
   * Handle incoming stream data
   */
  async handleStreamData(stream: StreamInfo, data: Bytes): Promise<AuditShardResponse | null> {
    try {
      const request = this.deserializeAuditShardRequest(data)
      return await this.processAuditShardRequest(request)
    } catch (error) {
      console.error('Failed to handle audit shard request stream data:', error)
      return null
    }
  }
} 