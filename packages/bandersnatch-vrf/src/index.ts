/**
 * Bandersnatch VRF Package
 *
 * Implements Verifiable Random Functions on the Bandersnatch curve
 * Reference: submodules/bandersnatch-vrf-spec/
 */

// Re-export from bandersnatch package
export { BANDERSNATCH_PARAMS, BandersnatchCurve } from '@pbnj/bandersnatch'

// Prover exports
export * from './prover'
// Main exports for easy importing
export {
  IETFVRFProver,
  RingVRFProver,
} from './prover'
// Verifier exports
export * from './verifier'
export {
  IETFVRFVerifier,
  PedersenVRFVerifier,
  RingVRFVerifier,
} from './verifier'
