/**
 * Pedersen VRF Prover Implementation
 *
 * Implements Pedersen VRF proving with key hiding
 */

import type {
  VRFInput,
  VRFProofWithOutput,
  VRFSecretKey,
} from '@pbnj/types'
import type { ProverConfig } from './types'

/**
 * Pedersen VRF Prover
 * Implements Pedersen VRF with key hiding
 */
export class PedersenVRFProver {
  /**
   * Generate Pedersen VRF proof
   */
  static prove(
    _secretKey: VRFSecretKey,
    _input: VRFInput,
    _auxData?: Uint8Array,
    _config?: ProverConfig,
  ): VRFProofWithOutput {
    // TODO: Implement Pedersen VRF
    throw new Error('Pedersen VRF not yet implemented')
  }
}
