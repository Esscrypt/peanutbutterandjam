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
// Elligator2 hash-to-curve is now available in bandersnatch-vrf package
// Export curve implementations
// Temporary alias for legacy compatibility
export {
  BandersnatchCurveNoble,
  BandersnatchCurveNoble as BandersnatchCurve,
  BandersnatchNoble,
} from './curve-noble'
// VRF functionality moved to bandersnatch-vrf package
