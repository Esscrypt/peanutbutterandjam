import { Buffer } from 'node:buffer'
import { logger } from '@pbnjam/core'
import type { EncodedData, ErasureCoder, ShardWithIndex } from '@pbnjam/types'

// Rust native module types
interface RustShardWithIndex {
  shard: Buffer
  index: number
}

interface RustEncodedResult {
  shardsWithIndices: RustShardWithIndex[]
  originalLength: number
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

    if (actualK <= 0 || actualN <= actualK) {
      throw new Error(`Invalid parameters: k=${actualK}, n=${actualN}`)
    }

    const dataBuffer = Buffer.from(data)
    const result: RustEncodedResult = this.rustInstance.encode(dataBuffer)

    logger.debug('Rust encode result', {
      result: JSON.stringify(result, null, 2),
      hasShardsWithIndices: !!result.shardsWithIndices,
      shardsWithIndicesLength: result.shardsWithIndices?.length,
    })

    // Convert Rust shards to TypeScript format
    const shards: ShardWithIndex[] = result.shardsWithIndices.map(
      (rustShard) => ({
        shard: new Uint8Array(rustShard.shard),
        index: rustShard.index,
      }),
    )

    return {
      shardsWithIndices: shards,
      originalLength: result.originalLength,
    }
  }

  /**
   * Decode shards using the Rust Reed-Solomon implementation
   * Follows Gray Paper Appendix H.6 specification
   */
  decode(shards: ShardWithIndex[], originalLength: number): Uint8Array {
    // Convert TypeScript shards to Rust format
    const rustShards: RustShardWithIndex[] = shards.map((shard) => ({
      shard: Buffer.from(shard.shard),
      index: shard.index,
    }))

    const encodedResult: RustEncodedResult = {
      shardsWithIndices: rustShards,
      originalLength: originalLength >>> 0,
    }

    return new Uint8Array(this.rustInstance.decode(encodedResult))
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
