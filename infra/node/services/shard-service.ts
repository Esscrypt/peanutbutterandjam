/**
 * Shard Service - Erasure Coding and Shard Management
 *
 * Provides erasure coding functionality using the Rust Reed-Solomon implementation
 * Handles encoding, decoding, and shard recovery operations for JAM protocol
 */

import {
  type EventBusService,
  logger,
  type SafePromise,
  safeError,
  safeResult,
} from '@pbnj/core'
import {
  type EncodedData,
  type ErasureCodingValidationResult,
  isRustModuleAvailable,
  RustReedSolomonCoder,
} from '@pbnj/erasure-coding'
import { BaseService, type IConfigService } from '@pbnj/types'
import type { ConfigService } from './config-service'

/**
 * Default configurations based on JAM protocol specifications
 *
 * According to Gray Paper:
 * - Tiny edition: rate 2:6 (k=2, n=6) for testing with V=6 validators
 * - Full edition: rate 342:1023 (k=342, n=1023) for production with V=1023 validators
 */

/**
 * Shard service configuration
 */
export interface ShardServiceConfig {
  /** Configuration service for getting validator count and EC parameters */
  configService: IConfigService
  /** Shard size in octet pairs (default: 2) */
  shardSize?: number
  /** Enable automatic recovery */
  autoRecovery?: boolean
  /** Enable performance metrics */
  enableMetrics?: boolean
}

/**
 * Shard encoding result
 */
export interface ShardEncodingResult {
  /** Encoded shards */
  shards: Uint8Array[]
  /** Reed-Solomon parameters used */
  parameters: {
    k: number
    n: number
    originalLength: number
    shardSize: number
  }
  /** Validation result if enabled */
  validation?: ErasureCodingValidationResult
}

/**
 * Shard decoding result
 */
export interface ShardDecodingResult {
  /** Decoded data */
  data: Uint8Array
  /** Performance metrics if enabled */
  metrics?: {
    decodeTimeMs: number
    shardCount: number
  }
}

/**
 * Shard recovery result
 */
export interface ShardRecoveryResult {
  /** Recovered data */
  data: Uint8Array
  /** Indices of corrupted shards that were recovered */
  recoveredIndices: number[]
  /** Performance metrics if enabled */
  metrics?: {
    recoveryTimeMs: number
    corruptedShardCount: number
  }
}

/**
 * Shard service implementation
 */
export class ShardService extends BaseService {
  private readonly configService: ConfigService
  private readonly coder: RustReedSolomonCoder
  private readonly isInitialized = false

  constructor(configService: ConfigService, _eventBusService: EventBusService) {
    super('shard-service')
    this.configService = configService

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
   * Encode data into shards using Reed-Solomon erasure coding
   * Uses Gray Paper compliant shard size (2 octet pairs = 4 octets)
   */
  async encodeData(data: Uint8Array): SafePromise<EncodedData> {
    return safeResult(this.coder.encode(data))
  }

  /**
   * Decode shards back to original data
   */
  async decode(
    shards: Uint8Array[],
    originalLength: number,
  ): SafePromise<Uint8Array> {
    if (!this.coder) {
      return safeError(new Error('Shard service not initialized'))
    }

    const decoded = this.coder.decode(shards, originalLength)

    return safeResult(decoded)
  }

  /**
   * Check if the service is ready for operations
   */
  isReady(): boolean {
    return this.isInitialized && this.coder !== null && this.running
  }
}
