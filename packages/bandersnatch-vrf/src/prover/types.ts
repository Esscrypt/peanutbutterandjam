/**
 * Prover-specific types for Bandersnatch VRF
 */

import type { VRFProofWithOutput } from '@pbnj/types'

/**
 * Prover configuration options
 */
export interface ProverConfig {
  /** Whether to use auxiliary data */
  useAuxData?: boolean
  /** Custom hash function for H1 */
  hashToCurve?: (message: Uint8Array) => Uint8Array
  /** Custom hash function for H2 */
  hashOutput?: (gamma: Uint8Array) => Uint8Array
}

/**
 * Prover state for batch operations
 */
export interface ProverState {
  /** Current secret key */
  secretKey: Uint8Array
  /** Configuration options */
  config: ProverConfig
  /** Internal state for optimization */
  cachedValues?: Map<string, Uint8Array>
}

/**
 * Prover result with metadata
 */
export interface ProverResult extends VRFProofWithOutput {
  /** Generation time in milliseconds */
  generationTime: number
  /** Whether auxiliary data was used */
  usedAuxData: boolean
  /** Prover configuration used */
  config: ProverConfig
}
