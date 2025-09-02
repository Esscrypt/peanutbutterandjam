/**
 * Bandersnatch VRF Package
 *
 * Implements Verifiable Random Functions on the Bandersnatch curve
 * Reference: submodules/bandersnatch-vrf-spec/
 */

export * from './config'
export * from './curve'
export { BandersnatchCurve } from './curve'

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
