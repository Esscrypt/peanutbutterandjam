/**
 * VRF (Verifiable Random Function) Types for JAM Protocol
 *
 * Core types for Bandersnatch VRF implementation
 * Reference: Gray Paper VRF specifications
 */

import type { Bytes } from './core'

/**
 * VRF secret key
 */
export interface VRFSecretKey {
  bytes: Bytes
}

/**
 * VRF public key
 */
export interface VRFPublicKey {
  bytes: Bytes
}

/**
 * VRF input message
 */
export interface VRFInput {
  message: Bytes
}

/**
 * VRF output
 */
export interface VRFOutput {
  gamma: Bytes
  hash: Bytes
}

/**
 * VRF proof
 */
export interface VRFProof {
  bytes: Bytes
}

/**
 * VRF proof with output
 */
export interface VRFProofWithOutput {
  output: VRFOutput
  proof: VRFProof
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
  publicKeys: VRFPublicKey[]
  /** Ring size */
  size: number
  /** Ring commitment */
  commitment: Bytes
}

/**
 * Ring VRF proof structure
 */
export interface RingVRFProof {
  /** Zero-knowledge proof of ring membership */
  zkProof: Bytes
  /** Commitment to the prover's position */
  positionCommitment: Bytes
  /** Ring signature */
  ringSignature: Bytes
  /** Auxiliary proof data */
  auxData?: Bytes
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
export interface RingVRFInput extends VRFInput {
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
  ringCommitment: Bytes
  /** Position commitment */
  positionCommitment: Bytes
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
