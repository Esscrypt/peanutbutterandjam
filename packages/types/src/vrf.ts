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
 * VRF output
 */
export interface VRFOutput {
  gamma: Uint8Array
  hash: Uint8Array
}

/**
 * VRF proof with output
 */
export interface VRFProofWithOutput {
  output: VRFOutput
  proof: Uint8Array
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

/**
 * Ring VRF specific types
 */

/**
 * Ring VRF ring structure
 */
export interface RingVRFRing {
  /** Public keys in the ring */
  publicKeys: Uint8Array[]
  /** Ring size */
  size: number
  /** Ring commitment */
  commitment: Uint8Array
}

/**
 * Ring VRF proof structure
 */
export interface RingVRFProof {
  /** Zero-knowledge proof of ring membership */
  zkProof: Uint8Array
  /** Commitment to the prover's position */
  positionCommitment: Uint8Array
  /** Ring signature */
  ringSignature: Uint8Array
  /** Auxiliary proof data */
  auxData?: Uint8Array
}

/**
 * Ring VRF parameters
 */
export interface RingVRFParams {
  /** Ring size */
  ringSize: number
  /** Security parameter */
  securityParam: number
  /** Hash function identifier */
  hashFunction: string
}

/**
 * Ring VRF input with ring context
 */
export interface RingVRFInput {
  /** Ring of public keys */
  ring: RingVRFRing
  /** Prover's position in the ring (0-indexed) */
  proverIndex: number
  /** Ring parameters */
  params: RingVRFParams
}

/**
 * Ring VRF output with anonymity guarantees
 */
export interface RingVRFOutput extends VRFOutput {
  /** Ring commitment */
  ringCommitment: Uint8Array
  /** Position commitment */
  positionCommitment: Uint8Array
  /** Anonymity set size */
  anonymitySetSize: number
}

/**
 * Ring VRF proof with output
 */
export interface RingVRFProofWithOutput {
  output: RingVRFOutput
  proof: RingVRFProof
}
