/**
 * Decoding Validation Implementation
 *
 * Validation for erasure coding decoding operations
 */

import type { ValidationResult } from '../types'
import type { DecodingValidator, ValidationConfig } from './types'
import { DEFAULT_VALIDATION_CONFIG } from './types'

/**
 * Decoding validation implementation
 */
export class DecodingValidation implements DecodingValidator {
  private readonly config: ValidationConfig

  constructor(config: Partial<ValidationConfig> = {}) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config }
  }

  /**
   * Validate decoding parameters
   */
  validateParameters(k: number, receivedCount: number): ValidationResult {
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

    // Validate received count
    if (!Number.isInteger(receivedCount) || receivedCount < 0) {
      errors.push(
        `Invalid received count: ${receivedCount}. Must be a non-negative integer.`,
      )
    }

    if (receivedCount < k) {
      errors.push(
        `Received count (${receivedCount}) is less than required k (${k}) for decoding`,
      )
    }

    if (receivedCount > this.config.maxShardCount) {
      errors.push(
        `Received count (${receivedCount}) exceeds maximum shard count (${this.config.maxShardCount})`,
      )
    }

    // Check for optimal recovery
    if (receivedCount === k) {
      warnings.push(
        'Received exactly k shards. No redundancy available for error correction.',
      )
    }

    if (receivedCount > k * 2) {
      warnings.push(
        `Received ${receivedCount} shards for k=${k}. Consider using fewer shards for efficiency.`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate received shards
   */
  validateReceivedShards(
    shards: Uint8Array[],
    indices: number[],
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config.enableDataValidation) {
      return { isValid: true, errors, warnings }
    }

    // Check for null/undefined arrays
    if (!Array.isArray(shards)) {
      errors.push('Shards must be an array')
      return { isValid: false, errors, warnings }
    }

    if (!Array.isArray(indices)) {
      errors.push('Indices must be an array')
      return { isValid: false, errors, warnings }
    }

    // Check array lengths
    if (shards.length === 0) {
      errors.push('No shards provided for decoding')
    }

    if (indices.length === 0) {
      errors.push('No indices provided for decoding')
    }

    if (shards.length !== indices.length) {
      errors.push(
        `Shard count (${shards.length}) does not match index count (${indices.length})`,
      )
    }

    // Validate individual shards and indices
    for (let i = 0; i < shards.length; i++) {
      const shard = shards[i]
      const index = indices[i]

      // Validate shard
      if (!(shard instanceof Uint8Array)) {
        errors.push(`Shard ${i} is not a Uint8Array`)
      }

      if (shard && shard.length === 0) {
        warnings.push(`Shard ${i} is empty`)
      }

      // Validate index
      if (!Number.isInteger(index) || index < 0) {
        errors.push(`Invalid index ${index} for shard ${i}`)
      }

      if (index >= 1023) {
        errors.push(`Index ${index} exceeds maximum validator index (1022)`)
      }
    }

    // Check for duplicate indices
    const uniqueIndices = new Set(indices)
    if (uniqueIndices.size !== indices.length) {
      errors.push('Duplicate indices found in received shards')
    }

    // Check shard size consistency
    if (shards.length > 1) {
      const firstSize = shards[0]?.length || 0
      for (let i = 1; i < shards.length; i++) {
        if (shards[i]?.length !== firstSize) {
          warnings.push(
            `Shard ${i} has different size (${shards[i]?.length}) than first shard (${firstSize})`,
          )
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate decoded data
   */
  validateDecodedData(
    originalData: Uint8Array,
    decodedData: Uint8Array,
  ): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!this.config.enableDataValidation) {
      return { isValid: true, errors, warnings }
    }

    // Check for null/undefined data
    if (!originalData) {
      errors.push('Original data is null or undefined')
    }

    if (!decodedData) {
      errors.push('Decoded data is null or undefined')
    }

    if (!originalData || !decodedData) {
      return { isValid: false, errors, warnings }
    }

    // Check data sizes
    if (originalData.length !== decodedData.length) {
      errors.push(
        `Original data length (${originalData.length}) does not match decoded data length (${decodedData.length})`,
      )
    }

    if (decodedData.length === 0) {
      warnings.push('Decoded data is empty')
    }

    if (decodedData.length > this.config.maxDataSize) {
      errors.push(
        `Decoded data size (${decodedData.length}) exceeds maximum allowed size (${this.config.maxDataSize})`,
      )
    }

    // Check data integrity (byte-by-byte comparison)
    if (originalData.length === decodedData.length) {
      let differences = 0
      for (let i = 0; i < originalData.length; i++) {
        if (originalData[i] !== decodedData[i]) {
          differences++
        }
      }

      if (differences > 0) {
        errors.push(
          `Data integrity check failed: ${differences} bytes differ between original and decoded data`,
        )
      }
    }

    // Check for padding issues
    if (decodedData.length > 0 && decodedData.length % 684 !== 0) {
      warnings.push(
        `Decoded data length (${decodedData.length}) is not a multiple of 684 bytes. May contain padding.`,
      )
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
