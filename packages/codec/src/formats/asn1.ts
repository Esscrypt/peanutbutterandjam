/**
 * ASN.1 Codec Implementation
 *
 * Implements ASN.1 encoding and decoding for the JAM protocol
 */

import { logger } from '@pbnj/core'
import type { CodecConfig, Asn1Config, Asn1Data, FormatCodec } from '@pbnj/types'

/**
 * ASN.1 codec for standard data serialization
 */
export class Asn1Codec<T> implements FormatCodec<T> {
  private config: Asn1Config

  constructor(config: CodecConfig) {
    this.config = {
      ...config,
      useBER: true,
      useDER: false,
      validateSchema: false,
    }
  }

  /**
   * Encode data to ASN.1 format
   */
  encode(data: T): Uint8Array {
    const startTime = Date.now()

    logger.debug('Encoding data to ASN.1 format', {
      useBER: this.config.useBER,
      useDER: this.config.useDER,
      validateSchema: this.config.validateSchema,
    })

    try {
      // Convert data to ASN.1 representation
      const asn1Data = this.dataToAsn1(data)

      // Validate against schema if enabled
      if (this.config.validateSchema && this.config.schema) {
        if (!this.validateAgainstSchema(asn1Data)) {
          throw new Error('ASN.1 data validation against schema failed')
        }
      }

      // Encode to ASN.1 format
      const encoded = this.encodeAsn1(asn1Data)

      const encodingTime = Date.now() - startTime

      logger.debug('ASN.1 encoding completed', {
        originalSize: this.getDataSize(data),
        encodedSize: encoded.length,
        encodingTime,
      })

      return encoded
    } catch (error) {
      logger.error('ASN.1 encoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Decode data from ASN.1 format
   */
  decode(data: Uint8Array): T {
    const startTime = Date.now()

    logger.debug('Decoding data from ASN.1 format', {
      dataSize: data.length,
    })

    try {
      // Decode from ASN.1 format
      const asn1Data = this.decodeAsn1(data)

      // Validate against schema if enabled
      if (this.config.validateSchema && this.config.schema) {
        if (!this.validateAgainstSchema(asn1Data)) {
          throw new Error('ASN.1 data validation against schema failed')
        }
      }

      // Convert ASN.1 data back to original format
      const decoded = this.asn1ToData(asn1Data)

      const decodingTime = Date.now() - startTime

      logger.debug('ASN.1 decoding completed', {
        encodedSize: data.length,
        decodedSize: this.getDataSize(decoded),
        decodingTime,
      })

      return decoded
    } catch (error) {
      logger.error('ASN.1 decoding failed', {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Validate ASN.1 data
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

      // Try to convert to ASN.1 to ensure it's valid
      this.dataToAsn1(data)
      return true
    } catch {
      return false
    }
  }

  /**
   * Convert data to ASN.1 representation
   */
  private dataToAsn1(data: T): Asn1Data {
    // This is a simplified implementation
    // In a real implementation, you would have proper ASN.1 conversion
    const dataBytes = this.serializeData(data)

    return {
      tag: 0x04, // OCTET STRING
      length: dataBytes.length,
      value: dataBytes,
      constructed: false,
    }
  }

  /**
   * Convert ASN.1 data back to original format
   */
  private asn1ToData(asn1Data: Asn1Data): T {
    // This is a simplified implementation
    // In a real implementation, you would have proper ASN.1 conversion
    return this.deserializeData(asn1Data.value) as T
  }

  /**
   * Serialize data to bytes
   */
  private serializeData(data: T): Uint8Array {
    // This is a simplified implementation
    // In a real implementation, you would have proper ASN.1 serialization
    const jsonString = JSON.stringify(data, this.bigIntReplacer)
    return new TextEncoder().encode(jsonString)
  }

  /**
   * Deserialize data from bytes
   */
  private deserializeData(data: Uint8Array): T {
    // This is a simplified implementation
    // In a real implementation, you would have proper ASN.1 deserialization
    const jsonString = new TextDecoder().decode(data)
    return JSON.parse(jsonString, this.bigIntReviver) as T
  }

  /**
   * BigInt replacer for JSON serialization
   */
  private bigIntReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString()
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
   * Encode ASN.1 data to bytes
   */
  private encodeAsn1(asn1Data: Asn1Data): Uint8Array {
    const result: number[] = []

    // Add tag
    result.push(asn1Data.tag)

    // Add length
    if (asn1Data.length < 128) {
      // Short form
      result.push(asn1Data.length)
    } else {
      // Long form
      const lengthBytes = this.intToBytes(asn1Data.length)
      result.push(0x80 | lengthBytes.length)
      result.push(...lengthBytes)
    }

    // Add value
    result.push(...Array.from(asn1Data.value))

    return new Uint8Array(result)
  }

  /**
   * Decode ASN.1 data from bytes
   */
  private decodeAsn1(data: Uint8Array): Asn1Data {
    let offset = 0

    // Read tag
    const tag = data[offset++]

    // Read length
    let length: number
    if ((data[offset] & 0x80) === 0) {
      // Short form
      length = data[offset++]
    } else {
      // Long form
      const lengthLength = data[offset++] & 0x7f
      length = this.bytesToInt(data.slice(offset, offset + lengthLength))
      offset += lengthLength
    }

    // Read value
    const value = data.slice(offset, offset + length)

    return {
      tag,
      length,
      value,
      constructed: (tag & 0x20) !== 0,
    }
  }

  /**
   * Convert integer to bytes
   */
  private intToBytes(value: number): number[] {
    const bytes: number[] = []
    while (value > 0) {
      bytes.unshift(value & 0xff)
      value = value >> 8
    }
    return bytes.length > 0 ? bytes : [0]
  }

  /**
   * Convert bytes to integer
   */
  private bytesToInt(bytes: Uint8Array): number {
    let value = 0
    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i]
    }
    return value
  }

  /**
   * Validate ASN.1 data against schema
   */
  private validateAgainstSchema(_asn1Data: Asn1Data): boolean {
    // This is a placeholder implementation
    // In a real implementation, you would validate against the actual ASN.1 schema
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
