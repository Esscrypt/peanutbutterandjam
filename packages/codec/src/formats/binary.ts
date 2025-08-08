/**
 * Binary Codec Implementation
 *
 * Implements binary encoding and decoding for the JAM protocol
 */

import { logger } from '@pbnj/core'
import type { CodecConfig, BinaryConfig, BinaryData, FormatCodec } from '@pbnj/types'

/**
 * Binary codec for efficient data serialization
 */
export class BinaryCodec<T> implements FormatCodec<T> {
  private config: BinaryConfig

  constructor(config: CodecConfig) {
    this.config = {
      ...config,
      littleEndian: true,
      includeTypeInfo: true,
      useCompression: false,
    }
  }

  /**
   * Encode data to binary format
   */
  encode(data: T): Uint8Array {
    const startTime = Date.now()

    logger.debug('Encoding data to binary format', {
      includeTypeInfo: this.config.includeTypeInfo,
      useCompression: this.config.useCompression,
    })

    try {
      // Convert data to binary representation
      const binaryData = this.dataToBinary(data)

      // Add type information if enabled
      if (this.config.includeTypeInfo) {
        const typeInfo = this.addTypeInfo(binaryData.data, data)
        binaryData.data = typeInfo
      }

      // Compress data if enabled
      if (this.config.useCompression) {
        binaryData.data = this.compress(binaryData.data)
      }

      // Calculate checksum
      binaryData.checksum = this.calculateChecksum(binaryData.data)

      // Serialize to final binary format
      const encoded = this.serializeBinaryData(binaryData)

      const encodingTime = Date.now() - startTime

      logger.debug('Binary encoding completed', {
        originalSize: this.getDataSize(data),
        encodedSize: encoded.length,
        encodingTime,
      })

      return encoded
    } catch (error) {
      logger.error('Binary encoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Decode data from binary format
   */
  decode(data: Uint8Array): T {
    const startTime = Date.now()

    logger.debug('Decoding data from binary format', {
      dataSize: data.length,
    })

    try {
      // Deserialize binary data
      const binaryData = this.deserializeBinaryData(data)

      // Verify checksum
      const expectedChecksum = this.calculateChecksum(binaryData.data)
      if (binaryData.checksum !== expectedChecksum) {
        throw new Error('Checksum verification failed')
      }

      // Decompress data if it was compressed
      if (this.config.useCompression) {
        binaryData.data = this.decompress(binaryData.data)
      }

      // Remove type information if it was included
      let actualData: Uint8Array
      if (this.config.includeTypeInfo) {
        actualData = this.removeTypeInfo(binaryData.data)
      } else {
        actualData = binaryData.data
      }

      // Convert binary data back to original format
      const decoded = this.binaryToData(actualData)

      const decodingTime = Date.now() - startTime

      logger.debug('Binary decoding completed', {
        encodedSize: data.length,
        decodedSize: this.getDataSize(decoded),
        decodingTime,
      })

      return decoded
    } catch (error) {
      logger.error('Binary decoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Validate binary data
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

      return true
    } catch {
      return false
    }
  }

  /**
   * Convert data to binary representation
   */
  private dataToBinary(data: T): BinaryData {
    const type = this.getDataType(data)
    const version = 1
    const binaryData = this.serializeData(data)

    return {
      type,
      version,
      data: binaryData,
      checksum: '',
    }
  }

  /**
   * Convert binary data back to original format
   */
  private binaryToData(data: Uint8Array): T {
    // This is a simplified implementation
    // In a real implementation, you would have proper type-specific deserialization
    return JSON.parse(new TextDecoder().decode(data), this.bigIntReviver) as T
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
   * Serialize data to binary
   */
  private serializeData(data: T): Uint8Array {
    // This is a simplified implementation
    // In a real implementation, you would have efficient binary serialization
    const jsonString = JSON.stringify(data, this.bigIntReplacer)
    return new TextEncoder().encode(jsonString)
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
   * Add type information to binary data
   */
  private addTypeInfo(data: Uint8Array, originalData: T): Uint8Array {
    const typeInfo = {
      type: this.getDataType(originalData),
      version: 1,
      timestamp: Date.now(),
    }

    const typeInfoBytes = new TextEncoder().encode(JSON.stringify(typeInfo))
    const result = new Uint8Array(4 + typeInfoBytes.length + data.length)

    // Write type info length (4 bytes)
    const view = new DataView(result.buffer)
    view.setUint32(0, typeInfoBytes.length, this.config.littleEndian)

    // Write type info
    result.set(typeInfoBytes, 4)

    // Write actual data
    result.set(data, 4 + typeInfoBytes.length)

    return result
  }

  /**
   * Remove type information from binary data
   */
  private removeTypeInfo(data: Uint8Array): Uint8Array {
    const view = new DataView(data.buffer)
    const typeInfoLength = view.getUint32(0, this.config.littleEndian)

    // Return data without type info
    return data.slice(4 + typeInfoLength)
  }

  /**
   * Compress binary data
   */
  private compress(data: Uint8Array): Uint8Array {
    // This is a placeholder implementation
    // In a real implementation, you would use a proper compression algorithm
    return data
  }

  /**
   * Decompress binary data
   */
  private decompress(data: Uint8Array): Uint8Array {
    // This is a placeholder implementation
    // In a real implementation, you would use a proper decompression algorithm
    return data
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: Uint8Array): string {
    // Simple checksum implementation
    let checksum = 0
    for (let i = 0; i < data.length; i++) {
      checksum = (checksum + data[i]) & 0xffffffff
    }
    return checksum.toString(16).padStart(8, '0')
  }

  /**
   * Serialize binary data structure to bytes
   */
  private serializeBinaryData(binaryData: BinaryData): Uint8Array {
    const typeBytes = new TextEncoder().encode(binaryData.type)
    const checksumBytes = new TextEncoder().encode(binaryData.checksum)

    const result = new Uint8Array(
      8 + typeBytes.length + 4 + binaryData.data.length + checksumBytes.length,
    )
    const view = new DataView(result.buffer)

    // Write type length and type
    view.setUint32(0, typeBytes.length, this.config.littleEndian)
    result.set(typeBytes, 4)

    // Write version
    view.setUint32(
      4 + typeBytes.length,
      binaryData.version,
      this.config.littleEndian,
    )

    // Write data length and data
    view.setUint32(
      8 + typeBytes.length,
      binaryData.data.length,
      this.config.littleEndian,
    )
    result.set(binaryData.data, 12 + typeBytes.length)

    // Write checksum
    result.set(checksumBytes, 12 + typeBytes.length + binaryData.data.length)

    return result
  }

  /**
   * Deserialize binary data structure from bytes
   */
  private deserializeBinaryData(data: Uint8Array): BinaryData {
    const view = new DataView(data.buffer)

    // Read type length and type
    const typeLength = view.getUint32(0, this.config.littleEndian)
    const typeBytes = data.slice(4, 4 + typeLength)
    const type = new TextDecoder().decode(typeBytes)

    // Read version
    const version = view.getUint32(4 + typeLength, this.config.littleEndian)

    // Read data length and data
    const dataLength = view.getUint32(8 + typeLength, this.config.littleEndian)
    const binaryData = data.slice(12 + typeLength, 12 + typeLength + dataLength)

    // Read checksum
    const checksumBytes = data.slice(12 + typeLength + dataLength)
    const checksum = new TextDecoder().decode(checksumBytes)

    return {
      type,
      version,
      data: binaryData,
      checksum,
    }
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
