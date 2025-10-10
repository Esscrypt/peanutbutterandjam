import { Buffer } from 'node:buffer'
import { logger } from '@pbnj/core'
import type { EncodedData, ErasureCoder } from '@pbnj/types'

// Rust native module types
interface RustEncodedResult {
  shards: Buffer[]
  k: number
  n: number
  originalLength: number
  indices: number[]
}

interface RustReedSolomonClass {
  new (k: number, n: number): RustReedSolomonInstance
}

interface RustReedSolomonInstance {
  encode(data: Buffer): RustEncodedResult
  decode(encoded: RustEncodedResult): Buffer
}

interface RustNativeModule {
  ReedSolomonCoder: RustReedSolomonClass
}

/**
 * Rust-based Reed-Solomon erasure coding implementation
 * Follows Gray Paper Appendix H.6 specification
 */
export class RustReedSolomonCoder implements ErasureCoder {
  private readonly rustInstance: RustReedSolomonInstance
  private readonly _k: number
  private readonly _n: number
  public readonly nativeModuleAvailable: boolean

  constructor(k: number, n: number) {
    this._k = k
    this._n = n
    this.nativeModuleAvailable = false

    logger.debug('DEBUG: RustReedSolomonCoder constructor called', { k, n })

    try {
      // Try to load the native module
      const nativeModule =
        require('../rust-reed-solomon/native') as RustNativeModule

      if (!nativeModule?.ReedSolomonCoder) {
        throw new Error('Native module does not export ReedSolomonCoder class')
      }

      // Create Rust instance
      this.rustInstance = new nativeModule.ReedSolomonCoder(k, n)

      this.nativeModuleAvailable = true

      logger.debug(
        'Successfully loaded native module: jam-reed-solomon.darwin-arm64.node',
      )
      logger.debug('Rust Reed-Solomon Coder initialized', {
        k: this.k,
        n: this.n,
        parityShards: this.n - this.k,
      })
    } catch (error) {
      logger.error('Failed to load Rust Reed-Solomon native module', { error })
      throw new Error(`Failed to initialize Rust Reed-Solomon: ${error}`)
    }
  }

  /**
   * Get the k parameter (number of data shards)
   */
  get k(): number {
    return this._k
  }

  /**
   * Get the n parameter (total number of shards)
   */
  get n(): number {
    return this._n
  }

  /**
   * Encode data using the Rust Reed-Solomon implementation
   * Follows Gray Paper Appendix H.6 specification
   */
  encode(data: Uint8Array): EncodedData {
    const actualK = this.k
    const actualN = this.n

    logger.debug('DEBUG: RustReedSolomonCoder.encode called', {
      inputSize: data.length,
      actualK,
      actualN,
      nativeModuleAvailable: this.nativeModuleAvailable,
    })

    if (actualK <= 0 || actualN <= actualK) {
      throw new Error(`Invalid parameters: k=${actualK}, n=${actualN}`)
    }

    logger.debug('Encoding with Rust Reed-Solomon (Gray Paper H.6)', {
      inputSize: data.length,
      k: actualK,
      n: actualN,
    })

    try {
      const dataBuffer = Buffer.from(data)
      const result: RustEncodedResult = this.rustInstance.encode(dataBuffer)

      logger.debug('Rust encoding complete', {
        shardCount: result.shards.length,
        k: result.k,
        n: result.n,
        originalLength: result.originalLength,
        shardSizes: result.shards.map((s) => s.length),
        fullResult: result,
      })

      logger.debug('DEBUG: About to return EncodedData', {
        originalLength: result.originalLength,
        dataLength: data.length,
        match: result.originalLength === data.length,
      })

      // Convert Buffer[] to Uint8Array[]
      const shards = result.shards.map((buffer) => new Uint8Array(buffer))

      return {
        shards,
        k: result.k,
        n: result.n,
        originalLength: result.originalLength,
        indices: result.indices,
      }
    } catch (error) {
      logger.error('Rust encoding failed', { error })
      throw error
    }
  }

  /**
   * Decode shards using the Rust Reed-Solomon implementation
   * Follows Gray Paper Appendix H.6 specification
   */
  decode(shards: Uint8Array[], originalLength: number): Uint8Array {
    const actualK = this.k
    const actualN = this.n

    if (actualK <= 0 || actualN <= actualK) {
      throw new Error(`Invalid parameters: k=${actualK}, n=${actualN}`)
    }

    logger.debug('Decoding with Rust Reed-Solomon (Gray Paper H.6)', {
      totalShards: shards.length,
      k: actualK,
      originalLength,
    })

    try {
      // Convert Uint8Array[] to Buffer[]
      const shardBuffers = shards.map((shard) => Buffer.from(shard))

      // Create EncodedResult object for the Rust decode method
      // Note: Rust implementation produces k + 2*k shards total
      const totalShards = actualK + 2 * actualK

      logger.debug('DEBUG: TypeScript decode wrapper', {
        inputShards: shards.length,
        expectedShards: totalShards,
        actualK,
        actualN,
        originalLength,
      })

      const encodedResult: RustEncodedResult = {
        shards: shardBuffers,
        k: actualK,
        n: totalShards,
        originalLength: originalLength >>> 0,
        indices: Array.from({ length: totalShards }, (_, i) => i),
      }

      const result: Buffer = this.rustInstance.decode(encodedResult)

      logger.debug('Rust decoding complete', {
        decodedLength: result.length,
        originalLength,
        shardCount: shardBuffers.length,
        shardSizes: shardBuffers.map((s) => s.length),
      })

      return new Uint8Array(result)
    } catch (error) {
      logger.error('Rust decoding failed', { error })
      throw error
    }
  }
}

/**
 * Check if the Rust native module is available
 */
export function isRustModuleAvailable(): boolean {
  try {
    require('../rust-reed-solomon/native')
    return true
  } catch {
    return false
  }
}
