/**
 * Core Codec Implementation
 *
 * Main codec implementation for the JAM protocol
 */

import { logger } from '@pbnj/core'
import { Asn1Codec } from './formats/asn1'
import { BinaryCodec } from './formats/binary'
import { JsonCodec } from './formats/json'
import type {
  Codec,
  CodecConfig,
  CodecErrorWithContext,
  ValidationResult,
} from './types'
import { CodecError, DEFAULT_CODEC_CONFIG, EncodingFormat } from './types'

/**
 * Main codec implementation
 */
export class JAMCodec<T> implements Codec<T> {
  private config: CodecConfig
  private binaryCodec?: BinaryCodec<T>
  private jsonCodec?: JsonCodec<T>
  private asn1Codec?: Asn1Codec<T>

  constructor(config: Partial<CodecConfig> = {}) {
    this.config = { ...DEFAULT_CODEC_CONFIG, ...config }

    logger.debug('Initializing JAM Codec', {
      config: this.config,
    })
  }

  /**
   * Get or create binary codec
   */
  private getBinaryCodec(): BinaryCodec<T> {
    if (!this.binaryCodec) {
      this.binaryCodec = new BinaryCodec<T>(this.config)
    }
    return this.binaryCodec
  }

  /**
   * Get or create JSON codec
   */
  private getJsonCodec(): JsonCodec<T> {
    if (!this.jsonCodec) {
      this.jsonCodec = new JsonCodec<T>(this.config)
    }
    return this.jsonCodec
  }

  /**
   * Get or create ASN.1 codec
   */
  private getAsn1Codec(): Asn1Codec<T> {
    if (!this.asn1Codec) {
      this.asn1Codec = new Asn1Codec<T>(this.config)
    }
    return this.asn1Codec
  }

  /**
   * Encode data to the specified format
   */
  encode(
    data: T,
    format: EncodingFormat = this.config.defaultFormat,
  ): Uint8Array {
    const startTime = Date.now()

    logger.debug('Encoding data', {
      format,
      dataSize: this.getDataSize(data),
      enableValidation: this.config.enableValidation,
    })

    try {
      // Validate input data if validation is enabled
      if (this.config.enableValidation) {
        const validation = this.validate(data)
        if (!validation.isValid) {
          throw this.createError(
            CodecError.VALIDATION_ERROR,
            'Data validation failed',
            {
              errors: validation.errors,
              warnings: validation.warnings,
            },
          )
        }
      }

      // Check data size limits
      const dataSize = this.getDataSize(data)
      if (dataSize > this.config.maxDataSize) {
        throw this.createError(
          CodecError.ENCODING_ERROR,
          'Data size exceeds maximum limit',
          {
            dataSize,
            maxSize: this.config.maxDataSize,
          },
        )
      }

      // Encode data using the appropriate format codec
      let encoded: Uint8Array
      switch (format) {
        case EncodingFormat.BINARY:
          try {
            encoded = this.getBinaryCodec().encode(data)
          } catch (error) {
            logger.error('Binary codec error', {
              error: error instanceof Error ? error.message : String(error),
            })
            throw error
          }
          break
        case EncodingFormat.JSON:
          try {
            encoded = this.getJsonCodec().encode(data)
          } catch (error) {
            logger.error('JSON codec error', {
              error: error instanceof Error ? error.message : String(error),
            })
            throw error
          }
          break
        case EncodingFormat.ASN1:
          try {
            encoded = this.getAsn1Codec().encode(data)
          } catch (error) {
            logger.error('ASN.1 codec error', {
              error: error instanceof Error ? error.message : String(error),
            })
            throw error
          }
          break
        default:
          throw this.createError(
            CodecError.INVALID_FORMAT,
            `Unsupported format: ${format}`,
          )
      }

      const encodingTime = Date.now() - startTime

      logger.debug('Data encoded successfully', {
        format,
        originalSize: dataSize,
        encodedSize: encoded.length,
        encodingTime,
      })

      return encoded
    } catch (error) {
      const encodingTime = Date.now() - startTime

      logger.error('Data encoding failed', {
        format,
        error: error instanceof Error ? error.message : String(error),
        encodingTime,
      })

      throw error
    }
  }

