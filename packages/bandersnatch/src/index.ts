/**
 * Bandersnatch Curve Package
 *
 * This package provides the core Bandersnatch elliptic curve implementation
 * with all necessary operations for cryptographic applications.
 */

// Export types
export type { CurvePoint } from '@pbnj/types'
// Export curve parameters
export { BANDERSNATCH_PARAMS } from './config'
// Export Elligator2 hash-to-curve
export { elligator2HashToCurve } from './crypto/elligator2'
// Export curve implementations
export { BandersnatchCurve } from './curve'
export { BandersnatchCurveNoble, BandersnatchNoble } from './curve-noble'
export type { BandersnatchVRFOutput, BandersnatchVRFProof } from './sign'
export { signMessage, verifySignature, vrfOutputToHash } from './sign'
