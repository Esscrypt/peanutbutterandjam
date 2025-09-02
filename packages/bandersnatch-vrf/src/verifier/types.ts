/**
 * Verifier-specific types for Bandersnatch VRF
 */

import type { VRFOutput } from '@pbnj/types'

/**
 * Verifier configuration options
 */
export interface VerifierConfig {
  /** Whether to use auxiliary data */
  useAuxData?: boolean
  /** Custom hash function for H1 */
  hashToCurve?: (message: Uint8Array) => Uint8Array
  /** Custom hash function for H2 */
  hashOutput?: (gamma: Uint8Array) => Uint8Array
  /** Strict verification mode */
  strictMode?: boolean
}

/**
 * Verification result with metadata
 */
export interface VerificationResult {
  /** Whether verification was successful */
  isValid: boolean
  /** Verification time in milliseconds */
  verificationTime: number
  /** Error message if verification failed */
  error?: string
  /** Verification metadata */
  metadata?: {
    /** Scheme used for verification */
    scheme: string
    /** Whether auxiliary data was used */
    usedAuxData: boolean
    /** Configuration used */
    config: VerifierConfig
  }
}

/**
 * Batch verification input
 */
export interface BatchVerificationInput {
  /** Public key */
  publicKey: Uint8Array
  /** Input message */
  input: Uint8Array
  /** VRF output */
  output: VRFOutput
  /** VRF proof */
  proof: Uint8Array
  /** Auxiliary data */
  auxData?: Uint8Array
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  /** Overall verification result */
  isValid: boolean
  /** Individual verification results */
  results: VerificationResult[]
  /** Number of successful verifications */
  successCount: number
  /** Number of failed verifications */
  failureCount: number
  /** Total verification time */
  totalTime: number
}
