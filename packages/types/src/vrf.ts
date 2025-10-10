/**
 * VRF (Verifiable Random Function) Types for JAM Protocol
 *
 * Core types for Bandersnatch VRF implementation
 * Reference: Gray Paper VRF specifications
 */

export interface CurvePoint {
  x: bigint
  y: bigint
  isInfinity: boolean
}

/**
 * VRF schemes
 */
export enum VRFScheme {
  IETF = 'IETF',
  PEDERSEN = 'PEDERSEN',
  RING = 'RING',
}

/**
 * VRF error types
 */
export enum VRFError {
  INVALID_KEY = 'INVALID_KEY',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_PROOF = 'INVALID_PROOF',
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  CURVE_ERROR = 'CURVE_ERROR',
  HASH_ERROR = 'HASH_ERROR',
}

export interface RingVRFInput {
  /** VRF input data */
  input: Uint8Array
  /** Additional data (not affecting VRF output) */
  auxData?: Uint8Array
  /** Ring of public keys */
  ringKeys: Uint8Array[]
  /** Prover's key index in the ring */
  proverIndex: number
}

export interface RingVRFOutput {
  /** VRF output hash */
  hash: Uint8Array
  /** VRF output point (gamma) */
  point: Uint8Array
}

export interface RingVRFProof {
  /** Pedersen VRF proof components */
  pedersenProof: Uint8Array
  /** Ring commitment (KZG commitment to ring polynomial) */
  ringCommitment: Uint8Array
  /** Ring membership proof (KZG proof) */
  ringProof: Uint8Array
  /** Prover index (for verification, not revealed in anonymous version) */
  proverIndex?: number
}

export interface RingVRFResult {
  /** VRF output */
  output: RingVRFOutput
  /** Ring VRF proof */
  proof: RingVRFProof
}
