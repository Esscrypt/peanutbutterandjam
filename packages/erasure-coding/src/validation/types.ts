/**
 * Validation Types
 *
 * Types for erasure coding validation
 */

import type { EncodedData, ErasureCodingValidationResult } from '@pbnj/types'

/**
 * Encoding validation interface
 */
export interface EncodingValidator {
  /** Validate encoding parameters */
  validateParameters(k: number, n: number): ErasureCodingValidationResult
  /** Validate input data */
  validateInputData(data: Uint8Array): ErasureCodingValidationResult
  /** Validate encoded data structure */
  validateEncodedData(encodedData: EncodedData): ErasureCodingValidationResult
}

/**
 * Decoding validation interface
 */
export interface DecodingValidator {
  /** Validate decoding parameters */
  validateParameters(
    k: number,
    receivedCount: number,
  ): ErasureCodingValidationResult
  /** Validate received shards */
  validateReceivedShards(
    shards: Uint8Array[],
    indices: number[],
  ): ErasureCodingValidationResult
  /** Validate decoded data */
  validateDecodedData(
    originalData: Uint8Array,
    decodedData: Uint8Array,
  ): ErasureCodingValidationResult
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
