/**
 * Core Erasure Coding Implementation
 *
 * Main erasure coding implementation for the JAM protocol
 */

import { ReedSolomon } from './algorithms/reed-solomon'
import type {
  ErasureCoder,
  ErasureCodingParams,
  EncodedData,
  ErasureCodingErrorWithContext,
} from '@pbnj/types'
import { DEFAULT_ERASURE_CODING_PARAMS, ErasureCodingError } from '@pbnj/types'
import type {
  GF2_16,
  PolynomialOps,
  EncodingValidation,
  DecodingValidation,
  ValidationResult
} from './types'
import {
  GF2_16 as GF2_16Impl,
  PolynomialOps as PolynomialOpsImpl,
  EncodingValidation as EncodingValidationImpl,
  DecodingValidation as DecodingValidationImpl
} from './types'

/**
 * Main erasure coding implementation
 */
export class JAMErasureCoder implements ErasureCoder {
  private params: ErasureCodingParams
  private readonly field: GF2_16
  private readonly polynomial: PolynomialOps
  private readonly reedSolomon: ReedSolomon
  private readonly encodingValidation: EncodingValidation
  private readonly decodingValidation: DecodingValidation

  constructor(params: Partial<ErasureCodingParams> = {}) {
    this.params = { ...DEFAULT_ERASURE_CODING_PARAMS, ...params }

    // Initialize algorithms
    this.field = new GF2_16Impl()
    this.polynomial = new PolynomialOpsImpl(this.field)
    this.reedSolomon = new ReedSolomon(this.field, this.polynomial)

    // Initialize validation
    this.encodingValidation = new EncodingValidationImpl()
    this.decodingValidation = new DecodingValidationImpl()

    console.debug('JAM Erasure Coder initialized', { params: this.params })
  }

  /**
   * Encode data into erasure coded shards
   */
  encode(
    data: Uint8Array,
    k: number = this.params.k,
    n: number = this.params.n,
  ): EncodedData {
    const startTime = Date.now()

    console.debug('Starting erasure coding encoding', {
      dataLength: data.length,
      k,
      n,
      fieldSize: this.params.fieldSize,
    })

    try {
      // Validate parameters
      const paramValidation = this.encodingValidation.validateParameters(k, n)
      if (!paramValidation.isValid) {
        throw this.createError(
          ErasureCodingError.INVALID_PARAMETERS,
          'Invalid encoding parameters',
          {
            errors: paramValidation.errors,
            warnings: paramValidation.warnings,
          },
        )
      }

      // Validate input data
      const dataValidation = this.encodingValidation.validateInputData(data)
      if (!dataValidation.isValid) {
        throw this.createError(
          ErasureCodingError.INVALID_PARAMETERS,
          'Invalid input data',
          { errors: dataValidation.errors, warnings: dataValidation.warnings },
        )
      }

      // Pad data if necessary
      const paddedData = this.padData(data)

      // Split data into words (16-bit elements)
      const words = this.dataToWords(paddedData)

      // Split words into chunks of size k
      const chunks = this.splitIntoChunks(words, k)

      // Encode each chunk and create shards
      const shards: Uint8Array[] = []
      for (let shardIndex = 0; shardIndex < n; shardIndex++) {
        const shardUint8Array: number[] = []

        for (const chunk of chunks) {
          const encodedChunk = this.reedSolomon.encode(chunk, k, n)
          // Take the shardIndex-th element from the encoded chunk
          const shardWord = encodedChunk[shardIndex]
          // Convert word to Uint8Array (little-endian)
          shardUint8Array.push(shardWord & 0xff)
          shardUint8Array.push((shardWord >> 8) & 0xff)
        }

        shards.push(new Uint8Array(shardUint8Array))
      }

      // Create indices
      const indices = Array.from({ length: n }, (_, i) => i)

      const encodedData: EncodedData = {
        originalLength: data.length,
        k,
        n,
        shards,
        indices,
      }

      // Validate encoded data
      const encodedValidation =
        this.encodingValidation.validateEncodedData(encodedData)
      if (!encodedValidation.isValid) {
        throw this.createError(
          ErasureCodingError.ENCODING_ERROR,
          'Encoded data validation failed',
          {
            errors: encodedValidation.errors,
            warnings: encodedValidation.warnings,
          },
        )
      }

      const encodingTime = Date.now() - startTime
      console.debug('Erasure coding encoding completed', {
        originalLength: data.length,
        encodedShards: shards.length,
        encodingTime,
      })

      return encodedData
    } catch (error) {
      const encodingTime = Date.now() - startTime
      console.error('Erasure coding encoding failed', {
        error: error instanceof Error ? error.message : String(error),
        encodingTime,
      })
      throw error
    }
  }

