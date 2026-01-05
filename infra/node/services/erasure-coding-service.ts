/**
 * Shard Service - Erasure Coding and Shard Management
 *
 * Provides erasure coding functionality using the Rust Reed-Solomon implementation
 * Handles encoding, decoding, and shard recovery operations for JAM protocol
 */

import { logger } from '@pbnjam/core'
import {
  isRustModuleAvailable,
  RustReedSolomonCoder,
} from '@pbnjam/erasure-coding'
import {
  BaseService,
  type EncodedData,
  type SafePromise,
  type ShardWithIndex,
  safeError,
  safeResult,
} from '@pbnjam/types'
import type { ConfigService } from './config-service'

/**
 * Default configurations based on JAM protocol specifications
 *
 * According to Gray Paper:
 * - Tiny edition: rate 2:6 (k=2, n=6) for testing with V=6 validators
 * - Full edition: rate 342:1023 (k=342, n=1023) for production with V=1023 validators
 */

/**
 * Shard encoding result
 */
export interface ShardEncodingResult {
  /** Encoded shards */
  shards: ShardWithIndex[]
  originalLength: number
}

/**
 * Shard recovery result
 */
export interface ShardRecoveryResult {
  /** Recovered data */
  data: Uint8Array
  /** Indices of corrupted shards that were recovered */
  recoveredIndices: number[]
}

/**
 * Shard service implementation
 */
export class ErasureCodingService extends BaseService {
  private readonly configService: ConfigService
  private readonly coder: RustReedSolomonCoder
  private readonly isInitialized = false

  constructor(options: { configService: ConfigService }) {
    super('erasure-coding-service')
    this.configService = options.configService

    // According to Gray Paper: shard size is always 2 octet pairs (4 octets)
    // k = numCores, n = numValidators
    this.coder = new RustReedSolomonCoder(
      this.configService.k,
      this.configService.n,
    )
  }

  /**
   * Start the shard service
   */
  async start(): SafePromise<boolean> {
    if (!isRustModuleAvailable()) {
      return safeError(
        new Error(
          'Rust Reed-Solomon module not available. Please build with: bun run build:native',
        ),
      )
    }

    logger.info('Starting shard service...')
    this.setRunning(true)
    logger.info('Shard service started successfully')
    return safeResult(true)
  }

  /**
   * Stop the shard service
   */
  async stop(): SafePromise<boolean> {
    logger.info('Stopping shard service...')
    this.setRunning(false)
    logger.info('Shard service stopped successfully')
    return safeResult(true)
  }

  /**
   * Encode arbitrary data into shards using Reed-Solomon erasure coding
   *
   * Gray Paper Reference: erasure_coding.tex
   * - Chunks data into segments of Csegmentsize = 4104 octets
   * - Each segment is erasure coded independently
   * - Rust implementation handles zero-padding internally
   *
   * @param data - Arbitrary Uint8Array to encode
   * @returns Promise<ShardEncodingResult> - Encoded shards with metadata
   */
  async encodeData(data: Uint8Array): SafePromise<ShardEncodingResult> {
    const Csegmentsize = 4104 // Gray Paper: segment size

    // Chunk data into segments of Csegmentsize
    const segments: Uint8Array[] = []
    for (let i = 0; i < data.length; i += Csegmentsize) {
      const segment = data.slice(i, i + Csegmentsize)
      segments.push(segment)
    }

    // Encode each segment independently
    const allShards: ShardWithIndex[] = []
    let totalOriginalLength = 0

    for (const segment of segments) {
      const encodedSegment: EncodedData = this.coder.encode(segment)

      // Add segment index to shard metadata (optional)
      allShards.push(...encodedSegment.shardsWithIndices)
      totalOriginalLength += encodedSegment.originalLength
    }

    return safeResult({
      shards: allShards,
      originalLength: totalOriginalLength,
    })
  }

  /**
   * Decode shards back to original data
   *
   * Gray Paper Reference: erasure_coding.tex
   * - Reconstructs data from available shards
   * - Handles multiple segments if data was chunked
   * - Rust implementation handles zero-padding removal
   * - Supports both array and map input formats
   *
   * @param shards - Either array of shards or map of index->shard
   * @param originalLength - Original data length
   * @param includeMetrics - Whether to include performance metrics
   * @returns Promise<ShardDecodingResult> - Reconstructed data with optional metrics
   */
  async decode(
    shards: ShardWithIndex[],
    originalLength: number,
  ): SafePromise<Uint8Array> {
    if (!this.coder) {
      return safeError(new Error('Shard service not initialized'))
    }

    const Csegmentsize = 4104 // Gray Paper: segment size

    // Calculate how many segments we had
    const numSegments = Math.ceil(originalLength / Csegmentsize)

    if (numSegments === 1) {
      // Single segment - decode directly
      const reconstructedData = this.coder.decode(shards, originalLength)
      return safeResult(reconstructedData)
    } else {
      // Multiple segments - need to group shards by segment and decode each separately
      const segmentLength = Csegmentsize
      const reconstructedSegments: Uint8Array[] = []

      for (let segmentIndex = 0; segmentIndex < numSegments; segmentIndex++) {
        // Filter shards that belong to this segment
        // For now, assume shards are ordered by segment (this needs to be improved)
        const segmentShards = shards.slice(
          segmentIndex * this.configService.n,
          (segmentIndex + 1) * this.configService.n,
        )

        // Calculate segment length (last segment might be shorter)
        const isLastSegment = segmentIndex === numSegments - 1
        const currentSegmentLength = isLastSegment
          ? originalLength - segmentIndex * segmentLength
          : segmentLength

        const segmentData = this.coder.decode(
          segmentShards,
          currentSegmentLength,
        )
        reconstructedSegments.push(segmentData)
      }

      // Concatenate all segments
      const totalLength = reconstructedSegments.reduce(
        (sum, seg) => sum + seg.length,
        0,
      )
      const reconstructedData = new Uint8Array(totalLength)
      let offset = 0

      for (const segment of reconstructedSegments) {
        reconstructedData.set(segment, offset)
        offset += segment.length
      }

      return safeResult(reconstructedData)
    }
  }

  /**
   * Check if the service is ready for operations
   */
  isReady(): boolean {
    return this.isInitialized && this.coder !== null && this.running
  }
}
