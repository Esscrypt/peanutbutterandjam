/**
 * Validation Types
 *
 * Types for erasure coding validation
 */

import type { EncodedData, ValidationResult } from '../types'

/**
 * Encoding validation interface
 */
export interface EncodingValidator {
  /** Validate encoding parameters */
  validateParameters(k: number, n: number): ValidationResult
  /** Validate input data */
  validateInputData(data: Uint8Array): ValidationResult
  /** Validate encoded data structure */
  validateEncodedData(encodedData: EncodedData): ValidationResult
}

/**
 * Decoding validation interface
 */
export interface DecodingValidator {
  /** Validate decoding parameters */
  validateParameters(k: number, receivedCount: number): ValidationResult
  /** Validate received shards */
  validateReceivedShards(
    shards: Uint8Array[],
    indices: number[],
  ): ValidationResult
  /** Validate decoded data */
  validateDecodedData(
    originalData: Uint8Array,
    decodedData: Uint8Array,
  ): ValidationResult
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Enable parameter validation */
  enableParameterValidation: boolean
  /** Enable data validation */
  enableDataValidation: boolean
  /** Enable structure validation */
  enableStructureValidation: boolean
  /** Maximum data size */
  maxDataSize: number
  /** Minimum shard count */
  minShardCount: number
  /** Maximum shard count */
  maxShardCount: number
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  enableParameterValidation: true,
  enableDataValidation: true,
  enableStructureValidation: true,
  maxDataSize: 1024 * 1024 * 100, // 100MB
  minShardCount: 1,
  maxShardCount: 1023,
}