  /**
   * Decode data from erasure coded shards
   */
  decode(encodedData: EncodedData, k: number = this.params.k): Uint8Array {
    const startTime = Date.now()

    console.debug('Starting erasure coding decoding', {
      shardCount: encodedData.shards.length,
      k,
      originalLength: encodedData.originalLength,
    })

    try {
      // Validate parameters
      const paramValidation = this.decodingValidation.validateParameters(
        k,
        encodedData.shards.length,
      )
      if (!paramValidation.isValid) {
        throw this.createError(
          ErasureCodingError.INVALID_PARAMETERS,
          'Invalid decoding parameters',
          {
            errors: paramValidation.errors,
            warnings: paramValidation.warnings,
          },
        )
      }

      // Validate received shards
      const shardValidation = this.decodingValidation.validateReceivedShards(
        encodedData.shards,
        encodedData.indices,
      )
      if (!shardValidation.isValid) {
        throw this.createError(
          ErasureCodingError.INVALID_PARAMETERS,
          'Invalid received shards',
          {
            errors: shardValidation.errors,
            warnings: shardValidation.warnings,
          },
        )
      }

      // Convert shards to words
      const shardWords = encodedData.shards.map((shard) =>
        this.dataToWords(shard),
      )

      // Calculate number of chunks based on shard word length
      const chunksPerShard = shardWords[0].length

      // Decode each chunk
      const decodedChunks: Uint8Array[] = []
      for (let chunkIndex = 0; chunkIndex < chunksPerShard; chunkIndex++) {
        // Collect the chunkIndex-th word from each shard
        const chunkWords = shardWords.map((shard) => shard[chunkIndex])
        const decodedChunk = this.reedSolomon.decode(
          chunkWords,
          k,
          this.params.n,
        )
        const decodedUint8Array = this.wordsToData(decodedChunk)
        decodedChunks.push(decodedUint8Array)
      }

      // Join chunks
      const decodedData = this.joinChunks(decodedChunks)

      // Remove padding
      const unpaddedData = this.unpadData(
        decodedData,
        encodedData.originalLength,
      )

      const decodingTime = Date.now() - startTime
      console.debug('Erasure coding decoding completed', {
        decodedLength: unpaddedData.length,
        decodingTime,
      })

      return unpaddedData
    } catch (error) {
      const decodingTime = Date.now() - startTime
      console.error('Erasure coding decoding failed', {
        error: error instanceof Error ? error.message : String(error),
        decodingTime,
      })
      throw error
    }
  }

  /**
   * Validate encoded data
   */
  validate(encodedData: EncodedData): ValidationResult {
    return this.encodingValidation.validateEncodedData(encodedData)
  }

  /**
   * Pad data to multiple of 684 Uint8Array
   */
  private padData(data: Uint8Array): Uint8Array {
    const blockSize = 684 // 342 words * 2 Uint8Array per word
    const padding = (blockSize - (data.length % blockSize)) % blockSize

    if (padding === 0) {
      return data
    }

    const padded = new Uint8Array(data.length + padding)
    padded.set(data)
    return padded
  }

  /**
   * Remove padding from data
   */
  private unpadData(data: Uint8Array, originalLength: number): Uint8Array {
    return data.slice(0, originalLength)
  }

  /**
   * Convert data to 16-bit words
   */
  private dataToWords(data: Uint8Array): number[] {
    const words: number[] = []
    for (let i = 0; i < data.length; i += 2) {
      const byte1 = data[i]
      const byte2 = i + 1 < data.length ? data[i + 1] : 0
      const word = byte1 | (byte2 << 8) // Little-endian
      words.push(word)
    }
    return words
  }

  /**
   * Convert 16-bit words to data
   */
  private wordsToData(words: number[]): Uint8Array {
    const data = new Uint8Array(words.length * 2)
    for (let i = 0; i < words.length; i++) {
      data[i * 2] = words[i] & 0xff
      data[i * 2 + 1] = (words[i] >> 8) & 0xff
    }
    return data
  }

  /**
   * Split words into chunks of size k
   */
  private splitIntoChunks(words: number[], k: number): number[][] {
    const chunks: number[][] = []
    for (let i = 0; i < words.length; i += k) {
      chunks.push(words.slice(i, i + k))
    }
    return chunks
  }

  /**
   * Join chunks into single data array
   */
  private joinChunks(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  /**
   * Create error with context
   */
  private createError(
    error: ErasureCodingError,
    message: string,
    context?: Record<string, unknown>,
  ): ErasureCodingErrorWithContext {
    return {
      error,
      message,
      context,
    }
  }

  /**
   * Get current parameters
   */
  getParams(): ErasureCodingParams {
    return { ...this.params }
  }

  /**
   * Update parameters
   */
  updateParams(newParams: Partial<ErasureCodingParams>): void {
    this.params = { ...this.params, ...newParams }
    console.debug('Erasure coding parameters updated', { params: this.params })
  }
}