  /**
   * Decode data from the specified format
   */
  decode(
    data: Uint8Array,
    format: EncodingFormat = this.config.defaultFormat,
  ): T {
    const startTime = Date.now()

    logger.debug('Decoding data', {
      format,
      dataSize: data.length,
      enableValidation: this.config.enableValidation,
    })

    try {
      // Check data size limits
      if (data.length > this.config.maxDataSize) {
        throw this.createError(
          CodecError.DECODING_ERROR,
          'Data size exceeds maximum limit',
          {
            dataSize: data.length,
            maxSize: this.config.maxDataSize,
          },
        )
      }

      // Decode data using the appropriate format codec
      let decoded: T
      switch (format) {
        case EncodingFormat.BINARY:
          decoded = this.getBinaryCodec().decode(data)
          break
        case EncodingFormat.JSON:
          decoded = this.getJsonCodec().decode(data)
          break
        case EncodingFormat.ASN1:
          decoded = this.getAsn1Codec().decode(data)
          break
        default:
          throw this.createError(
            CodecError.INVALID_FORMAT,
            `Unsupported format: ${format}`,
          )
      }

      // Validate decoded data if validation is enabled
      if (this.config.enableValidation) {
        const validation = this.validate(decoded)
        if (!validation.isValid) {
          throw this.createError(
            CodecError.VALIDATION_ERROR,
            'Decoded data validation failed',
            {
              errors: validation.errors,
              warnings: validation.warnings,
            },
          )
        }
      }

      const decodingTime = Date.now() - startTime

      logger.debug('Data decoded successfully', {
        format,
        encodedSize: data.length,
        decodedSize: this.getDataSize(decoded),
        decodingTime,
      })

      return decoded
    } catch (error) {
      const decodingTime = Date.now() - startTime

      logger.error('Data decoding failed', {
        format,
        error: error instanceof Error ? error.message : String(error),
        decodingTime,
      })

      throw error
    }
  }

  /**
   * Validate data structure and content
   */
  validate(data: T): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Basic null/undefined check
      if (data === null || data === undefined) {
        errors.push('Data cannot be null or undefined')
        return { isValid: false, errors, warnings }
      }

      // Type-specific validation
      if (typeof data === 'object') {
        // Check for circular references
        if (this.hasCircularReferences(data)) {
          errors.push('Data contains circular references')
        }

        // Check for non-serializable values
        const nonSerializable = this.findNonSerializableValues(data)
        if (nonSerializable.length > 0) {
          const message = `Data contains non-serializable values: ${nonSerializable.join(', ')}`
          errors.push(message)
          warnings.push(message)
        }
      }

      // Size validation
      const dataSize = this.getDataSize(data)
      if (dataSize > this.config.maxDataSize) {
        errors.push(
          `Data size (${dataSize}) exceeds maximum limit (${this.config.maxDataSize})`,
        )
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      errors.push(
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      )
      return { isValid: false, errors, warnings }
    }
  }

  /**
   * Get the size of data in bytes
   */
  private getDataSize(data: T): number {
    if (data === null || data === undefined) {
      return 0
    }

    if (typeof data === 'string') {
      return new TextEncoder().encode(data).length
    }

    if (typeof data === 'number') {
      return 8 // Assume 64-bit number
    }

    if (typeof data === 'bigint') {
      return 8 // Assume 64-bit bigint
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
   * BigInt replacer for JSON serialization
   */
  private bigIntReplacer(_key: string, value: unknown): unknown {
    if (typeof value === 'bigint') {
      return `${value.toString()}n`
    }
    return value
  }

  /**
   * Check for circular references in objects
   */
  private hasCircularReferences(obj: unknown, seen = new WeakSet()): boolean {
    if (obj === null || typeof obj !== 'object') {
      return false
    }

    if (seen.has(obj as object)) {
      return true
    }

    seen.add(obj as object)

    if (Array.isArray(obj)) {
      return obj.some((item) => this.hasCircularReferences(item, seen))
    }

    return Object.values(obj as Record<string, unknown>).some((value) =>
      this.hasCircularReferences(value, seen),
    )
  }

  /**
   * Find non-serializable values in objects
   */
  private findNonSerializableValues(obj: unknown): string[] {
    const nonSerializable: string[] = []

    if (obj === null) {
      return nonSerializable
    }

    if (typeof obj === 'function') {
      nonSerializable.push('Function')
    } else if (obj instanceof Symbol) {
      nonSerializable.push('Symbol')
    } else if (obj instanceof WeakMap || obj instanceof WeakSet) {
      nonSerializable.push('WeakMap/WeakSet')
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        const itemNonSerializable = this.findNonSerializableValues(item)
        if (itemNonSerializable.length > 0) {
          nonSerializable.push(`[${index}]: ${itemNonSerializable.join(', ')}`)
        }
      })
    } else if (typeof obj === 'object') {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        const valueNonSerializable = this.findNonSerializableValues(value)
        if (valueNonSerializable.length > 0) {
          nonSerializable.push(`${key}: ${valueNonSerializable.join(', ')}`)
        }
      })
    }

    return nonSerializable
  }

  /**
   * Create a codec error with context
   */
  private createError(
    error: CodecError,
    message: string,
    context?: Record<string, unknown>,
  ): CodecErrorWithContext {
    return {
      error,
      message,
      context,
    }
  }

  /**
   * Update codec configuration
   */
  updateConfig(newConfig: Partial<CodecConfig>): void {
    this.config = { ...this.config, ...newConfig }

    // Reset codecs to use new config
    this.binaryCodec = undefined
    this.jsonCodec = undefined
    this.asn1Codec = undefined

    logger.debug('Codec configuration updated', {
      newConfig: this.config,
    })
  }

  /**
   * Get current configuration
   */
  getConfig(): CodecConfig {
    return { ...this.config }
  }
}
