/**
 * Encoding Validation Implementation
 *
 * Validation for erasure coding encoding operations
 */

import type { EncodedData, ValidationResult } from '../types'
import type { EncodingValidator, ValidationConfig } from './types'
import { DEFAULT_VALIDATION_CONFIG } from './types'

/**
 * Encoding validation implementation
 */
export class EncodingValidation implements EncodingValidator {
  private readonly config: ValidationConfig

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config }
  }

  /**
   * Validate encoding parameters
   */
  validateParameters(k: number, n: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config.enableParameterValidation) {
      return { isValid: true, errors, warnings }
    }

    // Validate k parameter
    if (!Number.isInteger(k) || k <= 0) {
      errors.push(`Invalid k parameter: ${k}. Must be a positive integer.`)
    }

    if (k < this.config.minShardCount) {
      errors.push(
        `k (${k}) is below minimum shard count (${this.config.minShardCount})`,
      )
    }

    if (k > this.config.maxShardCount) {
      errors.push(
        `k (${k}) exceeds maximum shard count (${this.config.maxShardCount})`,
      )
    }

    // Validate n parameter
    if (!Number.isInteger(n) || n <= 0) {
      errors.push(`Invalid n parameter: ${n}. Must be a positive integer.`)
    }

    if (n < this.config.minShardCount) {
      errors.push(
        `n (${n}) is below minimum shard count (${this.config.minShardCount})`,
      )
    }

    if (n > this.config.maxShardCount) {
      errors.push(
        `n (${n}) exceeds maximum shard count (${this.config.maxShardCount})`,
      )
    }

    // Validate relationship between k and n
    if (k >= n) {
      errors.push(`k (${k}) must be less than n (${n}) for erasure coding`)
    }

    // Check for optimal parameters
    if (n !== 1023) {
      warnings.push(
        `Non-standard n value: ${n}. Standard JAM protocol uses n=1023.`,
      )
    }

    if (k !== 342 && k !== 6) {
      warnings.push(
        `Non-standard k value: ${k}. Standard JAM protocol uses k=342 for blobs or k=6 for segments.`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate input data
   */
  validateInputData(data: Uint8Array): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config.enableDataValidation) {
      return { isValid: true, errors, warnings }
    }

    // Check for null/undefined data
    if (!data) {
      errors.push('Input data is null or undefined')
      return { isValid: false, errors, warnings }
    }

    // Check data size
    if (data.length === 0) {
      errors.push('Input data is empty')
    }

    if (data.length > this.config.maxDataSize) {
      errors.push(
        `Data size (${data.length}) exceeds maximum allowed size (${this.config.maxDataSize})`,
      )
    }

    // Check if data length is a multiple of 684 bytes (342 words * 2 bytes per word)
    if (data.length % 684 !== 0) {
      warnings.push(
        `Data length (${data.length}) is not a multiple of 684 bytes. Padding may be required.`,
      )
    }

    // Check for potential issues
    if (data.length < 684) {
      warnings.push(
        `Data length (${data.length}) is very small. Consider if erasure coding is necessary.`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate encoded data structure
   */
  validateEncodedData(encodedData: EncodedData): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config.enableStructureValidation) {
      return { isValid: true, errors, warnings }
    }

    // Check for null/undefined encoded data
    if (!encodedData) {
      errors.push('Encoded data is null or undefined')
      return { isValid: false, errors, warnings }
    }

    // Validate basic structure
    if (!Array.isArray(encodedData.shards)) {
      errors.push('Encoded data shards must be an array')
    }

    if (!Array.isArray(encodedData.indices)) {
      errors.push('Encoded data indices must be an array')
    }

    if (encodedData.shards.length !== encodedData.indices.length) {
      errors.push(
        `Shard count (${encodedData.shards.length}) does not match index count (${encodedData.indices.length})`,
      )
    }

    // Validate shard count
    if (encodedData.shards.length < encodedData.k) {
      errors.push(
        `Shard count (${encodedData.shards.length}) is less than required k (${encodedData.k})`,
      )
    }

    if (encodedData.shards.length > encodedData.n) {
      errors.push(
        `Shard count (${encodedData.shards.length}) exceeds maximum n (${encodedData.n})`,
      )
    }

    // Validate individual shards
    for (let i = 0; i < encodedData.shards.length; i++) {
      const shard = encodedData.shards[i]
      const index = encodedData.indices[i]

      if (!(shard instanceof Uint8Array)) {
        errors.push(`Shard ${i} is not a Uint8Array`)
      }

      if (!Number.isInteger(index) || index < 0 || index >= encodedData.n) {
        errors.push(`Invalid index ${index} for shard ${i}`)
      }

      if (shard && shard.length === 0) {
        warnings.push(`Shard ${i} is empty`)
      }
    }

    // Check for duplicate indices
    const uniqueIndices = new Set(encodedData.indices)
    if (uniqueIndices.size !== encodedData.indices.length) {
      errors.push('Duplicate indices found in encoded data')
    }

    // Validate original length
    if (encodedData.originalLength < 0) {
      errors.push('Original length cannot be negative')
    }

    if (encodedData.originalLength > this.config.maxDataSize) {
      errors.push(
        `Original length (${encodedData.originalLength}) exceeds maximum allowed size`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
