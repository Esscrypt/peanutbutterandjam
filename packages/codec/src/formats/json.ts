/**
 * JSON Codec Implementation
 *
 * Implements JSON encoding and decoding for the JAM protocol
 */

import { logger } from '@pbnj/core'
import type {
  CodecConfig,
  FormatCodec,
  JsonConfig,
  JsonData,
} from '@pbnj/types'

/**
 * JSON codec for human-readable data serialization
 */
export class JsonCodec<T> implements FormatCodec<T> {
  private config: JsonConfig

  constructor(config: CodecConfig) {
    this.config = {
      ...config,
      prettyPrint: false,
      includeNulls: true,
    }
  }

  /**
   * Encode data to JSON format
   */
  encode(data: T): Uint8Array {
    const startTime = Date.now()

    logger.debug('Encoding data to JSON format', {
      prettyPrint: this.config.prettyPrint,
      includeNulls: this.config.includeNulls,
    })

    try {
      // Create JSON data structure
      const jsonData: JsonData = {
        type: this.getDataType(data),
        version: 1,
        data: data,
        metadata: {
          timestamp: Date.now(),
          encoding: 'json',
          version: '1.0',
        },
      }

      // Convert to JSON string
      const jsonString = this.serializeToJson(jsonData)

      // Convert to bytes
      const encoded = new TextEncoder().encode(jsonString)

      const encodingTime = Date.now() - startTime

      logger.debug('JSON encoding completed', {
        originalSize: this.getDataSize(data),
        encodedSize: encoded.length,
        encodingTime,
      })

      return encoded
    } catch (error) {
      logger.error('JSON encoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Decode data from JSON format
   */
  decode(data: Uint8Array): T {
    const startTime = Date.now()

    logger.debug('Decoding data from JSON format', {
      dataSize: data.length,
    })

    try {
      // Convert bytes to string
      const jsonString = new TextDecoder().decode(data)

      // Parse JSON
      const jsonData = this.deserializeFromJson(jsonString)

      // Validate JSON data structure
      if (!this.validateJsonData(jsonData)) {
        throw new Error('Invalid JSON data structure')
      }

      // Extract actual data
      const decoded = jsonData.data as T

      const decodingTime = Date.now() - startTime

      logger.debug('JSON decoding completed', {
        encodedSize: data.length,
        decodedSize: this.getDataSize(decoded),
        decodingTime,
      })

      return decoded
    } catch (error) {
      logger.error('JSON decoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Validate JSON data
   */
  validate(data: T): boolean {
    try {
      // Basic validation
      if (data === null || data === undefined) {
        return false
      }

      // Check data size
      const dataSize = this.getDataSize(data)
      if (dataSize > this.config.maxDataSize) {
        return false
      }

      // Check for non-serializable values
      if (this.hasNonSerializableValues(data)) {
        return false
      }

      // Try to serialize to JSON to ensure it's valid
      JSON.stringify(data, this.bigIntReplacer)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get data type identifier
   */
  private getDataType(data: T): string {
    if (typeof data === 'string') return 'string'
    if (typeof data === 'number') return 'number'
    if (typeof data === 'boolean') return 'boolean'
    if (Array.isArray(data)) return 'array'
    if (data instanceof Uint8Array) return 'uint8array'
    if (typeof data === 'object') return 'object'
    return 'unknown'
  }

  /**
   * Serialize data to JSON string
   */
  private serializeToJson(jsonData: JsonData): string {
    const options: {
      replacer?: (key: string, value: unknown) => unknown
      space?: string | number
    } = {}

    // Use custom replacer if provided, otherwise use BigInt replacer
    if (this.config.replacer) {
      options.replacer = this.config.replacer
    } else {
      options.replacer = this.bigIntReplacer
    }

    // Use pretty printing if enabled
    if (this.config.prettyPrint) {
      options.space = 2
    }

    return JSON.stringify(jsonData, options.replacer, options.space)
  }

  /**
   * Deserialize data from JSON string
   */
  private deserializeFromJson(jsonString: string): JsonData {
    const options: {
      reviver?: (key: string, value: unknown) => unknown
    } = {}

    // Use custom reviver if provided, otherwise use BigInt reviver
    if (this.config.reviver) {
      options.reviver = this.config.reviver
    } else {
      options.reviver = this.bigIntReviver
    }

    return JSON.parse(jsonString, options.reviver) as JsonData
  }

  /**
   * BigInt replacer for JSON serialization
   */
  private bigIntReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`
    }
    return value
  }

  /**
   * BigInt reviver for JSON deserialization
   */
  private bigIntReviver(_key: string, value: unknown): unknown {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1))
    }
    return value
  }

  /**
   * Validate JSON data structure
   */
  private validateJsonData(jsonData: unknown): jsonData is JsonData {
    if (!jsonData || typeof jsonData !== 'object') {
      return false
    }

    const data = jsonData as Record<string, unknown>

    // Check required fields
    if (typeof data['type'] !== 'string') {
      return false
    }

    if (typeof data['version'] !== 'number') {
      return false
    }

    if (!('data' in data)) {
      return false
    }

    return true
  }

  /**
   * Get data size in bytes
   */
  private getDataSize(data: T): number {
    if (data === null || data === undefined) {
      return 0
    }

    if (typeof data === 'string') {
      return new TextEncoder().encode(data).length
    }

    if (typeof data === 'number') {
      return 8
    }

    if (typeof data === 'bigint') {
      return 8
    }

    if (typeof data === 'boolean') {
      return 1
    }

    if (data instanceof Uint8Array) {
      return data.length
    }

    if (Array.isArray(data)) {
      return data.reduce((size, item) => size + this.getDataSize(item), 0)
    }

    if (typeof data === 'object') {
      return JSON.stringify(data, this.bigIntReplacer).length
    }

    return 0
  }

  /**
   * Check for non-serializable values
   */
  private hasNonSerializableValues(data: T): boolean {
    if (data === null || typeof data !== 'object') {
      return false
    }

    if (data instanceof Function) {
      return true
    }

    if (data instanceof Symbol) {
      return true
    }

    if (data instanceof WeakMap || data instanceof WeakSet) {
      return true
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.hasNonSerializableValues(item))
    }

    return Object.values(data as Record<string, unknown>).some((value) =>
      this.hasNonSerializableValues(value as T),
    )
  }
}
