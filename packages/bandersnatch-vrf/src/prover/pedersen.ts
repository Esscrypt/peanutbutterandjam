/**
 * Pedersen VRF Prover Implementation
 *
 * Implements Pedersen VRF with key hiding
 */

import type {
  ProverConfig,
  VRFInput,
  VRFProofWithOutput,
  VRFSecretKey,
} from '../types'

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
